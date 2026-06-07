const test = require("node:test");
const assert = require("node:assert/strict");

const {
  parseRegressionCases,
  summarizeTopics,
  compareRegressionCase,
  verifyRegressionCases,
  verifyCurrentProgram,
} = require("../services/program-topic-extractor/src/auto-update/verification");

test("parses regression cases from CSV", () => {
  const cases = parseRegressionCases(
    "program_id,program_name,document_format,expected_topics_count,expected_hours_theory,expected_hours_practice,expected_hours_total,expected_source_section\n1,Name,doc,2,3,4,7,method\n",
  );

  assert.equal(cases[0].programId, 1);
  assert.equal(cases[0].expectedHoursTotal, 7);
});

test("summarizes topic counts and hours", () => {
  const summary = summarizeTopics([
    { hours_theory: 1, hours_practice: 2, hours_total: 3, source_section: "method" },
    { hours_theory: 2, hours_practice: 2, hours_total: 4, source_section: "method" },
  ]);

  assert.deepEqual(summary, {
    topicsCount: 2,
    hoursTheory: 3,
    hoursPractice: 4,
    hoursTotal: 7,
    sourceSections: ["method"],
  });
});

test("detects regression mismatches", () => {
  const result = compareRegressionCase(
    {
      programId: 1,
      expectedTopicsCount: 2,
      expectedHoursTheory: 3,
      expectedHoursPractice: 4,
      expectedHoursTotal: 7,
      expectedSourceSection: "method",
    },
    [{ hours_theory: 1, hours_practice: 2, hours_total: 3, source_section: "other" }],
  );

  assert.equal(result.passed, false);
  assert.ok(result.mismatches.some((mismatch) => mismatch.field === "topicsCount"));
  assert.ok(result.mismatches.some((mismatch) => mismatch.field === "sourceSection"));
});

test("verifies all regression cases with injected loader", async () => {
  const result = await verifyRegressionCases({
    cases: [{
      programId: 1,
      expectedTopicsCount: 1,
      expectedHoursTheory: 1,
      expectedHoursPractice: 2,
      expectedHoursTotal: 3,
      expectedSourceSection: "method",
    }],
    loadProgramContext: async () => ({
      freshTopics: [{ hours_theory: 1, hours_practice: 2, hours_total: 3, source_section: "method" }],
    }),
  });

  assert.equal(result.passed, true);
});

test("current program verification delegates to evaluator", async () => {
  const result = await verifyCurrentProgram({
    context: { program: { id: 1 } },
    evaluator: async () => ({
      evaluation: {
        match: true,
        confidence: 0.9,
      },
    }),
  });

  assert.equal(result.passed, true);
});
