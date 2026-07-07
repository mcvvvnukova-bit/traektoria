const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createDescriptionSelectionState,
  applyDescriptionText,
} = require("../src/description-selection");
const {
  SCENARIO_1_CRITERIA,
  SCENARIO_1_CRITERIA_LOG_ARRAY_COLUMNS,
  SCENARIO_1_CRITERIA_LOG_COLUMNS,
  buildScenario1CriteriaRecognitionRecord,
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
  assert.ok(SCENARIO_1_CRITERIA_LOG_COLUMNS.length > 27);
  assert.equal(record.criterion_01_municipality_status, "recognized");
  assert.equal(record.criterion_01_municipality_value, "Североморск");
  assert.equal(record.criterion_03_age_status, "recognized");
  assert.equal(record.criterion_03_age_bucket, "10-12");
  assert.equal(record.criterion_03_age_years, 10);
  assert.equal(record.criterion_03_age_text, "10 лет");
  assert.equal(record.criterion_03_age_confidence, 0.95);
  assert.deepEqual(record.criterion_12_exact_interest_topic_labels, ["робототехника"]);
  assert.equal(record.criterion_17_completed_exact_topic_match_status, "not_applicable");
  assert.equal(record.criteria, undefined);
  assert.equal(SCENARIO_1_CRITERIA_LOG_ARRAY_COLUMNS.has("criterion_12_exact_interest_topic_labels"), true);
});

test("builds record metadata with recognition method and overall confidence", () => {
  const state = createDescriptionSelectionState();
  applyDescriptionText(state, "Школьник, Мурманск, что-нибудь полезное для развития");

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
});
