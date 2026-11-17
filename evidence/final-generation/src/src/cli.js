import 'dotenv/config';

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPromptInput } from './prompt/build.js';
import { OpenAIRequestError, requestExpense } from './llm/openai-client.js';
import { parseAndValidateResult, ResultValidationError } from './validation/result.js';

function getLocalDate() {
  const now = new Date();
  const year = String(now.getFullYear()).padStart(4, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function parseArguments(args) {
  if (!Array.isArray(args) || args.length === 0) {
    throw new Error('Usage: node src/cli.js [--reference-date YYYY-MM-DD] "expense sentence"');
  }

  let referenceDate = getLocalDate();
  let sentenceArgs = args;
  if (args[0] === '--reference-date') {
    if (args.length < 3 || !isCalendarDate(args[1])) {
      throw new Error('--reference-date requires a valid YYYY-MM-DD date and one sentence.');
    }
    referenceDate = args[1];
    sentenceArgs = args.slice(2);
  } else if (args.some((argument) => argument.startsWith('--'))) {
    throw new Error('Unknown option. Use --reference-date YYYY-MM-DD if needed.');
  }

  if (sentenceArgs.length !== 1) {
    throw new Error('Provide exactly one quoted expense sentence.');
  }
  return { sentence: sentenceArgs[0], referenceDate };
}

function hasOneQuestion(question) {
  return (
    question.trim().endsWith('?') &&
    (question.match(/\?/g) ?? []).length === 1
  );
}

function getInvalidAmountClarification(text) {
  let candidate;
  try {
    candidate = JSON.parse(text);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return null;
    }
    throw error;
  }

  if (
    !candidate ||
    typeof candidate !== 'object' ||
    Array.isArray(candidate) ||
    candidate.intent !== 'add_expense'
  ) {
    return null;
  }

  const expense = candidate.expense;
  if (!expense || typeof expense !== 'object' || Array.isArray(expense)) {
    return null;
  }
  const amount = expense.amountRupees;
  if (
    typeof amount === 'number' &&
    Number.isFinite(amount) &&
    (!Number.isInteger(amount) || amount < 1 || amount > 1000000)
  ) {
    let question = 'What exact amount in rupees did you spend?';
    if (amount < 1) {
      question = 'Please provide a valid positive amount in rupees?';
    } else if (amount > 1000000) {
      question = 'Please provide an amount from 1 to 1000000 rupees?';
    }
    return {
      intent: 'clarify',
      question,
    };
  }
  return null;
}

function applyResultGuards(result, referenceDate) {
  if (
    result.intent === 'add_expense' &&
    result.expense.date > referenceDate
  ) {
    return {
      intent: 'clarify',
      question: 'What date should I use? The expense date cannot be in the future.',
    };
  }
  if (result.intent === 'clarify' && !hasOneQuestion(result.question)) {
    throw new ResultValidationError(
      'The model clarification did not contain exactly one question.',
    );
  }
  return result;
}

export async function runCli(args = process.argv.slice(2)) {
  const { sentence, referenceDate } = parseArguments(args);
  const messages = buildPromptInput(sentence, referenceDate);
  const response = await requestExpense(messages);
  if (response.type === 'refusal') {
    return {
      intent: 'refuse',
      reason: 'The model provider refused this request.',
    };
  }

  const amountClarification = getInvalidAmountClarification(response.text);
  if (amountClarification) {
    return parseAndValidateResult(JSON.stringify(amountClarification));
  }

  const result = parseAndValidateResult(response.text);
  return applyResultGuards(result, referenceDate);
}

function isDirectInvocation() {
  return (
    process.argv[1] !== undefined &&
    fileURLToPath(import.meta.url) === resolve(process.argv[1])
  );
}

if (isDirectInvocation()) {
  runCli()
    .then((result) => {
      process.stdout.write(`${JSON.stringify(result)}\n`);
    })
    .catch((error) => {
      const prefix =
        error instanceof OpenAIRequestError && error.kind === 'connectivity'
          ? 'LLM_ERROR: '
          : '';
      process.stderr.write(`${prefix}${error.message}\n`);
      process.exitCode = 1;
    });
}
