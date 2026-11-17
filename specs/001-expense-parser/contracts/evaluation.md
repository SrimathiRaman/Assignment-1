# Evaluation Contract

## Command

The single live evaluation command is:

```text
npm run evaluate
```

It reads the fixed `evals/dataset.json`, invokes the CLI per case, and runs schema
validation, requirement-mapped property checks, and quality scoring. Evaluation proceeds
sequentially to limit request bursts and preserve a clear per-case order. Thresholds
come from `.harness/thresholds.json`, are recorded before the first evaluation, and are
protected during repair.

## Per-Case Layers

- **Schema**: Validate the app's output with the same JSON Schema file used by the app.
- **Properties**: Run all property checks mapped by the case's `requirementIds`. Invalid
  output is still reported as a schema failure and does not count as a valid expense.
- **Quality**: Count exactly matching expected output fields and divide by the number of
  expected fields for that case.

## Threshold and Decision

The harness reads the fixed threshold from a single checked-in evaluator configuration:

- Schema pass rate: 100%.
- Property pass rate: 100%.
- At least 85% of cases have a quality score of 0.75 or greater.

Report `PASS` only when all thresholds are met; otherwise, a completed run is `FAIL`.
Do not lower the threshold or alter the dataset/evaluators to repair an implementation.

If the model cannot be reached, mark the affected case `LLM_ERROR`, stop further requests,
mark unattempted cases `NOT_RUN`, and report `CANT BE DETERMINED`. This is an incomplete
run, not a threshold `FAIL`.

If the app returns no result because its model response is unparseable or schema-invalid,
record a schema failure, a zero quality score, and the CLI error detail for that case.
This is a completed evaluation failure, not an `LLM_ERROR`.

## Evidence

Append each run to `evidence/eval-results.json`. Each run includes model name,
timestamp, threshold, per-case result for each layer, pass rates, and final decision.
Append completed failing cases to `evidence/failure-feedback.json` with the case, output,
failed rule ID, and quality score. Preserve prior evidence and the first implementation
before repair.
