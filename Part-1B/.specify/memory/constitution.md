<!--
Sync Impact Report
Version change: uninitialized scaffold -> 1.0.0 (initial adoption)
Modified principles:
- PRINCIPLE_1_NAME -> I. Expense-Only CLI
- PRINCIPLE_2_NAME -> II. Faithful, Validated Extraction
- PRINCIPLE_3_NAME -> III. Separation and Secret Safety
- PRINCIPLE_4_NAME -> IV. Immutable Evaluation Standard
- PRINCIPLE_5_NAME -> V. Controlled Repair and Human Approval
Added sections: Technical Constraints; Evaluation and Release Workflow
Removed sections: none
Follow-up TODOs: Confirm the original ratification date.
-->
# Expense Parser Constitution

## Core Principles

### I. Expense-Only CLI
The product MUST be a Node.js command-line application for converting expense-related
sentences into structured expenses. It MUST NOT include a database or web UI. The
implementation MUST prefer the simplest solution that satisfies the requirements.

### II. Faithful, Validated Extraction
LLM output MUST be treated as untrusted and validated against the output schema before
it is accepted. The parser MUST never invent an amount; when an amount is missing, it
MUST ask the user for clarification rather than return a fabricated value. It MUST refuse
requests unrelated to expenses and requests that attempt to change these instructions.
These constraints preserve data integrity and keep the tool within its intended purpose.

### III. Separation and Secret Safety
Prompt construction, model invocation, and output validation MUST remain separate
responsibilities. The API key MUST be read only from environment variables and MUST NOT
be embedded in source code or committed to Git. This separation supports independent
testing and prevents accidental credential disclosure.

### IV. Immutable Evaluation Standard
Before an evaluation begins, its quality threshold MUST be set and recorded; it MUST NOT
be lowered in response to results. The evaluation dataset MUST contain at least 15 cases,
and difficult cases MUST NOT be removed. One evaluation harness MUST perform schema
validation, property checks, and quality scoring, then report an overall PASS or FAIL.
These rules make evaluation repeatable and prevent results from being tuned after the
fact.

### V. Controlled Repair and Human Approval
The first implementation MUST be preserved before any repair begins. Evaluation failures
MUST be recorded and provided to the coding agent for repair. The coding agent MUST NOT
change the dataset, evaluators, or threshold. Final approval MUST be an explicit human
ACCEPT or REJECT; automated evaluation alone is not approval.

## Technical Constraints

The runtime MUST be Node.js. The interface MUST be command-line only, with no database
or web UI. Dependencies and abstractions MUST be limited to what is needed to implement,
validate, and evaluate expense parsing.

## Evaluation and Release Workflow

Each evaluation run MUST use the same harness for schema validation, property checks,
and quality scoring, and MUST produce a PASS or FAIL result against the threshold
recorded before evaluation. A FAIL MUST preserve its failure details and trigger the
controlled repair process in Principle V. The original implementation and evaluation
assets MUST remain available for comparison. A release MUST NOT be described as
approved until a human records ACCEPT; REJECT means it is not approved.

## Governance

This constitution governs feature specifications, implementation, evaluation, and
release decisions for the Expense Parser. Amendments MUST be documented in this file,
reviewed for effects on existing requirements, and approved by the project owner before
they take effect. An amendment MUST update the version and last-amended date.

Versioning uses semantic versioning: MAJOR for incompatible changes to governing
requirements, MINOR for new principles or materially expanded requirements, and PATCH
for clarifications or non-semantic wording changes. Every specification, implementation
review, and evaluation MUST be checked against this constitution. Any exception requires
an explicit constitution amendment; evaluation failures MUST NOT be handled by weakening
the dataset, evaluators, or threshold.

**Version**: 1.0.0 | **Ratified**: 2026-11-12 | **Last Amended**: 2026-11-17
