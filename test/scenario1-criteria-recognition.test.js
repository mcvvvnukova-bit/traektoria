const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createDescriptionSelectionState,
  applyDescriptionText,
} = require("../src/description-selection");
const {
  SCENARIO_1_CRITERIA_COLUMNS,
  buildScenario1CriteriaRecognitionRecord,
  buildScenario1CriteriaSnapshot,
} = require("../src/scenario1-criteria-recognition");

test("builds 27 separate criterion snapshots for scenario 1 recognition", () => {
  const state = createDescriptionSelectionState();
  applyDescriptionText(state, "Сыну 10 лет, Североморск, робототехника после школы");

  const criteria = buildScenario1CriteriaSnapshot(state, { recognitionMethod: "regexp" });

  assert.equal(SCENARIO_1_CRITERIA_COLUMNS.length, 27);
  assert.equal(Object.keys(criteria).length, 27);
  assert.equal(criteria.criterion_01_municipality.value, "Североморск");
  assert.equal(criteria.criterion_01_municipality.status, "recognized");
  assert.equal(criteria.criterion_03_age.value.ageYears, 10);
  assert.equal(criteria.criterion_03_age.confidence, 0.95);
  assert.deepEqual(criteria.criterion_12_exact_interest_topic.value.specificInterestLabels, ["робототехника"]);
  assert.equal(criteria.criterion_17_completed_exact_topic_match.status, "not_applicable");
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
  assert.equal(record.criteria.criterion_16_interest_without_thematic_match.status, "pending_scoring");
});
