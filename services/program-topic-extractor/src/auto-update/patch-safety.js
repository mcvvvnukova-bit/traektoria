const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);

function assertUnifiedDiffOnly(patchText) {
  const trimmed = String(patchText || "").trim();
  if (!trimmed) {
    throw new Error("Patch is empty");
  }
  if (trimmed.startsWith("```") || trimmed.endsWith("```")) {
    throw new Error("Patch must not be wrapped in Markdown fences");
  }
  if (!/^(diff --git |--- )/u.test(trimmed)) {
    throw new Error("Patch must start with a unified diff header");
  }
  if (!trimmed.includes("\n+++ ") || !trimmed.includes("\n@@")) {
    throw new Error("Patch must include unified diff file and hunk headers");
  }
  return trimmed;
}

function validatePatch(patchText, options = {}) {
  const allowedPaths = new Set(options.allowedPaths || []);
  const trimmed = assertUnifiedDiffOnly(patchText);
  assertNoDatabaseStructureChanges(trimmed);
  const paths = new Set();
  const lines = trimmed.split(/\r?\n/u);

  for (const line of lines) {
    if (/^(new file mode|deleted file mode|Binary files |GIT binary patch)/u.test(line)) {
      throw new Error("Patch must not create, delete, or modify binary files");
    }

    if (line.startsWith("diff --git ")) {
      const match = /^diff --git\s+(.+?)\s+(.+)$/u.exec(line);
      if (!match) {
        throw new Error(`Invalid diff header: ${line}`);
      }
      collectPath(paths, match[1]);
      collectPath(paths, match[2]);
      continue;
    }

    if (line.startsWith("--- ") || line.startsWith("+++ ")) {
      const rawPath = line.slice(4).split(/\t/u)[0].trim();
      if (rawPath === "/dev/null") {
        throw new Error("Patch must not create or delete files");
      }
      collectPath(paths, rawPath);
    }
  }

  if (!paths.size) {
    throw new Error("Patch does not contain file paths");
  }

  for (const patchPath of paths) {
    if (!allowedPaths.has(patchPath)) {
      throw new Error(`Patch path is not allowlisted: ${patchPath}`);
    }
  }

  return {
    patchText: trimmed,
    paths: [...paths],
  };
}

function assertNoDatabaseStructureChanges(patchText) {
  const addedLines = String(patchText || "")
    .split(/\r?\n/u)
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1));

  const forbiddenPatterns = [
    {
      pattern: /\b(?:CREATE|ALTER|DROP|TRUNCATE)\s+(?:TABLE|INDEX|SCHEMA|DATABASE|VIEW|MATERIALIZED\s+VIEW|SEQUENCE|TYPE|EXTENSION|FUNCTION|TRIGGER)\b/iu,
      reason: "database schema-changing SQL is forbidden",
    },
    {
      pattern: /\b(?:REINDEX|VACUUM\s+FULL|CLUSTER)\b/iu,
      reason: "database maintenance/schema operations are forbidden",
    },
    {
      pattern: /require\s*\([^)]*["'][^"']*(?:src\/db|\.\.\/\.\.\/\.\.\/\.\.\/src\/db)[^"']*["'][^)]*\)/iu,
      reason: "parser patches must not import database helpers",
    },
    {
      pattern: /from\s+["'][^"']*(?:src\/db|\.\.\/\.\.\/\.\.\/\.\.\/src\/db)[^"']*["']/iu,
      reason: "parser patches must not import database helpers",
    },
    {
      pattern: /\b(?:executeSql|executeSqlFile|queryRows|DATABASE_URL|PFDO_MIRROR_DATABASE_URL|PSQL_BIN)\b/u,
      reason: "parser patches must not add database access",
    },
  ];

  for (const line of addedLines) {
    for (const { pattern, reason } of forbiddenPatterns) {
      if (pattern.test(line)) {
        throw new Error(`${reason}: ${line.trim().slice(0, 160)}`);
      }
    }
  }
}

function collectPath(paths, rawPath) {
  const normalized = normalizePatchPath(rawPath);
  if (normalized) {
    paths.add(normalized);
  }
}

function normalizePatchPath(rawPath) {
  let value = String(rawPath || "").trim();
  if (!value || value === "/dev/null") return "";

  value = value.split(/\t/u)[0].trim();
  if (value.startsWith("a/") || value.startsWith("b/")) {
    value = value.slice(2);
  }

  if (path.isAbsolute(value)) {
    throw new Error(`Patch path must be repo-relative: ${value}`);
  }
  if (value.split(/[\\/]+/u).includes("..")) {
    throw new Error(`Patch path must not contain parent traversal: ${value}`);
  }
  if (value.includes("\0")) {
    throw new Error("Patch path must not contain null bytes");
  }

  return value.replace(/\\/gu, "/");
}

async function createSnapshots({ repoRoot, filePaths, artifactDir }) {
  const snapshotDir = path.join(artifactDir, "snapshots");
  await fs.mkdir(snapshotDir, { recursive: true });

  const snapshots = [];
  for (const filePath of filePaths) {
    const absolutePath = path.join(repoRoot, filePath);
    const content = await fs.readFile(absolutePath);
    const snapshotPath = path.join(snapshotDir, encodeSnapshotName(filePath));
    await fs.mkdir(path.dirname(snapshotPath), { recursive: true });
    await fs.writeFile(snapshotPath, content);
    snapshots.push({
      filePath,
      absolutePath,
      snapshotPath,
    });
  }

  return snapshots;
}

async function restoreSnapshots(snapshots) {
  for (const snapshot of snapshots) {
    const content = await fs.readFile(snapshot.snapshotPath);
    await fs.writeFile(snapshot.absolutePath, content);
  }
}

async function applyPatchWithSnapshots(options) {
  const {
    patchText,
    repoRoot,
    artifactDir,
    allowedPaths,
    patchAdapter = applyPatchCommand,
  } = options;
  const validation = validatePatch(patchText, { allowedPaths });
  const snapshots = await createSnapshots({
    repoRoot,
    artifactDir,
    filePaths: validation.paths,
  });

  const patchPath = path.join(artifactDir, "candidate.patch");
  await fs.mkdir(artifactDir, { recursive: true });
  await fs.writeFile(patchPath, `${validation.patchText}\n`, "utf-8");

  try {
    await patchAdapter({ repoRoot, patchPath, patchText: validation.patchText, paths: validation.paths });
    return {
      applied: true,
      patchPath,
      paths: validation.paths,
      snapshots,
    };
  } catch (error) {
    await restoreSnapshots(snapshots);
    throw error;
  }
}

async function applyPatchCommand({ repoRoot, patchPath }) {
  await execFileAsync("patch", ["-p1", "-i", patchPath], {
    cwd: repoRoot,
    maxBuffer: 1024 * 1024,
  });
}

function encodeSnapshotName(filePath) {
  return `${filePath.replace(/[\\/]/gu, "__")}.snapshot`;
}

module.exports = {
  assertUnifiedDiffOnly,
  validatePatch,
  assertNoDatabaseStructureChanges,
  normalizePatchPath,
  createSnapshots,
  restoreSnapshots,
  applyPatchWithSnapshots,
  applyPatchCommand,
};
