const fs = require("node:fs/promises");
const path = require("node:path");
const { parseCsv } = require("../csv");

async function loadRegressionCases(filePath) {
  const content = await fs.readFile(filePath, "utf-8");
  return parseRegressionCases(content);
}

function parseRegressionCases(content) {
  return parseCsv(content).map((row) => ({
    programId: Number(row.program_id),
    programName: row.program_name || "",
    documentFormat: row.document_format || "",
    expectedTopicsCount: Number(row.expected_topics_count),
    expectedHoursTheory: Number(row.expected_hours_theory),
    expectedHoursPractice: Number(row.expected_hours_practice),
    expectedHoursTotal: Number(row.expected_hours_total),
    expectedSourceSection: row.expected_source_section || "",
  }));
}

function summarizeTopics(topics) {
  return {
    topicsCount: topics.length,
    hoursTheory: round(sum(topics, "hours_theory", "hoursTheory")),
    hoursPractice: round(sum(topics, "hours_practice", "hoursPractice")),
    hoursTotal: round(sum(topics, "hours_total", "hoursTotal")),
    sourceSections: [...new Set(topics.map((topic) => topic.source_section || topic.sourceSection || "").filter(Boolean))],
  };
}

function compareRegressionCase(regressionCase, topics) {
  const actual = summarizeTopics(topics);
  const mismatches = [];

  compareField(mismatches, "topicsCount", regressionCase.expectedTopicsCount, actual.topicsCount);
  compareField(mismatches, "hoursTheory", regressionCase.expectedHoursTheory, actual.hoursTheory);
  compareField(mismatches, "hoursPractice", regressionCase.expectedHoursPractice, actual.hoursPractice);
  compareField(mismatches, "hoursTotal", regressionCase.expectedHoursTotal, actual.hoursTotal);

  if (
    regressionCase.expectedSourceSection &&
    !actual.sourceSections.includes(regressionCase.expectedSourceSection)
  ) {
    mismatches.push({
      field: "sourceSection",
      expected: regressionCase.expectedSourceSection,
      actual: actual.sourceSections.join("; "),
    });
  }

  return {
    programId: regressionCase.programId,
    passed: mismatches.length === 0,
    expected: regressionCase,
    actual,
    mismatches,
  };
}

async function verifyRegressionCases(options) {
  const {
    repoRoot,
    regressionFile,
    loadProgramContext,
  } = options;
  const cases =
    options.cases ||
    (await loadRegressionCases(
      regressionFile ||
        path.join(repoRoot, "services/program-topic-extractor/regression/checked-programs.csv"),
    ));
  const results = [];

  for (const regressionCase of cases) {
    try {
      const context = await loadProgramContext(regressionCase.programId);
      const result = compareRegressionCase(regressionCase, context.freshTopics || []);
      results.push(result);
    } catch (error) {
      results.push({
        programId: regressionCase.programId,
        passed: false,
        expected: regressionCase,
        actual: null,
        mismatches: [{ field: "context", expected: "loadable regression program", actual: error.message }],
      });
    }
  }

  return {
    passed: results.every((result) => result.passed),
    results,
  };
}

async function verifyCurrentProgram(options) {
  const { context, evaluator } = options;
  const evaluationResult = await evaluator(context);
  return {
    passed: evaluationResult.evaluation && evaluationResult.evaluation.match === true,
    evaluationResult,
  };
}

function compareField(mismatches, field, expected, actual) {
  if (Number(expected) !== Number(actual)) {
    mismatches.push({ field, expected, actual });
  }
}

function sum(topics, snakeKey, camelKey) {
  return topics.reduce((total, topic) => {
    const value = topic[snakeKey] ?? topic[camelKey];
    const number = Number(value);
    return Number.isFinite(number) ? total + number : total;
  }, 0);
}

function round(value) {
  return Number(Number(value).toFixed(2));
}

module.exports = {
  loadRegressionCases,
  parseRegressionCases,
  summarizeTopics,
  compareRegressionCase,
  verifyRegressionCases,
  verifyCurrentProgram,
};
