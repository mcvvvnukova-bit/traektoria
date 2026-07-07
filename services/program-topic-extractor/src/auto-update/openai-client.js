const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { setTimeout: sleep } = require("node:timers/promises");
const {
  DEFAULT_OPENROUTER_API_URL,
  DEFAULT_OPENROUTER_MODEL,
  createChatCompletion,
  extractChatCompletionText,
  resolveLlmConfig,
} = require("../../../../src/llm-client");

const DEFAULT_API_URL = DEFAULT_OPENROUTER_API_URL;
const DEFAULT_MODEL = DEFAULT_OPENROUTER_MODEL;
const DEFAULT_MAX_RETRIES = 4;

const EVALUATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "match",
    "confidence",
    "missing_topics",
    "extra_topics",
    "wrong_hours",
    "failure_mode",
    "recommended_parser_change",
  ],
  properties: {
    match: { type: "boolean" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    missing_topics: { type: "array", items: { type: "string" } },
    extra_topics: { type: "array", items: { type: "string" } },
    wrong_hours: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["topic", "expected", "actual"],
        properties: {
          topic: { type: "string" },
          expected: { type: "string" },
          actual: { type: "string" },
        },
      },
    },
    failure_mode: { type: "string" },
    recommended_parser_change: { type: "string" },
  },
};

const REPAIR_PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "root_cause",
    "target_files",
    "target_functions",
    "parser_change_plan",
    "database_action",
    "verification_plan",
    "risk_level",
    "notes",
  ],
  properties: {
    summary: { type: "string" },
    root_cause: { type: "string" },
    target_files: { type: "array", items: { type: "string" } },
    target_functions: { type: "array", items: { type: "string" } },
    parser_change_plan: { type: "array", items: { type: "string" } },
    database_action: {
      type: "string",
      enum: ["none", "reload_after_parser_fix", "reload_only", "manual_review"],
    },
    verification_plan: { type: "array", items: { type: "string" } },
    risk_level: { type: "string", enum: ["low", "medium", "high"] },
    notes: { type: "string" },
  },
};

function createOpenAIClient(options = {}) {
  const modelOverride =
    (options.model && options.model !== DEFAULT_MODEL ? options.model : "") ||
    process.env.PFDO_PARSER_UPDATER_MODEL ||
    process.env.OPENAI_MODEL ||
    "";
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const cacheDir = options.cacheDir || process.env.PFDO_PARSER_UPDATER_OPENAI_CACHE_DIR || "";
  const parsedMaxRetries =
    options.maxRetries ?? Number(process.env.PFDO_PARSER_UPDATER_OPENAI_RETRIES || DEFAULT_MAX_RETRIES);
  const maxRetries = Number.isFinite(parsedMaxRetries) && parsedMaxRetries >= 0
    ? Math.floor(parsedMaxRetries)
    : DEFAULT_MAX_RETRIES;

  if (!fetchImpl) {
    throw new Error("Global fetch is unavailable. Use Node.js 18+ or inject fetchImpl.");
  }

  function resolveStepConfig(step) {
    return resolveLlmConfig(step, {
      provider: options.provider,
      defaultProvider: "openrouter",
      model: modelOverride || undefined,
      apiKey: options.apiKey,
      apiUrl: options.apiUrl,
      timeoutMs: options.timeoutMs,
      fetchImpl,
    });
  }

  async function createResponse(payload, step) {
    const config = resolveStepConfig(step);

    const cacheKey = cacheDir ? cacheKeyForPayload({
      provider: config.provider,
      apiUrl: config.apiUrl,
      payload,
    }) : "";
    if (cacheKey) {
      const cached = await readCachedResponse(cacheDir, cacheKey);
      if (cached) return cached;
    }

    let lastError = null;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        const body = await createChatCompletion({
          ...config,
          step,
          temperature: 0.1,
          maxTokens: parserUpdaterMaxTokens(),
          messages: responseRequestToMessages(payload),
        });

        if (cacheKey) {
          await writeCachedResponse(cacheDir, cacheKey, body);
        }
        return body;
      } catch (error) {
        if (attempt < maxRetries && isRetryableOpenAIError(error)) {
          lastError = error;
          await sleep(backoffMs(attempt));
          continue;
        }
        throw error;
      }
    }

    throw lastError || new Error("LLM API request failed after retries");
  }

  const initialConfig = resolveStepConfig("pfdo_parser_evaluation");

  return {
    model: initialConfig.model,
    async evaluateProgram(input) {
      const config = resolveStepConfig("pfdo_parser_evaluation");
      const request = buildEvaluationRequest({ model: config.model, ...input });
      const rawResponse = await createResponse(request, "pfdo_parser_evaluation");
      const outputText = extractResponseText(rawResponse);
      const evaluation = parseEvaluationJson(outputText);
      return {
        request,
        rawResponse,
        outputText,
        evaluation,
      };
    },
    async requestPatch(input) {
      const config = resolveStepConfig("pfdo_parser_patch");
      const request = buildPatchRequest({ model: config.model, ...input });
      const rawResponse = await createResponse(request, "pfdo_parser_patch");
      const patchText = extractResponseText(rawResponse).trim();
      return {
        request,
        rawResponse,
        patchText,
      };
    },
    async requestRepairPlan(input) {
      const config = resolveStepConfig("pfdo_parser_repair_plan");
      const request = buildRepairPlanRequest({ model: config.model, ...input });
      const rawResponse = await createResponse(request, "pfdo_parser_repair_plan");
      const outputText = extractResponseText(rawResponse);
      const repairPlan = parseRepairPlanJson(outputText);
      return {
        request,
        rawResponse,
        outputText,
        repairPlan,
      };
    },
  };
}

function buildEvaluationRequest({ model, context, attempt = 0 }) {
  return {
    model,
    instructions: [
      "You evaluate Russian PFDO educational program document parsing quality.",
      "Compare the document excerpt with current database topics and fresh parser topics.",
      "Return JSON only. Mark match=true only when the database topics are already correct for the document and the fresh parser topics are not worse.",
      "Use fresh parser topics as diagnostics: if they look correct but the database rows are stale, set match=false and recommend reloading database topics, not a schema change.",
      "Be conservative: if important document topics are missing, extra service/noise rows are present, or hours materially disagree, set match=false.",
      "When a structured thematic-planning table is present, treat its numbered topic rows as authoritative over narrative content sections. Do not require adding a narrative-only heading when the structured table skips that number.",
      "Do not set match=false solely because the source document itself has inconsistent numbering, a contradictory totals row, or malformed hour cells, if the parser preserves the structured topic rows and explicitly marks or repairs the anomaly in source_excerpt.",
      "If a row preserves raw contradictory hour values from the structured table and source_excerpt explicitly contains hours_inconsistent, treat that as a correct representation of a source-document defect rather than a parser mismatch.",
      "Use database_fresh_diff as factual diagnostics. If database_fresh_diff.equal is true, do not claim that the database is missing a row that exists in fresh_parser_topics.",
    ].join("\n"),
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify(
              {
                attempt,
                program: context.program,
                document_excerpt: context.documentExcerpt,
                database_topics: compactTopicRows(context.databaseTopics || []),
                fresh_parser_topics: compactTopicRows(context.freshTopics || []),
                database_fresh_diff: compareCompactTopicRows(context.databaseTopics || [], context.freshTopics || []),
                warnings: context.warnings || [],
              },
              null,
              2,
            ),
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "pfdo_parser_evaluation",
        strict: true,
        schema: EVALUATION_SCHEMA,
      },
    },
  };
}

function buildPatchRequest({
  model,
  context,
  evaluation,
  allowedFiles,
  sourceSnippets,
  attempt = 1,
  previousErrors = [],
}) {
  return {
    model,
    instructions: [
      "You are patching a Node.js rule-based parser for Russian PFDO program documents.",
      "Return only a unified diff. Do not include Markdown fences, prose, explanations, or multiple alternatives.",
      "The first line must be a standard unified diff header such as `diff --git a/path b/path`. Do not return `*** Begin Patch`; that format is invalid here.",
      "The diff must touch only the allowed file paths listed by the user.",
      "Prefer the smallest targeted parser change that fixes the failure mode without weakening existing rules.",
      "Do not change database schema, migrations, import scripts, package files, generated artifacts, or any database access code.",
      "Do not add SQL DDL, database helper imports, DATABASE_URL usage, or psql calls. The patch validator rejects them.",
    ].join("\n"),
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify(
              {
                attempt,
                previous_patch_errors: previousErrors,
                allowed_files: allowedFiles,
                program: context.program,
                evaluation,
                document_excerpt: context.documentExcerpt,
                database_topics: compactTopicRows(context.databaseTopics || []),
                fresh_parser_topics: compactTopicRows(context.freshTopics || []),
                database_fresh_diff: compareCompactTopicRows(context.databaseTopics || [], context.freshTopics || []),
                source_snippets: sourceSnippets || {},
              },
              null,
              2,
            ),
          },
        ],
      },
    ],
  };
}

function buildRepairPlanRequest({
  model,
  context,
  evaluation,
  allowedFiles,
  sourceSnippets,
}) {
  return {
    model,
    instructions: [
      "You diagnose parser failures in a Node.js rule-based parser for Russian PFDO program documents.",
      "Return JSON only. Do not return code, unified diffs, patches, Markdown fences, or replacement file contents.",
      "The goal is to produce a concrete repair plan that a local coding agent can implement and verify with tests.",
      "Focus on parser behavior: target files/functions, source-table layout, expected extraction rules, and verification steps.",
      "Do not propose changing database schema, migrations, import scripts, package files, generated artifacts, or database access code.",
      "If database rows are stale but fresh parser output is correct, set database_action=reload_only.",
      "If parser changes are required before DB reload, set database_action=reload_after_parser_fix.",
    ].join("\n"),
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify(
              {
                allowed_files: allowedFiles,
                program: context.program,
                evaluation,
                document_excerpt: context.documentExcerpt,
                database_topics: compactTopicRows(context.databaseTopics || []),
                fresh_parser_topics: compactTopicRows(context.freshTopics || []),
                database_fresh_diff: compareCompactTopicRows(context.databaseTopics || [], context.freshTopics || []),
                source_snippets: sourceSnippets || {},
              },
              null,
              2,
            ),
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "pfdo_parser_repair_plan",
        strict: true,
        schema: REPAIR_PLAN_SCHEMA,
      },
    },
  };
}

function responseRequestToMessages(request) {
  const systemParts = [];
  if (request.instructions) {
    systemParts.push(String(request.instructions));
  }
  if (request.text?.format?.schema) {
    systemParts.push([
      "Return a JSON object that matches this JSON Schema.",
      JSON.stringify(request.text.format.schema, null, 2),
    ].join("\n"));
  }

  const messages = [];
  if (systemParts.length) {
    messages.push({
      role: "system",
      content: systemParts.join("\n\n"),
    });
  }

  for (const item of request.input || []) {
    messages.push({
      role: item.role || "user",
      content: responseInputContentToText(item.content),
    });
  }

  return messages;
}

function parserUpdaterMaxTokens() {
  const parsed = Number(process.env.PFDO_PARSER_UPDATER_MAX_TOKENS || 4000);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 4000;
}

function responseInputContentToText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((item) => {
    if (typeof item === "string") return item;
    if (typeof item?.text === "string") return item.text;
    if (typeof item?.input_text === "string") return item.input_text;
    return "";
  }).join("\n");
}

function compactTopicRows(rows) {
  return rows.slice(0, 250).map((row) => ({
    topic_order: row.topic_order ?? row.topicOrder ?? null,
    section_title: row.section_title ?? row.sectionTitle ?? "",
    topic_name: row.topic_name ?? row.topicName ?? "",
    hours_theory: row.hours_theory ?? row.hoursTheory ?? null,
    hours_practice: row.hours_practice ?? row.hoursPractice ?? null,
    hours_total: row.hours_total ?? row.hoursTotal ?? null,
    source_section: row.source_section ?? row.sourceSection ?? "",
    source_excerpt: row.source_excerpt ?? row.sourceExcerpt ?? "",
  }));
}

function compareCompactTopicRows(databaseRows, freshRows) {
  const database = compactTopicRows(databaseRows);
  const fresh = compactTopicRows(freshRows);
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
        database: {
          hours_theory: databaseRow.hours_theory,
          hours_practice: databaseRow.hours_practice,
          hours_total: databaseRow.hours_total,
        },
        fresh: {
          hours_theory: freshRow.hours_theory,
          hours_practice: freshRow.hours_practice,
          hours_total: freshRow.hours_total,
        },
      });
    }
  }

  return {
    equal: missingInDatabase.length === 0 && extraInDatabase.length === 0 && hourMismatches.length === 0,
    database_count: database.length,
    fresh_count: fresh.length,
    missing_in_database: missingInDatabase.slice(0, 25),
    extra_in_database: extraInDatabase.slice(0, 25),
    hour_mismatches: hourMismatches.slice(0, 25),
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

function normalizeComparisonText(value) {
  return String(value || "").replace(/\s+/gu, " ").trim().toLowerCase();
}

function sameNullableNumber(left, right) {
  if (left == null && right == null) return true;
  return Number(left) === Number(right);
}

function cacheKeyForPayload(payload) {
  return crypto.createHash("sha256").update(stableStringify(payload)).digest("hex");
}

async function readCachedResponse(cacheDir, cacheKey) {
  try {
    const content = await fs.readFile(cachePath(cacheDir, cacheKey), "utf-8");
    return JSON.parse(content);
  } catch (error) {
    if (error && error.code === "ENOENT") return null;
    return null;
  }
}

async function writeCachedResponse(cacheDir, cacheKey, response) {
  const filePath = cachePath(cacheDir, cacheKey);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(response)}\n`, "utf-8");
}

function cachePath(cacheDir, cacheKey) {
  return path.join(cacheDir, `${cacheKey}.json`);
}

function stableStringify(value) {
  return JSON.stringify(sortJsonValue(value));
}

function sortJsonValue(value) {
  if (Array.isArray(value)) return value.map(sortJsonValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, sortJsonValue(value[key])]),
  );
}

function isOpenAIQuotaExceededError(error) {
  const code = String(error && error.code || "");
  const type = String(error && error.type || "");
  const message = String(error && error.message || "");
  return (
    /insufficient_quota|quota_exceeded/iu.test(code) ||
    /insufficient_quota|quota_exceeded/iu.test(type) ||
    /exceeded your current quota|check your plan and billing/iu.test(message)
  );
}

function isRetryableOpenAIError(error) {
  if (!error) return false;
  if (isOpenAIQuotaExceededError(error)) return false;
  if (error.status === 429 || error.status >= 500) return true;
  const message = String(error.message || "");
  return /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|network|socket|timeout/i.test(message);
}

function backoffMs(attempt) {
  return Math.min(12000, 1000 * 2 ** attempt);
}

function extractResponseText(response) {
  return extractChatCompletionText(response);
}

function parseEvaluationJson(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid evaluation JSON: ${error.message}`);
  }

  const required = EVALUATION_SCHEMA.required;
  for (const field of required) {
    if (!(field in parsed)) {
      throw new Error(`Evaluation JSON missing required field: ${field}`);
    }
  }

  if (typeof parsed.match !== "boolean") {
    throw new Error("Evaluation JSON field match must be boolean");
  }
  if (typeof parsed.confidence !== "number" || parsed.confidence < 0 || parsed.confidence > 1) {
    throw new Error("Evaluation JSON field confidence must be a number from 0 to 1");
  }
  for (const field of ["missing_topics", "extra_topics", "wrong_hours"]) {
    if (!Array.isArray(parsed[field])) {
      throw new Error(`Evaluation JSON field ${field} must be an array`);
    }
  }
  if (typeof parsed.failure_mode !== "string") {
    throw new Error("Evaluation JSON field failure_mode must be string");
  }
  if (typeof parsed.recommended_parser_change !== "string") {
    throw new Error("Evaluation JSON field recommended_parser_change must be string");
  }

  return parsed;
}

function parseRepairPlanJson(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid repair plan JSON: ${error.message}`);
  }

  for (const field of REPAIR_PLAN_SCHEMA.required) {
    if (!(field in parsed)) {
      throw new Error(`Repair plan JSON missing required field: ${field}`);
    }
  }
  for (const field of ["summary", "root_cause", "database_action", "risk_level", "notes"]) {
    if (typeof parsed[field] !== "string") {
      throw new Error(`Repair plan JSON field ${field} must be string`);
    }
  }
  for (const field of ["target_files", "target_functions", "parser_change_plan", "verification_plan"]) {
    if (!Array.isArray(parsed[field]) || !parsed[field].every((item) => typeof item === "string")) {
      throw new Error(`Repair plan JSON field ${field} must be an array of strings`);
    }
  }
  if (!REPAIR_PLAN_SCHEMA.properties.database_action.enum.includes(parsed.database_action)) {
    throw new Error("Repair plan JSON field database_action has invalid value");
  }
  if (!REPAIR_PLAN_SCHEMA.properties.risk_level.enum.includes(parsed.risk_level)) {
    throw new Error("Repair plan JSON field risk_level has invalid value");
  }

  return parsed;
}

module.exports = {
  DEFAULT_MODEL,
  EVALUATION_SCHEMA,
  REPAIR_PLAN_SCHEMA,
  createOpenAIClient,
  cacheKeyForPayload,
  isOpenAIQuotaExceededError,
  isRetryableOpenAIError,
  backoffMs,
  buildEvaluationRequest,
  buildPatchRequest,
  buildRepairPlanRequest,
  compactTopicRows,
  extractResponseText,
  parseEvaluationJson,
  parseRepairPlanJson,
};
