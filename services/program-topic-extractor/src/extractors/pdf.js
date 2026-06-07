const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);

const BUNDLED_PYTHON = path.join(
  os.homedir(),
  ".cache",
  "codex-runtimes",
  "codex-primary-runtime",
  "dependencies",
  "python",
  "bin",
  "python3"
);

async function extractPdfText(documentPath) {
  const pythonBin = resolvePythonBin();
  const helperPath = path.resolve(__dirname, "..", "python", "pdf_extract.py");

  try {
    const { stdout, stderr } = await execFileAsync(pythonBin, [helperPath, documentPath], {
      maxBuffer: 256 * 1024 * 1024,
    });

    const warnings = [];
    if (stderr && stderr.trim()) {
      warnings.push(stderr.trim());
    }

    if (!stdout.trim()) {
      warnings.push("PDF text extraction returned empty text.");
    }

    if (shouldUseOcrFallback(stdout)) {
      const ocr = await extractPdfTextWithMacosVision(documentPath);
      if (ocr.text.trim().length > stdout.trim().length) {
        return {
          text: ocr.text,
          documentFormat: "pdf",
          extractionMethod: "pypdf+macos-vision-ocr",
          warnings: [...warnings, ...ocr.warnings],
        };
      }
      warnings.push(...ocr.warnings);
    }

    return {
      text: stdout,
      documentFormat: "pdf",
      extractionMethod: "pypdf",
      warnings,
    };
  } catch (error) {
    throw new Error(`PDF extraction failed for ${documentPath}: ${error.message}`);
  }
}

function resolvePythonBin() {
  if (process.env.TOPIC_EXTRACTOR_PYTHON_BIN) {
    return process.env.TOPIC_EXTRACTOR_PYTHON_BIN;
  }

  if (fs.existsSync(BUNDLED_PYTHON)) {
    return BUNDLED_PYTHON;
  }

  return "python3";
}

function shouldUseOcrFallback(text) {
  return process.platform === "darwin" && String(text || "").trim().length < 50;
}

async function extractPdfTextWithMacosVision(documentPath) {
  const helperPath = path.resolve(__dirname, "..", "swift", "pdf_ocr.swift");

  try {
    const { stdout, stderr } = await execFileAsync("swift", [helperPath, documentPath], {
      maxBuffer: 256 * 1024 * 1024,
    });

    const warnings = ["Used macOS Vision OCR because PDF text layer was empty."];
    if (stderr && stderr.trim()) {
      warnings.push(stderr.trim());
    }
    if (!stdout.trim()) {
      warnings.push("macOS Vision OCR returned empty text.");
    }

    return {
      text: stdout,
      warnings,
    };
  } catch (error) {
    return {
      text: "",
      warnings: [`macOS Vision OCR fallback failed: ${error.message}`],
    };
  }
}

module.exports = {
  extractPdfText,
  resolvePythonBin,
};
