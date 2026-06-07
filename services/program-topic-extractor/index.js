#!/usr/bin/env node

const fs = require("node:fs/promises");
const path = require("node:path");

const { parseCliArgs } = require("./src/cli");
const { loadManifest } = require("./src/manifest");
const { extractDocumentText } = require("./src/extractors");
const { extractTopicsFromText } = require("./src/parsers/topics");
const { writeCsv } = require("./src/exporters/csv");
const { writeJson } = require("./src/exporters/json");

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  const manifestPath = path.resolve(options.manifestPath);
  const outDir = path.resolve(options.outDir);

  const manifestEntries = await loadManifest(manifestPath);
  await fs.mkdir(outDir, { recursive: true });

  const csvRows = [];
  const programResults = [];

  for (const entry of manifestEntries) {
    const documentPath = path.resolve(entry.document_path);
    const extraction = await extractDocumentText({
      documentPath,
      documentFormat: entry.document_format,
    });

    const parsedTopics = extractTopicsFromText({
      text: extraction.text,
      documentPath,
      documentFormat: extraction.documentFormat,
    });

    const topicRows = parsedTopics.topics.map((topic, index) => ({
      program_id: entry.program_id,
      program_name: entry.program_name,
      program_portal_url: entry.program_portal_url,
      program_document_url: entry.program_document_url || "",
      document_path: documentPath,
      document_format: extraction.documentFormat,
      topic_order: index + 1,
      topic_raw: topic.topic_raw,
      source_section: topic.source_section,
      source_excerpt: topic.source_excerpt,
      extraction_method: extraction.extractionMethod,
      extractor_warnings: [...extraction.warnings, ...parsedTopics.warnings].join(" | "),
    }));

    csvRows.push(...topicRows);
    programResults.push({
      program_id: entry.program_id,
      program_name: entry.program_name,
      program_portal_url: entry.program_portal_url,
      program_document_url: entry.program_document_url || "",
      document_path: documentPath,
      document_format: extraction.documentFormat,
      extraction_method: extraction.extractionMethod,
      extractor_warnings: [...extraction.warnings, ...parsedTopics.warnings],
      topics_count: topicRows.length,
      topics: topicRows.map((row) => ({
        topic_order: row.topic_order,
        topic_raw: row.topic_raw,
        source_section: row.source_section,
        source_excerpt: row.source_excerpt,
      })),
    });
  }

  const csvPath = path.join(outDir, options.csvName);
  const jsonPath = path.join(outDir, options.jsonName);

  await writeCsv(csvPath, csvRows);
  await writeJson(jsonPath, {
    manifest_path: manifestPath,
    generated_at: new Date().toISOString(),
    programs_count: programResults.length,
    topic_rows_count: csvRows.length,
    programs: programResults,
  });

  console.log(
    JSON.stringify(
      {
        manifestPath,
        outDir,
        csvPath,
        jsonPath,
        programsCount: programResults.length,
        topicRowsCount: csvRows.length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
