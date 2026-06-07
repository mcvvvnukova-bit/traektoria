const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const {
  validatePatch,
  normalizePatchPath,
  applyPatchWithSnapshots,
} = require("../services/program-topic-extractor/src/auto-update/patch-safety");

const allowedPath = "services/program-topic-extractor/src/parsers/calendar-topics.js";
const secondAllowedPath = "services/program-topic-extractor/src/extractors/pdf.js";

function diffFor(filePath = allowedPath) {
  return [
    `diff --git a/${filePath} b/${filePath}`,
    `--- a/${filePath}`,
    `+++ b/${filePath}`,
    "@@ -1,1 +1,1 @@",
    "-old",
    "+new",
  ].join("\n");
}

test("normalizes a and b patch prefixes", () => {
  assert.equal(normalizePatchPath(`a/${allowedPath}`), allowedPath);
  assert.equal(normalizePatchPath(`b/${allowedPath}`), allowedPath);
});

test("accepts a single allowlisted parser diff", () => {
  const result = validatePatch(diffFor(), { allowedPaths: [allowedPath] });

  assert.deepEqual(result.paths, [allowedPath]);
});

test("accepts multiple allowlisted parser files", () => {
  const result = validatePatch([diffFor(allowedPath), diffFor(secondAllowedPath)].join("\n"), {
    allowedPaths: [allowedPath, secondAllowedPath],
  });

  assert.deepEqual(result.paths, [allowedPath, secondAllowedPath]);
});

test("rejects prose before diff", () => {
  assert.throws(() => validatePatch(`Here is the patch:\n${diffFor()}`, { allowedPaths: [allowedPath] }), /start/);
});

test("rejects out-of-allowlist files", () => {
  assert.throws(
    () => validatePatch(diffFor("scripts/import-pfdo-calendar-topics.js"), { allowedPaths: [allowedPath] }),
    /not allowlisted/,
  );
});

test("rejects parent traversal paths", () => {
  assert.throws(() => normalizePatchPath("a/../src/db.js"), /parent traversal/);
});

test("rejects database schema changes inside parser diffs", () => {
  const patch = [
    `diff --git a/${allowedPath} b/${allowedPath}`,
    `--- a/${allowedPath}`,
    `+++ b/${allowedPath}`,
    "@@ -1,1 +1,1 @@",
    "-const value = 1;",
    "+const sql = \"ALTER TABLE pfdo_program_calendar_topics ADD COLUMN bad TEXT\";",
  ].join("\n");

  assert.throws(() => validatePatch(patch, { allowedPaths: [allowedPath] }), /schema-changing SQL/);
});

test("rejects database helper imports inside parser diffs", () => {
  const patch = [
    `diff --git a/${allowedPath} b/${allowedPath}`,
    `--- a/${allowedPath}`,
    `+++ b/${allowedPath}`,
    "@@ -1,1 +1,1 @@",
    "-const value = 1;",
    "+const { queryRows } = require(\"../../../../src/db\");",
  ].join("\n");

  assert.throws(() => validatePatch(patch, { allowedPaths: [allowedPath] }), /database helpers/);
});

test("restores snapshot when patch adapter fails", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "parser-updater-repo-"));
  const targetPath = path.join(repoRoot, allowedPath);
  const artifactDir = path.join(repoRoot, "tmp/artifacts");
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, "old\n", "utf-8");

  await assert.rejects(
    () => applyPatchWithSnapshots({
      patchText: diffFor(),
      repoRoot,
      artifactDir,
      allowedPaths: [allowedPath],
      patchAdapter: async () => {
        await fs.writeFile(targetPath, "partially changed\n", "utf-8");
        throw new Error("adapter failed");
      },
    }),
    /adapter failed/,
  );

  assert.equal(await fs.readFile(targetPath, "utf-8"), "old\n");
});
