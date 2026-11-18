# Expense Parser

A command-line app that uses an OpenAI model to turn one expense sentence into a
validated JSON result. It has no database or web UI.

## Requirements

- Node.js 22.12 or newer
- npm
- An OpenAI API key and a model that supports Structured Outputs

## Setup

Install dependencies:

```sh
npm install
```

Copy `.env.example` to `.env`, then set `OPENAI_API_KEY` and `OPENAI_MODEL` in `.env`.
The `.env` file is ignored by Git; never commit API keys.

## Parse an expense

```sh
node src/cli.js "spent 250 on lunch yesterday"
```

The CLI uses the machine's local date as the reference date. For a reproducible date:

```sh
node src/cli.js --reference-date 2026-11-17 "spent 250 on lunch yesterday"
```

The program writes one JSON result to stdout. Results have one of these forms:

```json
{
  "intent": "add_expense",
  "expense": {
    "amountRupees": 250,
    "category": "Food",
    "date": "2026-11-16",
    "description": "lunch"
  }
}
```

```json
{ "intent": "clarify", "question": "What amount did you spend?" }
```

```json
{ "intent": "refuse", "reason": "This request is not about an expense." }
```

An expense amount must be a whole number from 1 through 1,000,000 rupees, and its date
cannot be in the future. Missing, ambiguous, unsupported, or invalid expense details
require clarification; unrelated requests and attempts to override the instructions are
refused.

## Tests and evaluation

Run the evaluator unit tests without making API calls:

```sh
npm test
```

Run the full evaluation against the fixed dataset:

```sh
npm run evaluate
```

The evaluation calls the configured model and may incur API charges. It checks output
schema, behavior properties, and quality against the fixed threshold. Results and any
failure feedback are recorded under `evidence/`. An unavailable model results in
`CANT BE DETERMINED`, not a pass or fail evaluation decision.

Do not change the dataset, evaluators, or threshold to obtain a passing result. Automated
`PASS` does not replace the required human `ACCEPT` or `REJECT` approval.

## Project layout

- `src/` — CLI, prompt construction, OpenAI client, and output validation
- `prompts/system.md` — extraction and guardrail instructions
- `schemas/expense-result.schema.json` — canonical output schema
- `evals/dataset.json` — fixed evaluation cases
- `.harness/` — evaluation runner and evaluators
- `tests/` — evaluator unit tests
- `evidence/` — evaluation results and feedback

The CLI uses OpenAI Structured Outputs and then validates the returned result against
the canonical schema. API/configuration errors, incomplete responses, and invalid model
output are reported to stderr with a nonzero exit status; the app does not automatically
retry.
