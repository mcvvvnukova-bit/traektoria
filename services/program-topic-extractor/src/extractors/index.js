const { extractPlainTextFile } = require("./plain-text");
const { extractWithTextutil } = require("./textutil");
const { extractPdfText } = require("./pdf");

async function extractDocumentText({ documentPath, documentFormat }) {
  const normalizedFormat = String(documentFormat || "").toLowerCase();

  if (["txt", "md", "html", "htm", "json", "csv"].includes(normalizedFormat)) {
    return extractPlainTextFile(documentPath, normalizedFormat);
  }

  if (["doc", "docx", "rtf"].includes(normalizedFormat)) {
    return extractWithTextutil(documentPath, normalizedFormat);
  }

  if (normalizedFormat === "pdf") {
    return extractPdfText(documentPath);
  }

  throw new Error(`Unsupported document format: ${normalizedFormat}`);
}

module.exports = {
  extractDocumentText,
};
