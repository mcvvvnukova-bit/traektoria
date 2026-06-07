const fs = require("node:fs/promises");

const { stringifyCsv } = require("../csv");

const FIELD_ORDER = [
  "program_id",
  "program_name",
  "program_portal_url",
  "program_document_url",
  "document_path",
  "document_format",
  "topic_order",
  "topic_raw",
  "source_section",
  "source_excerpt",
  "extraction_method",
  "extractor_warnings",
];

async function writeCsv(outputPath, rows) {
  const content = stringifyCsv(rows, FIELD_ORDER);
  await fs.writeFile(outputPath, `\ufeff${content}`, "utf-8");
}

module.exports = {
  writeCsv,
};
