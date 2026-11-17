import 'dotenv/config';

import { randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateCase,
  getFailedRuleIds,
  summarizeRun,
  thresholds,
} from './evaluators.js';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const datasetPath = resolve(projectRoot, 'evals/dataset.json');
const cliPath = resolve(projectRoot, 'src/cli.js');
const evidenceDirectory = resolve(projectRoot, 'evidence');
const evidencePath = resolve(evidenceDirectory, 'eval-results.json');
const feedbackPath = resolve(evidenceDirectory, 'failure-feedback.json');
const datasetTypes = [
  'normal',
  'boundary',
  'ambiguous',
  'missing_information',
  'malformed',
  'adversarial',
];

export function assertNoArguments(args) {
  if (args.length > 0) {
    throw new Error('The evaluation command does not accept options.');
  }
}

function readJson(path, description) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to read ${description}: ${error.message}`, {
      cause: error,
    });
  }
}

function loadDataset() {
  const dataset = readJson(datasetPath, 'evals/dataset.json');
  if (!Array.isArray(dataset) || dataset.length < 22) {
    throw new Error('The fixed evaluation dataset must contain at least 22 cases.');
  }

  const ids = new Set();
  const types = new Set();
  for (const testCase of dataset) {
    if (
      typeof testCase.id !== 'string' ||
      ids.has(testCase.id) ||
      !datasetTypes.includes(testCase.type) ||
      typeof testCase.input !== 'string' ||
      typeof testCase.referenceDate !== 'string' ||
      !Array.isArray(testCase.requirementIds) ||
      testCase.requirementIds.length === 0
    ) {
      throw new Error('The evaluation dataset contains a malformed or duplicate case.');
    }
    ids.add(testCase.id);
    types.add(testCase.type);
  }

  if (!datasetTypes.every((type) => types.has(type))) {
    throw new Error('The evaluation dataset must retain cases of all six required types.');
  }
  for (let index = 1; index <= 22; index += 1) {
    if (!ids.has(`E${String(index).padStart(3, '0')}`)) {
      throw new Error('The fixed evaluation dataset must retain all cases E001-E022.');
    }
  }

  return dataset;
}

function loadEvidence() {
  if (!existsSync(evidencePath)) {
    return { runs: [], attempts: [] };
  }

  const evidence = readJson(evidencePath, 'evidence/eval-results.json');
  if (
    !evidence ||
    !Array.isArray(evidence.runs) ||
    !Array.isArray(evidence.attempts)
  ) {
    throw new Error('evidence/eval-results.json must contain runs and attempts arrays.');
  }
  return evidence;
}

function loadFeedback() {
  if (!existsSync(feedbackPath)) {
    return [];
  }

  const feedback = readJson(feedbackPath, 'evidence/failure-feedback.json');
  if (!Array.isArray(feedback)) {
    throw new Error('evidence/failure-feedback.json must contain a JSON array.');
  }
  return feedback;
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function sanitizeError(message) {
  return message
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, '[REDACTED]')
    .trim()
    .slice(0, 1000);
}

function parseOutput(stdout) {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return { output: null, parseError: 'The CLI produced no JSON output.' };
  }

  try {
    return { output: JSON.parse(trimmed), parseError: null };
  } catch (error) {
    return { output: null, parseError: `The CLI output was not valid JSON: ${error.message}` };
  }
}

function isConnectivityFailure(message) {
  return /LLM_ERROR|ECONNREFUSED|ECONNRESET|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|fetch failed|network (?:error|unreachable)/i.test(
    message,
  );
}

function runCli(testCase) {
  const result = spawnSync(
    process.execPath,
    [
      cliPath,
      '--reference-date',
      testCase.referenceDate,
      testCase.input,
    ],
    {
      encoding: 'utf8',
      env: process.env,
      timeout: 120000,
    },
  );

  const stderr = sanitizeError(
    [result.stderr, result.error?.message].filter(Boolean).join('\n'),
  );
  if (result.status !== 0) {
    return {
      output: null,
      stderr,
      connectivityFailure: isConnectivityFailure(stderr),
      exitCode: result.status,
    };
  }

  const parsed = parseOutput(result.stdout ?? '');
  return {
    ...parsed,
    stderr,
    connectivityFailure: false,
    exitCode: result.status,
  };
}

function makeCaseResult(testCase, cliResult) {
  const layers = evaluateCase(testCase, cliResult.output);
  return {
    id: testCase.id,
    type: testCase.type,
    input: testCase.input,
    referenceDate: testCase.referenceDate,
    requirementIds: testCase.requirementIds,
    output: cliResult.output,
    cliExitCode: cliResult.exitCode,
    ...(cliResult.stderr ? { cliError: cliResult.stderr } : {}),
    ...(cliResult.parseError ? { cliError: cliResult.parseError } : {}),
    ...layers,
    status: 'COMPLETED',
  };
}

function makeAttempt(testCases, caseResults, failedIndex, cliResult, modelName) {
  const interruptedCase = testCases[failedIndex];
  const remainingCases = testCases.slice(failedIndex + 1).map((testCase) => ({
    id: testCase.id,
    status: 'NOT_RUN',
  }));

  return {
    attemptId: randomUUID(),
    timestamp: new Date().toISOString(),
    modelName,
    attemptStatus: 'CANT BE DETERMINED',
    cases: [
      ...caseResults,
      {
        id: interruptedCase.id,
        type: interruptedCase.type,
        input: interruptedCase.input,
        referenceDate: interruptedCase.referenceDate,
        requirementIds: interruptedCase.requirementIds,
        status: 'LLM_ERROR',
        errorClassification: cliResult.stderr,
      },
      ...remainingCases,
    ],
  };
}

function makeFailureFeedback(testCase, caseResult) {
  return getFailedRuleIds(caseResult).map((failedRuleId) => ({
    case: {
      id: testCase.id,
      input: testCase.input,
      referenceDate: testCase.referenceDate,
      expectedResult: testCase.expectedResult,
      requirementIds: testCase.requirementIds,
    },
    output: caseResult.output,
    failedRuleId,
    score: caseResult.quality.score,
  }));
}

function recordAttempt(attempt) {
  const evidence = loadEvidence();
  evidence.attempts.push(attempt);
  mkdirSync(evidenceDirectory, { recursive: true });
  writeJson(evidencePath, evidence);
}

function recordRun(run, newFeedback) {
  const evidence = loadEvidence();
  const feedback = loadFeedback();
  evidence.runs.push(run);
  feedback.push(...newFeedback);
  mkdirSync(evidenceDirectory, { recursive: true });
  writeJson(evidencePath, evidence);
  writeJson(feedbackPath, feedback);
}

export function runEvaluation() {
  const dataset = loadDataset();
  if (!existsSync(cliPath)) {
    throw new Error(
      'src/cli.js is not present; complete the application tasks before running evaluation.',
    );
  }
  if (!process.env.OPENAI_MODEL) {
    throw new Error('OPENAI_MODEL must be set in the environment or .env file.');
  }

  const modelName = process.env.OPENAI_MODEL;
  const caseResults = [];
  const feedback = [];

  for (let index = 0; index < dataset.length; index += 1) {
    const testCase = dataset[index];
    const cliResult = runCli(testCase);

    if (cliResult.connectivityFailure) {
      const attempt = makeAttempt(
        dataset,
        caseResults,
        index,
        cliResult,
        modelName,
      );
      recordAttempt(attempt);
      process.stdout.write(`${JSON.stringify(attempt, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }

    const caseResult = makeCaseResult(testCase, cliResult);
    caseResults.push(caseResult);
    feedback.push(...makeFailureFeedback(testCase, caseResult));
  }

  const summary = summarizeRun(caseResults);
  const run = {
    runId: randomUUID(),
    timestamp: new Date().toISOString(),
    modelName,
    thresholds,
    cases: caseResults,
    ...summary,
  };

  recordRun(run, feedback);
  process.stdout.write(`${JSON.stringify(run, null, 2)}\n`);
}

function isDirectInvocation() {
  return (
    process.argv[1] !== undefined &&
    fileURLToPath(import.meta.url) === resolve(process.argv[1])
  );
}

if (isDirectInvocation()) {
  try {
    assertNoArguments(process.argv.slice(2));
    runEvaluation();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
