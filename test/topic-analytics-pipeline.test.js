const test = require("node:test");
const assert = require("node:assert/strict");

const {
  parseArgs: parseAnalyticsArgs,
  normalizeProgramIds,
  programIdFilterSql,
} = require("../scripts/build-pfdo-topic-analytics");
const {
  createAnalyticsOptionsAfterImport,
} = require("../scripts/import-pfdo-calendar-topics");

test("parses topic analytics incremental rebuild options", () => {
  const options = parseAnalyticsArgs([
    "--program-id",
    "1247288",
    "--program-ids",
    "exports/program_ids.csv",
    "--limit",
    "1000",
    "--skip-exports",
    "--skip-schema",
  ]);

  assert.equal(options.programId, 1247288);
  assert.equal(options.programIdsPath, "exports/program_ids.csv");
  assert.equal(options.limit, 1000);
  assert.equal(options.skipExports, true);
  assert.equal(options.applySchema, false);
});

test("normalizes unique positive program ids for analytics scopes", () => {
  assert.deepEqual(normalizeProgramIds([10, "20", 10]), [10, 20]);
  assert.throws(() => normalizeProgramIds(["0"]), /Invalid program id/);
});

test("builds scoped analytics SQL filter", () => {
  assert.equal(programIdFilterSql("t", []), "");
  assert.equal(programIdFilterSql("t", [10, 20]), " AND t.program_id IN (10, 20)");
});

test("runs full analytics after unscoped import", async () => {
  const options = await createAnalyticsOptionsAfterImport(
    { skipAnalytics: false, keepExisting: false, programId: null, programIdsPath: null },
    new Set([10, 20]),
  );

  assert.deepEqual(options, { applySchema: false });
});

test("rebuilds target program analytics after scoped replacement import", async () => {
  const options = await createAnalyticsOptionsAfterImport(
    { skipAnalytics: false, keepExisting: false, programId: 1247288, programIdsPath: null },
    new Set(),
  );

  assert.deepEqual(options, { programIds: [1247288], applySchema: false });
});

test("rebuilds only successful scoped programs when keeping existing raw rows", async () => {
  const options = await createAnalyticsOptionsAfterImport(
    { skipAnalytics: false, keepExisting: true, programId: 1247288, programIdsPath: null },
    new Set([1247288]),
  );

  assert.deepEqual(options, { programIds: [1247288], applySchema: false });
});

test("can skip analytics after import explicitly", async () => {
  const options = await createAnalyticsOptionsAfterImport(
    { skipAnalytics: true, keepExisting: false, programId: 1247288, programIdsPath: null },
    new Set([1247288]),
  );

  assert.equal(options, null);
});
