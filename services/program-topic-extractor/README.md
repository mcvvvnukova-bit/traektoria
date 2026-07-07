# Program Topic Extractor

Offline `Node.js` service for extracting raw topic lists from local program files.

## What it does

- Reads a local manifest that maps program metadata to local files.
- Extracts text from `pdf`, `doc`, `docx`, `txt`, `md`, `html`, and `rtf`.
- Searches the extracted text for topic-like sections such as:
  - `Учебно-тематический план`
  - `Содержание программы`
  - `Перечень изучаемых разделов`
  - `Тема 1`
  - `1.1 ...`
- Writes a flat raw-topic export to `CSV` and `JSON`.

The service does **not** normalize or classify topics.

## Calendar-topic import to PostgreSQL

For the local PFDO mirror, use the repository-level importer:

```bash
node scripts/import-pfdo-calendar-topics.js --concurrency 4
```

It reads local document paths from `pfdo_programs.program_document_local_path`, extracts calendar-topic rows from explicit planning tables, and writes normalized rows to `pfdo_program_calendar_topics`.

Target table columns include:

- `program_id`
- `topic_order`
- `section_title`
- `topic_name`
- `hours_theory`
- `hours_practice`
- `hours_total`
- `activity_type`
- `control_form`
- `source_excerpt`
- `document_path`
- `confidence`

The calendar parser focuses on sections such as `учебно-тематический план`, `календарно-тематический план`, and tables with `теория / практика / всего`. It also handles:

- structured `.docx` tables extracted directly from Word XML, including tables where hour columns are split as `Всего / Теория / Практика`;
- vertical calendar schedules where `month`, `activity type`, `hours`, `topic`, `place`, and `control form` are extracted as separate lines;
- annual sports training plans where rows such as `Общая физическая подготовка` have hour values across training stages.

Documents without a recognizable planning structure produce no topic rows.

## Topic normalization and classification

After importing calendar-topic rows, build the analytics layer:

```bash
node scripts/build-pfdo-topic-analytics.js
```

The script creates a versioned derived layer:

- `pfdo_program_topic_normalizations` — one normalized record for each extracted topic row;
- `pfdo_program_topic_aggregates` — hours aggregated by `program_id + normalized_topic_key + record_type`;
- `pfdo_program_topic_classifications` — hierarchical rule-based classification;
- `pfdo_program_topic_review_queue` — low-confidence or unknown topics for manual review;
- `pfdo_topic_classifier_golden_labels` — storage for manually verified labels used for future evaluation/training.

Current record types:

- `content` — subject matter that students study;
- `service` — assessment, schedule, method, equipment, or other learning-process metadata;
- `noise` — OCR/table fragments and unusable rows.

The current classifier version is `technical-hierarchical-taxonomy-v3`. It improves the pipeline in five places:

- stronger normalization for control prefixes, bibliography fragments, equipment, schedule rows, and common technical synonyms;
- context-aware scoring that uses `topic + program + section` rather than the topic string alone;
- a hierarchy `record_type -> domain -> category`, for example `content -> engineering -> robotics`;
- quality reporting against `pfdo_topic_classifier_golden_labels`;
- feedback overrides from manually reviewed golden labels before rule scoring.

Technical-direction exports:

- `exports/классификатор тем технической направленности.csv`
- `exports/сводка классификатора тем технической направленности.csv`
- `exports/очередь ручной проверки тем технической направленности.csv`
- `exports/качество классификатора тем технической направленности.json`
- `exports/ошибки классификатора тем технической направленности.csv`

`unknown_content` stays a content category rather than mixing uncertain subject topics with extraction noise, so these rows can feed manual review and later embedding-based classification.

## Parser auto-updater

The parser auto-updater audits selected programs with the configured LLM provider, refreshes stale `pfdo_program_calendar_topics` rows locally when fresh parser output already matches the document, and creates a structured repair plan when the parser itself needs work.

The LLM is not allowed to generate or apply code patches in the active updater flow. For parser mismatches it returns strict JSON with diagnosis, target parser files/functions, a change plan, database action, verification plan, and risk level. Local code changes are then made by the coding agent or engineer and verified with tests/regression before database rows are reloaded.

Repair plans may target only parser/extractor implementation:

- `services/program-topic-extractor/src/parsers/*.js`
- `services/program-topic-extractor/src/extractors/*.js`
- `services/program-topic-extractor/src/python/*.py`
- `services/program-topic-extractor/src/swift/*.swift`

Start with dry-run mode:

```bash
node scripts/update-pfdo-program-parser.js \
  --program-ids exports/parser_update_programs.csv \
  --limit 1
```

Apply mode must be explicit:

```bash
node scripts/update-pfdo-program-parser.js \
  --program-ids exports/parser_update_programs.csv \
  --apply
```

Required environment:

- `OPENROUTER_API_KEY` when `LLM_PROVIDER_PFDO_PARSER_EVALUATION=openrouter`
- `LOCAL_LLM_API_URL` when the PFDO parser steps use `LLM_PROVIDER_PFDO_PARSER_EVALUATION=local`
- `PFDO_MIRROR_DATABASE_URL` when the local default `postgresql://localhost:5432/pfdo_51_mirror` is not correct

Optional flags:

- `--model <model>` overrides the LLM model for all parser auto-updater steps.
- `--out-dir <path>` changes the artifact directory from `tmp/parser-updater`.
- `--limit <n>` processes only the first N program IDs.
- `--no-db-refresh` keeps apply mode from rewriting `pfdo_program_calendar_topics`.
- `--max-attempts <n>` is kept as a compatibility option; parser fixes now produce one repair plan instead of iterative GPT patches.

Outputs:

- `exports/parser-updater-report.csv`
- `exports/parser-updater-report.json`
- `tmp/parser-updater/<program_id>/` with parser output, evaluation responses, local DB refresh artifacts, repair plans, snapshots, and verification summaries

Safety rules:

- dry-run is the default;
- LLM repair plans are advisory JSON, not executable patches;
- the LLM cannot change database structure or database access code through the updater;
- topic rows are snapshotted before refresh, and failed current-program or regression verification restores the database snapshot;
- regression verification uses `services/program-topic-extractor/regression/checked-programs.csv`.

## Input manifest

Supported formats:

- `CSV`
- `JSON`

Required fields per program:

- `program_id`
- `program_name`
- `program_portal_url`
- `document_path`

Optional fields:

- `document_format`
- `program_document_url`

Example CSV:

```csv
program_id,program_name,program_portal_url,document_path,document_format,program_document_url
364163,Школа программирования,https://51.pfdo.ru/app/public/program/364163,/absolute/path/to/364163.pdf,pdf,https://docs.pfdo.ru/uploads/programs/example.pdf
```

## Usage

```bash
node services/program-topic-extractor/index.js \
  --manifest /absolute/path/to/manifest.csv \
  --out-dir /absolute/path/to/output
```

Optional flags:

- `--csv-name topics.csv`
- `--json-name topics.json`

## Output files

### CSV

Flat export where one row is one raw topic.

Columns:

- `program_id`
- `program_name`
- `program_portal_url`
- `program_document_url`
- `document_path`
- `document_format`
- `topic_order`
- `topic_raw`
- `source_section`
- `source_excerpt`
- `extraction_method`
- `extractor_warnings`

### JSON

Structured export with per-program metadata, warnings, and extracted topics.

## Extraction details

### DOC / DOCX / RTF

Uses macOS `textutil` when available.

For `.docx`, the extractor also reads `word/document.xml` directly and appends structured table rows to the extracted text. This keeps table cells separate for calendar-topic parsing and reduces misses caused by `textutil` flattening table layout.

### PDF

Uses a small helper script with `pypdf`. The service checks these options in order:

1. `TOPIC_EXTRACTOR_PYTHON_BIN`
2. Bundled Codex runtime Python
3. `python3`

If `pypdf` is unavailable, PDF extraction fails with a clear error message.

## Notes

- This service is optimized for local, offline processing.
- It prefers raw recall over aggressive cleanup.
- If a file is scanned and has no readable text layer, the service may return zero topics and a warning.
