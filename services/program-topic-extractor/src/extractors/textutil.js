const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { extractDocxTablesText } = require("./docx-tables");

const execFileAsync = promisify(execFile);

async function extractWithTextutil(documentPath, documentFormat) {
  try {
    const { stdout } = await execFileAsync("/usr/bin/textutil", ["-convert", "txt", "-stdout", documentPath], {
      maxBuffer: 128 * 1024 * 1024,
    });
    const warnings = [];
    let text = stdout;
    let extractionMethod = "textutil";

    if (documentFormat === "docx") {
      try {
        const structured = await extractDocxTablesText(documentPath);
        warnings.push(...structured.warnings);

        if (structured.text.trim()) {
          text = `${stdout}\n\nSTRUCTURED_DOCX_TABLES\n${structured.text}`;
          extractionMethod = "textutil+docx-tables";
        } else {
          warnings.push("DOCX structured table extraction returned no table rows.");
        }
      } catch (error) {
        warnings.push(`DOCX structured table extraction failed: ${error.message}`);
      }
    }

    if (documentFormat === "doc") {
      try {
        const structured = await extractDocTablesText(documentPath);
        warnings.push(...structured.warnings);

        if (structured.text.trim()) {
          text = `${stdout}\n\nSTRUCTURED_DOC_TABLES\n${structured.text}`;
          extractionMethod = "textutil+doc-html-tables";
        } else {
          warnings.push("DOC structured table extraction returned no table rows.");
        }
      } catch (error) {
        warnings.push(`DOC structured table extraction failed: ${error.message}`);
      }
    }

    return {
      text,
      documentFormat,
      extractionMethod,
      warnings,
    };
  } catch (error) {
    throw new Error(`textutil failed for ${documentPath}: ${error.message}`);
  }
}

async function extractDocTablesText(documentPath) {
  const { stdout } = await execFileAsync("/usr/bin/textutil", ["-convert", "html", "-stdout", documentPath], {
    maxBuffer: 128 * 1024 * 1024,
  });
  const tables = extractHtmlTables(stdout);
  const lines = [];

  tables.forEach((rows, tableIndex) => {
    lines.push(`STRUCTURED_DOCX_TABLE_BEGIN ${tableIndex + 1}`);
    for (const row of rows) {
      lines.push(`TABLE_ROW || ${row.map(escapeDelimitedCell).join(" || ")}`);
    }
    lines.push("STRUCTURED_DOCX_TABLE_END");
  });

  return {
    text: lines.join("\n"),
    warnings: [],
  };
}

function extractHtmlTables(html) {
  return [...String(html || "").matchAll(/<table\b[\s\S]*?<\/table>/giu)]
    .map((tableMatch) =>
      [...tableMatch[0].matchAll(/<tr\b[\s\S]*?<\/tr>/giu)]
        .map((rowMatch) =>
          [...rowMatch[0].matchAll(/<td\b[\s\S]*?<\/td>/giu)]
            .map((cellMatch) => cleanupHtmlCell(cellMatch[0])),
        )
        .filter((row) => row.some((cell) => cell)),
    )
    .filter((table) => table.length);
}

function cleanupHtmlCell(value) {
  return decodeHtmlEntities(
    String(value || "")
      .replace(/<br\s*\/?>/giu, "\n")
      .replace(/<[^>]+>/gu, " ")
      .replace(/\s+/gu, " ")
      .trim(),
  );
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/giu, " ")
    .replace(/&quot;/giu, "\"")
    .replace(/&amp;/giu, "&")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&#x([0-9a-f]+);/giu, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/gu, (_, code) => String.fromCodePoint(Number(code)));
}

function escapeDelimitedCell(value) {
  return String(value || "").replace(/\s*\|\|\s*/gu, " / ");
}

module.exports = {
  extractWithTextutil,
};
