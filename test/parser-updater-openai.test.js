const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const {
  createOpenAIClient,
  extractResponseText,
  isOpenAIQuotaExceededError,
  parseEvaluationJson,
  parseRepairPlanJson,
} = require("../services/program-topic-extractor/src/auto-update/openai-client");

const validEvaluation = {
  match: true,
  confidence: 0.91,
  missing_topics: [],
  extra_topics: [],
  wrong_hours: [],
  failure_mode: "",
  recommended_parser_change: "",
};

const validRepairPlan = {
  summary: "Parser misses detailed DOCX rows.",
  root_cause: "The selector prefers the overview table.",
  target_files: ["services/program-topic-extractor/src/parsers/calendar-topics.js"],
  target_functions: ["selectPreferredDelimitedTableRows"],
  parser_change_plan: ["Prefer detailed structured study-plan rows when they are authoritative."],
  database_action: "reload_after_parser_fix",
  verification_plan: ["Run parser regression cases."],
  risk_level: "medium",
  notes: "No database schema changes.",
};

test("extracts response text from output array", () => {
  const text = extractResponseText({
    output: [{
      content: [{ type: "output_text", text: "hello" }],
    }],
  });

  assert.equal(text, "hello");
});

test("parses strict evaluation JSON", () => {
  const parsed = parseEvaluationJson(JSON.stringify(validEvaluation));

  assert.equal(parsed.match, true);
  assert.equal(parsed.confidence, 0.91);
});

test("rejects evaluation JSON with missing fields", () => {
  assert.throws(() => parseEvaluationJson('{"match":true}'), /missing required field/);
});

test("parses strict repair plan JSON", () => {
  const parsed = parseRepairPlanJson(JSON.stringify(validRepairPlan));

  assert.equal(parsed.database_action, "reload_after_parser_fix");
  assert.deepEqual(parsed.target_functions, ["selectPreferredDelimitedTableRows"]);
});

test("evaluation client sends structured output request", async () => {
  let capturedPayload = null;
  const client = createOpenAIClient({
    apiKey: "test-key",
    model: "gpt-test",
    fetchImpl: async (_url, request) => {
      capturedPayload = JSON.parse(request.body);
      return {
        ok: true,
        text: async () => JSON.stringify({ output_text: JSON.stringify(validEvaluation) }),
      };
    },
  });

  const result = await client.evaluateProgram({
    context: {
      program: { id: 1, name: "Program" },
      documentExcerpt: "Учебно-тематический план",
      databaseTopics: [],
      freshTopics: [],
      warnings: [],
    },
  });

  assert.equal(result.evaluation.match, true);
  assert.equal(capturedPayload.text.format.type, "json_schema");
  assert.equal(capturedPayload.text.format.name, "pfdo_parser_evaluation");
});

test("patch client returns raw patch text", async () => {
  const patchText = "diff --git a/services/program-topic-extractor/src/parsers/calendar-topics.js b/services/program-topic-extractor/src/parsers/calendar-topics.js\n";
  const client = createOpenAIClient({
    apiKey: "test-key",
    model: "gpt-test",
    fetchImpl: async () => ({
      ok: true,
      text: async () => JSON.stringify({ output_text: patchText }),
    }),
  });

  const result = await client.requestPatch({
    context: {
      program: { id: 1 },
      documentExcerpt: "",
      freshTopics: [],
    },
    evaluation: validEvaluation,
    allowedFiles: ["services/program-topic-extractor/src/parsers/calendar-topics.js"],
    sourceSnippets: {},
  });

  assert.equal(result.patchText, patchText.trim());
});

test("repair plan client sends structured output request", async () => {
  let capturedPayload = null;
  const client = createOpenAIClient({
    apiKey: "test-key",
    model: "gpt-test",
    fetchImpl: async (_url, request) => {
      capturedPayload = JSON.parse(request.body);
      return {
        ok: true,
        text: async () => JSON.stringify({ output_text: JSON.stringify(validRepairPlan) }),
      };
    },
  });

  const result = await client.requestRepairPlan({
    context: {
      program: { id: 1, name: "Program" },
      documentExcerpt: "Учебно-тематический план",
      databaseTopics: [],
      freshTopics: [],
      warnings: [],
    },
    evaluation: validEvaluation,
    allowedFiles: ["services/program-topic-extractor/src/parsers/calendar-topics.js"],
    sourceSnippets: {
      "services/program-topic-extractor/src/parsers/calendar-topics.js": "function parser() {}",
    },
  });

  assert.equal(result.repairPlan.summary, validRepairPlan.summary);
  assert.equal(capturedPayload.text.format.type, "json_schema");
  assert.equal(capturedPayload.text.format.name, "pfdo_parser_repair_plan");
});

test("OpenAI client caches identical responses", async () => {
  const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), "parser-updater-openai-cache-"));
  let fetchCalls = 0;
  const client = createOpenAIClient({
    apiKey: "test-key",
    model: "gpt-test",
    cacheDir,
    fetchImpl: async () => {
      fetchCalls += 1;
      return {
        ok: true,
        text: async () => JSON.stringify({ output_text: JSON.stringify(validEvaluation) }),
      };
    },
  });
  const input = {
    context: {
      program: { id: 1, name: "Program" },
      documentExcerpt: "Учебно-тематический план",
      databaseTopics: [],
      freshTopics: [],
      warnings: [],
    },
  };

  await client.evaluateProgram(input);
  await client.evaluateProgram(input);

  assert.equal(fetchCalls, 1);
});

test("OpenAI client does not retry insufficient quota", async () => {
  let fetchCalls = 0;
  const client = createOpenAIClient({
    apiKey: "test-key",
    model: "gpt-test",
    maxRetries: 3,
    fetchImpl: async () => {
      fetchCalls += 1;
      return {
        ok: false,
        status: 429,
        text: async () => JSON.stringify({
          error: {
            message: "You exceeded your current quota, please check your plan and billing details.",
            code: "insufficient_quota",
            type: "insufficient_quota",
          },
        }),
      };
    },
  });

  await assert.rejects(
    () => client.evaluateProgram({
      context: {
        program: { id: 1 },
        documentExcerpt: "",
        databaseTopics: [],
        freshTopics: [],
        warnings: [],
      },
    }),
    (error) => isOpenAIQuotaExceededError(error),
  );
  assert.equal(fetchCalls, 1);
});
