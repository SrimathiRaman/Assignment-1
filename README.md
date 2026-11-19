# Assignment 1 – Spec-Driven Development & Harness Engineering - AI SDLC

Both applications were specified with the GitHub Spec Kit workflow (constitution → specify → clarify → plan → tasks → analyze → implement) and validated by a harness before a final human ACCEPT/REJECT decision.

| Part | Application | Type | Harness |
| --- | --- | --- | --- |
| [Part-1A](Part-1A/) | Expense Tracker – single-page browser app, data in localStorage | Deterministic | Integrity, lint, security and spec-derived unit/contract tests |
| [Part-1B](Part-1B/) | Expense Parser – command-line tool that uses an LLM to turn a sentence into a structured expense | Non-deterministic | Schema, invariant/property and quality evaluation over multiple dataset |

## Repository structure

```text
Assignment-1/
├── README.md
├── Part-1A/
│   ├── .specify/, specs/        Spec Kit artifacts (constitution, spec, plan, tasks, contracts)
│   ├── src/, tests/             Application and spec-derived tests
│   ├── .harness/                Harness runner and configuration
│   └── evidence/                Initial/final generation, harness results, harness-log.md
└── Part-1B/
    ├── .specify/, specs/        Spec Kit artifacts
    ├── src/, prompts/, schemas/ Application, system prompt, output schema
    ├── tests/, evals/           Evaluator tests and evals/dataset.json
    ├── .harness/                Evaluation harness
    └── evidence/                Initial/final generation, eval-results.json, harness-log.md
```

## Prerequisites

- Node.js 20.19 or later and npm
- Part 1B : Node 22.12 and an OpenAI API key

## Part 1A – Expense Tracker

```powershell
cd Part-1A
npm install
npm run harness      # runs all four gates; results in evidence/harness-results/
npm test             # unit and contract tests only
npm start            # serves the app; open the address shown (usually http://localhost:3000)
```

Harness gates:

| Gate | Check |
| --- | --- |
| G0 integrity | Tests and harness files unchanged since they were approved and locked |
| G1 lint | ESLint, including function-length and complexity limits |
| G2 security | ESLint security rules, hard-coded secret scan, npm audit (high/critical) |
| G3 tests | Vitest unit and contract tests derived from the specification |

Each run writes `run-NNN.json` and `run-NNN-feedback.md` to `evidence/harness-results/`. The harness log and final human decision are in `evidence/harness-log.md`.

## Part 1B – Expense Parser

### Configure

```powershell
cd Part-1B
npm install
Copy-Item .env.example .env
```

Edit `.env` and set:

```text
OPENAI_API_KEY=<your key>
OPENAI_MODEL=<model name>
```

`.env` is ignored by Git and must never be committed.

### Run the application

```powershell
node --env-file-if-exists=.env src/cli.js --reference-date 2026-11-17 "spent 250 on lunch yesterday"
```

The result is one of three intents: `add_expense`, `clarify` or `refuse`.

### Run the evaluation harness

```powershell
npm run evaluate
```

The harness runs every case in `evals/dataset.json` through the application, then applies three layers – schema validation, invariant/property checks and quality scoring – and compares the totals with the threshold declared in the specification (schema 100%, properties 100%, at least 85% of cases with quality score ≥ 0.75). Results are appended to `evidence/eval-results.json`. If the model cannot be reached, the attempt is recorded separately as `CANT BE DETERMINED` and is never counted as a pass.

The harness log, repair history and final human decision are in `evidence/harness-log.md`.

### Data notice

Inputs are sent to the OpenAI API under its standard data policy. Use only synthetic, non-personal sample sentences.

## Results summary

| Part | Final harness result | Human decision |
| --- | --- | --- |
| 1A | PASS (run 004) | See `Part-1A/evidence/harness-log.md` |
| 1B | FAIL (run 3: schema 100%, properties 100%, quality 40.9%) | See `Part-1B/evidence/harness-log.md` |

Known limitations for each part are listed in its harness log.

## Use of AI tools

GitHub Copilot (agent mode) was used through the Spec Kit workflow to generate specification artifacts
