const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { loadEnvFile } = require("../src/load-env");
const { executeSql, queryRows, textToSql } = require("../src/db");

loadEnvFile();

const DATABASE_URL =
  process.env.PFDO_MIRROR_DATABASE_URL || "postgresql://localhost:5432/pfdo_51_mirror";
const outputDir = path.resolve(__dirname, "..", "tmp", "program_docs");
const manifestPath = path.join(outputDir, "program_document_manifest.csv");
const concurrency = Math.max(1, Number(process.env.PFDO_DOCUMENT_DOWNLOAD_CONCURRENCY || 10));
const requestTimeoutMs = Math.max(1000, Number(process.env.PFDO_DOCUMENT_DOWNLOAD_TIMEOUT_MS || 90000));
const maxAttempts = Math.max(1, Number(process.env.PFDO_DOCUMENT_DOWNLOAD_ATTEMPTS || 3));
const force = process.env.PFDO_DOCUMENT_DOWNLOAD_FORCE === "1";

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  if (process.env.PFDO_DOCUMENT_ENSURE_COLUMNS !== "false") {
    await ensureDocumentColumns();
  }

  const programs = await loadPrograms();
  const withUrl = programs.filter((program) => program.documentUrl);
  const withoutUrl = programs.filter((program) => !program.documentUrl);

  if (withoutUrl.length) {
    await flushUpdates(
      withoutUrl.map((program) => ({
        id: program.id,
        documentUrl: null,
        localPath: null,
        fileUrl: null,
        contentType: null,
        fileSize: null,
        error: "NO_DOCUMENT_URL",
      })),
    );
  }

  let completed = 0;
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  const updates = [];
  const manifestRows = [
    [
      "program_id",
      "program_name",
      "program_document_url",
      "program_document_local_path",
      "program_document_file_url",
      "status",
      "error",
    ],
  ];

  for (const program of withoutUrl) {
    manifestRows.push([program.id, program.name, "", "", "", "missing_url", "NO_DOCUMENT_URL"]);
  }

  await runPool(withUrl, concurrency, async (program) => {
    const result = await processProgram(program);
    completed += 1;
    if (result.status === "downloaded") downloaded += 1;
    if (result.status === "skipped") skipped += 1;
    if (result.status === "failed") failed += 1;
    updates.push(result.update);
    manifestRows.push([
      program.id,
      program.name,
      program.documentUrl,
      result.update.localPath || "",
      result.update.fileUrl || "",
      result.status,
      result.update.error || "",
    ]);

    if (updates.length >= 100) {
      await flushUpdates(updates.splice(0, updates.length));
    }

    if (completed % 100 === 0 || completed === withUrl.length) {
      console.log(
        JSON.stringify({
          completed,
          totalWithUrl: withUrl.length,
          downloaded,
          skipped,
          failed,
          missingUrl: withoutUrl.length,
        }),
      );
    }
  });

  if (updates.length) {
    await flushUpdates(updates);
  }

  manifestRows.sort((a, b) => {
    if (a[0] === "program_id") return -1;
    if (b[0] === "program_id") return 1;
    return Number(a[0]) - Number(b[0]);
  });
  await fs.writeFile(manifestPath, toCsv(manifestRows), "utf-8");

  console.log(
    JSON.stringify(
      {
        totalPrograms: programs.length,
        withUrl: withUrl.length,
        missingUrl: withoutUrl.length,
        downloaded,
        skipped,
        failed,
        outputDir,
        manifestPath,
      },
      null,
      2,
    ),
  );
}

async function ensureDocumentColumns() {
  await executeSql(
    `
ALTER TABLE pfdo_programs
  ADD COLUMN IF NOT EXISTS program_document_url TEXT,
  ADD COLUMN IF NOT EXISTS program_document_local_path TEXT,
  ADD COLUMN IF NOT EXISTS program_document_file_url TEXT,
  ADD COLUMN IF NOT EXISTS program_document_content_type TEXT,
  ADD COLUMN IF NOT EXISTS program_document_file_size BIGINT,
  ADD COLUMN IF NOT EXISTS program_document_downloaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS program_document_download_error TEXT;
`,
    DATABASE_URL,
  );
}

async function loadPrograms() {
  const rows = await queryRows(
    `
SELECT
  id,
  replace(encode(convert_to(COALESCE(search_name, ''), 'UTF8'), 'base64'), E'\\n', ''),
  replace(encode(convert_to(COALESCE(NULLIF(detail_payload -> 'program_text' ->> 'value', ''), ''), 'UTF8'), 'base64'), E'\\n', ''),
  replace(encode(convert_to(COALESCE(program_document_local_path, ''), 'UTF8'), 'base64'), E'\\n', '')
FROM pfdo_programs
ORDER BY id;
`,
    DATABASE_URL,
  );

  return rows.map(([id, nameB64, documentUrlB64, localPathB64]) => ({
    id: Number(id),
    name: decodeBase64(nameB64),
    documentUrl: decodeBase64(documentUrlB64),
    localPath: decodeBase64(localPathB64),
  }));
}

async function processProgram(program) {
  const extension = getExtensionFromUrl(program.documentUrl);
  const targetPath = path.join(outputDir, `${program.id}${extension}`);

  try {
    if (!force && (await isUsableFile(targetPath))) {
      const stat = await fs.stat(targetPath);
      return {
        status: "skipped",
        update: buildUpdate(program.id, program.documentUrl, targetPath, null, stat.size, null),
      };
    }

    const result = await downloadWithRetry(program.documentUrl, targetPath);
    return {
      status: "downloaded",
      update: buildUpdate(
        program.id,
        program.documentUrl,
        targetPath,
        result.contentType,
        result.fileSize,
        null,
      ),
    };
  } catch (error) {
    await fs.rm(`${targetPath}.part`, { force: true });
    return {
      status: "failed",
      update: {
        id: program.id,
        documentUrl: program.documentUrl,
        localPath: null,
        fileUrl: null,
        contentType: null,
        fileSize: null,
        error: normalizeError(error),
      },
    };
  }
}

async function downloadWithRetry(url, targetPath) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await downloadFile(url, targetPath);
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await delay(500 * attempt);
      }
    }
  }
  throw lastError;
}

async function downloadFile(url, targetPath) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  const tempPath = `${targetPath}.part`;

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 PFDO document mirror",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP_${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (!buffer.length) {
      throw new Error("EMPTY_RESPONSE");
    }

    await fs.writeFile(tempPath, buffer);
    await fs.rename(tempPath, targetPath);
    return {
      contentType: response.headers.get("content-type") || null,
      fileSize: buffer.length,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function buildUpdate(id, documentUrl, localPath, contentType, fileSize, error) {
  const absolutePath = path.resolve(localPath);
  return {
    id,
    documentUrl,
    localPath: absolutePath,
    fileUrl: pathToFileURL(absolutePath).href,
    contentType,
    fileSize,
    error,
  };
}

async function flushUpdates(updates) {
  if (!updates.length) return;

  const values = updates
    .map((item) => {
      const downloadedAt = item.error ? "NULL::timestamptz" : "NOW()";
      return `(
        ${Number(item.id)},
        ${nullableText(item.documentUrl)},
        ${nullableText(item.localPath)},
        ${nullableText(item.fileUrl)},
        ${nullableText(item.contentType)},
        ${nullableNumber(item.fileSize)},
        ${downloadedAt},
        ${nullableText(item.error)}
      )`;
    })
    .join(",\n");

  await executeSql(
    `
WITH updates (
  id,
  program_document_url,
  program_document_local_path,
  program_document_file_url,
  program_document_content_type,
  program_document_file_size,
  program_document_downloaded_at,
  program_document_download_error
) AS (
  VALUES
  ${values}
)
UPDATE pfdo_programs p
SET
  program_document_url = updates.program_document_url,
  program_document_local_path = updates.program_document_local_path,
  program_document_file_url = updates.program_document_file_url,
  program_document_content_type = updates.program_document_content_type,
  program_document_file_size = updates.program_document_file_size,
  program_document_downloaded_at = updates.program_document_downloaded_at,
  program_document_download_error = updates.program_document_download_error
FROM updates
WHERE p.id = updates.id;
`,
    DATABASE_URL,
  );
}

async function runPool(items, limit, worker) {
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const item = items[nextIndex];
      nextIndex += 1;
      await worker(item);
    }
  });
  await Promise.all(workers);
}

async function isUsableFile(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}

function getExtensionFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    const extension = path.extname(pathname).toLowerCase();
    return extension || ".bin";
  } catch {
    return ".bin";
  }
}

function normalizeError(error) {
  if (error?.name === "AbortError") return "REQUEST_TIMEOUT";
  return String(error?.message || error).slice(0, 500);
}

function nullableText(value) {
  return value == null || value === "" ? "NULL" : textToSql(value);
}

function nullableNumber(value) {
  return Number.isFinite(Number(value)) ? String(Number(value)) : "NULL::bigint";
}

function decodeBase64(value) {
  return value ? Buffer.from(value, "base64").toString("utf-8") : "";
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toCsv(rows) {
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function csvCell(value) {
  const stringValue = String(value ?? "");
  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
