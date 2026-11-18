# CLI Contract

## Invocation

Normal use accepts one quoted sentence:

```text
node src/cli.js "spent 250 on lunch yesterday"
```

The optional `--reference-date YYYY-MM-DD` argument supplies an explicit date for
evaluation and reproducible manual checks. Without it, use the machine's local calendar
date.

The CLI loads `OPENAI_API_KEY` and `OPENAI_MODEL` from the environment, with local
development values loaded from an ignored `.env` file.

## Successful Output

Write exactly one JSON object to stdout using the shared
`schemas/expense-result.schema.json` schema. The object has the `add_expense`, `clarify`,
or `refuse` shape defined by OS-001. Do not print banners, progress, or diagnostics to
stdout.

`add_expense`, `clarify`, and `refuse` are successful parsing outcomes and exit with
status 0.

## Errors

- Invalid command usage or an invalid explicit reference date: explanatory message on
  stderr; nonzero exit; no JSON result.
- Missing required configuration, network/API error, provider-incomplete response,
  invalid JSON, or schema-invalid output: explicit message on stderr; nonzero exit; no
  JSON result.
- Do not automatically retry model or schema failures.
- Keep secrets and raw API authorization data out of error messages.

## Harness Invocation

The harness runs this same CLI once per evaluation case and supplies that case's
`referenceDate`. It captures stdout, stderr, and exit status; it does not duplicate
prompting, model invocation, or parsing logic.
