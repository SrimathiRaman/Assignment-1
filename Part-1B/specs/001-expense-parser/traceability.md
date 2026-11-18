# Expense Parser Traceability

Dataset IDs below are the required stable IDs for `evals/dataset.json`:

- **E001-E002**: normal add (yesterday and omitted date/today).
- **E003-E006**: boundary amounts 1, 1,000,000, 0, and 1,000,001.
- **E007-E011**: ambiguous amount, missing amount, multiple expenses, other currency,
  and future date.
- **E012-E013**: empty and malformed/garbled expense input.
- **E014-E016**: unrelated request, instruction override combined with expense, and
  instruction disclosure attempt.
- **E017**: ambiguous numeric date.
- **E018-E022**: valid `Other`, `Housing`, `Utilities`, `Health`, and `Entertainment`
  category assignments.

Harness layers: **S** = schema, **P** = property, **Q** = quality, **R** = run-state /
threshold decision, **A** = human approval. `N/A` means the row is checked by offline
unit or operational tests rather than a live dataset case.

| Requirement / rule | Task IDs | Source file(s) | Dataset cases | Harness layer |
|---|---|---|---|---|
| US1 - Record one clear expense | T009-T012, T016, T018 | `prompts/system.md`, `src/`, `schemas/expense-result.schema.json` | E001-E004, E018-E022 | S, P, Q |
| US2 - Clarify incomplete or unsupported expense | T013-T014, T016, T018 | `prompts/system.md`, `src/cli.js`, `.harness/evaluators.js` | E005-E013, E017 | S, P, Q |
| US3 - Refuse out-of-scope or override request | T015-T016, T018 | `prompts/system.md`, `src/cli.js`, `.harness/evaluators.js` | E014-E016 | S, P, Q |
| FR-001 | T006, T012, T018 | `src/cli.js`, `.harness/run.js` | E001, E008, E014 | S, P, Q |
| FR-002 | T003, T007, T009, T012 | `schemas/expense-result.schema.json`, `prompts/system.md`, `src/cli.js` | E001, E003-E006, E018-E022 | S, P, Q |
| FR-003 | T003, T007, T009 | `schemas/expense-result.schema.json`, `prompts/system.md` | E001, E004, E018-E022 | S, P, Q |
| FR-004 | T007, T013, T014 | `prompts/system.md`, `src/cli.js` | E005-E011, E012, E017 | S, P, Q |
| FR-005 | T007, T015 | `prompts/system.md`, `src/cli.js` | E014-E016 | S, P, Q |
| FR-006 | T003, T005, T008, T011 | `schemas/expense-result.schema.json`, `src/validation/result.js`, `.harness/evaluators.js`, `tests/evaluators.test.js` | E001, E013; malformed-output fixtures | S |
| FR-007 | T007, T012, T014 | `src/cli.js`, `prompts/system.md` | E001-E002, E011, E017 | P |
| FR-008 | T007, T009, T012 | `prompts/system.md`, `src/cli.js` | E001, E018-E022 | P, Q |
| FR-009 | T004, T006-T008, T016-T018 | `evals/dataset.json`, `.harness/`, `tests/evaluators.test.js`, `evidence/` | E001-E022 | S, P, Q, R |
| FR-010 | T004-T008, T016-T018 | `.harness/thresholds.json`, `.harness/evaluators.js`, `.harness/run.js` | E001-E022 | S, P, Q, R |
| FR-011 | T020 | `evidence/eval-results.json` | N/A | A |
| FR-012 | T006, T008, T010-T012, T016-T018 | `src/llm/openai-client.js`, `src/cli.js`, `.harness/run.js`, `tests/evaluators.test.js` | N/A; injected transport-error fixture | R |
| FR-013 | T002, T010, T012, T018 | `.gitignore`, `.env.example`, `src/llm/openai-client.js`, `src/cli.js`, `quickstart.md` | Synthetic E001 | N/A |
| FR-014 | T010, T018 | `src/llm/openai-client.js`, `contracts/cli.md`, `quickstart.md` | N/A; provider policy is external | N/A |
| OS-001 | T003, T005, T011 | `schemas/expense-result.schema.json`, `src/validation/result.js`, `.harness/evaluators.js` | E001-E022 | S |
| OS-001.1 | T003, T005, T011 | `schemas/expense-result.schema.json`, `src/validation/result.js` | E001-E006, E018-E022 | S |
| OS-001.2 | T003, T005, T013-T014 | `schemas/expense-result.schema.json`, `prompts/system.md`, `src/cli.js` | E005-E013, E017 | S |
| OS-001.3 | T003, T005, T015 | `schemas/expense-result.schema.json`, `prompts/system.md` | E014-E016 | S |
| INV-001 | T005, T008, T011-T015 | `.harness/evaluators.js`, `src/`, `prompts/system.md` | E001-E022 | S, P |
| INV-001.1 | T005, T009, T013 | `.harness/evaluators.js`, `prompts/system.md` | E007-E008, E013 | P |
| INV-001.2 | T003, T005, T011 | `schemas/expense-result.schema.json`, `src/validation/result.js` | E001, E003-E006, E018-E022 | S |
| INV-001.3 | T005, T011, T013, T015 | `schemas/expense-result.schema.json`, `src/validation/result.js`, `prompts/system.md` | E005-E016 | S, P |
| INV-001.4 | T005, T013-T015 | `.harness/evaluators.js`, `prompts/system.md`, `src/cli.js` | E009, E015 | P |
| INV-001.5 | T005, T012, T014 | `.harness/evaluators.js`, `src/cli.js` | E001-E002, E011, E017 | P |
| INV-001.6 | T005, T015 | `.harness/evaluators.js`, `prompts/system.md` | E014-E016 | P |
| PROP-001 | T005, T008-T016 | `.harness/evaluators.js`, `tests/evaluators.test.js`, `src/`, `prompts/system.md` | E001-E022 | S, P, Q |
| PROP-001.1 | T005, T008-T009 | `.harness/evaluators.js`, `tests/evaluators.test.js`, `prompts/system.md` | E001, E003-E004 | P |
| PROP-001.2 | T005, T008, T012, T014 | `.harness/evaluators.js`, `src/cli.js`, `tests/evaluators.test.js` | E001-E002, E011, E017 | P |
| PROP-001.3 | T005, T008, T013-T014 | `.harness/evaluators.js`, `prompts/system.md`, `src/cli.js` | E009, E015 | P |
| PROP-001.4 | T005, T008, T011 | `.harness/evaluators.js`, `tests/evaluators.test.js`, `src/validation/result.js` | N/A; invalid-output fixtures | S, P |
| PROP-001.5 | T005, T008, T015 | `.harness/evaluators.js`, `tests/evaluators.test.js`, `prompts/system.md` | E014-E016 | P |
| PROP-001.6 | T005-T008, T016, T018 | `.harness/evaluators.js`, `.harness/run.js`, `tests/evaluators.test.js`, `evidence/eval-results.json` | E001-E022; replay fixtures | S, P, Q, R |
| GR-001 | T004-T008, T013-T017 | `.harness/`, `evals/dataset.json`, `prompts/system.md`, `src/` | E001-E022 | P, R |
| GR-001.1 | T009, T013, T015 | `prompts/system.md` | E015-E016 | P |
| GR-001.2 | T007, T015 | `prompts/system.md` | E014-E016 | P |
| GR-001.3 | T005, T013-T014 | `.harness/evaluators.js`, `prompts/system.md`, `src/cli.js` | E005-E011, E012-E013, E017 | P |
| GR-001.4 | T005, T013-T014 | `.harness/evaluators.js`, `prompts/system.md`, `src/cli.js` | E005-E011, E012, E017 | S, P |
| GR-001.5 | T004-T008, T016-T018 | `.harness/thresholds.json`, `.harness/evaluators.js`, `evals/dataset.json` | E001-E022 | R |
| EVAL-001 | T004-T008, T016-T018 | `.harness/thresholds.json`, `.harness/evaluators.js`, `.harness/run.js` | E001-E022 | S, P, Q, R |
| EVAL-001.1 | T004-T008, T016-T018 | `.harness/thresholds.json`, `.harness/evaluators.js`, `schemas/expense-result.schema.json` | E001-E022 | S |
| EVAL-001.2 | T004-T008, T016-T018 | `.harness/thresholds.json`, `.harness/evaluators.js` | E001-E022 | P |
| EVAL-001.3 | T004-T008, T016-T018 | `.harness/thresholds.json`, `.harness/evaluators.js` | E001-E022 | Q |
| EVAL-001.4 | T005, T008, T016, T018 | `.harness/evaluators.js`, `tests/evaluators.test.js` | E001-E022 | Q |
| EVAL-001.5 | T004-T006, T008, T016-T018 | `.harness/thresholds.json`, `.harness/run.js`, `tests/evaluators.test.js` | E001-E022; transport-error fixture | R |
| SC-001 | T003, T005, T011-T012, T018 | `schemas/expense-result.schema.json`, `src/`, `.harness/evaluators.js` | E001-E006, E018-E022 | S, P |
| SC-002 | T005, T013-T015, T018 | `prompts/system.md`, `src/cli.js`, `.harness/evaluators.js` | E005-E017 | S, P |
| SC-003 | T004-T008, T016, T018 | `.harness/thresholds.json`, `.harness/`, `evidence/eval-results.json` | E001-E022 | S, P, Q, R |
| SC-004 | T007, T016-T019 | `evals/dataset.json`, `evidence/`, `traceability.md` | E001-E022 | R |
| SC-005 | T020 | `evidence/eval-results.json` | N/A | A |
