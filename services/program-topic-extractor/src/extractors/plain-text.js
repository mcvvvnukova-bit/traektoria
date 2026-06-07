const fs = require("node:fs/promises");

async function extractPlainTextFile(documentPath, documentFormat) {
  const text = await fs.readFile(documentPath, "utf-8");
  return {
    text,
    documentFormat,
    extractionMethod: "plain_text",
    warnings: [],
  };
}

module.exports = {
  extractPlainTextFile,
};
