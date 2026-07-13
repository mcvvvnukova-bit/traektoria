const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createDescriptionSelectionState,
  applyDescriptionText,
} = require("../src/description-selection");
const {
  SCENARIO_1_CRITERIA,
  SCENARIO_1_CRITERIA_COLUMNS,
  SCENARIO_1_CRITERIA_LOG_ARRAY_COLUMNS,
  SCENARIO_1_CRITERIA_LOG_COLUMNS,
  buildScenario1CriteriaRecognitionRecord,
  buildScenario1CriteriaSnapshot,
} = require("../src/scenario1-criteria-recognition");

test("builds flat criterion fields for scenario 1 recognition", () => {
  const state = createDescriptionSelectionState();
  applyDescriptionText(state, "Сыну 10 лет, Североморск, робототехника после школы");

  const record = buildScenario1CriteriaRecognitionRecord({
    platform: "telegram",
    sessionId: "123",
    inputText: "Сыну 10 лет, Североморск, робототехника после школы",
    recognitionMethod: "regexp",
    state,
  });

  assert.equal(SCENARIO_1_CRITERIA.length, 27);
  assert.equal(SCENARIO_1_CRITERIA_COLUMNS.length, 27);
  assert.ok(SCENARIO_1_CRITERIA_LOG_COLUMNS.length > 27);
  assert.equal(record.criterion_01_municipality_status, "recognized");
  assert.deepEqual(record.criterion_01_municipality_value, ["Североморск"]);
  assert.equal(record.criterion_03_age_status, "recognized");
  assert.equal(record.criterion_03_age_bucket, "10-12");
  assert.equal(record.criterion_03_age_years, 10);
  assert.equal(record.criterion_03_age_text, "10 лет");
  assert.equal(record.criterion_03_age_confidence, 0.95);
  assert.deepEqual(record.criterion_12_exact_interest_topic_labels, ["робототехника"]);
  assert.equal(record.criterion_17_completed_exact_topic_match_status, "not_applicable");
  assert.equal(record.criteria, undefined);
  assert.equal(SCENARIO_1_CRITERIA_LOG_ARRAY_COLUMNS.has("criterion_01_municipality_value"), true);
  assert.equal(SCENARIO_1_CRITERIA_LOG_ARRAY_COLUMNS.has("criterion_12_exact_interest_topic_labels"), true);
});

test("builds 27 separate criterion snapshots for scenario 1 recognition", () => {
  const state = createDescriptionSelectionState();
  applyDescriptionText(state, "Сыну 10 лет, Североморск, робототехника после школы");

  const criteria = buildScenario1CriteriaSnapshot(state, { recognitionMethod: "regexp" });

  assert.equal(Object.keys(criteria).length, 27);
  assert.deepEqual(criteria.criterion_01_municipality.value, ["Североморск"]);
  assert.equal(criteria.criterion_01_municipality.status, "recognized");
  assert.equal(criteria.criterion_03_age.value.ageYears, 10);
  assert.equal(criteria.criterion_03_age.confidence, 0.95);
  assert.deepEqual(criteria.criterion_12_exact_interest_topic.value.specificInterestLabels, ["робототехника"]);
  assert.equal(criteria.criterion_17_completed_exact_topic_match.status, "not_applicable");
});

test("builds record metadata with recognition method and overall confidence", () => {
  const state = createDescriptionSelectionState();
  applyDescriptionText(state, "Школьник, Мурманск, что-нибудь полезное для развития");
  state.llm.criteria = {
    criterion_01_municipality: {
      status: "recognized",
      value: "Мурманск",
      confidence: 0.91,
    },
    criterion_16_interest_without_thematic_match: {
      status: "pending_scoring",
      interests_text: "широкий запрос на развитие",
      confidence: 0.72,
    },
  };

  const record = buildScenario1CriteriaRecognitionRecord({
    platform: "mattermost",
    sessionId: "channel:abc:user:def",
    metadata: {
      channelId: "abc",
      channelType: "O",
    },
    inputText: "Школьник, Мурманск, что-нибудь полезное для развития",
    recognitionMethod: "LLM",
    state,
  });

  assert.equal(record.platform, "mattermost");
  assert.equal(record.sessionId, "channel:abc:user:def");
  assert.equal(record.channel, "mattermost:abc");
  assert.equal(record.channelId, "abc");
  assert.equal(record.recognitionMethod, "LLM");
  assert.ok(record.recognitionConfidence > 0);
  assert.ok(record.recognitionConfidence < 1);
  assert.equal(record.criterion_16_interest_without_thematic_match_status, "pending_scoring");
  assert.deepEqual(record.criterion_16_interest_without_thematic_match_interests, []);
  assert.equal(record.criterion_16_interest_without_thematic_match_interests_text, "широкий запрос на развитие");
  assert.deepEqual(record.criterion_01_municipality_value, ["Мурманск"]);
  assert.equal(record.criterion_01_municipality_confidence, 0.91);
  assert.equal(record.criterion_16_interest_without_thematic_match_confidence, 0.72);
});

test("does not build llm log values from normalized fields when model omits criteria", () => {
  const state = createDescriptionSelectionState();
  applyDescriptionText(state, "Сыну 10 лет, Североморск, робототехника после школы");

  const record = buildScenario1CriteriaRecognitionRecord({
    platform: "telegram",
    sessionId: "123",
    inputText: "Сыну 10 лет, Североморск, робототехника после школы",
    recognitionMethod: "LLM",
    state,
  });

  assert.equal(record.criterion_03_age_status, "not_specified");
  assert.equal(record.criterion_03_age_years, null);
  assert.equal(record.criterion_03_age_confidence, null);
  assert.equal(record.criterion_01_municipality_status, "not_specified");
  assert.deepEqual(record.criterion_01_municipality_value, []);
  assert.equal(record.criterion_01_municipality_confidence, null);
  assert.equal(record.recognitionConfidence, 0);
});

test("writes only model-provided criteria fields for llm recognition", () => {
  const state = createDescriptionSelectionState();
  applyDescriptionText(state, "Сыну 10 лет, Североморск, робототехника после школы");
  state.llm.criteria = {
    criterion_03_age: {
      status: "recognized",
      age_bucket: "10-12",
      age_years: 10,
      age_text: "10 лет",
      confidence: 0.82,
    },
    criterion_12_exact_interest_topic: {
      status: "recognized",
      terms: ["робототехника"],
      labels: ["робототехника"],
      confidence: 0.77,
    },
  };

  const record = buildScenario1CriteriaRecognitionRecord({
    platform: "telegram",
    sessionId: "123",
    inputText: "Сыну 10 лет, Североморск, робототехника после школы",
    recognitionMethod: "LLM",
    state,
  });

  assert.equal(record.criterion_03_age_status, "recognized");
  assert.equal(record.criterion_03_age_bucket, "10-12");
  assert.equal(record.criterion_03_age_years, 10);
  assert.equal(record.criterion_03_age_confidence, 0.82);
  assert.deepEqual(record.criterion_12_exact_interest_topic_terms, ["робототехника"]);
  assert.equal(record.criterion_12_exact_interest_topic_confidence, 0.77);
  assert.deepEqual(record.criterion_01_municipality_value, []);
  assert.equal(record.criterion_01_municipality_confidence, null);
});

test("logs ambiguous regexp municipalities as an array of candidates", () => {
  const state = createDescriptionSelectionState();
  applyDescriptionText(state, "Сыну 10 лет, Мурманск и Североморск, робототехника после школы");

  const record = buildScenario1CriteriaRecognitionRecord({
    platform: "telegram",
    sessionId: "123",
    inputText: "Сыну 10 лет, Мурманск и Североморск, робототехника после школы",
    recognitionMethod: "regexp",
    state,
  });

  assert.equal(record.criterion_01_municipality_status, "recognized_ambiguous");
  assert.deepEqual(record.criterion_01_municipality_value, ["Мурманск", "Североморск"]);
  assert.equal(record.criterion_01_municipality_confidence, 0.6);
});
