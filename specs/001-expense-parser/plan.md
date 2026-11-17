# Implementation Plan: Expense Parser

**Branch**: `001-expense-parser` | **Date**: 2026-11-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-expense-parser/spec.md`, with
technology and evaluation constraints supplied for this planning run.

## Summary

Build a Node.js ES-module command-line parser that sends one expense sentence and its
reference date to the OpenAI API using `fetch`, then validates the returned intent
against one shared JSON Schema. Keep prompt construction, model invocation, and schema
validation separate. Build the immutable evaluation dataset and one-command harness
before the parser application; the harness invokes the CLI for every case and records
schema, property, and quality results.

## Technical Context

**Language/Version**: Node.js 22.12 or newer, ES modules; use a supported Node LTS for
the normal development and evaluation runtime.

**Primary Dependencies**: Built-in `fetch`; `dotenv` for local `.env` loading; Ajv and
`ajv-formats` for shared JSON Schema validation; Vitest for offline evaluator unit tests.
No OpenAI SDK is required.

**Storage**: No application database or persistence. The fixed dataset and generated
evaluation evidence are JSON files. The app does not persist runtime user sentences.

**Testing**: Vitest unit tests for schema, property, and quality evaluator functions
using fixed sample outputs; an opt-in live harness run uses the configured model.

**Target Platform**: Cross-platform Node.js CLI with network access to the configured
OpenAI API endpoint for live parsing and evaluation.

**Project Type**: Single command-line application with an evaluation harness.

**Performance Goals**: No throughput or latency SLA is specified. Make one model request
per input, evaluate cases sequentially, and apply a bounded request timeout.

**Constraints**: `OPENAI_API_KEY` and `OPENAI_MODEL` are loaded from an uncommitted
`.env`; `.env` MUST be ignored by Git. Use the user's exact output schema locally in both
app and harness. Return an explicit CLI error and nonzero exit status for model or schema
failures; do not retry automatically. Do not add a database or web UI.

**Scale/Scope**: One sentence per CLI invocation; at least 15 version-controlled
evaluation cases across normal, boundary, ambiguous, missing-information, malformed, and
adversarial types. The harness is a single local command and processes the dataset
sequentially.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / constraint | Gate | Plan alignment |
|---|---|---|
| I. Expense-Only CLI | PASS | Node.js CLI only; no database or web UI. |
| II. Faithful, Validated Extraction | PASS | Untrusted model output is checked against the shared schema; missing or invalid facts do not become invented expenses. |
| III. Separation and Secret Safety | PASS | Prompt, fetch client, and validator are separate; credentials and model name come from ignored `.env`, never source control. |
| IV. Immutable Evaluation Standard | PASS | Dataset has at least 15 hard-retained cases; one harness runs all three evaluation layers against the fixed threshold. |
| V. Controlled Repair and Human Approval | PASS | Preserve the first implementation and evidence before repairs; provide failure feedback; repair agent cannot change dataset, evaluator, or threshold; human records ACCEPT or REJECT. |
| Evaluation threshold | PASS | Schema 100%, property checks 100%, and at least 85% of cases score 0.75 or higher. |

No constitution violations or exceptions are required. `CANT BE DETERMINED` is an
`EvaluationAttempt` status for a connectivity-interrupted attempt, not an
`EvaluationRun` decision. Only a completed evaluation produces an `EvaluationRun`, whose
`evaluationDecision` is always `PASS` or `FAIL`. Attempts and completed runs are
recorded as distinct record types in the evidence file.

## Architecture

1. **CLI input and orchestration**: Read one sentence and an optional reference date.
   The default reference date is the machine's local date; the harness passes each
   dataset case's fixed reference date explicitly.
2. **Prompt construction**: Load the system prompt from `prompts/` and combine it with
   the sentence as untrusted input plus the reference date. Do not let sentence content
   replace system instructions.
3. **OpenAI client**: Use built-in `fetch` to call the Responses API with
   `OPENAI_API_KEY` and `OPENAI_MODEL` from the process environment. Request JSON mode,
   extract the response text, and handle HTTP errors, refusals, and incomplete responses
   explicitly.
4. **Schema validation**: Parse the model text and validate it with Ajv against the one
   JSON Schema file. Return only schema-valid results. Schema-invalid or unparseable
   output produces an error on stderr and a nonzero exit code.
5. **Evaluation harness**: One command spawns the app once per dataset case. For each
   completed response, it runs schema validation, requirement-mapped property checks,
   and exact expected-field quality scoring. It records completed runs with
   `evaluationDecision: PASS|FAIL` and interrupted attempts separately with
   `attemptStatus: CANT BE DETERMINED` in `evidence/eval-results.json`.
6. **Repair feedback**: A completed failing case is recorded with its case, output,
   failed rule ID, and score in `evidence/failure-feedback.json`. Before any repair,
   preserve the first implementation with a Git commit/tag and preserve its evaluation
   evidence. During repair, `evals/dataset.json`, `.harness/evaluators.js`, and
   `.harness/thresholds.json` are protected and are not changed by the coding agent. If
   a model request cannot reach the service, mark that case `LLM_ERROR`, stop the run,
   mark unattempted cases `NOT_RUN`, and record `attemptStatus: CANT BE DETERMINED` in a
   separate `EvaluationAttempt`; do not create an `EvaluationRun` or turn an
   infrastructure failure into a threshold FAIL or a user clarification.

The external API may return different content across live requests. Evaluator functions
are deterministic for captured inputs and outputs; each live response and model name
must be recorded so a completed run can be reproduced from its evidence. Live model
repeatability is not guaranteed by temperature settings. `PROP-001.6` applies to replay
of identical captured outputs, not to independent live requests.

### Implementation Order

1. Define the shared schema, fixed threshold file, dataset of at least 15 cases, harness
   evaluators, evidence format, and Vitest evaluator tests.
2. Verify the evaluator unit tests using fixed sample outputs before the app exists.
   The one-command harness can be wired to the CLI contract, but its live run is not
   attempted until the CLI is implemented.
3. Implement the prompt, OpenAI client, output validation, and CLI as separate modules.
4. Run the live harness, preserve the first implementation and evidence, then provide
   recorded failures to the coding agent without allowing changes to the protected
   dataset, evaluators, or threshold.
5. Require a human `ACCEPT` or `REJECT` for the final approval.

## Phase 0: Research

Research findings and decisions are recorded in [research.md](./research.md). The key
design decision is to request JSON mode and enforce the exact discriminated output schema
locally. OpenAI strict Structured Outputs does not support a root-level union schema
needed for the three exact result shapes; using JSON mode avoids maintaining a second,
transformed schema. Local validation remains mandatory.

## Phase 1: Design & Contracts

### Data Model

See [data-model.md](./data-model.md) for the result union, dataset cases, per-case
evaluation results, run summary, and failure feedback.

### Interface Contracts

- [contracts/cli.md](./contracts/cli.md) defines CLI arguments, stdout JSON, errors,
  configuration, and exit statuses.
- [contracts/evaluation.md](./contracts/evaluation.md) defines dataset inputs, evidence
  records, scoring, and evaluation outcomes.

### Quickstart

See [quickstart.md](./quickstart.md) for environment setup, unit tests, and the single
live evaluation command.

## Project Structure

### Documentation (this feature)

```text
specs/001-expense-parser/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── traceability.md
├── contracts/
│   ├── cli.md
│   └── evaluation.md
└── tasks.md                 # Created by /speckit-tasks, not this command
```

### Source Code (repository root)

```text
.env                         # Local only; ignored by Git
.env.example                 # Variable names and non-secret placeholders
.gitignore
package.json                 # ESM declaration and scripts
schemas/
└── expense-result.schema.json
prompts/
└── system.md
src/
├── cli.js                   # CLI parsing and orchestration
├── prompt/
│   └── build.js             # Prompt assembly
├── llm/
│   └── openai-client.js     # OpenAI Responses API via fetch
└── validation/
    └── result.js            # Shared schema validation
tests/
└── evaluators.test.js       # Vitest tests with sample outputs
evals/
└── dataset.json             # Fixed, version-controlled evaluation cases
.harness/
├── run.js                   # The single evaluation command entry point
├── evaluators.js            # Schema, property, and quality layers
└── thresholds.json          # Fixed before evaluation; protected during repair
evidence/
├── eval-results.json        # Completed runs: PASS/FAIL; interrupted attempts: attemptStatus CANT BE DETERMINED
└── failure-feedback.json    # Failed-case repair feedback
```

**Structure Decision**: Use one Node.js project. Keep the JSON Schema at repository
root so both `src/` and `.harness/` consume the same file. Keep app responsibilities
separate, and keep evaluator logic independently testable. The dataset is created and
reviewed before app implementation; it is not changed during repair.

### Post-Design Gate

| Check | Result |
|---|---|
| Node.js CLI only; no database or web UI | PASS |
| Prompt, model call, and output validation remain separate | PASS |
| Secrets are environment-only and excluded from Git | PASS |
| The exact same output schema is consumed by app and harness | PASS |
| Dataset and evaluator assets precede app implementation and remain protected during repair | PASS |
| Completed runs use the fixed threshold; unreachable-model interrupted attempts are recorded separately with attemptStatus CANT BE DETERMINED | PASS |
| First implementation/evidence is preserved and human approval remains required | PASS |

No post-design constitution violations or unresolved specification decisions were found.

## Complexity Tracking

No constitution violations or unnecessary architectural complexity are introduced.
