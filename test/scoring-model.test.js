const test = require("node:test");
const assert = require("node:assert/strict");

const {
  SCENARIO_DESCRIPTION,
  SCENARIO_DEEP,
  SCENARIO_WIDE,
  scoreProgramCandidate,
} = require("../src/scoring-model");

function baseCandidate(overrides = {}) {
  return {
    id: 1,
    municipalityId: 10,
    ageMinMonths: 7 * 12,
    ageMaxMonths: 14 * 12,
    directionName: "Техническая",
    enrollment: 1,
    groups: [],
    modules: [],
    topics: [],
    topicsKnown: true,
    keywords: [],
    ...overrides,
  };
}

test("applies cost as a hard filter before scoring", () => {
  const result = scoreProgramCandidate(
    baseCandidate({
      groups: [{ period_price: "5000" }],
      topics: [{ name: "Робототехника", key: "robotics" }],
    }),
    {
      scenario: SCENARIO_DESCRIPTION,
      municipalityId: 10,
      age: "10-12",
      budget: "4000",
      interests: ["building"],
    },
  );

  assert.equal(result.passesFilters, false);
  assert.equal(result.exclusionReason, "budget_mismatch");
  assert.equal(result.score, 0);
});

test("does not apply cost filter when budget has no restrictions", () => {
  const result = scoreProgramCandidate(
    baseCandidate({
      groups: [{ period_price: "5000" }],
      topics: [{ name: "Робототехника", key: "robotics" }],
    }),
    {
      scenario: SCENARIO_DESCRIPTION,
      municipalityId: 10,
      age: "10-12",
      budget: "без ограничений",
      interests: ["building"],
    },
  );

  assert.equal(result.passesFilters, true);
  assert.notEqual(result.exclusionReason, "budget_mismatch");
});

test("applies education form id as a hard filter", () => {
  const mismatch = scoreProgramCandidate(
    baseCandidate({
      eduForm: 3,
      eduFormName: "Заочная",
      topics: [{ name: "Робототехника", key: "robotics" }],
    }),
    {
      scenario: SCENARIO_DESCRIPTION,
      municipalityId: 10,
      age: "10-12",
      educationFormId: 1,
      interests: ["building"],
    },
  );

  assert.equal(mismatch.passesFilters, false);
  assert.equal(mismatch.exclusionReason, "education_form_mismatch");

  const match = scoreProgramCandidate(
    baseCandidate({
      eduForm: 3,
      eduFormName: "Заочная",
      topics: [{ name: "Робототехника", key: "robotics" }],
    }),
    {
      scenario: SCENARIO_DESCRIPTION,
      municipalityId: 10,
      age: "10-12",
      educationFormId: 3,
      interests: ["building"],
    },
  );

  assert.equal(match.passesFilters, true);
  assert.notEqual(match.exclusionReason, "education_form_mismatch");
});

test("uses best thematic match per interest instead of summing all hierarchy levels", () => {
  const result = scoreProgramCandidate(
    baseCandidate({
      topics: [{
        name: "Робототехника",
        key: "robotics",
        categoryName: "Робототехника",
        parentName: "Инженерное творчество",
      }],
    }),
    {
      scenario: SCENARIO_DESCRIPTION,
      municipalityId: 10,
      age: "10-12",
      interests: ["building"],
    },
  );

  assert.equal(result.criteriaScores.topicPresence, 10);
  assert.equal(result.criteriaScores.interests, 100);
  assert.equal(result.score, 110);
  assert.equal(result.exactTopicMatch, true);
});

test("allows fallback interest match when normalized topics are absent", () => {
  const result = scoreProgramCandidate(
    baseCandidate({
      name: "Начальная робототехника",
      topics: [],
      topicsKnown: true,
      keywords: ["робототехника"],
    }),
    {
      scenario: SCENARIO_DESCRIPTION,
      municipalityId: 10,
      age: "10-12",
      interests: ["building"],
    },
  );

  assert.equal(result.criteriaScores.topicPresence, -10);
  assert.equal(result.criteriaScores.interests, 20);
  assert.equal(result.fallbackTopicMatch, true);
  assert.equal(result.score, 10);
  assert.equal(result.eligible, true);
});

test("keeps a basketball topic match even when broad sports terms do not match", () => {
  const result = scoreProgramCandidate(
    baseCandidate({
      directionName: "Физкультурно-спортивная",
      enrollment: 3,
      topics: [{
        name: "Игра в баскетбол",
        key: "igra-v-basketbol",
        categoryName: "Предметная тема без категории",
        parentName: "Предметные темы без категории",
      }],
    }),
    {
      scenario: SCENARIO_DESCRIPTION,
      municipalityId: 10,
      ageYears: 13,
      interests: ["sports"],
      directionLabel: "Физкультурно-спортивная",
      specificInterestTerms: ["баскетбол", "баскет"],
    },
  );

  assert.equal(result.passesFilters, true);
  assert.equal(result.eligible, true);
  assert.equal(result.exclusionReason, "");
  assert.equal(result.specificInterestMatch, true);
  assert.equal(result.specificInterestMatchLevel, "topic_level_3");
  assert.equal(result.criteriaScores.specificInterests, 180);
});

test("keeps an exact basketball fallback match after age mismatch", () => {
  const result = scoreProgramCandidate(
    baseCandidate({
      name: "Баскетбол",
      directionName: "Физкультурно-спортивная",
      ageMinMonths: 15 * 12,
      ageMaxMonths: 17 * 12,
      enrollment: 3,
      topics: [],
      keywords: ["баскетбол"],
    }),
    {
      scenario: SCENARIO_DESCRIPTION,
      municipalityId: 10,
      ageYears: 13,
      interests: ["sports"],
      directionLabel: "Физкультурно-спортивная",
      specificInterestTerms: ["баскетбол", "баскет"],
    },
  );

  assert.equal(result.passesFilters, true);
  assert.equal(result.ageEligible, false);
  assert.equal(result.eligible, true);
  assert.equal(result.exclusionReason, "");
  assert.equal(result.specificInterestMatch, true);
  assert.equal(result.specificInterestMatchLevel, "text_strong");
});

test("scores schedule and availability by the best group", () => {
  const result = scoreProgramCandidate(
    baseCandidate({
      topicsKnown: false,
      groups: [{
        free_places_counter: 3,
        periods: [{
          schedule: {
            monday: [{ week_day: "Понедельник", start_time: "18:00" }],
          },
        }],
      }],
    }),
    {
      scenario: SCENARIO_DESCRIPTION,
      municipalityId: 10,
      age: "10-12",
      scheduleText: "будни вечером",
    },
  );

  assert.equal(result.criteriaScores.schedule, 60);
  assert.equal(result.criteriaScores.availability, 50);
  assert.equal(result.score, 110);
});

test("penalizes closed enrollment with the balanced availability weight", () => {
  const result = scoreProgramCandidate(
    baseCandidate({
      enrollment: 3,
      topicsKnown: false,
    }),
    {
      scenario: SCENARIO_DESCRIPTION,
      municipalityId: 10,
      age: "10-12",
    },
  );

  assert.equal(result.criteriaScores.availability, -25);
  assert.equal(result.score, -25);
  assert.equal(result.eligible, false);
});

test("scores deep trajectory only after thematic link and depth signal", () => {
  const result = scoreProgramCandidate(
    baseCandidate({
      directoryLevelId: 3,
      topics: [{
        name: "Робототехника",
        key: "robotics",
        categoryCode: "robotics",
        categoryName: "Робототехника",
        parentCode: "engineering",
        parentName: "Инженерное творчество",
      }],
    }),
    {
      scenario: SCENARIO_DEEP,
      municipalityId: 10,
      ageYears: 11,
      completedTopicProfile: {
        topicKeys: ["robotics"],
        categoryKeys: ["code:robotics"],
        parentCategoryKeys: ["code:engineering"],
        averageHours: 10,
      },
    },
  );

  assert.equal(result.criteriaScores.topicPresence, 10);
  assert.equal(result.criteriaScores.trajectory, 110);
  assert.ok(result.depthSignals.length > 0);
  assert.equal(result.score, 120);
});

test("excludes wide trajectory candidates that repeat completed level 2 category", () => {
  const result = scoreProgramCandidate(
    baseCandidate({
      topics: [{
        categoryCode: "robotics",
        categoryName: "Робототехника",
        parentCode: "engineering",
        parentName: "Инженерное творчество",
      }],
    }),
    {
      scenario: SCENARIO_WIDE,
      municipalityId: 10,
      ageYears: 11,
      completedTopicProfile: {
        categoryKeys: ["code:robotics"],
        parentCategoryKeys: ["code:engineering"],
      },
    },
  );

  assert.equal(result.exclusionReason, "repeated_level2_topic");
  assert.equal(result.score, 0);
});

test("scores wide trajectory novelty and target directory levels", () => {
  const result = scoreProgramCandidate(
    baseCandidate({
      directoryLevelId: 2,
      topics: [{
        categoryCode: "painting",
        categoryName: "Живопись",
        parentCode: "art",
        parentName: "Художественное творчество",
      }],
    }),
    {
      scenario: SCENARIO_WIDE,
      municipalityId: 10,
      ageYears: 11,
      completedTopicProfile: {
        categoryKeys: ["code:robotics"],
        parentCategoryKeys: ["code:engineering"],
      },
    },
  );

  assert.equal(result.criteriaScores.topicPresence, 10);
  assert.equal(result.criteriaScores.trajectory, 160);
  assert.equal(result.score, 170);
  assert.deepEqual(result.noveltySignals, ["добавляет новый раздел тем"]);
});
