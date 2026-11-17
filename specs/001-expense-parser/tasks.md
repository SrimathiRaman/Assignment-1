---

description: "Implementation tasks for the Expense Parser"
---

# Tasks: Expense Parser

**Input**: Design documents from `/specs/001-expense-parser/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`,
and `quickstart.md`

**Organization**: Follow the requested order: setup, harness, dataset, evaluator unit
tests, app stories, evaluation, and verification. Every task cites specification IDs.

## Phase 1: Setup

**Purpose**: Establish the Node.js project, secret handling, and shared output contract.

- [X] T001 [P] Initialize the ESM project and `test` / `evaluate` scripts in `package.json` and `package-lock.json`; include dotenv, Ajv, ajv-formats, and Vitest dependencies. Covers FR-001, FR-010, EVAL-001.5.
- [X] T002 [P] Add `.gitignore` and a placeholder-only `.env.example` for `OPENAI_API_KEY` and `OPENAI_MODEL`; ensure `.env` is ignored and no real key is added. Covers FR-013, FR-014.
- [X] T003 [P] Define `schemas/expense-result.schema.json` with exactly the three OS-001 branches and no extra properties: amount integer 1 through 1,000,000 inclusive; category one of `Food`, `Transport`, `Housing`, `Utilities`, `Health`, `Entertainment`, `Other`; date a valid `YYYY-MM-DD` calendar date; description non-empty and at most 80 characters; clarify has one non-empty question and no expense; refuse has one non-empty reason and no expense. Leave the dynamic `date <= referenceDate` comparison to T005 and T014. Covers FR-002, FR-003, FR-006, OS-001.1, OS-001.2, OS-001.3, INV-001.2, INV-001.5.

## Phase 2: Harness Foundation

**Purpose**: Implement evaluation rules and the single harness command before creating
the dataset or application.

- [X] T004 Freeze the evaluation threshold values in `.harness/thresholds.json`: 100% schema, 100% property checks, and 85% of cases scoring at least 0.75; mark this file protected from repair edits. Covers FR-009, FR-010, GR-001.5, EVAL-001.1, EVAL-001.2, EVAL-001.3, EVAL-001.5.
- [X] T005 Implement schema, requirement-mapped property (including `date <= referenceDate`), exact-field quality, pass-rate, and completed-evaluation decision logic in `.harness/evaluators.js`, consuming `schemas/expense-result.schema.json` and `.harness/thresholds.json`. Keep the completed `evaluationDecision` to `PASS` or `FAIL`. Covers FR-006, FR-010, INV-001.1 through INV-001.6, PROP-001.1 through PROP-001.6, EVAL-001.1 through EVAL-001.5.
- [X] T006 Implement the one-command sequential harness in `.harness/run.js`; call `src/cli.js` per case, capture stdout/stderr/status, append per-layer results to `evidence/eval-results.json`, append completed failures to `evidence/failure-feedback.json`, and record `LLM_ERROR` / `NOT_RUN` for an unreachable model. Record `attemptStatus: CANT BE DETERMINED` in a separate `EvaluationAttempt` record, not an `EvaluationRun`; completed runs receive only `evaluationDecision: PASS|FAIL`. Covers FR-009, FR-010, FR-012, SC-003, SC-004, EVAL-001.1 through EVAL-001.5.

## Phase 3: Fixed Evaluation Dataset

**Purpose**: Create the protected evaluation set before app implementation.

- [X] T007 Create at least 22 stable, uniquely identified cases in `evals/dataset.json`, each with `type` in `normal`, `boundary`, `ambiguous`, `missing_information`, `malformed`, or `adversarial`, plus `input`, fixed `referenceDate`, schema-valid `expectedResult`, and applicable `requirementIds`; include the planned cases E001-E022 and retain every difficult case during repairs. Covers FR-009, FR-010, SC-003, SC-004, EVAL-001.1 through EVAL-001.5.

## Phase 4: Evaluator Unit Tests

**Purpose**: Verify the harness evaluators offline with fixed sample outputs before
implementing the app.

- [X] T008 Add and run Vitest sample-output tests in `tests/evaluators.test.js` for valid and invalid schema branches, amount/date/category properties, guardrail outcomes, exact-field scores, threshold boundaries, replay determinism for identical captured outputs, and incomplete-attempt classification; do not assert identical results from independent live model calls. Covers FR-006, FR-009, FR-010, FR-012, PROP-001.1 through PROP-001.6, GR-001.1 through GR-001.5, EVAL-001.1 through EVAL-001.5.

## Phase 5: User Story 1 - Record One Clear Expense (Priority: P1)

**Goal**: Parse one clearly stated expense and return a valid `add_expense` result.

**Independent Test**: Run E001-E004 and E018-E022 with fixed reference dates; each output
is a valid add-expense schema result with the expected amount, category, date, and
description.

**App-only boundary**: T009-T015 and T017 may edit only `src/**` and `prompts/system.md`.
They MUST NOT change `evals/dataset.json`, `.harness/**`,
`tests/evaluators.test.js`, or `.harness/thresholds.json`.

- [ ] T009 [P] [US1] Write the initial system prompt for faithful extraction of one clear expense, rupee amount, permitted category, reference date, concise supported description, and JSON-only output in `prompts/system.md`. Covers FR-001, FR-002, FR-003, FR-008, OS-001.1, INV-001.1, PROP-001.1, GR-001.1, GR-001.3.
- [ ] T010 [P] [US1] Implement the OpenAI Responses API `fetch` client in `src/llm/openai-client.js`; load `OPENAI_API_KEY` and `OPENAI_MODEL` from the process environment, apply a bounded timeout, and surface network, API, refusal, and incomplete-response outcomes without automatic retries. Covers FR-012, FR-013, FR-014.
- [ ] T011 [P] [US1] Implement the Ajv result validator in `src/validation/result.js` using `schemas/expense-result.schema.json`; reject malformed JSON, unknown properties, invalid variants, and out-of-range fields. Covers FR-006, OS-001.1, OS-001.2, OS-001.3, INV-001.2, INV-001.3, PROP-001.4.
- [ ] T012 [US1] Initialize dotenv in `src/cli.js` before reading configuration, then wire input parsing, local-date default, optional `--reference-date`, prompt, model client, result validator, JSON stdout, and explicit stderr/nonzero failures; keep all app-only boundary files unchanged. Covers FR-001, FR-002, FR-006, FR-007, FR-008, FR-012, FR-013, OS-001.1, INV-001.2, PROP-001.1, PROP-001.2.

## Phase 6: User Story 2 - Clarify Incomplete or Unsupported Expense (Priority: P1)

**Goal**: Return one clarification question and no expense when an expense cannot be
recorded faithfully.

**Independent Test**: Run E005-E011, E012-E013, and E017; verify each returns a valid
`clarify` result with no expense and exactly one question.

- [ ] T013 [P] [US2] Extend `prompts/system.md` to clarify missing or unclear amounts, multiple expenses, non-rupee currency, invalid-range amounts, and future dates without guessing or returning partial expenses. Covers FR-004, FR-007, OS-001.2, INV-001.1, INV-001.3, INV-001.4, INV-001.5, PROP-001.3, GR-001.3, GR-001.4.
- [ ] T014 [P] [US2] Extend date and result handling in `src/cli.js` so relative dates use the supplied local reference date, future add-expense results are not accepted, and clarification results contain no expense; keep all app-only boundary files unchanged. Covers FR-004, FR-007, OS-001.2, INV-001.3, INV-001.5, PROP-001.2, PROP-001.3, GR-001.3, GR-001.4.

## Phase 7: User Story 3 - Refuse Out-of-Scope or Instruction-Override Requests (Priority: P1)

**Goal**: Return a refusal with a reason for unrelated requests and instruction overrides,
including overrides combined with expense details.

**Independent Test**: Run E014-E016; verify each returns a valid `refuse` result with no
expense and a non-empty reason.

- [ ] T015 [US3] Extend `prompts/system.md` to refuse non-expense requests and attempts to ignore, reveal, or replace instructions, with refusal taking precedence over expense extraction; keep all app-only boundary files unchanged. Covers FR-005, OS-001.3, INV-001.3, INV-001.6, PROP-001.5, GR-001.1, GR-001.2.

## Phase 8: Run Evaluation

**Purpose**: Evaluate the first implementation against the fixed dataset and threshold.

- [ ] T016 Run `npm run evaluate` and inspect `evidence/eval-results.json` and `evidence/failure-feedback.json`; preserve the first implementation in a Git commit/tag before any repair. Completed runs record `evaluationDecision: PASS|FAIL`; an unreachable model produces a separate `EvaluationAttempt` with `attemptStatus: CANT BE DETERMINED`, not an evaluation-run decision. Covers FR-009, FR-010, FR-012, SC-003, SC-004, EVAL-001.1 through EVAL-001.5.

## Phase 9: Repair Application Failures

**Purpose**: Repair only app behavior identified by recorded evaluation failures.

- [ ] T017 If T016 records a completed `FAIL`, give the recorded case, output, failed rule ID, and score to the coding agent; repair only `src/**` or `prompts/system.md` and rerun `npm run evaluate` after each repair until `PASS` or escalation. Preserve the first implementation and do not edit `evals/dataset.json`, `.harness/**`, `tests/evaluators.test.js`, or `.harness/thresholds.json`. If T016 records an `EvaluationAttempt` with `attemptStatus: CANT BE DETERMINED`, restore model/config/network availability without weakening evaluation assets. Covers FR-009, FR-010, FR-012, GR-001.5, SC-004, EVAL-001.1 through EVAL-001.5.

## Phase 10: Verification and Approval

**Purpose**: Verify protected assets, final evaluation evidence, and human release
decision.

- [ ] T018 Run `npm test` and the final `npm run evaluate`; verify all layers, threshold decision, model name, and evidence append behavior in `tests/evaluators.test.js`, `evidence/eval-results.json`, and `evidence/failure-feedback.json`. Covers FR-006, FR-009, FR-010, FR-012, SC-001 through SC-004, EVAL-001.1 through EVAL-001.5.
- [ ] T019 Audit and complete the requirement-to-task, source, dataset-case, and harness-layer mappings in `specs/001-expense-parser/traceability.md`; verify every FR, OS, INV, PROP, GR, EVAL, and SC ID is present. Covers FR-001 through FR-014, OS-001.1 through OS-001.3, INV-001.1 through INV-001.6, PROP-001.1 through PROP-001.6, GR-001.1 through GR-001.5, EVAL-001.1 through EVAL-001.5, SC-001 through SC-005.
- [ ] T020 Record the human's explicit `ACCEPT` or `REJECT` with timestamp alongside the final run in `evidence/eval-results.json`; do not treat an automated `PASS` as approval. Covers FR-011, SC-005.

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001-T003; independent files may be prepared in parallel.
- **Harness (Phase 2)**: T004-T006; depends on the shared schema and project scripts.
- **Dataset (Phase 3)**: T007 depends on the harness rule IDs and output schema.
- **Evaluator Tests (Phase 4)**: T008 depends on T004-T007 and completes before app work.
- **App Stories (Phases 5-7)**: Depend on T001-T008. US2 follows US1 because both extend
  the same prompt and CLI; US3 follows US2 because it updates the shared prompt.
- **Evaluation (Phase 8)**: T016 depends on all app stories.
- **Repair (Phase 9)**: T017 depends on T016 and runs only for failures or an incomplete
  model/configuration run.
- **Verification and Approval (Phase 10)**: T018-T020 follow the final app state; human
  approval follows successful verification.

### User Story Dependencies

- **US1**: First app increment; depends on the setup, harness, dataset, and evaluator-test
  phases.
- **US2**: Depends on the US1 prompt/client/validation/CLI foundation.
- **US3**: Depends on the same CLI and prompt foundation and follows US2 to avoid
  conflicting edits to `prompts/system.md`.

### Parallel Opportunities

- **Setup**: T001, T002, and T003 operate on separate files and can run in parallel.
- **US1**: T009, T010, and T011 edit separate prompt, client, and validator files and can
  run in parallel; T012 integrates them afterward.
- **US2**: T013 and T014 edit separate prompt and CLI files and can run in parallel.
- **US3**: T015 is a single prompt change; no parallel task is needed.
- Harness, dataset, evaluator tests, evaluation, and repair remain ordered as requested.

## Parallel Example: User Story 1

```text
Task T009: Write the extraction prompt in prompts/system.md
Task T010: Implement the OpenAI fetch client in src/llm/openai-client.js
Task T011: Implement shared output validation in src/validation/result.js
```

## Parallel Example: User Story 2

```text
Task T013: Extend clarification rules in prompts/system.md
Task T014: Implement clarification/date behavior in src/cli.js
```

## Parallel Example: User Story 3

No independent parallel tasks are available: refusal behavior is a single prompt change
in `prompts/system.md` (T015).

## Implementation Strategy

### MVP First

The user-facing MVP is **User Story 1**: accept a clear single expense and return a
schema-valid `add_expense`. The protected harness, dataset, and evaluator tests are still
required prerequisites and are built before any app task.

### Requested Incremental Order

1. Setup project and shared schema.
2. Build the threshold, harness, and evidence handling.
3. Create and freeze the dataset.
4. Write and pass evaluator unit tests before app implementation.
5. Implement US1, then US2, then US3 without editing protected evaluation assets.
6. Run evaluation, repair only app files if needed, then perform final verification and
   request human approval.
