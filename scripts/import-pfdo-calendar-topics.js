const path = require("node:path");
const fs = require("node:fs/promises");
const { loadEnvFile } = require("../src/load-env");
const { executeSql, executeSqlFile, jsonToSql, queryRows, textToSql } = require("../src/db");
const { parseCsv } = require("../services/program-topic-extractor/src/csv");
const { extractDocumentText } = require("../services/program-topic-extractor/src/extractors");
const {
  extractCalendarTopicsFromText,
} = require("../services/program-topic-extractor/src/parsers/calendar-topics");

loadEnvFile();

const DATABASE_URL =
  process.env.PFDO_MIRROR_DATABASE_URL || "postgresql://localhost:5432/pfdo_51_mirror";
const schemaPath = path.resolve(__dirname, "..", "db", "pfdo-mirror-schema.sql");
const batchSize = Math.max(10, Number(process.env.PFDO_CALENDAR_TOPIC_INSERT_BATCH_SIZE || 500));
const defaultConcurrency = Math.max(1, Number(process.env.PFDO_CALENDAR_TOPIC_CONCURRENCY || 3));

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await executeSqlFile(schemaPath, DATABASE_URL);

  const programs = await loadPrograms(options);
  if (!options.keepExisting) {
    await clearTargetRows(options);
  }

  const counters = {
    programs: programs.length,
    processed: 0,
    withTopics: 0,
    withoutTopics: 0,
    failed: 0,
    topicRows: 0,
  };
  const pendingRows = [];
  const failures = [];

  for (let start = 0; start < programs.length; start += options.concurrency) {
    const batch = programs.slice(start, start + options.concurrency);
    const results = await Promise.all(batch.map(processProgram));

    for (const result of results) {
      counters.processed += 1;

      if (result.error) {
        counters.failed += 1;
        failures.push(result.error);
        continue;
      }

      if (result.rows.length) {
        counters.withTopics += 1;
      } else {
        counters.withoutTopics += 1;
      }

      for (const topic of result.rows) {
        pendingRows.push({
          programId: result.program.id,
          topicOrder: topic.topic_order,
          sectionTitle: topic.section_title,
          topicName: topic.topic_name,
          hoursTheory: topic.hours_theory,
          hoursPractice: topic.hours_practice,
          hoursTotal: topic.hours_total,
          activityType: topic.activity_type,
          controlForm: topic.control_form,
          sourceSection: topic.source_section,
          sourceExcerpt: topic.source_excerpt,
          documentPath: result.program.documentPath,
          documentFormat: result.extraction.documentFormat,
          extractionMethod: result.extraction.extractionMethod,
          confidence: topic.confidence,
          rawPayload: {
            ...topic.raw_payload,
            program_name: result.program.name,
            program_portal_url: result.program.portalUrl,
            program_document_url: result.program.documentUrl,
            extraction_warnings: result.warnings,
          },
        });
      }

      counters.topicRows += result.rows.length;
      if (pendingRows.length >= batchSize) {
        await insertRows(pendingRows.splice(0, pendingRows.length));
      }
    }

    if (counters.processed % 100 === 0 || counters.processed === counters.programs) {
      console.log(JSON.stringify(counters));
    }
  }

  if (pendingRows.length) {
    await insertRows(pendingRows);
  }

  console.log(
    JSON.stringify(
      {
        ...counters,
        failures: failures.slice(0, 20),
      },
      null,
      2,
    ),
  );
}

async function processProgram(program) {
  try {
    const documentFormat = inferDocumentFormat(program.documentPath);
    const extraction = await extractDocumentText({
      documentPath: program.documentPath,
      documentFormat,
    });
    const parsed = extractCalendarTopicsFromText({
      text: extraction.text,
      documentPath: program.documentPath,
      documentFormat: extraction.documentFormat,
    });

    return {
      program,
      extraction,
      rows: parsed.topics,
      warnings: [...extraction.warnings, ...parsed.warnings],
      error: null,
    };
  } catch (error) {
    return {
      program,
      extraction: null,
      rows: [],
      warnings: [],
      error: {
        program_id: program.id,
        program_name: program.name,
        document_path: program.documentPath,
        error: String(error.message || error).slice(0, 500),
      },
    };
  }
}

function parseArgs(argv) {
  const options = {
    limit: null,
    programId: null,
    programIdsPath: null,
    keepExisting: false,
    concurrency: defaultConcurrency,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    const next = argv[index + 1];

    if (value === "--limit") {
      options.limit = Number(next);
      index += 1;
      continue;
    }

    if (value === "--program-id") {
      options.programId = Number(next);
      index += 1;
      continue;
    }

    if (value === "--program-ids") {
      options.programIdsPath = next;
      index += 1;
      continue;
    }

    if (value === "--keep-existing") {
      options.keepExisting = true;
      continue;
    }

    if (value === "--concurrency") {
      options.concurrency = Math.max(1, Number(next));
      index += 1;
      continue;
    }

    if (value === "--help" || value === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Usage:
  node scripts/import-pfdo-calendar-topics.js

Options:
  --limit 100          Process only first N programs with local documents.
  --program-id 364163  Process one program.
  --program-ids file   Process programs from CSV with a program_id column.
  --keep-existing      Do not delete previous rows before inserting new rows.
  --concurrency 4      Number of documents extracted in parallel.
`);
}

async function loadPrograms(options) {
  const where = [];
  where.push("program_document_local_path IS NOT NULL");
  where.push("program_document_download_error IS NULL");

  const programIds = await loadProgramIds(options);
  if (options.programId) {
    where.push(`id = ${Number(options.programId)}`);
  }
  if (programIds.length) {
    where.push(`id IN (${programIds.map(Number).join(", ")})`);
  }

  const limit = options.limit ? `LIMIT ${Number(options.limit)}` : "";
  const rows = await queryRows(
    `
SELECT
  id,
  replace(encode(convert_to(COALESCE(search_name, ''), 'UTF8'), 'base64'), E'\\n', ''),
  replace(encode(convert_to(COALESCE(source_url, ''), 'UTF8'), 'base64'), E'\\n', ''),
  replace(encode(convert_to(COALESCE(program_document_url, ''), 'UTF8'), 'base64'), E'\\n', ''),
  replace(encode(convert_to(COALESCE(program_document_local_path, ''), 'UTF8'), 'base64'), E'\\n', '')
FROM pfdo_programs
WHERE ${where.join(" AND ")}
ORDER BY id
${limit};
`,
    DATABASE_URL,
  );

  return rows.map(([id, nameB64, portalUrlB64, documentUrlB64, documentPathB64]) => ({
    id: Number(id),
    name: decodeBase64(nameB64),
    portalUrl: decodeBase64(portalUrlB64),
    documentUrl: decodeBase64(documentUrlB64),
    documentPath: decodeBase64(documentPathB64),
  }));
}

async function clearTargetRows(options) {
  if (options.programId) {
    await executeSql(
      `DELETE FROM pfdo_program_calendar_topics WHERE program_id = ${Number(options.programId)};`,
      DATABASE_URL,
    );
    return;
  }

  const programIds = await loadProgramIds(options);
  if (programIds.length) {
    await executeSql(
      `DELETE FROM pfdo_program_calendar_topics WHERE program_id IN (${programIds.map(Number).join(", ")});`,
      DATABASE_URL,
    );
    return;
  }

  await executeSql("DELETE FROM pfdo_program_calendar_topics;", DATABASE_URL);
}

async function loadProgramIds(options) {
  if (!options.programIdsPath) return [];

  const csvPath = path.resolve(options.programIdsPath);
  const rows = parseCsv(await fs.readFile(csvPath, "utf-8"));
  const ids = [];
  const seen = new Set();
  for (const row of rows) {
    const rawValue = String(row.program_id || "").trim();
    if (!rawValue) continue;
    const id = Number(rawValue);
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error(`Invalid program_id in ${csvPath}: ${rawValue}`);
    }
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

async function insertRows(rows) {
  if (!rows.length) return;

  const values = rows
    .map(
      (row) => `(
        ${Number(row.programId)},
        ${Number(row.topicOrder)},
        ${nullableText(row.sectionTitle)},
        ${textToSql(row.topicName)},
        ${nullableNumber(row.hoursTheory)},
        ${nullableNumber(row.hoursPractice)},
        ${nullableNumber(row.hoursTotal)},
        ${nullableText(row.activityType)},
        ${nullableText(row.controlForm)},
        ${nullableText(row.sourceSection)},
        ${nullableText(row.sourceExcerpt)},
        ${nullableText(row.documentPath)},
        ${nullableText(row.documentFormat)},
        ${nullableText(row.extractionMethod)},
        ${nullableNumber(row.confidence)},
        ${jsonToSql(row.rawPayload)}
      )`,
    )
    .join(",\n");

  await executeSql(
    `
INSERT INTO pfdo_program_calendar_topics (
  program_id,
  topic_order,
  section_title,
  topic_name,
  hours_theory,
  hours_practice,
  hours_total,
  activity_type,
  control_form,
  source_section,
  source_excerpt,
  document_path,
  document_format,
  extraction_method,
  confidence,
  raw_payload
)
VALUES
${values};
`,
    DATABASE_URL,
  );
}

function inferDocumentFormat(documentPath) {
  return path.extname(documentPath).replace(/^\./, "").toLowerCase();
}

function nullableText(value) {
  return value == null || value === "" ? "NULL" : textToSql(value);
}

function nullableNumber(value) {
  if (value == null || value === "") return "NULL";
  const number = Number(value);
  return Number.isFinite(number) ? String(number) : "NULL";
}

function decodeBase64(value) {
  return value ? Buffer.from(value, "base64").toString("utf-8") : "";
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
