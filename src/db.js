const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);

const MACOS_POSTGRES_APP_PSQL_BIN = `${os.homedir()}/Applications/Postgres.app/Contents/Versions/latest/bin/psql`;
const DEFAULT_PSQL_BIN = process.platform === "darwin" ? MACOS_POSTGRES_APP_PSQL_BIN : "psql";
const PSQL_BIN = process.env.PSQL_BIN || DEFAULT_PSQL_BIN;

function getDatabaseUrl(overrideUrl) {
  return overrideUrl || process.env.DATABASE_URL;
}

function assertDatabaseConfig(overrideUrl) {
  if (!getDatabaseUrl(overrideUrl)) {
    throw new Error("Missing DATABASE_URL");
  }
}

async function executeSql(sql, overrideUrl) {
  assertDatabaseConfig(overrideUrl);
  const databaseUrl = getDatabaseUrl(overrideUrl);
  const tempFile = path.join(
    os.tmpdir(),
    `codex-pg-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`,
  );

  try {
    await fs.writeFile(tempFile, `${sql}\n`, "utf-8");
    await execFileAsync(
      PSQL_BIN,
      [databaseUrl, "-X", "-v", "ON_ERROR_STOP=1", "-q", "-f", tempFile],
      { maxBuffer: 10 * 1024 * 1024 },
    );
  } finally {
    await fs.rm(tempFile, { force: true });
  }
}

async function queryRows(sql, overrideUrl) {
  assertDatabaseConfig(overrideUrl);
  const databaseUrl = getDatabaseUrl(overrideUrl);
  const { stdout } = await execFileAsync(
    PSQL_BIN,
    [databaseUrl, "-X", "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-F", "\t", "-c", sql],
    { maxBuffer: 10 * 1024 * 1024 },
  );

  return stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split("\t"));
}

async function executeSqlFile(filePath, overrideUrl) {
  assertDatabaseConfig(overrideUrl);
  const databaseUrl = getDatabaseUrl(overrideUrl);
  const absolutePath = path.resolve(filePath);
  await execFileAsync(
    PSQL_BIN,
    [databaseUrl, "-X", "-v", "ON_ERROR_STOP=1", "-q", "-f", absolutePath],
    { maxBuffer: 10 * 1024 * 1024 },
  );
}

function jsonToSql(value) {
  const base64 = Buffer.from(JSON.stringify(value), "utf-8").toString("base64");
  return `convert_from(decode('${base64}', 'base64'), 'UTF8')::jsonb`;
}

function textToSql(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function decodeJsonCell(cell) {
  if (!cell) return null;
  const json = Buffer.from(cell, "base64").toString("utf-8");
  return JSON.parse(json);
}

module.exports = {
  executeSql,
  executeSqlFile,
  queryRows,
  jsonToSql,
  textToSql,
  decodeJsonCell,
  PSQL_BIN,
  getDatabaseUrl,
};
