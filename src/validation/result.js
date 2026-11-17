import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const schemaPath = fileURLToPath(
  new URL('../../schemas/expense-result.schema.json', import.meta.url),
);
const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);

export class ResultValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ResultValidationError';
  }
}

export function parseAndValidateResult(text) {
  let result;
  try {
    result = JSON.parse(text);
  } catch (error) {
    throw new ResultValidationError(
      `The model returned invalid JSON: ${error.message}`,
    );
  }

  if (!validate(result)) {
    const details = (validate.errors ?? [])
      .map(({ instancePath, message }) => `${instancePath || '/'} ${message}`)
      .join('; ');
    throw new ResultValidationError(
      `The model result failed schema validation: ${details}`,
    );
  }
  return result;
}
