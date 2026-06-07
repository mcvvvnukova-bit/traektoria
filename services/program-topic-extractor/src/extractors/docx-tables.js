const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { resolvePythonBin } = require("./pdf");

const execFileAsync = promisify(execFile);

async function extractDocxTablesText(documentPath) {
  const pythonBin = resolvePythonBin();
  const helperPath = path.resolve(__dirname, "..", "python", "docx_tables_extract.py");

  const { stdout, stderr } = await execFileAsync(pythonBin, [helperPath, documentPath], {
    maxBuffer: 128 * 1024 * 1024,
  });

  return {
    text: stdout,
    warnings: stderr && stderr.trim() ? [stderr.trim()] : [],
  };
}

module.exports = {
  extractDocxTablesText,
};
