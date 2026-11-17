# Data Model: Expense Parser

## Expense Result

One successful parser response. It is a discriminated union with exactly one branch:

- **AddExpenseResult**
  - `intent`: literal `add_expense`
  - `expense.amountRupees`: integer from 1 through 1,000,000 inclusive
  - `expense.category`: `Food`, `Transport`, `Housing`, `Utilities`, `Health`,
    `Entertainment`, or `Other`
  - `expense.date`: valid `YYYY-MM-DD` calendar date, no later than the reference date
  - `expense.description`: non-empty string, at most 80 characters
- **ClarifyResult**
  - `intent`: literal `clarify`
  - `question`: one non-empty user-directed question
  - Does not contain `expense`
- **RefuseResult**
  - `intent`: literal `refuse`
  - `reason`: one non-empty reason
  - Does not contain `expense`

These shapes and their constraints are defined once in
`schemas/expense-result.schema.json`. Semantic checks such as relative date resolution,
no invented amount, and no partial multi-expense recording are evaluator properties in
addition to JSON Schema validation.

## Parser Input

- `sentence`: one user-provided natural-language sentence. Treat it as untrusted data.
- `referenceDate`: valid local calendar date supplied by the CLI or harness. Normal CLI
  operation defaults it to today's local date.
- `modelName`: model identifier from `OPENAI_MODEL`; used for the API request and
  evidence metadata.

The app does not persist parser inputs. An evaluation harness may persist only the
version-controlled synthetic evaluation cases and their outputs in the requested
evidence files.

## Evaluation Case

Each stable, version-controlled object in `evals/dataset.json` contains:

- `id`: stable unique identifier for failure feedback and evidence.
- `type`: one of `normal`, `boundary`, `ambiguous`, `missing_information`, `malformed`,
  or `adversarial`.
- `input`: sentence passed to the CLI.
- `referenceDate`: fixed `YYYY-MM-DD` date for deterministic date expectations.
- `expectedResult`: exact expected result conforming to the output schema.
- `requirementIds`: one or more specification IDs, including the applicable functional,
  invariant, property, or guardrail rules.

The dataset contains at least 15 cases and covers every listed type. Difficult cases are
retained during repairs. Case IDs are stable; dataset changes are outside the repair
agent's authority.

## Per-Case Evaluation Result

For each completed case, record:

- Dataset identity and input/reference-date context.
- Model output returned by the app.
- `schema`: pass/fail plus schema error details where applicable.
- `properties`: pass/fail and failed rule IDs.
- `quality`: matched expected-field count, total expected-field count, and score
  (`matched / total`).
- `status`: completed evaluation status.

For a model connectivity failure, record `status: LLM_ERROR`, the error classification,
and no fabricated output, schema result, or quality score. Cases not attempted after the
run stops have `status: NOT_RUN`.

If the app returns no result because its model response is unparseable or schema-invalid,
record `output: null`, the CLI validation error, a schema failure, and a quality score of
zero. This is a completed case failure, distinct from a connectivity error.

## Evaluation Run

An evidence run records:

- `runId` and timestamp.
- `modelName` and the fixed threshold values used.
- A result for each attempted case and the run-level schema/property pass rates.
- Quality case count at or above 0.75 and its percentage.
- `evaluationDecision`: `PASS` or `FAIL`.

Only a completed evaluation produces an `EvaluationRun`. Completed runs are appended
to `evidence/eval-results.json` so repairs do not erase the initial implementation's
results.

## Evaluation Attempt

If model connectivity prevents an evaluation from completing, record an
`EvaluationAttempt` separately in `evidence/eval-results.json`. It records an attempt
identifier, timestamp, model name, attempted case results, and
`attemptStatus: CANT BE DETERMINED`. The affected case is `LLM_ERROR`; cases not attempted
after the run stops are `NOT_RUN`. An attempt has no `evaluationDecision` and is not an
`EvaluationRun`.

## Failure Feedback

For each completed case that fails a schema, property, or quality rule, append a feedback
record to `evidence/failure-feedback.json` containing:

- The case (ID, input, reference date, expected result, and requirement IDs).
- The actual output.
- The failed rule ID.
- The quality score.

LLM connectivity errors are recorded in the run evidence as `LLM_ERROR`; they are not
quality failures and have no score.
