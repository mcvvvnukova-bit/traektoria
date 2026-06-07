const fs = require("node:fs/promises");
const path = require("node:path");
const { parseCsv, stringifyCsv } = require("../csv");
const { createOpenAIClient, DEFAULT_MODEL, isOpenAIQuotaExceededError } = require("./openai-client");
const { verifyCurrentProgram, verifyRegressionCases } = require("./verification");
const { executeSql, jsonToSql, queryRows, textToSql } = require("../../../../src/db");

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const DEFAULT_DATABASE_URL = "postgresql://localhost:5432/pfdo_51_mirror";
const DEFAULT_ALLOWED_WRITABLE_FILES = [
  "services/program-topic-extractor/src/parsers/calendar-topics.js",
  "services/program-topic-extractor/src/parsers/topics.js",
  "services/program-topic-extractor/src/extractors/index.js",
  "services/program-topic-extractor/src/extractors/docx-tables.js",
  "services/program-topic-extractor/src/extractors/pdf.js",
  "services/program-topic-extractor/src/extractors/plain-text.js",
  "services/program-topic-extractor/src/extractors/textutil.js",
  "services/program-topic-extractor/src/python/docx_tables_extract.py",
  "services/program-topic-extractor/src/python/pdf_extract.py",
  "services/program-topic-extractor/src/swift/pdf_ocr.swift",
];
const DEFAULT_OUT_DIR = "tmp/parser-updater";
const DEFAULT_OPENAI_CACHE_DIR = "tmp/parser-updater-cache/openai";
const DEFAULT_REPORT_CSV = "exports/parser-updater-report.csv";
const DEFAULT_REPORT_JSON = "exports/parser-updater-report.json";

function parseArgs(argv, env = process.env) {
  const options = {
    programIdsPath: null,
    apply: false,
    dryRun: true,
    maxAttempts: 2,
    model: env.PFDO_PARSER_UPDATER_MODEL || env.OPENAI_MODEL || DEFAULT_MODEL,
    outDir: DEFAULT_OUT_DIR,
    openAiCacheDir: env.PFDO_PARSER_UPDATER_OPENAI_CACHE_DIR || DEFAULT_OPENAI_CACHE_DIR,
    openAiCache: env.PFDO_PARSER_UPDATER_OPENAI_CACHE !== "0",
    limit: null,
    refreshDatabase: true,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    const next = argv[index + 1];

    if (value === "--help" || value === "-h") {
      options.help = true;
      continue;
    }

    if (value === "--program-ids") {
      options.programIdsPath = requireValue(value, next);
      index += 1;
      continue;
    }

    if (value === "--apply") {
      options.apply = true;
      options.dryRun = false;
      continue;
    }

    if (value === "--max-attempts") {
      options.maxAttempts = parsePositiveInteger(value, next);
      index += 1;
      continue;
    }

    if (value === "--model") {
      options.model = requireValue(value, next);
      index += 1;
      continue;
    }

    if (value === "--out-dir") {
      options.outDir = requireValue(value, next);
      index += 1;
      continue;
    }

    if (value === "--openai-cache-dir") {
      options.openAiCacheDir = requireValue(value, next);
      options.openAiCache = true;
      index += 1;
      continue;
    }

    if (value === "--no-openai-cache") {
      options.openAiCache = false;
      continue;
    }

    if (value === "--limit") {
      options.limit = parsePositiveInteger(value, next);
      index += 1;
      continue;
    }

    if (value === "--no-db-refresh") {
      options.refreshDatabase = false;
      continue;
    }

    throw new Error(`Unknown option: ${value}`);
  }

  if (!options.help && !options.programIdsPath) {
    throw new Error("Missing required option: --program-ids <path>");
  }

  return options;
}

function printHelp() {
  return `
Usage:
  node scripts/update-pfdo-program-parser.js --program-ids exports/parser_update_programs.csv

Options:
  --program-ids <path>   CSV file with a program_id column.
  --apply                Run active mode: reload stale DB rows locally and create repair plans for parser mismatches.
  --max-attempts <n>     Compatibility option. Parser fixes now produce one repair plan instead of GPT patches.
  --model <model>        OpenAI model override. Default: env or ${DEFAULT_MODEL}.
  --out-dir <path>       Artifact directory. Default: ${DEFAULT_OUT_DIR}.
  --openai-cache-dir <path> Cache OpenAI responses under this path. Default: ${DEFAULT_OPENAI_CACHE_DIR}.
  --no-openai-cache      Disable OpenAI response cache.
  --limit <n>            Process only first N program IDs.
  --no-db-refresh        Do not rewrite pfdo_program_calendar_topics after accepted parser changes.
  --help                 Show this help.
`;
}

async function runParserUpdater(rawOptions = {}, deps = {}) {
  const repoRoot = rawOptions.repoRoot || REPO_ROOT;
  const options = {
    ...rawOptions,
    dryRun: rawOptions.apply ? false : rawOptions.dryRun !== false,
    maxAttempts: rawOptions.maxAttempts || 2,
    outDir: rawOptions.outDir || DEFAULT_OUT_DIR,
    model: rawOptions.model || DEFAULT_MODEL,
    openAiCache: rawOptions.openAiCache !== false,
    openAiCacheDir: rawOptions.openAiCacheDir || DEFAULT_OPENAI_CACHE_DIR,
    refreshDatabase: rawOptions.refreshDatabase !== false,
  };
  const databaseUrl =
    options.databaseUrl || process.env.PFDO_MIRROR_DATABASE_URL || DEFAULT_DATABASE_URL;
  const outDir = resolveInsideRepo(repoRoot, options.outDir);
  const queryRowsImpl = deps.queryRows || queryRows;
  const executeSqlImpl = deps.executeSql || executeSql;
  const openaiClient =
    deps.openaiClient ||
    createOpenAIClient({
      apiKey: options.openAiApiKey || process.env.OPENAI_API_KEY,
      model: options.model,
      cacheDir: options.openAiCache ? resolveInsideRepo(repoRoot, options.openAiCacheDir) : "",
      fetchImpl: deps.fetchImpl,
    });

  if (!deps.openaiClient && !process.env.OPENAI_API_KEY && !options.openAiApiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const programIds = await loadProgramIdsFromCsv(resolveInsideRepo(repoRoot, options.programIdsPath), {
    limit: options.limit,
  });
  const rows = [];

  for (const programId of programIds) {
    const result = await processProgram(programId, {
      repoRoot,
      outDir,
      databaseUrl,
      options,
      queryRows: queryRowsImpl,
      executeSql: executeSqlImpl,
      openaiClient,
      deps,
    });
    rows.push(result.reportRow);
    console.log(JSON.stringify(result.reportRow));
    if (result.reportRow.status === "api_blocked") {
      break;
    }
  }

  await writeReports(repoRoot, rows, options);

  return {
    rows,
    counters: countStatuses(rows),
  };
}

async function processProgram(programId, context) {
  const { repoRoot, outDir, databaseUrl, options, openaiClient, deps } = context;
  const artifactDir = path.join(outDir, String(programId));
  await fs.mkdir(artifactDir, { recursive: true });
  const loadCurrentContext = () => loadProgramContextForUpdater(programId, context);

  try {
    let programContext = await loadCurrentContext();
    await writeJson(path.join(artifactDir, "before-parser-output.json"), {
      program: programContext.program,
      databaseTopics: programContext.databaseTopics,
      freshTopics: programContext.freshTopics,
      warnings: programContext.warnings,
    });

    if (options.refreshDatabase) {
      const localRefresh = await tryLocalDatabaseRefresh({
        programId,
        programContext,
        context,
        artifactDir: path.join(artifactDir, "local-db-refresh"),
      });
      if (localRefresh.accepted) {
        return buildProcessResult(programId, options.dryRun ? "needs_reload_local" : "reloaded_local", localRefresh.evaluation, {
          dbRowsWritten: localRefresh.refreshResult ? localRefresh.refreshResult.rowsWritten : "",
        });
      }
      if (localRefresh.restoredContext) {
        programContext = localRefresh.restoredContext;
      }
    }

    const evaluationResult = await openaiClient.evaluateProgram({
      context: programContext,
      attempt: 0,
    });
    await writeJson(path.join(artifactDir, "evaluation-response.json"), safeModelResult(evaluationResult));

    if (evaluationResult.evaluation.match) {
      return buildProcessResult(programId, "ok", evaluationResult.evaluation);
    }

    if (options.dryRun) {
      return buildProcessResult(programId, "needs_update", evaluationResult.evaluation);
    }

    if (options.refreshDatabase) {
      const refreshResult = await refreshAndEvaluateDatabaseTopics({
        programId,
        programContext,
        context,
        artifactDir: path.join(artifactDir, "initial-db-refresh"),
        attempt: 0,
      });
      if (refreshResult.accepted) {
        return buildProcessResult(programId, "reloaded", refreshResult.evaluationResult.evaluation, {
          dbRowsWritten: refreshResult.refreshResult.rowsWritten,
        });
      }
      programContext = refreshResult.restoredContext || programContext;
    }

    const repairPlanDir = path.join(artifactDir, "repair-plan");
    await fs.mkdir(repairPlanDir, { recursive: true });
    try {
      const sourcePlan = buildPatchSourcePlan({
        programContext,
        evaluation: evaluationResult.evaluation,
      });
      const sourceSnippets = await loadSourceSnippets(repoRoot, sourcePlan.filePaths, {
        searchTerms: sourcePlan.searchTerms,
      });
      const repairPlanResult = await openaiClient.requestRepairPlan({
        context: programContext,
        evaluation: evaluationResult.evaluation,
        allowedFiles: DEFAULT_ALLOWED_WRITABLE_FILES,
        sourceSnippets,
      });
      const repairPlanPath = path.join(repairPlanDir, "repair-plan-response.json");
      await writeJson(repairPlanPath, safeModelResult(repairPlanResult));
      return buildProcessResult(programId, "needs_parser_fix", evaluationResult.evaluation, {
        repairPlanPath: path.relative(repoRoot, repairPlanPath),
      });
    } catch (error) {
      await writeJson(path.join(repairPlanDir, "error.json"), { error: error.message });
      if (isOpenAIQuotaExceededError(error)) {
        return buildProcessResult(programId, "api_blocked", evaluationResult.evaluation, { error: error.message });
      }
      return buildProcessResult(programId, "needs_parser_fix", evaluationResult.evaluation, {
        error: error.message,
      });
    }
  } catch (error) {
    if (isOpenAIQuotaExceededError(error)) {
      return buildProcessResult(programId, "api_blocked", null, { error: error.message });
    }
    return buildProcessResult(programId, "failed", null, { error: error.message });
  }
}

async function loadProgramContextForUpdater(programId, context) {
  return loadProgramContext(programId, {
    repoRoot: context.repoRoot,
    databaseUrl: context.databaseUrl,
    queryRows: context.queryRows,
    extractDocumentText: context.deps.extractDocumentText,
    parseCalendarTopics: context.deps.parseCalendarTopics,
  });
}

async function verifyRegressionForUpdater(context) {
  return verifyRegressionCases({
    repoRoot: context.repoRoot,
    loadProgramContext: (regressionProgramId) => loadProgramContextForUpdater(regressionProgramId, context),
  });
}

async function tryLocalDatabaseRefresh(input) {
  const { programId, programContext, context, artifactDir } = input;
  const candidate = getLocalDatabaseRefreshCandidate(programContext);
  if (!candidate.eligible) {
    return { accepted: false, candidate };
  }

  await fs.mkdir(artifactDir, { recursive: true });
  await writeJson(path.join(artifactDir, "local-refresh-candidate.json"), candidate);

  const evaluation = buildLocalEvaluation({
    match: !context.options.dryRun,
    confidence: candidate.quality.confidence,
    failureMode: context.options.dryRun ? candidate.reason : "",
    recommendation: context.options.dryRun ? "Apply mode can refresh database topics from fresh parser output without an OpenAI call." : "",
  });

  if (context.options.dryRun) {
    return { accepted: true, evaluation, candidate };
  }

  let databaseSnapshot = null;
  try {
    databaseSnapshot = await snapshotDatabaseTopics(programId, {
      queryRows: context.queryRows,
      databaseUrl: context.databaseUrl,
    });
    const refreshResult = await refreshDatabaseTopicsForProgram(programContext, {
      executeSql: context.executeSql,
      databaseUrl: context.databaseUrl,
    });
    const refreshedContext = await loadProgramContextForUpdater(programId, context);
    const databaseMatchesFresh = areTopicRowsEquivalent(refreshedContext.databaseTopics, refreshedContext.freshTopics);
    const regressionVerification = await verifyRegressionForUpdater(context);
    await writeJson(path.join(artifactDir, "verification-summary.json"), {
      localRefresh: {
        passed: databaseMatchesFresh && regressionVerification.passed,
        databaseMatchesFresh,
        candidate,
      },
      regression: regressionVerification,
      databaseRefresh: refreshResult,
    });
    await writeJson(path.join(artifactDir, "after-db-refresh-output.json"), {
      program: refreshedContext.program,
      databaseTopics: refreshedContext.databaseTopics,
      freshTopics: refreshedContext.freshTopics,
      warnings: refreshedContext.warnings,
      refresh: refreshResult,
    });

    if (databaseMatchesFresh && regressionVerification.passed) {
      return {
        accepted: true,
        evaluation,
        candidate,
        refreshedContext,
        refreshResult,
        regressionVerification,
      };
    }

    await restoreDatabaseTopicsSnapshot(databaseSnapshot, {
      executeSql: context.executeSql,
      databaseUrl: context.databaseUrl,
    });
    databaseSnapshot = null;

    return {
      accepted: false,
      candidate,
      restoredContext: await loadProgramContextForUpdater(programId, context),
      error: new Error("Local database refresh failed verification"),
    };
  } catch (error) {
    if (databaseSnapshot) {
      await restoreDatabaseTopicsSnapshot(databaseSnapshot, {
        executeSql: context.executeSql,
        databaseUrl: context.databaseUrl,
      });
    }
    await writeJson(path.join(artifactDir, "error.json"), { error: error.message });
    return {
      accepted: false,
      candidate,
      restoredContext: await loadProgramContextForUpdater(programId, context).catch(() => null),
      error,
    };
  }
}

async function refreshAndEvaluateDatabaseTopics(input) {
  const { programId, programContext, context, artifactDir, attempt } = input;
  await fs.mkdir(artifactDir, { recursive: true });

  let databaseSnapshot = null;
  try {
    databaseSnapshot = await snapshotDatabaseTopics(programId, {
      queryRows: context.queryRows,
      databaseUrl: context.databaseUrl,
    });
    const refreshResult = await refreshDatabaseTopicsForProgram(programContext, {
      executeSql: context.executeSql,
      databaseUrl: context.databaseUrl,
    });
    const refreshedContext = await loadProgramContextForUpdater(programId, context);
    await writeJson(path.join(artifactDir, "after-db-refresh-output.json"), {
      program: refreshedContext.program,
      databaseTopics: refreshedContext.databaseTopics,
      freshTopics: refreshedContext.freshTopics,
      warnings: refreshedContext.warnings,
      refresh: refreshResult,
    });

    const currentVerification = await verifyCurrentProgram({
      context: refreshedContext,
      evaluator: (verifyContext) =>
        context.openaiClient.evaluateProgram({
          context: verifyContext,
          attempt,
        }),
    });
    const regressionVerification = await verifyRegressionForUpdater(context);
    await writeJson(path.join(artifactDir, "verification-summary.json"), {
      currentProgram: {
        passed: currentVerification.passed,
        evaluation: currentVerification.evaluationResult.evaluation,
      },
      regression: regressionVerification,
      databaseRefresh: refreshResult,
    });

    if (currentVerification.passed && regressionVerification.passed) {
      return {
        accepted: true,
        refreshedContext,
        evaluationResult: currentVerification.evaluationResult,
        refreshResult,
        regressionVerification,
      };
    }

    await restoreDatabaseTopicsSnapshot(databaseSnapshot, {
      executeSql: context.executeSql,
      databaseUrl: context.databaseUrl,
    });
    databaseSnapshot = null;

    return {
      accepted: false,
      restoredContext: await loadProgramContextForUpdater(programId, context),
      evaluationResult: currentVerification.evaluationResult,
      refreshResult,
      regressionVerification,
      error: new Error("Database topic refresh or regression verification failed"),
    };
  } catch (error) {
    if (databaseSnapshot) {
      await restoreDatabaseTopicsSnapshot(databaseSnapshot, {
        executeSql: context.executeSql,
        databaseUrl: context.databaseUrl,
      });
    }
    await writeJson(path.join(artifactDir, "error.json"), { error: error.message });
    return {
      accepted: false,
      restoredContext: await loadProgramContextForUpdater(programId, context).catch(() => null),
      error,
    };
  }
}

async function loadProgramIdsFromCsv(filePath, options = {}) {
  const content = await fs.readFile(filePath, "utf-8");
  const records = parseCsv(content);
  if (!records.length && !content.trim()) return [];

  const header = content.split(/\r?\n/u)[0] || "";
  if (!header.split(",").map((column) => column.trim()).includes("program_id")) {
    throw new Error("CSV must contain a program_id column");
  }

  const ids = [];
  const seen = new Set();
  for (const record of records) {
    const rawValue = String(record.program_id || "").trim();
    if (!rawValue) continue;
    const id = Number(rawValue);
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error(`Invalid program_id value: ${rawValue}`);
    }
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (options.limit && ids.length >= options.limit) break;
  }
  return ids;
}

async function loadProgramContext(programId, options = {}) {
  const repoRoot = options.repoRoot || REPO_ROOT;
  const databaseUrl = options.databaseUrl || DEFAULT_DATABASE_URL;
  const queryRowsImpl = options.queryRows || queryRows;
  const extractDocumentText =
    options.extractDocumentText || require("../extractors").extractDocumentText;
  const parseCalendarTopics =
    options.parseCalendarTopics || loadCalendarTopicParser(repoRoot);

  const program = await loadProgram(programId, { queryRows: queryRowsImpl, databaseUrl });
  if (!program) {
    throw new Error(`Program not found: ${programId}`);
  }
  if (!program.documentPath) {
    throw new Error(`Program ${programId} has no local document path`);
  }

  const databaseTopics = await loadDatabaseTopics(programId, {
    queryRows: queryRowsImpl,
    databaseUrl,
  });
  const documentFormat = inferDocumentFormat(program.documentPath);
  const extraction = await extractDocumentText({
    documentPath: program.documentPath,
    documentFormat,
  });
  const parsed = parseCalendarTopics({
    text: extraction.text,
    documentPath: program.documentPath,
    documentFormat: extraction.documentFormat || documentFormat,
  });

  return {
    program,
    extraction: {
      documentFormat: extraction.documentFormat || documentFormat,
      extractionMethod: extraction.extractionMethod || "",
    },
    databaseTopics,
    freshTopics: parsed.topics || [],
    warnings: [...(extraction.warnings || []), ...(parsed.warnings || [])],
    documentExcerpt: buildDocumentExcerpt(extraction.text || ""),
  };
}

async function loadProgram(programId, { queryRows: queryRowsImpl, databaseUrl }) {
  const rows = await queryRowsImpl(
    `
SELECT
  id,
  replace(encode(convert_to(COALESCE(search_name, ''), 'UTF8'), 'base64'), E'\\n', ''),
  replace(encode(convert_to(COALESCE(source_url, ''), 'UTF8'), 'base64'), E'\\n', ''),
  replace(encode(convert_to(COALESCE(program_document_url, ''), 'UTF8'), 'base64'), E'\\n', ''),
  replace(encode(convert_to(COALESCE(program_document_local_path, ''), 'UTF8'), 'base64'), E'\\n', '')
FROM pfdo_programs
WHERE id = ${Number(programId)}
LIMIT 1;
`,
    databaseUrl,
  );

  if (!rows.length) return null;
  const row = rows[0];
  return {
    id: Number(row[0]),
    name: decodeBase64(row[1]),
    portalUrl: decodeBase64(row[2]),
    documentUrl: decodeBase64(row[3]),
    documentPath: decodeBase64(row[4]),
  };
}

async function loadDatabaseTopics(programId, { queryRows: queryRowsImpl, databaseUrl }) {
  const rows = await queryRowsImpl(
    `
SELECT
  topic_order,
  replace(encode(convert_to(COALESCE(section_title, ''), 'UTF8'), 'base64'), E'\\n', ''),
  replace(encode(convert_to(COALESCE(topic_name, ''), 'UTF8'), 'base64'), E'\\n', ''),
  COALESCE(hours_theory::TEXT, ''),
  COALESCE(hours_practice::TEXT, ''),
  COALESCE(hours_total::TEXT, ''),
  replace(encode(convert_to(COALESCE(source_section, ''), 'UTF8'), 'base64'), E'\\n', ''),
  replace(encode(convert_to(COALESCE(source_excerpt, ''), 'UTF8'), 'base64'), E'\\n', '')
FROM pfdo_program_calendar_topics
WHERE program_id = ${Number(programId)}
ORDER BY topic_order;
`,
    databaseUrl,
  );

  return rows.map((row) => ({
    topic_order: Number(row[0]),
    section_title: decodeBase64(row[1]),
    topic_name: decodeBase64(row[2]),
    hours_theory: parseNullableNumber(row[3]),
    hours_practice: parseNullableNumber(row[4]),
    hours_total: parseNullableNumber(row[5]),
    source_section: decodeBase64(row[6]),
    source_excerpt: decodeBase64(row[7]),
  }));
}

async function snapshotDatabaseTopics(programId, { queryRows: queryRowsImpl, databaseUrl }) {
  const rows = await queryRowsImpl(
    `
SELECT
  id,
  program_id,
  topic_order,
  replace(encode(convert_to(COALESCE(section_title, ''), 'UTF8'), 'base64'), E'\\n', ''),
  replace(encode(convert_to(COALESCE(topic_name, ''), 'UTF8'), 'base64'), E'\\n', ''),
  COALESCE(hours_theory::TEXT, ''),
  COALESCE(hours_practice::TEXT, ''),
  COALESCE(hours_total::TEXT, ''),
  replace(encode(convert_to(COALESCE(activity_type, ''), 'UTF8'), 'base64'), E'\\n', ''),
  replace(encode(convert_to(COALESCE(control_form, ''), 'UTF8'), 'base64'), E'\\n', ''),
  replace(encode(convert_to(COALESCE(source_section, ''), 'UTF8'), 'base64'), E'\\n', ''),
  replace(encode(convert_to(COALESCE(source_excerpt, ''), 'UTF8'), 'base64'), E'\\n', ''),
  replace(encode(convert_to(COALESCE(document_path, ''), 'UTF8'), 'base64'), E'\\n', ''),
  replace(encode(convert_to(COALESCE(document_format, ''), 'UTF8'), 'base64'), E'\\n', ''),
  replace(encode(convert_to(COALESCE(extraction_method, ''), 'UTF8'), 'base64'), E'\\n', ''),
  COALESCE(confidence::TEXT, ''),
  replace(encode(convert_to(COALESCE(raw_payload::TEXT, '{}'), 'UTF8'), 'base64'), E'\\n', ''),
  COALESCE(imported_at::TEXT, '')
FROM pfdo_program_calendar_topics
WHERE program_id = ${Number(programId)}
ORDER BY id;
`,
    databaseUrl,
  );

  return {
    programId: Number(programId),
    rows: rows.map((row) => ({
      id: Number(row[0]),
      programId: Number(row[1]),
      topicOrder: Number(row[2]),
      sectionTitle: decodeBase64(row[3]),
      topicName: decodeBase64(row[4]),
      hoursTheory: parseNullableNumber(row[5]),
      hoursPractice: parseNullableNumber(row[6]),
      hoursTotal: parseNullableNumber(row[7]),
      activityType: decodeBase64(row[8]),
      controlForm: decodeBase64(row[9]),
      sourceSection: decodeBase64(row[10]),
      sourceExcerpt: decodeBase64(row[11]),
      documentPath: decodeBase64(row[12]),
      documentFormat: decodeBase64(row[13]),
      extractionMethod: decodeBase64(row[14]),
      confidence: parseNullableNumber(row[15]),
      rawPayload: parseJsonCell(decodeBase64(row[16])),
      importedAt: row[17] || null,
    })),
  };
}

async function restoreDatabaseTopicsSnapshot(snapshot, options = {}) {
  const executeSqlImpl = options.executeSql || executeSql;
  const sql = buildReplaceDatabaseTopicsSql(snapshot.programId, snapshot.rows, {
    preserveIds: true,
  });
  await executeSqlImpl(sql, options.databaseUrl);
  return {
    programId: snapshot.programId,
    rowsRestored: snapshot.rows.length,
  };
}

async function refreshDatabaseTopicsForProgram(programContext, options = {}) {
  const executeSqlImpl = options.executeSql || executeSql;
  const rows = buildDatabaseTopicRowsFromContext(programContext);
  const sql = buildReplaceDatabaseTopicsSql(programContext.program.id, rows);
  await executeSqlImpl(sql, options.databaseUrl);
  return {
    programId: programContext.program.id,
    rowsWritten: rows.length,
  };
}

function buildDatabaseTopicRowsFromContext(programContext) {
  const program = programContext.program;
  return (programContext.freshTopics || []).map((topic, index) => ({
    programId: program.id,
    topicOrder: topic.topic_order ?? topic.topicOrder ?? index + 1,
    sectionTitle: topic.section_title ?? topic.sectionTitle ?? "",
    topicName: topic.topic_name ?? topic.topicName ?? "",
    hoursTheory: topic.hours_theory ?? topic.hoursTheory ?? null,
    hoursPractice: topic.hours_practice ?? topic.hoursPractice ?? null,
    hoursTotal: topic.hours_total ?? topic.hoursTotal ?? null,
    activityType: topic.activity_type ?? topic.activityType ?? "",
    controlForm: topic.control_form ?? topic.controlForm ?? "",
    sourceSection: topic.source_section ?? topic.sourceSection ?? "",
    sourceExcerpt: topic.source_excerpt ?? topic.sourceExcerpt ?? "",
    documentPath: program.documentPath,
    documentFormat: programContext.extraction.documentFormat,
    extractionMethod: programContext.extraction.extractionMethod,
    confidence: topic.confidence ?? null,
    rawPayload: {
      ...(topic.raw_payload || topic.rawPayload || {}),
      program_name: program.name,
      program_portal_url: program.portalUrl,
      program_document_url: program.documentUrl,
      extraction_warnings: programContext.warnings || [],
    },
  }));
}

function buildReplaceDatabaseTopicsSql(programId, rows, options = {}) {
  const insertSql = rows.length
    ? `
INSERT INTO pfdo_program_calendar_topics (
${databaseTopicColumns(options).map((column) => `  ${column}`).join(",\n")}
)
VALUES
${rows.map((row) => formatDatabaseTopicRow(row, options)).join(",\n")};
`
    : "";

  return `
BEGIN;
DELETE FROM pfdo_program_calendar_topics WHERE program_id = ${Number(programId)};
${insertSql}COMMIT;
`;
}

function databaseTopicColumns(options = {}) {
  const columns = [
    "program_id",
    "topic_order",
    "section_title",
    "topic_name",
    "hours_theory",
    "hours_practice",
    "hours_total",
    "activity_type",
    "control_form",
    "source_section",
    "source_excerpt",
    "document_path",
    "document_format",
    "extraction_method",
    "confidence",
    "raw_payload",
  ];

  if (options.preserveIds) {
    return ["id", ...columns, "imported_at"];
  }
  return columns;
}

function formatDatabaseTopicRow(row, options = {}) {
  const values = [
    Number(row.programId),
    Number(row.topicOrder),
    nullableText(row.sectionTitle),
    textToSql(row.topicName),
    nullableNumber(row.hoursTheory),
    nullableNumber(row.hoursPractice),
    nullableNumber(row.hoursTotal),
    nullableText(row.activityType),
    nullableText(row.controlForm),
    nullableText(row.sourceSection),
    nullableText(row.sourceExcerpt),
    nullableText(row.documentPath),
    nullableText(row.documentFormat),
    nullableText(row.extractionMethod),
    nullableNumber(row.confidence),
    jsonToSql(row.rawPayload || {}),
  ];

  if (options.preserveIds) {
    values.unshift(Number(row.id));
    values.push(nullableText(row.importedAt));
  }

  return `(${values.join(", ")})`;
}

function getLocalDatabaseRefreshCandidate(programContext) {
  const quality = evaluateFreshParserQuality(programContext);
  const diff = compareTopicRowsForLocalRefresh(
    programContext.databaseTopics || [],
    programContext.freshTopics || [],
  );
  const databaseEmpty = !programContext.databaseTopics || programContext.databaseTopics.length === 0;
  const staleByMissingRows =
    diff.missingInDatabase.length > 0 &&
    diff.extraInDatabase.length === 0 &&
    diff.hourMismatches.length === 0;
  const eligible = quality.passed && !diff.equal && (databaseEmpty || staleByMissingRows);

  return {
    eligible,
    reason: eligible
      ? "Fresh parser output passes local checks and database is missing parser rows without conflicting extras or hour mismatches."
      : "Local refresh is not safe without GPT evaluation.",
    quality,
    diff,
  };
}

function evaluateFreshParserQuality(programContext) {
  const topics = programContext.freshTopics || [];
  const warnings = programContext.warnings || [];
  const reasons = [];

  if (!topics.length) {
    reasons.push("fresh parser returned no topics");
  }
  if (warnings.some((warning) => /No calendar-topic rows found/iu.test(warning))) {
    reasons.push("fresh parser reported missing calendar-topic rows");
  }
  if (topics.some((topic) => !normalizeComparisonText(topic.topic_name || topic.topicName))) {
    reasons.push("fresh parser returned a topic without a name");
  }
  const totalHours = sumTopicNumbers(topics, "hours_total", "hoursTotal");
  const splitHours = sumTopicNumbers(topics, "hours_theory", "hoursTheory") + sumTopicNumbers(topics, "hours_practice", "hoursPractice");
  if (topics.length && totalHours <= 0 && splitHours <= 0) {
    reasons.push("fresh parser returned no positive hours");
  }

  return {
    passed: reasons.length === 0,
    confidence: reasons.length === 0 ? 0.82 : 0,
    reasons,
    topicsCount: topics.length,
    hoursTotal: roundNumber(totalHours),
    hoursSplit: roundNumber(splitHours),
  };
}

function compareTopicRowsForLocalRefresh(databaseRows, freshRows) {
  const database = databaseRows.map(compactComparableTopicRow);
  const fresh = freshRows.map(compactComparableTopicRow);
  const keyFor = (row) => `${row.topic_order ?? ""}|${normalizeComparisonText(row.topic_name)}`;
  const databaseByKey = new Map(database.map((row) => [keyFor(row), row]));
  const freshByKey = new Map(fresh.map((row) => [keyFor(row), row]));
  const missingInDatabase = fresh.filter((row) => !databaseByKey.has(keyFor(row))).map(compactDiffRow);
  const extraInDatabase = database.filter((row) => !freshByKey.has(keyFor(row))).map(compactDiffRow);
  const hourMismatches = [];

  for (const freshRow of fresh) {
    const databaseRow = databaseByKey.get(keyFor(freshRow));
    if (!databaseRow) continue;
    if (
      !sameNullableNumber(databaseRow.hours_theory, freshRow.hours_theory) ||
      !sameNullableNumber(databaseRow.hours_practice, freshRow.hours_practice) ||
      !sameNullableNumber(databaseRow.hours_total, freshRow.hours_total)
    ) {
      hourMismatches.push({
        topic_order: freshRow.topic_order,
        topic_name: freshRow.topic_name,
        database: compactHours(databaseRow),
        fresh: compactHours(freshRow),
      });
    }
  }

  return {
    equal: missingInDatabase.length === 0 && extraInDatabase.length === 0 && hourMismatches.length === 0,
    databaseCount: database.length,
    freshCount: fresh.length,
    missingInDatabase,
    extraInDatabase,
    hourMismatches,
  };
}

function areTopicRowsEquivalent(databaseRows, freshRows) {
  return compareTopicRowsForLocalRefresh(databaseRows || [], freshRows || []).equal;
}

function compactComparableTopicRow(row) {
  return {
    topic_order: row.topic_order ?? row.topicOrder ?? null,
    topic_name: row.topic_name ?? row.topicName ?? "",
    hours_theory: row.hours_theory ?? row.hoursTheory ?? null,
    hours_practice: row.hours_practice ?? row.hoursPractice ?? null,
    hours_total: row.hours_total ?? row.hoursTotal ?? null,
  };
}

function compactDiffRow(row) {
  return {
    topic_order: row.topic_order,
    topic_name: row.topic_name,
    hours_theory: row.hours_theory,
    hours_practice: row.hours_practice,
    hours_total: row.hours_total,
  };
}

function compactHours(row) {
  return {
    hours_theory: row.hours_theory,
    hours_practice: row.hours_practice,
    hours_total: row.hours_total,
  };
}

function buildLocalEvaluation(input) {
  return {
    match: Boolean(input.match),
    confidence: input.confidence ?? 0.82,
    missing_topics: [],
    extra_topics: [],
    wrong_hours: [],
    failure_mode: input.failureMode || "",
    recommended_parser_change: input.recommendation || "",
  };
}

function normalizeComparisonText(value) {
  return String(value || "").replace(/\s+/gu, " ").trim().toLowerCase();
}

function sameNullableNumber(left, right) {
  if (left == null && right == null) return true;
  return Number(left) === Number(right);
}

function sumTopicNumbers(topics, snakeKey, camelKey) {
  return topics.reduce((total, topic) => {
    const number = Number(topic[snakeKey] ?? topic[camelKey]);
    return Number.isFinite(number) ? total + number : total;
  }, 0);
}

function roundNumber(value) {
  return Number(Number(value).toFixed(2));
}

function buildDocumentExcerpt(text, maxChars = 14000) {
  const normalized = String(text || "").replace(/\r\n?/gu, "\n").replace(/[ \t]+/gu, " ");
  if (normalized.length <= maxChars) return normalized;

  const planMatch = /(учебн[оы]\s*[- ]?\s*тематическ|календарн[оы]\s*[- ]?\s*тематическ|теория\s+практика\s+всего|тема\s+теория\s+практика\s+всего)/iu.exec(
    normalized,
  );
  if (planMatch) {
    const start = Math.max(0, planMatch.index - 1500);
    return normalized.slice(start, start + maxChars);
  }

  const headLength = Math.floor(maxChars * 0.65);
  const tailLength = maxChars - headLength;
  return `${normalized.slice(0, headLength)}\n...\n${normalized.slice(-tailLength)}`;
}

function loadCalendarTopicParser(repoRoot) {
  const parserPath = path.join(
    repoRoot,
    "services/program-topic-extractor/src/parsers/calendar-topics.js",
  );
  delete require.cache[require.resolve(parserPath)];
  return require(parserPath).extractCalendarTopicsFromText;
}

function buildPatchSourcePlan({ programContext, evaluation }) {
  const documentFormat = String(programContext.extraction?.documentFormat || "").toLowerCase();
  const text = [
    evaluation?.failure_mode,
    evaluation?.recommended_parser_change,
    ...(programContext.warnings || []),
  ].join("\n");
  const filePaths = new Set(["services/program-topic-extractor/src/parsers/calendar-topics.js"]);
  const searchTerms = new Set([
    "extractCalendarTopicsFromText",
    "postProcessExtractedTopics",
    "parseCalendarRow",
  ]);

  if (documentFormat === "docx" || /docx|structured|table|таблиц/iu.test(text)) {
    filePaths.add("services/program-topic-extractor/src/extractors/docx-tables.js");
    filePaths.add("services/program-topic-extractor/src/python/docx_tables_extract.py");
    for (const term of [
      "STRUCTURED_DOCX_TABLE",
      "parseDelimitedTableRow",
      "isDelimitedHeaderRow",
      "inferDelimitedHours",
      "normalizeDelimitedHoursByTopicContext",
      "splitControlTail",
      "selectPreferredDelimitedTableRows",
      "selectOverviewStructuredStudyPlanGroup",
    ]) {
      searchTerms.add(term);
    }
  }

  if (documentFormat === "pdf" || /pdf|ocr|скан/iu.test(text)) {
    filePaths.add("services/program-topic-extractor/src/extractors/pdf.js");
    filePaths.add("services/program-topic-extractor/src/python/pdf_extract.py");
    filePaths.add("services/program-topic-extractor/src/swift/pdf_ocr.swift");
    searchTerms.add("extractVerticalCalendarRows");
    searchTerms.add("extractWideTrainingPlanRows");
  }

  if (documentFormat === "doc" || /html|textutil|cell-wise|vertical|\.doc/iu.test(text)) {
    filePaths.add("services/program-topic-extractor/src/extractors/plain-text.js");
    filePaths.add("services/program-topic-extractor/src/extractors/textutil.js");
    searchTerms.add("cell-wise-study-plan");
    searchTerms.add("extractCellWiseStudyPlanRows");
    searchTerms.add("extractVerticalCalendarRows");
  }

  return {
    filePaths: [...filePaths].filter((filePath) => DEFAULT_ALLOWED_WRITABLE_FILES.includes(filePath)),
    searchTerms: [...searchTerms],
  };
}

async function loadSourceSnippets(repoRoot, filePaths, options = {}) {
  const maxChars = options.maxChars || 12000;
  const searchTerms = options.searchTerms || [];
  const snippets = {};
  for (const filePath of filePaths) {
    try {
      const content = await fs.readFile(path.join(repoRoot, filePath), "utf-8");
      snippets[filePath] = focusSourceSnippet(content, searchTerms, maxChars);
    } catch (error) {
      if (error && error.code === "ENOENT") {
        snippets[filePath] = `// Source file is unavailable in this workspace: ${filePath}`;
        continue;
      }
      throw error;
    }
  }
  return snippets;
}

function focusSourceSnippet(content, searchTerms, maxChars) {
  if (content.length <= maxChars) return content;
  const normalizedTerms = [...new Set((searchTerms || []).map((term) => String(term || "").trim()).filter(Boolean))];
  const lowerContent = content.toLowerCase();
  const windows = [];
  const windowSize = Math.max(1800, Math.floor(maxChars / Math.max(2, Math.min(normalizedTerms.length || 1, 6))));

  for (const term of normalizedTerms) {
    const index = lowerContent.indexOf(term.toLowerCase());
    if (index < 0) continue;
    const start = Math.max(0, index - Math.floor(windowSize / 3));
    const end = Math.min(content.length, start + windowSize);
    windows.push({ start, end });
  }

  if (!windows.length) {
    return content.slice(0, maxChars);
  }

  windows.sort((left, right) => left.start - right.start);
  const merged = [];
  for (const window of windows) {
    const previous = merged[merged.length - 1];
    if (previous && window.start <= previous.end + 200) {
      previous.end = Math.max(previous.end, window.end);
    } else {
      merged.push({ ...window });
    }
  }

  const chunks = [];
  let used = 0;
  for (const window of merged) {
    if (used >= maxChars) break;
    const remaining = maxChars - used;
    const chunk = content.slice(window.start, Math.min(window.end, window.start + remaining));
    chunks.push(`/* source excerpt ${window.start}-${window.start + chunk.length} */\n${chunk}`);
    used += chunk.length;
  }
  return chunks.join("\n\n/* ... */\n\n").slice(0, maxChars);
}

async function writeReports(repoRoot, rows, options) {
  const csvPath = path.join(repoRoot, options.reportCsv || DEFAULT_REPORT_CSV);
  const jsonPath = path.join(repoRoot, options.reportJson || DEFAULT_REPORT_JSON);
  await fs.mkdir(path.dirname(csvPath), { recursive: true });
  await fs.mkdir(path.dirname(jsonPath), { recursive: true });

  const fieldOrder = [
    "program_id",
    "status",
    "match",
    "confidence",
    "failure_mode",
    "recommended_parser_change",
    "attempts",
    "db_rows_written",
    "repair_plan_path",
    "error",
  ];
  await fs.writeFile(csvPath, stringifyCsv(rows, fieldOrder), "utf-8");
  await writeJson(jsonPath, rows);
}

function buildProcessResult(programId, status, evaluation, extra = {}) {
  return {
    reportRow: {
      program_id: programId,
      status,
      match: evaluation ? evaluation.match : "",
      confidence: evaluation ? evaluation.confidence : "",
      failure_mode: evaluation ? evaluation.failure_mode : "",
      recommended_parser_change: evaluation ? evaluation.recommended_parser_change : "",
      attempts: extra.attempts || "",
      db_rows_written: extra.dbRowsWritten ?? "",
      repair_plan_path: extra.repairPlanPath || "",
      error: extra.error || "",
    },
  };
}

function countStatuses(rows) {
  return rows.reduce((counts, row) => {
    counts[row.status] = (counts[row.status] || 0) + 1;
    return counts;
  }, {});
}

function safeModelResult(result) {
  return {
    request: result.request,
    outputText: result.outputText,
    patchText: result.patchText,
    repairPlan: result.repairPlan,
    evaluation: result.evaluation,
  };
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}

function resolveInsideRepo(repoRoot, inputPath) {
  if (!inputPath) {
    throw new Error("Missing path");
  }
  return path.isAbsolute(inputPath) ? inputPath : path.join(repoRoot, inputPath);
}

function requireValue(option, value) {
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${option}`);
  }
  return value;
}

function parsePositiveInteger(option, value) {
  const rawValue = requireValue(option, value);
  const number = Number(rawValue);
  if (!Number.isInteger(number) || number < 1) {
    throw new Error(`${option} must be a positive integer`);
  }
  return number;
}

function inferDocumentFormat(documentPath) {
  return path.extname(documentPath).replace(/^\./u, "").toLowerCase();
}

function decodeBase64(value) {
  return value ? Buffer.from(value, "base64").toString("utf-8") : "";
}

function parseNullableNumber(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function nullableText(value) {
  return value == null || value === "" ? "NULL" : textToSql(value);
}

function nullableNumber(value) {
  if (value == null || value === "") return "NULL";
  const number = Number(value);
  return Number.isFinite(number) ? String(number) : "NULL";
}

function parseJsonCell(value) {
  if (!value) return {};
  try {
    return JSON.parse(value);
  } catch (_error) {
    return {};
  }
}

module.exports = {
  REPO_ROOT,
  DEFAULT_DATABASE_URL,
  DEFAULT_ALLOWED_WRITABLE_FILES,
  DEFAULT_OUT_DIR,
  DEFAULT_OPENAI_CACHE_DIR,
  parseArgs,
  printHelp,
  runParserUpdater,
  processProgram,
  loadProgramIdsFromCsv,
  loadProgramContext,
  loadProgram,
  loadDatabaseTopics,
  snapshotDatabaseTopics,
  restoreDatabaseTopicsSnapshot,
  refreshDatabaseTopicsForProgram,
  buildDatabaseTopicRowsFromContext,
  buildReplaceDatabaseTopicsSql,
  getLocalDatabaseRefreshCandidate,
  evaluateFreshParserQuality,
  compareTopicRowsForLocalRefresh,
  areTopicRowsEquivalent,
  buildDocumentExcerpt,
  buildPatchSourcePlan,
  loadSourceSnippets,
  focusSourceSnippet,
  loadCalendarTopicParser,
  resolveInsideRepo,
  countStatuses,
};
