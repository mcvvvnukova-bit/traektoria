const fs = require("node:fs/promises");
const path = require("node:path");

const { parseCsv } = require("./csv");

const REQUIRED_FIELDS = [
  "program_id",
  "program_name",
  "program_portal_url",
  "document_path",
];

async function loadManifest(manifestPath) {
  const content = await fs.readFile(manifestPath, "utf-8");
  const extension = path.extname(manifestPath).toLowerCase();

  let records;
  if (extension === ".json") {
    records = JSON.parse(content);
  } else if (extension === ".csv") {
    records = parseCsv(content);
  } else {
    throw new Error(`Unsupported manifest format: ${extension}`);
  }

  if (!Array.isArray(records)) {
    throw new Error("Manifest must be an array of records.");
  }

  return records.map(validateManifestRecord);
}

function validateManifestRecord(record, index) {
  for (const field of REQUIRED_FIELDS) {
    if (!record[field]) {
      throw new Error(`Manifest row ${index + 1} is missing required field: ${field}`);
    }
  }

  const documentFormat = record.document_format || inferDocumentFormat(record.document_path);

  return {
    program_id: String(record.program_id).trim(),
    program_name: String(record.program_name).trim(),
    program_portal_url: String(record.program_portal_url).trim(),
    program_document_url: String(record.program_document_url || "").trim(),
    document_path: String(record.document_path).trim(),
    document_format: documentFormat,
  };
}

function inferDocumentFormat(documentPath) {
  return path.extname(documentPath).replace(".", "").toLowerCase();
}

module.exports = {
  loadManifest,
};
