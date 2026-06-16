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

Detailed reference: [Program topic classification](../../docs/program-topic-classification.md).

The repository-level importer refreshes this layer automatically after it writes
calendar-topic rows. For a scoped import, only the affected program analytics is
rebuilt; for an unscoped import, the full analytics layer is rebuilt. Use
`--skip-analytics` only when you intentionally want to update raw rows without
refreshing derived tables.

Manual rebuilds are still available:

```bash
node scripts/build-pfdo-topic-analytics.js
node scripts/build-pfdo-topic-analytics.js --program-id 364163
node scripts/build-pfdo-topic-analytics.js --program-ids exports/program_ids.csv
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

The current classifier version is `directional-hierarchical-taxonomy-v4`. It uses direction-aware rule profiles for technical and tourist/local-history programs, writes CSV exports to `exports/`, and keeps `unknown_content` as a content category for manual review.

## Parser auto-updater

The parser auto-updater audits selected programs with OpenAI, refreshes stale `pfdo_program_calendar_topics` rows locally when fresh parser output already matches the document, and creates a structured repair plan when the parser itself needs work.

OpenAI is not allowed to generate or apply code patches in the active updater flow. For parser mismatches it returns strict JSON with diagnosis, target parser files/functions, a change plan, database action, verification plan, and risk level. Local code changes are then made by the coding agent or engineer and verified with tests/regression before database rows are reloaded.

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

- `OPENAI_API_KEY`
- `PFDO_MIRROR_DATABASE_URL` when the local default `postgresql://localhost:5432/pfdo_51_mirror` is not correct

Optional flags:

- `--model <model>` overrides the OpenAI model.
- `--out-dir <path>` changes the artifact directory from `tmp/parser-updater`.
- `--limit <n>` processes only the first N program IDs.
- `--no-db-refresh` keeps apply mode from rewriting `pfdo_program_calendar_topics` and therefore skips the importer-triggered analytics refresh.
- `--max-attempts <n>` is kept as a compatibility option; parser fixes now produce one repair plan instead of iterative GPT patches.

Outputs:

- `exports/parser-updater-report.csv`
- `exports/parser-updater-report.json`
- `tmp/parser-updater/<program_id>/` with parser output, evaluation responses, local DB refresh artifacts, repair plans, snapshots, and verification summaries

Safety rules:

- dry-run is the default;
- OpenAI repair plans are advisory JSON, not executable patches;
- OpenAI cannot change database structure or database access code through the updater;
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

---

# Program Topic Extractor: русская версия

Офлайн-сервис на `Node.js` для извлечения сырых списков тем из локальных файлов программ.

## Что делает сервис

- Читает локальный манифест, который связывает метаданные программ с локальными файлами.
- Извлекает текст из `pdf`, `doc`, `docx`, `txt`, `md`, `html` и `rtf`.
- Ищет в извлеченном тексте разделы, похожие на списки тем, например:
  - `Учебно-тематический план`
  - `Содержание программы`
  - `Перечень изучаемых разделов`
  - `Тема 1`
  - `1.1 ...`
- Записывает плоский экспорт сырых тем в `CSV` и `JSON`.

Сервис **не** нормализует и не классифицирует темы.

## Импорт календарных тем в PostgreSQL

Для локального зеркала PFDO используйте импортёр верхнего уровня:

```bash
node scripts/import-pfdo-calendar-topics.js --concurrency 4
```

Он читает локальные пути к документам из `pfdo_programs.program_document_local_path`, извлекает строки календарных тем из явных таблиц планирования и записывает нормализованные строки в `pfdo_program_calendar_topics`.

Целевая таблица включает поля:

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

Парсер календарных тем ориентируется на разделы вроде `учебно-тематический план`, `календарно-тематический план`, а также на таблицы с колонками `теория / практика / всего`. Он также обрабатывает:

- структурированные таблицы `.docx`, извлеченные напрямую из Word XML, включая таблицы, где часы разделены как `Всего / Теория / Практика`;
- вертикальные календарные графики, где `month`, `activity type`, `hours`, `topic`, `place` и `control form` извлекаются отдельными строками;
- годовые планы спортивной подготовки, где строки вроде `Общая физическая подготовка` содержат часы по этапам подготовки.

Документы без распознаваемой структуры планирования не дают строк тем.

## Нормализация и классификация тем

Подробное описание: [Program topic classification](../../docs/program-topic-classification.md).

Импортёр верхнего уровня автоматически обновляет этот слой после записи календарных тем. Для точечного импорта пересобирается аналитика только затронутых программ. Для полного импорта пересобирается весь аналитический слой. Используйте `--skip-analytics` только если нужно намеренно обновить сырые строки без обновления производных таблиц.

Ручная пересборка также доступна:

```bash
node scripts/build-pfdo-topic-analytics.js
node scripts/build-pfdo-topic-analytics.js --program-id 364163
node scripts/build-pfdo-topic-analytics.js --program-ids exports/program_ids.csv
```

Скрипт создает версионированный производный слой:

- `pfdo_program_topic_normalizations` — одна нормализованная запись для каждой извлеченной строки темы;
- `pfdo_program_topic_aggregates` — часы, агрегированные по `program_id + normalized_topic_key + record_type`;
- `pfdo_program_topic_classifications` — иерархическая rule-based классификация;
- `pfdo_program_topic_review_queue` — темы с низкой уверенностью или неизвестной категорией для ручной проверки;
- `pfdo_topic_classifier_golden_labels` — хранилище вручную проверенных меток для будущей оценки и обучения.

Текущие типы записей:

- `content` — предметное содержание, которое изучают обучающиеся;
- `service` — аттестация, расписание, методика, оборудование и другие служебные сведения об учебном процессе;
- `noise` — OCR-фрагменты, обрывки таблиц и непригодные строки.

Текущая версия классификатора — `directional-hierarchical-taxonomy-v4`. Она использует профили правил с учетом направленности для технических и туристско-краеведческих программ, записывает CSV-экспорты в `exports/` и оставляет `unknown_content` как предметную категорию для ручной проверки.

## Автообновление парсера

Модуль автообновления парсера проверяет выбранные программы через OpenAI, локально обновляет устаревшие строки `pfdo_program_calendar_topics`, если свежий результат парсера уже совпадает с документом, и создает структурированный план исправления, если нужно менять сам парсер.

OpenAI не разрешено генерировать или применять кодовые патчи в активном сценарии обновления. При несовпадениях парсера модель возвращает строгий JSON с диагнозом, целевыми файлами и функциями парсера, планом изменений, действием для базы данных, планом проверки и уровнем риска. Локальные изменения кода затем выполняет разработчик или coding agent, после чего они проверяются тестами и регрессией перед повторной загрузкой строк в базу.

Планы исправления могут затрагивать только реализацию парсера и extractor-ов:

- `services/program-topic-extractor/src/parsers/*.js`
- `services/program-topic-extractor/src/extractors/*.js`
- `services/program-topic-extractor/src/python/*.py`
- `services/program-topic-extractor/src/swift/*.swift`

Начинайте с режима dry-run:

```bash
node scripts/update-pfdo-program-parser.js \
  --program-ids exports/parser_update_programs.csv \
  --limit 1
```

Режим применения должен быть включен явно:

```bash
node scripts/update-pfdo-program-parser.js \
  --program-ids exports/parser_update_programs.csv \
  --apply
```

Обязательное окружение:

- `OPENAI_API_KEY`
- `PFDO_MIRROR_DATABASE_URL`, если локальный адрес по умолчанию `postgresql://localhost:5432/pfdo_51_mirror` не подходит

Необязательные флаги:

- `--model <model>` переопределяет модель OpenAI.
- `--out-dir <path>` меняет директорию артефактов с `tmp/parser-updater` на указанную.
- `--limit <n>` обрабатывает только первые N идентификаторов программ.
- `--no-db-refresh` запрещает apply-режиму перезаписывать `pfdo_program_calendar_topics` и поэтому пропускает analytics refresh, который запускает импортёр.
- `--max-attempts <n>` сохранен для совместимости; исправления парсера теперь формируют один план ремонта вместо итеративных GPT-патчей.

Результаты:

- `exports/parser-updater-report.csv`
- `exports/parser-updater-report.json`
- `tmp/parser-updater/<program_id>/` с результатами парсинга, ответами оценки, артефактами локального обновления БД, планами исправления, снимками и сводками проверки

Правила безопасности:

- dry-run используется по умолчанию;
- планы исправления от OpenAI — это рекомендательный JSON, а не исполняемые патчи;
- OpenAI не может менять структуру базы данных или код доступа к базе через updater;
- перед обновлением строки тем сохраняются в snapshot, а при неудачной проверке текущей программы или регрессии snapshot базы восстанавливается;
- регрессионная проверка использует `services/program-topic-extractor/regression/checked-programs.csv`.

## Входной манифест

Поддерживаемые форматы:

- `CSV`
- `JSON`

Обязательные поля для каждой программы:

- `program_id`
- `program_name`
- `program_portal_url`
- `document_path`

Необязательные поля:

- `document_format`
- `program_document_url`

Пример CSV:

```csv
program_id,program_name,program_portal_url,document_path,document_format,program_document_url
364163,Школа программирования,https://51.pfdo.ru/app/public/program/364163,/absolute/path/to/364163.pdf,pdf,https://docs.pfdo.ru/uploads/programs/example.pdf
```

## Использование

```bash
node services/program-topic-extractor/index.js \
  --manifest /absolute/path/to/manifest.csv \
  --out-dir /absolute/path/to/output
```

Необязательные флаги:

- `--csv-name topics.csv`
- `--json-name topics.json`

## Выходные файлы

### CSV

Плоский экспорт, где одна строка соответствует одной сырой теме.

Колонки:

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

Структурированный экспорт с метаданными по каждой программе, предупреждениями и извлеченными темами.

## Детали извлечения

### DOC / DOCX / RTF

Использует macOS `textutil`, если он доступен.

Для `.docx` extractor также читает `word/document.xml` напрямую и добавляет структурированные строки таблиц к извлеченному тексту. Это сохраняет ячейки таблиц раздельными для парсинга календарных тем и уменьшает число пропусков, которые возникают из-за того, что `textutil` сглаживает табличную структуру.

### PDF

Использует небольшой вспомогательный скрипт с `pypdf`. Сервис проверяет варианты в таком порядке:

1. `TOPIC_EXTRACTOR_PYTHON_BIN`
2. Встроенный Python из Codex runtime
3. `python3`

Если `pypdf` недоступен, извлечение PDF завершается понятной ошибкой.

## Примечания

- Сервис оптимизирован для локальной офлайн-обработки.
- Он предпочитает полноту сырых результатов агрессивной очистке.
- Если файл является сканом и не содержит читаемого текстового слоя, сервис может вернуть ноль тем и предупреждение.
