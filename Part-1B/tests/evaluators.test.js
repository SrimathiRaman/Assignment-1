import { describe, expect, it } from 'vitest';
import dataset from '../evals/dataset.json';
import schema from '../schemas/expense-result.schema.json';
import {
  checkProperties,
  evaluateCase,
  scoreQuality,
  summarizeRun,
  thresholds,
  validateSchema,
} from '../.harness/evaluators.js';
import { assertNoArguments } from '../.harness/run.js';

const validAddResult = {
  intent: 'add_expense',
  expense: {
    amountRupees: 250,
    category: 'Food',
    date: '2026-11-16',
    description: 'lunch',
  },
};

describe('shared output schema', () => {
  it('accepts each of the three exact result branches', () => {
    expect(validateSchema(validAddResult).passed).toBe(true);
    expect(
      validateSchema({
        intent: 'clarify',
        question: 'How much did you spend?',
      }).passed,
    ).toBe(true);
    expect(
      validateSchema({
        intent: 'refuse',
        reason: 'This parser only handles expenses.',
      }).passed,
    ).toBe(true);
  });

  it('rejects invalid bounds, dates, extra fields, and mixed branches', () => {
    expect(
      validateSchema({
        ...validAddResult,
        expense: { ...validAddResult.expense, amountRupees: 0 },
      }).passed,
    ).toBe(false);
    expect(
      validateSchema({
        ...validAddResult,
        expense: { ...validAddResult.expense, date: '2026-02-30' },
      }).passed,
    ).toBe(false);
    expect(validateSchema({ ...validAddResult, extra: true }).passed).toBe(false);
    expect(
      validateSchema({
        intent: 'clarify',
        question: 'How much?',
        expense: validAddResult.expense,
      }).passed,
    ).toBe(false);
  });

  it('validates every dataset expected result and retains all six case types', () => {
    const types = new Set(dataset.map((testCase) => testCase.type));
    expect(dataset).toHaveLength(22);
    expect(types).toEqual(
      new Set([
        'normal',
        'boundary',
        'ambiguous',
        'missing_information',
        'malformed',
        'adversarial',
      ]),
    );
    expect(new Set(dataset.map((testCase) => testCase.id)).size).toBe(22);
    expect(
      dataset.every(
        (testCase) =>
          testCase.requirementIds.length > 0 &&
          validateSchema(testCase.expectedResult).passed,
      ),
    ).toBe(true);
    expect(schema.oneOf).toHaveLength(3);
  });
});

describe('requirement-mapped property checks', () => {
  it('preserves a supported amount and date for a clear expense', () => {
    const testCase = dataset.find((item) => item.id === 'E001');
    const checks = checkProperties(testCase, validAddResult);

    expect(checks.passed).toBe(true);
    expect(checks.checks.every((check) => check.passed)).toBe(true);
  });

  it('fails a future-date property', () => {
    const testCase = dataset.find((item) => item.id === 'E001');
    const output = {
      ...validAddResult,
      expense: { ...validAddResult.expense, date: '2026-11-18' },
    };

    expect(checkProperties(testCase, output).checks).toContainEqual({
      ruleId: 'INV-001.5',
      passed: false,
    });
  });

  it('requires clarification for missing details and refuses adversarial inputs', () => {
    const missingCase = dataset.find((item) => item.id === 'E008');
    const adversarialCase = dataset.find((item) => item.id === 'E015');

    expect(
      checkProperties(missingCase, {
        intent: 'add_expense',
        expense: validAddResult.expense,
      }).passed,
    ).toBe(false);
    expect(
      checkProperties(adversarialCase, {
        intent: 'add_expense',
        expense: validAddResult.expense,
      }).passed,
    ).toBe(false);
  });

  it('requires exactly one question in a clarification result', () => {
    const testCase = dataset.find((item) => item.id === 'E008');
    const output = {
      intent: 'clarify',
      question: 'How much did you spend? Which currency?',
    };

    expect(
      checkProperties(testCase, output).checks.find(
        (check) => check.ruleId === 'GR-001.4',
      ).passed,
    ).toBe(false);
  });
});

describe('quality scoring and fixed decision threshold', () => {
  it('scores exact expected leaf-field matches', () => {
    expect(scoreQuality(validAddResult, validAddResult)).toEqual({
      matchedFields: 5,
      totalFields: 5,
      score: 1,
    });

    const imperfect = {
      ...validAddResult,
      expense: { ...validAddResult.expense, category: 'Other' },
    };
    expect(scoreQuality(imperfect, validAddResult)).toEqual({
      matchedFields: 4,
      totalFields: 5,
      score: 0.8,
    });
    expect(scoreQuality(null, validAddResult).score).toBe(0);
  });

  it('uses the fixed thresholds and reports only PASS or FAIL', () => {
    expect(thresholds).toEqual({
      schemaPassRate: 1,
      propertyPassRate: 1,
      qualityScoreMinimum: 0.75,
      qualityPassRateMinimum: 0.85,
    });

    const passingCases = Array.from({ length: 20 }, (_, index) => ({
      schema: { passed: true },
      properties: { passed: true },
      quality: { score: index < 17 ? 0.75 : 0.5 },
    }));
    expect(summarizeRun(passingCases).evaluationDecision).toBe('PASS');
    expect(
      summarizeRun(passingCases.slice(0, 16).concat(
        passingCases.slice(16).map((result) => ({
          ...result,
          quality: { score: 0.5 },
        })),
      )).evaluationDecision,
    ).toBe('FAIL');
    expect(
      summarizeRun(
        passingCases.map((result, index) =>
          index === 0 ? { ...result, properties: { passed: false } } : result,
        ),
      ).evaluationDecision,
    ).toBe('FAIL');
  });

  it('replays identical captured outputs deterministically and rejects bypass flags', () => {
    const testCase = dataset.find((item) => item.id === 'E001');
    const first = evaluateCase(testCase, validAddResult);
    const second = evaluateCase(testCase, validAddResult);

    expect(second).toEqual(first);
    expect(Object.keys(first)).toEqual([
      'caseId',
      'schema',
      'properties',
      'quality',
    ]);
    expect(() => assertNoArguments(['--skip-schema'])).toThrow(
      'does not accept options',
    );
    expect(() => assertNoArguments(['--force-pass'])).toThrow(
      'does not accept options',
    );
  });
});
