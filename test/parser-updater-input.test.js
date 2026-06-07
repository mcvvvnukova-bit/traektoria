const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const {
  parseArgs,
  processProgram,
  loadProgramIdsFromCsv,
  loadProgramContext,
  buildDatabaseTopicRowsFromContext,
  buildReplaceDatabaseTopicsSql,
  buildDocumentExcerpt,
  buildPatchSourcePlan,
  focusSourceSnippet,
} = require("../services/program-topic-extractor/src/auto-update/parser-updater");

function b64(value) {
  return Buffer.from(String(value || ""), "utf-8").toString("base64");
}

test("loads unique program IDs from CSV with limit", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "parser-updater-input-"));
  const csvPath = path.join(dir, "programs.csv");
  await fs.writeFile(csvPath, "program_id,name\n619196,A\n\n1062482,B\n619196,A copy\n", "utf-8");

  const ids = await loadProgramIdsFromCsv(csvPath, { limit: 2 });

  assert.deepEqual(ids, [619196, 1062482]);
});

test("rejects CSV without program_id column", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "parser-updater-input-"));
  const csvPath = path.join(dir, "programs.csv");
  await fs.writeFile(csvPath, "id,name\n1,A\n", "utf-8");

  await assert.rejects(() => loadProgramIdsFromCsv(csvPath), /program_id/);
});

test("parses CLI options and keeps dry-run default", () => {
  const options = parseArgs([
    "--program-ids",
    "exports/programs.csv",
    "--limit",
    "1",
    "--model",
    "gpt-test",
    "--out-dir",
    "tmp/custom",
  ]);

  assert.equal(options.programIdsPath, "exports/programs.csv");
  assert.equal(options.limit, 1);
  assert.equal(options.model, "gpt-test");
  assert.equal(options.outDir, "tmp/custom");
  assert.equal(options.apply, false);
  assert.equal(options.dryRun, true);
  assert.equal(options.refreshDatabase, true);
  assert.equal(options.openAiCache, true);
});

test("parses option to disable database refresh", () => {
  const options = parseArgs(["--program-ids", "exports/programs.csv", "--no-db-refresh"]);

  assert.equal(options.refreshDatabase, false);
});

test("parses option to disable OpenAI cache", () => {
  const options = parseArgs(["--program-ids", "exports/programs.csv", "--no-openai-cache"]);

  assert.equal(options.openAiCache, false);
});

test("rejects invalid max attempts", () => {
  assert.throws(
    () => parseArgs(["--program-ids", "exports/programs.csv", "--max-attempts", "0"]),
    /positive integer/,
  );
});

test("loads program context with injected database and parser dependencies", async () => {
  const queries = [];
  const queryRows = async (sql) => {
    queries.push(sql);
    if (sql.includes("FROM pfdo_programs")) {
      return [[
        "619196",
        b64("Следопыт"),
        b64("https://example.test/program"),
        b64("https://example.test/doc"),
        b64("/tmp/619196.doc"),
      ]];
    }
    if (sql.includes("FROM pfdo_program_calendar_topics")) {
      return [[
        "1",
        b64("План"),
        b64("Компас"),
        "1",
        "2",
        "3",
        b64("db-section"),
        b64("excerpt"),
      ]];
    }
    return [];
  };

  const context = await loadProgramContext(619196, {
    queryRows,
    extractDocumentText: async () => ({
      text: "Учебно-тематический план\nКомпас 1 2 3",
      documentFormat: "doc",
      extractionMethod: "fake",
      warnings: ["extract warning"],
    }),
    parseCalendarTopics: () => ({
      topics: [{
        topic_order: 1,
        topic_name: "Компас",
        hours_theory: 1,
        hours_practice: 2,
        hours_total: 3,
        source_section: "fake-parser",
      }],
      warnings: ["parser warning"],
    }),
  });

  assert.equal(context.program.id, 619196);
  assert.equal(context.databaseTopics[0].topic_name, "Компас");
  assert.equal(context.freshTopics[0].source_section, "fake-parser");
  assert.deepEqual(context.warnings, ["extract warning", "parser warning"]);
  assert.equal(queries.length, 2);
});

test("builds focused document excerpt around planning section", () => {
  const prefix = "A".repeat(9000);
  const body = `${prefix}\nУчебно-тематический план\nТема 1\n${"B".repeat(9000)}`;
  const excerpt = buildDocumentExcerpt(body, 2000);

  assert.ok(excerpt.includes("Учебно-тематический план"));
  assert.ok(excerpt.length <= 2000);
});

test("builds DML-only topic refresh SQL", () => {
  const rows = buildDatabaseTopicRowsFromContext({
    program: {
      id: 619196,
      name: "Следопыт",
      portalUrl: "https://example.test/program",
      documentUrl: "https://example.test/doc",
      documentPath: "/tmp/619196.doc",
    },
    extraction: {
      documentFormat: "doc",
      extractionMethod: "fake",
    },
    warnings: [],
    freshTopics: [{
      topic_order: 1,
      topic_name: "Компас",
      hours_theory: 1,
      hours_practice: 2,
      hours_total: 3,
      raw_payload: { parser: "test" },
    }],
  });
  const sql = buildReplaceDatabaseTopicsSql(619196, rows);

  assert.match(sql, /DELETE FROM pfdo_program_calendar_topics WHERE program_id = 619196/);
  assert.match(sql, /INSERT INTO pfdo_program_calendar_topics/);
  assert.doesNotMatch(sql, /\b(?:CREATE|ALTER|DROP)\s+(?:TABLE|INDEX|SCHEMA)\b/i);
  assert.equal(rows[0].rawPayload.program_name, "Следопыт");
});

test("processes safe stale database refresh without OpenAI", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "parser-updater-local-refresh-"));
  const outDir = path.join(repoRoot, "tmp/parser-updater");
  await fs.mkdir(path.join(repoRoot, "services/program-topic-extractor/regression"), { recursive: true });
  await fs.writeFile(
    path.join(repoRoot, "services/program-topic-extractor/regression/checked-programs.csv"),
    [
      "program_id,program_name,document_format,expected_topics_count,expected_hours_theory,expected_hours_practice,expected_hours_total,expected_source_section,verified_at,notes",
      "619196,Следопыт,doc,2,2,0,2,section,2026-06-02,test",
      "",
    ].join("\n"),
    "utf-8",
  );

  let databaseRows = [{
    topic_order: 1,
    section_title: "section",
    topic_name: "Компас",
    hours_theory: 1,
    hours_practice: 0,
    hours_total: 1,
    source_section: "section",
    source_excerpt: "1 / Компас / 1 / 1 / 0",
  }];
  const freshRows = [
    databaseRows[0],
    {
      topic_order: 2,
      section_title: "section",
      topic_name: "Карта",
      hours_theory: 1,
      hours_practice: 0,
      hours_total: 1,
      source_section: "section",
      source_excerpt: "2 / Карта / 1 / 1 / 0",
    },
  ];
  const queryRows = async (sql) => {
    if (sql.includes("FROM pfdo_programs")) {
      return [[
        "619196",
        b64("Следопыт"),
        b64("https://example.test/program"),
        b64("https://example.test/doc"),
        b64("/tmp/619196.doc"),
      ]];
    }
    if (/SELECT\s+id,\s+program_id/su.test(sql)) {
      return databaseRows.map((row, index) => [
        String(index + 1),
        "619196",
        String(row.topic_order),
        b64(row.section_title),
        b64(row.topic_name),
        String(row.hours_theory ?? ""),
        String(row.hours_practice ?? ""),
        String(row.hours_total ?? ""),
        b64(""),
        b64(""),
        b64(row.source_section),
        b64(row.source_excerpt),
        b64("/tmp/619196.doc"),
        b64("doc"),
        b64("fake"),
        "0.9",
        b64("{}"),
        "2026-06-02 00:00:00+00",
      ]);
    }
    if (sql.includes("FROM pfdo_program_calendar_topics")) {
      return databaseRows.map((row) => [
        String(row.topic_order),
        b64(row.section_title),
        b64(row.topic_name),
        String(row.hours_theory ?? ""),
        String(row.hours_practice ?? ""),
        String(row.hours_total ?? ""),
        b64(row.source_section),
        b64(row.source_excerpt),
      ]);
    }
    return [];
  };
  let refreshSql = "";
  const result = await processProgram(619196, {
    repoRoot,
    outDir,
    databaseUrl: "postgresql://example.test/db",
    options: { apply: true, dryRun: false, refreshDatabase: true, maxAttempts: 1 },
    queryRows,
    executeSql: async (sql) => {
      refreshSql = sql;
      databaseRows = freshRows;
    },
    openaiClient: {
      evaluateProgram: async () => {
        throw new Error("OpenAI should not be called for safe local refresh");
      },
      requestPatch: async () => {
        throw new Error("OpenAI should not be called for safe local refresh");
      },
    },
    deps: {
      extractDocumentText: async () => ({
        text: "Учебно-тематический план\nКомпас 1 1 0\nКарта 1 1 0",
        documentFormat: "doc",
        extractionMethod: "fake",
        warnings: [],
      }),
      parseCalendarTopics: () => ({
        topics: freshRows,
        warnings: [],
      }),
    },
  });

  assert.equal(result.reportRow.status, "reloaded_local");
  assert.equal(result.reportRow.match, true);
  assert.equal(result.reportRow.db_rows_written, 2);
  assert.match(refreshSql, /DELETE FROM pfdo_program_calendar_topics/);
});

test("returns repair plan instead of applying GPT patch for parser mismatch", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "parser-updater-repair-plan-"));
  const parserPath = path.join(repoRoot, "services/program-topic-extractor/src/parsers/calendar-topics.js");
  await fs.mkdir(path.dirname(parserPath), { recursive: true });
  await fs.writeFile(parserPath, "function extractCalendarTopicsFromText() {}\nfunction parseCalendarRow() {}\n", "utf-8");
  const outDir = path.join(repoRoot, "tmp/parser-updater");
  const evaluation = {
    match: false,
    confidence: 0.7,
    missing_topics: ["Карта"],
    extra_topics: [],
    wrong_hours: [],
    failure_mode: "parser misses row",
    recommended_parser_change: "repair parser row extraction",
  };
  const repairPlan = {
    summary: "Parser misses a row.",
    root_cause: "Row selector is too narrow.",
    target_files: ["services/program-topic-extractor/src/parsers/calendar-topics.js"],
    target_functions: ["extractCalendarTopicsFromText"],
    parser_change_plan: ["Broaden row selector."],
    database_action: "reload_after_parser_fix",
    verification_plan: ["Run regression."],
    risk_level: "medium",
    notes: "No patch generated by GPT.",
  };
  let repairPlanRequested = false;

  const result = await processProgram(619196, {
    repoRoot,
    outDir,
    databaseUrl: "postgresql://example.test/db",
    options: { apply: true, dryRun: false, refreshDatabase: false, maxAttempts: 6 },
    queryRows: async (sql) => {
      if (sql.includes("FROM pfdo_programs")) {
        return [[
          "619196",
          b64("Следопыт"),
          b64("https://example.test/program"),
          b64("https://example.test/doc"),
          b64("/tmp/619196.doc"),
        ]];
      }
      if (sql.includes("FROM pfdo_program_calendar_topics")) return [];
      return [];
    },
    executeSql: async () => {
      throw new Error("database should not be changed");
    },
    openaiClient: {
      evaluateProgram: async () => ({ evaluation, outputText: JSON.stringify(evaluation), request: {}, rawResponse: {} }),
      requestRepairPlan: async () => {
        repairPlanRequested = true;
        return { repairPlan, outputText: JSON.stringify(repairPlan), request: {}, rawResponse: {} };
      },
      requestPatch: async () => {
        throw new Error("requestPatch must not be called");
      },
    },
    deps: {
      extractDocumentText: async () => ({
        text: "Учебно-тематический план\nКомпас 1",
        documentFormat: "doc",
        extractionMethod: "fake",
        warnings: [],
      }),
      parseCalendarTopics: () => ({
        topics: [{
          topic_order: 1,
          topic_name: "Компас",
          hours_theory: 1,
          hours_practice: 0,
          hours_total: 1,
          source_section: "section",
        }],
        warnings: [],
      }),
      patchAdapter: async () => {
        throw new Error("patch adapter must not be called");
      },
    },
  });

  assert.equal(result.reportRow.status, "needs_parser_fix");
  assert.equal(result.reportRow.repair_plan_path, "tmp/parser-updater/619196/repair-plan/repair-plan-response.json");
  assert.equal(repairPlanRequested, true);
  const saved = JSON.parse(await fs.readFile(path.join(repoRoot, result.reportRow.repair_plan_path), "utf-8"));
  assert.equal(saved.repairPlan.summary, "Parser misses a row.");
});

test("builds focused patch source plan and snippets", () => {
  const plan = buildPatchSourcePlan({
    programContext: {
      extraction: { documentFormat: "docx" },
      warnings: [],
    },
    evaluation: {
      failure_mode: "DOCX structured table hours mismatch",
      recommended_parser_change: "Fix parseDelimitedTableRow",
    },
  });
  const source = `${"A".repeat(5000)}function parseDelimitedTableRow() { return true; }\n${"B".repeat(5000)}`;
  const snippet = focusSourceSnippet(source, plan.searchTerms, 1000);

  assert.ok(plan.filePaths.includes("services/program-topic-extractor/src/parsers/calendar-topics.js"));
  assert.ok(plan.filePaths.includes("services/program-topic-extractor/src/extractors/docx-tables.js"));
  assert.equal(plan.filePaths.includes("services/program-topic-extractor/src/extractors/pdf.js"), false);
  assert.ok(snippet.includes("parseDelimitedTableRow"));
  assert.ok(snippet.length <= 1000);
});
