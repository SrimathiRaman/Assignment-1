import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RESPONSES_URL = 'https://api.openai.com/v1/responses';
const REQUEST_TIMEOUT_MS = 30000;
const schemaPath = fileURLToPath(
  new URL('../../schemas/expense-result.schema.json', import.meta.url),
);
const expenseSchema = JSON.parse(readFileSync(schemaPath, 'utf8'));

function getSchemaBranches() {
  return expenseSchema.oneOf.map(({ $ref }) => {
    const prefix = '#/definitions/';
    if (typeof $ref !== 'string' || !$ref.startsWith(prefix)) {
      throw new Error('The expense output schema contains an unsupported branch reference.');
    }

    const definition = expenseSchema.definitions[$ref.slice(prefix.length)];
    if (!definition) {
      throw new Error('The expense output schema references a missing definition.');
    }
    const branch = JSON.parse(JSON.stringify(definition));
    const intent = branch.properties?.intent;
    if (intent && Object.hasOwn(intent, 'const')) {
      intent.enum = [intent.const];
      delete intent.const;
    }
    return branch;
  });
}

const structuredOutputSchema = {
  type: 'object',
  properties: {
    result: { anyOf: getSchemaBranches() },
  },
  required: ['result'],
  additionalProperties: false,
};

export class OpenAIRequestError extends Error {
  constructor(message, kind, options = {}) {
    super(message, options);
    this.name = 'OpenAIRequestError';
    this.kind = kind;
  }
}

function extractAssistantOutput(response) {
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    throw new OpenAIRequestError(
      'The OpenAI API returned an invalid response object.',
      'incomplete',
    );
  }
  if (response.status === 'incomplete') {
    throw new OpenAIRequestError(
      'The OpenAI response was incomplete.',
      'incomplete',
    );
  }
  if (response.status !== 'completed') {
    throw new OpenAIRequestError(
      `The OpenAI response did not complete successfully (status: ${response.status ?? 'unknown'}).`,
      'incomplete',
    );
  }
  if (!Array.isArray(response.output)) {
    throw new OpenAIRequestError(
      'The OpenAI response contained no output items.',
      'incomplete',
    );
  }

  const textParts = [];
  for (const item of response.output) {
    if (
      !item ||
      typeof item !== 'object' ||
      item.type !== 'message' ||
      item.role !== 'assistant' ||
      !Array.isArray(item.content)
    ) {
      continue;
    }

    for (const content of item.content) {
      if (!content || typeof content !== 'object') {
        continue;
      }
      if (content.type === 'refusal' || typeof content.refusal === 'string') {
        return { type: 'refusal' };
      }
      if (content.type === 'output_text' && typeof content.text === 'string') {
        textParts.push(content.text);
      }
    }
  }

  if (textParts.length === 0) {
    throw new OpenAIRequestError(
      'The OpenAI response contained no assistant text.',
      'incomplete',
    );
  }
  return { type: 'text', text: textParts.join('') };
}

function unwrapStructuredOutput(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return text;
    }
    throw error;
  }

  if (
    parsed &&
    typeof parsed === 'object' &&
    !Array.isArray(parsed) &&
    Object.hasOwn(parsed, 'result') &&
    Object.keys(parsed).length === 1
  ) {
    return JSON.stringify(parsed.result);
  }
  return text;
}

export async function requestExpense(messages) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (!apiKey) {
    throw new OpenAIRequestError(
      'OPENAI_API_KEY is required.',
      'configuration',
    );
  }
  if (!model) {
    throw new OpenAIRequestError(
      'OPENAI_MODEL is required.',
      'configuration',
    );
  }

  let response;
  try {
    response = await fetch(RESPONSES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: messages,
        text: {
          format: {
            type: 'json_schema',
            name: 'expense_result',
            strict: true,
            schema: structuredOutputSchema,
          },
        },
        store: false,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new OpenAIRequestError(
      'The OpenAI request failed before a response was received.',
      'connectivity',
      { cause: error },
    );
  }

  if (!response.ok) {
    const isUnavailable = response.status === 429 || response.status >= 500;
    throw new OpenAIRequestError(
      `The OpenAI API returned HTTP ${response.status}.`,
      isUnavailable ? 'connectivity' : 'api',
    );
  }

  let responseBody;
  try {
    responseBody = await response.json();
  } catch (error) {
    throw new OpenAIRequestError(
      'The OpenAI API returned an invalid response body.',
      'incomplete',
      { cause: error },
    );
  }

  const output = extractAssistantOutput(responseBody);
  if (output.type === 'text') {
    return { ...output, text: unwrapStructuredOutput(output.text) };
  }
  return output;
}
