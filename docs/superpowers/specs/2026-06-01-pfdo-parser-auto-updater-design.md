# PFDO Parser Auto-Updater Design

Date: 2026-06-01

## Goal

Build a separate Node.js module that audits PFDO program document parsing quality and automatically applies safe parser changes when the extracted database topics do not match the topics present in program documents.

The module starts from a CSV list of program IDs. For each program it compares the current `pfdo_program_calendar_topics` rows with the source document content using OpenAI. If the current parser output is acceptable, it moves to the next program. If not, it asks OpenAI to produce a constrained patch for the document parser, applies it, verifies the changed parser, and keeps the change only if validation passes.

## Existing Context

The project already has the core extraction path:

- document paths are stored in `pfdo_programs.program_document_local_path`;
- source documents live under `tmp/program_docs`;
- text extraction is handled by `services/program-topic-extractor/src/extractors`;
- calendar topic parsing is handled by `services/program-topic-extractor/src/parsers/calendar-topics.js`;
- `scripts/import-pfdo-calendar-topics.js` imports extracted rows into `pfdo_program_calendar_topics`;
- regression examples are listed in `services/program-topic-extractor/regression/checked-programs.csv`.

The new module should orchestrate and improve that existing parser path instead of replacing it.

## Architecture

Add a library module:

`services/program-topic-extractor/src/auto-update/parser-updater.js`

Add a CLI wrapper:

`scripts/update-pfdo-program-parser.js`

The CLI wrapper only parses flags, loads environment variables, and calls the library module. The library module owns CSV loading, database reads, document text extraction, OpenAI calls, patch validation, patch application, verification, rollback, and report writing.

## CLI

Primary command:

```bash
node scripts/update-pfdo-program-parser.js \
  --program-ids exports/parser_update_programs.csv \
  --apply \
  --max-attempts 2
```

Options:

- `--program-ids <path>`: CSV containing a `program_id` column.
- `--apply`: actually writes parser changes. Without this flag, the module runs in dry-run mode.
- `--max-attempts <n>`: maximum patch attempts per failed program. Default: `2`.
- `--model <model>`: optional OpenAI model override.
- `--out-dir <path>`: optional artifact directory. Default: `tmp/parser-updater`.
- `--limit <n>`: optional limit for test runs.

Required environment:

- `OPENAI_API_KEY`
- `PFDO_MIRROR_DATABASE_URL`, or fallback to the same local `pfdo_51_mirror` URL used by the calendar-topic importer.

## Data Flow

For each `program_id` from the CSV:

1. Load the program row from `pfdo_programs`.
2. Load current rows from `pfdo_program_calendar_topics`.
3. Extract document text with the existing extractor layer.
4. Run the current parser directly against the extracted text to get fresh candidate rows.
5. Ask OpenAI to evaluate whether the database/parser topics match the document topics.
6. If OpenAI returns `match=true`, write an `ok` result and continue.
7. If OpenAI returns `match=false`, request a unified diff patch for allowed parser files.
8. Validate that the patch touches only allowed files.
9. Save snapshots of touched files.
10. Apply the patch.
11. Re-run parsing for the current program.
12. Run regression checks from `services/program-topic-extractor/regression/checked-programs.csv`.
13. Keep the patch only if the current program improves and regression checks pass.
14. Otherwise restore snapshots and record a failed update.

The module does not directly update database topic rows. Database refresh stays the responsibility of `scripts/import-pfdo-calendar-topics.js`, so parser quality work remains separate from import side effects.

## OpenAI Interaction

Use two structured model calls.

The evaluation call receives:

- program metadata;
- a trimmed document excerpt focused on likely plan/table sections;
- current database topic rows;
- fresh current-parser topic rows;
- parser warnings.

It returns JSON with:

- `match`: boolean;
- `confidence`: number from `0` to `1`;
- `missing_topics`: string array;
- `extra_topics`: string array;
- `wrong_hours`: compact array of mismatches;
- `failure_mode`: short string;
- `recommended_parser_change`: short string.

The patch call is only made when `match=false` and the confidence is high enough to justify an edit. It receives:

- the evaluation result;
- the relevant source snippets from allowed parser files;
- representative document excerpt;
- current parser output;
- expected improvement criteria.

It returns a unified diff only. Non-diff text is rejected.

## Patch Safety

Allowed writable files for the first version:

- `services/program-topic-extractor/src/parsers/calendar-topics.js`

Allowed readable context can include:

- `services/program-topic-extractor/src/extractors/index.js`
- `services/program-topic-extractor/src/extractors/docx-tables.js`
- `services/program-topic-extractor/src/extractors/pdf.js`
- `scripts/import-pfdo-calendar-topics.js`
- `services/program-topic-extractor/README.md`

Safety rules:

- dry-run is the default;
- `--apply` is required for file writes;
- patch paths must match the allowed writable file list exactly;
- absolute paths and parent-directory paths are rejected;
- generated patches are stored before application;
- touched files are snapshotted before application;
- failed verification restores snapshots;
- each program has a bounded number of attempts;
- no schema, dependency, package, deployment, or unrelated source files are changed by this module.

## Verification

Current-program verification:

- re-run the existing parser on the program document;
- ask OpenAI to re-evaluate the new output against the document;
- require the new result to be `match=true` or materially better than the previous result with no new obvious extras.

Regression verification:

- load `services/program-topic-extractor/regression/checked-programs.csv`;
- re-run parser for each listed program;
- compare topic count and hour totals with the expected values in the CSV;
- fail the patch if any checked program moves outside exact expected counts or totals.

The first implementation will not invent new regression labels. It will use the existing checked CSV as the guardrail and will report when a program cannot be checked because its document is missing.

## Reports And Artifacts

Write machine-readable and spreadsheet-friendly outputs:

- `exports/parser-updater-report.csv`
- `exports/parser-updater-report.json`

Write per-program artifacts under:

`tmp/parser-updater/<program_id>/`

Artifacts include:

- evaluation request and response JSON;
- patch request and response;
- accepted or rejected patch file;
- before/after parser output;
- verification summary;
- rollback reason when applicable.

Report statuses:

- `ok`: existing topics match the document;
- `needs_update`: mismatch found in dry-run mode;
- `updated`: patch applied and verification passed;
- `reverted`: patch applied but verification failed and snapshots were restored;
- `failed`: program could not be processed.

## Error Handling

Missing program rows, missing document paths, extraction failures, invalid model JSON, invalid patches, and failed regression checks are recorded per program and do not stop the whole run. Fatal configuration errors such as missing `OPENAI_API_KEY` stop before processing starts.

OpenAI output is treated as untrusted input. JSON is parsed strictly, patches are validated before application, and file writes are limited to the allowlist.

## Tests

Add focused Node.js tests for:

- CSV `program_id` loading;
- strict model JSON parsing;
- patch allowlist validation;
- dry-run behavior;
- snapshot restore behavior;
- regression comparison logic.

Manual verification command for a small run:

```bash
node scripts/update-pfdo-program-parser.js \
  --program-ids services/program-topic-extractor/regression/checked-programs.csv \
  --limit 1
```

Manual verification command for applying changes:

```bash
node scripts/update-pfdo-program-parser.js \
  --program-ids exports/parser_update_programs.csv \
  --apply \
  --max-attempts 1
```

## Non-Goals

- Do not rewrite the parser architecture in the first version.
- Do not update PostgreSQL rows directly from the auto-updater.
- Do not deploy changes to Beget.
- Do not change topic classification tables.
- Do not allow OpenAI to edit files outside the parser allowlist.
