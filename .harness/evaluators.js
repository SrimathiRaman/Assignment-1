import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const schemaPath = fileURLToPath(
  new URL('../schemas/expense-result.schema.json', import.meta.url),
);
const thresholdPath = fileURLToPath(
  new URL('./thresholds.json', import.meta.url),
);
const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
const thresholdConfig = JSON.parse(readFileSync(thresholdPath, 'utf8'));

const fixedThresholds = {
  schemaPassRate: 1,
  propertyPassRate: 1,
  qualityScoreMinimum: 0.75,
  qualityPassRateMinimum: 0.85,
};

if (
  Object.keys(thresholdConfig).length !== Object.keys(fixedThresholds).length ||
  Object.entries(fixedThresholds).some(
    ([key, value]) => thresholdConfig[key] !== value,
  )
) {
  throw new Error('Threshold configuration differs from the fixed evaluation standard.');
}

export const thresholds = Object.freeze(fixedThresholds);

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);

const propertyRuleIds = new Set([
  'INV-001.1',
  'INV-001.2',
  'INV-001.3',
  'INV-001.4',
  'INV-001.5',
  'INV-001.6',
  'PROP-001.1',
  'PROP-001.2',
  'PROP-001.3',
  'PROP-001.4',
  'PROP-001.5',
  'GR-001.1',
  'GR-001.2',
  'GR-001.3',
  'GR-001.4',
]);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(value, key) {
  return isRecord(value) && Object.hasOwn(value, key);
}

function hasAmountInInput(input, amount) {
  if (typeof input !== 'string' || !Number.isInteger(amount)) {
    return false;
  }

  const normalizedInput = input.replaceAll(',', '');
  const amountPattern = new RegExp(`(^|\\D)${amount}(\\D|$)`);
  return amountPattern.test(normalizedInput);
}

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function hasOneQuestion(value) {
  return (
    typeof value === 'string' &&
    value.trim().endsWith('?') &&
    (value.match(/\?/g) ?? []).length === 1
  );
}

function matchesExpectedIntent(testCase, output, intent) {
  return (
    testCase.expectedResult?.intent === intent &&
    output?.intent === intent &&
    !hasOwn(output, 'expense')
  );
}

function checkRule(ruleId, testCase, output, schemaResult) {
  const expected = testCase.expectedResult;
  const expectedExpense = expected?.expense;
  const actualExpense = output?.expense;

  switch (ruleId) {
    case 'INV-001.1':
    case 'PROP-001.1':
      if (expected?.intent !== 'add_expense') {
        return output?.intent !== 'add_expense';
      }
      return (
        output?.intent === 'add_expense' &&
        actualExpense?.amountRupees === expectedExpense.amountRupees &&
        hasAmountInInput(testCase.input, expectedExpense.amountRupees)
      );
    case 'INV-001.2':
      return schemaResult.passed;
    case 'INV-001.3':
      return (
        !['clarify', 'refuse'].includes(output?.intent) ||
        !hasOwn(output, 'expense')
      );
    case 'INV-001.4': {
      if (!isRecord(output)) {
        return false;
      }
      const expectedKeys = {
        add_expense: ['expense', 'intent'],
        clarify: ['intent', 'question'],
        refuse: ['intent', 'reason'],
      }[output.intent];
      return (
        expectedKeys !== undefined &&
        Object.keys(output).sort().join(',') === expectedKeys.sort().join(',')
      );
    }
    case 'INV-001.5':
      return (
        output?.intent !== 'add_expense' ||
        (isValidDate(actualExpense?.date) &&
          isValidDate(testCase.referenceDate) &&
          actualExpense.date <= testCase.referenceDate)
      );
    case 'INV-001.6':
    case 'PROP-001.5':
    case 'GR-001.1':
    case 'GR-001.2':
      return expected?.intent !== 'refuse' || matchesExpectedIntent(testCase, output, 'refuse');
    case 'PROP-001.2':
      return (
        expected?.intent !== 'add_expense' ||
        (output?.intent === 'add_expense' &&
          actualExpense?.date === expectedExpense.date)
      );
    case 'PROP-001.3':
      return (
        expected?.intent === 'add_expense' ||
        (output?.intent === expected.intent && !hasOwn(output, 'expense'))
      );
    case 'PROP-001.4':
      return schemaResult.passed;
    case 'GR-001.3':
      return expected?.intent !== 'clarify' || matchesExpectedIntent(testCase, output, 'clarify');
    case 'GR-001.4':
      return (
        expected?.intent !== 'clarify' ||
        (matchesExpectedIntent(testCase, output, 'clarify') &&
          hasOneQuestion(output.question))
      );
    default:
      return false;
  }
}

export function validateSchema(output) {
  const passed = validate(output);
  const errors = passed
    ? []
    : (validate.errors ?? []).map(
        ({ instancePath, message }) => `${instancePath || '/'} ${message}`,
      );

  return { passed, errors };
}

export function checkProperties(testCase, output, schemaResult = validateSchema(output)) {
  const requestedRules = (testCase.requirementIds ?? []).filter((id) =>
    /^(INV|PROP|GR)-/.test(id),
  );
  const checks = requestedRules.map((ruleId) => ({
    ruleId,
    passed: propertyRuleIds.has(ruleId)
      ? checkRule(ruleId, testCase, output, schemaResult)
      : false,
  }));
  const unsupportedRules = requestedRules.filter(
    (ruleId) => !propertyRuleIds.has(ruleId),
  );

  if (checks.length === 0) {
    checks.push({ ruleId: 'HARNESS-PROPERTY-NONE', passed: false });
  }

  return {
    passed: checks.every((check) => check.passed),
    checks,
    unsupportedRules,
  };
}

function flattenFields(value, prefix = '') {
  if (!isRecord(value)) {
    return [{ path: prefix, value }];
  }

  return Object.entries(value).flatMap(([key, child]) =>
    flattenFields(child, prefix ? `${prefix}.${key}` : key),
  );
}

function getPath(value, path) {
  return path.split('.').reduce(
    (current, key) => (isRecord(current) ? current[key] : undefined),
    value,
  );
}

export function scoreQuality(output, expectedResult) {
  if (!isRecord(expectedResult)) {
    throw new TypeError('Expected result must be a JSON object.');
  }

  const fields = flattenFields(expectedResult);
  const matchedFields = fields.filter(
    ({ path, value }) => Object.is(getPath(output, path), value),
  ).length;

  return {
    matchedFields,
    totalFields: fields.length,
    score: fields.length === 0 ? 0 : matchedFields / fields.length,
  };
}

export function evaluateCase(testCase, output) {
  const schemaResult = validateSchema(output);
  const propertyResult = checkProperties(testCase, output, schemaResult);
  const qualityResult = scoreQuality(output, testCase.expectedResult);

  return {
    caseId: testCase.id,
    schema: schemaResult,
    properties: propertyResult,
    quality: qualityResult,
  };
}

export function summarizeRun(caseResults) {
  if (!Array.isArray(caseResults) || caseResults.length === 0) {
    throw new TypeError('A completed evaluation requires at least one case result.');
  }

  const total = caseResults.length;
  const schemaPassRate =
    caseResults.filter((result) => result.schema.passed).length / total;
  const propertyPassRate =
    caseResults.filter((result) => result.properties.passed).length / total;
  const qualityPassCount = caseResults.filter(
    (result) => result.quality.score >= thresholds.qualityScoreMinimum,
  ).length;
  const qualityPassRate = qualityPassCount / total;
  const evaluationDecision =
    schemaPassRate >= thresholds.schemaPassRate &&
    propertyPassRate >= thresholds.propertyPassRate &&
    qualityPassRate >= thresholds.qualityPassRateMinimum
      ? 'PASS'
      : 'FAIL';

  return {
    totalCases: total,
    schemaPassRate,
    propertyPassRate,
    qualityPassCount,
    qualityPassRate,
    evaluationDecision,
  };
}

export function getFailedRuleIds(caseResult) {
  const failedRuleIds = [];

  if (!caseResult.schema.passed) {
    failedRuleIds.push('OS-001');
  }
  failedRuleIds.push(
    ...caseResult.properties.checks
      .filter((check) => !check.passed)
      .map((check) => check.ruleId),
  );
  if (caseResult.quality.score < thresholds.qualityScoreMinimum) {
    failedRuleIds.push('EVAL-001.3');
  }

  return [...new Set(failedRuleIds)];
}
