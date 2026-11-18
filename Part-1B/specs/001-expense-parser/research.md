# Research: Expense Parser

## Decisions

### Node.js runtime and ES modules

- **Decision**: Target Node.js 22.12 or newer and use `"type": "module"` in
  `package.json`; use a supported Node LTS as the normal runtime.
- **Rationale**: This supports built-in `fetch`, explicit ES module loading, and current
  Vitest requirements without adding a fetch polyfill.
- **Alternatives considered**: Older Node versions would need a fetch polyfill and may
  not meet current Vitest requirements; CommonJS is unnecessary for this project.
- **Sources**: [Node fetch](https://nodejs.org/api/globals.html#fetch),
  [Node package/module rules](https://nodejs.org/api/packages.html#type),
  [Node releases](https://nodejs.org/en/about/previous-releases),
  [Vitest getting started](https://vitest.dev/guide/).

### OpenAI API request and JSON response mode

- **Decision**: Use the OpenAI Responses API via built-in `fetch` and request JSON mode.
  Keep the canonical output contract in `schemas/expense-result.schema.json` and
  validate every parsed response locally before returning it.
- **Rationale**: The output contract is a three-branch result union with exact keys.
  OpenAI strict Structured Outputs does not allow a root-level union schema, and
  transforming the public schema into a second provider-specific schema would add
  complexity and risk drift. JSON mode provides JSON formatting; local JSON Schema
  validation remains the trust boundary.
- **Alternatives considered**: Strict Structured Outputs are preferable when the exact
  schema is supported. A transformed provider schema or a nullable envelope could fit
  API restrictions, but would create a second contract or change the required output
  shape. Plain text mode would provide weaker formatting.
- **Operational handling**: Check HTTP status, API error bodies, provider refusal, and
  incomplete responses. A provider refusal is mapped to a schema-valid `refuse` result;
  transport errors, incomplete responses, invalid JSON, and schema failures are explicit
  CLI errors with no successful result. Do not retry automatically.
- **Sources**: [Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create),
  [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs),
  [Models](https://developers.openai.com/api/docs/models).

### Shared JSON Schema validation

- **Decision**: Store one exact result schema in
  `schemas/expense-result.schema.json`; use Ajv 8 and `ajv-formats` in both the
  application and harness. Compile validators once per process.
- **Rationale**: A single schema prevents the parser and evaluator from disagreeing about
  allowed fields, intent branches, amount bounds, category values, and date shape.
  Property checks remain separate for semantic rules such as no future date and
  supported amount extraction.
- **Alternatives considered**: A hand-written validator duplicates schema rules and
  becomes harder to audit. A complete JSON Schema dialect may include keywords outside
  OpenAI's constrained response formats, so the model request uses JSON mode and local
  validation uses the full app schema.
- **Sources**: [Ajv schema languages](https://ajv.js.org/guide/schema-language.html),
  [Ajv JSON Schema drafts](https://ajv.js.org/json-schema.html),
  [JSON Schema specification](https://json-schema.org/specification).

### `.env` loading and secret handling

- **Decision**: Load dotenv configuration with `dotenv/config` in the ESM entry point.
  Read only `OPENAI_API_KEY` and `OPENAI_MODEL` from `process.env`; ignore `.env` in Git
  and provide a placeholder-only `.env.example`.
- **Rationale**: Local configuration is convenient for a CLI while the key remains out
  of source control. Existing environment variables take precedence over `.env`.
- **Alternatives considered**: Shell-exported variables alone are safer for deployment
  but less convenient for local development; committing populated dotenv files is
  prohibited.
- **Sources**: [dotenv usage](https://github.com/motdotla/dotenv#usage),
  [Git ignore](https://git-scm.com/docs/gitignore),
  [OpenAI production best practices](https://developers.openai.com/api/docs/guides/production-best-practices).

### Evaluator tests and live evaluation

- **Decision**: Use Vitest for deterministic evaluator unit tests with fixed sample
  outputs. Keep real API calls in the explicit `npm run evaluate` harness only.
- **Rationale**: Schema, property, and quality calculations can be tested offline and
  repeatably. A live model call can vary even when the model name and request are fixed,
  so it is inappropriate as a unit-test oracle.
- **Alternatives considered**: Running a live model in every unit test adds cost,
  network flakiness, and non-deterministic failures. Evaluator tests alone cannot replace
  the required live quality evaluation.
- **Sources**: [Vitest test organization](https://vitest.dev/guide/learn/writing-tests),
  [Vitest features](https://vitest.dev/guide/features),
  [Structured Outputs edge cases](https://developers.openai.com/api/docs/guides/structured-outputs).

## Evaluation State Decision

- A completed harness run is `PASS` only when all fixed thresholds are met; otherwise it
  is `FAIL`.
- If the model cannot be reached, the affected case is `LLM_ERROR`, remaining cases are
  `NOT_RUN`, and the incomplete run is `CANT BE DETERMINED`. It is not a completed
  evaluation and does not count as a threshold failure.
- Record each model response and evaluation layer result. Deterministic evaluator
  functions permit replay of a captured run; separate live runs are not guaranteed to
  produce identical model outputs.
