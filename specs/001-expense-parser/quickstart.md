# Quickstart: Expense Parser

This guide describes the planned validation flow after implementation.

## Prerequisites

- Node.js 22.12 or newer; use a supported LTS release.
- npm.
- An OpenAI API key and a model that supports JSON responses.
- Network access to the OpenAI API for live parsing and evaluation.

## Configure

1. Install dependencies:

   ```text
   npm install
   ```

2. Copy `.env.example` to `.env`.
3. Set `OPENAI_API_KEY` and `OPENAI_MODEL` in `.env`. Never commit `.env` or paste a
   populated value into source, tests, or evaluation data.

## Run Offline Evaluator Tests

```text
npm test
```

Expected: Vitest completes schema, property, and quality evaluator tests using fixed
sample outputs without making network calls.

## Parse One Expense

```text
node src/cli.js "spent 250 on lunch yesterday"
```

Expected: stdout contains one schema-valid JSON result. With today's date set to
`2026-11-17`, an accepted result uses date `2026-11-16`. Clarification and refusal
outcomes also produce one JSON object and exit successfully.

For deterministic date checks:

```text
node src/cli.js --reference-date 2026-11-17 "spent 250 on lunch yesterday"
```

## Run the Evaluation Harness

```text
npm run evaluate
```

Expected: the harness invokes the app for the dataset cases, writes results to
`evidence/eval-results.json`, and writes repair feedback to
`evidence/failure-feedback.json`. A complete run reports `PASS` or `FAIL` against the
fixed threshold. If the model cannot be reached, it records `LLM_ERROR` and reports
`CANT BE DETERMINED`. Live evaluation makes API requests and may incur provider charges.
