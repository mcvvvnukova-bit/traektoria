const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createDescriptionSelectionState,
  applyDescriptionText,
  getMissingRequiredFields,
  shouldConfirmSummary,
  buildRecommendationProfile,
  buildRequiredClarificationPrompt,
  shouldUseLlmForDescription,
  applyLlmAnalysis,
  buildPdfAnswers,
} = require("../src/description-selection");

test("parses complete free-text request", () => {
  const state = createDescriptionSelectionState();
  applyDescriptionText(state, "Сыну 10 лет, Североморск, робототехника после школы");

  assert.deepEqual(getMissingRequiredFields(state), []);
  assert.equal(state.fields.age, "10-12");
  assert.equal(state.fields.place, "Североморск");
  assert.ok(state.fields.interests.includes("building"));
  assert.ok(state.fields.interests.includes("logic"));
  assert.ok(state.fields.schedule.includes("weekdays"));
  assert.ok(state.fields.schedule.includes("evening"));

  const profile = buildRecommendationProfile(state);
  assert.equal(profile.age, "10-12");
  assert.equal(profile.location, "Североморск");
  assert.ok(profile.interests.includes("building"));
});

test("counts direction as required interest signal", () => {
  const state = createDescriptionSelectionState();
  applyDescriptionText(state, "Дочке 8 лет, Мурманск, художественная направленность");

  assert.deepEqual(getMissingRequiredFields(state), []);
  assert.equal(state.fields.direction, "art");
  assert.equal(state.fields.directionLabel, "Художественная");
});

test("keeps concrete basketball terms in the recommendation profile", () => {
  const state = createDescriptionSelectionState();
  applyDescriptionText(state, "занятия по баскетболу в Оленегорске для мальчика 13 лет");

  assert.deepEqual(getMissingRequiredFields(state), []);
  assert.equal(state.fields.ageYears, 13);
  assert.equal(state.fields.place, "Оленегорск");
  assert.ok(state.fields.interests.includes("sports"));
  assert.ok(state.fields.specificInterestTerms.includes("баскетбол"));
  assert.ok(state.fields.specificInterestTerms.includes("баскет"));

  const profile = buildRecommendationProfile(state);
  assert.ok(profile.interests.includes("sports"));
  assert.ok(profile.specificInterestTerms.includes("баскетбол"));
  assert.deepEqual(profile.specificInterestLabels, ["баскетбол"]);
});

test("builds one prompt for multiple missing required fields", () => {
  const state = createDescriptionSelectionState();
  applyDescriptionText(state, "8 лет");

  const missing = getMissingRequiredFields(state);
  assert.deepEqual(missing, ["place", "interest"]);
  assert.equal(
    buildRequiredClarificationPrompt(missing),
    "Чтобы подобрать программы, уточните, пожалуйста: где искать занятия и какие интересы или направление важны.",
  );
});

test("marks broad nonnumeric request as ambiguous instead of starting recommendation immediately", () => {
  const state = createDescriptionSelectionState();
  applyDescriptionText(state, "Школьник, Мурманск, что-нибудь полезное для развития");

  assert.deepEqual(getMissingRequiredFields(state), []);
  assert.equal(shouldConfirmSummary(state), true);
});

test("edit replaces changed interest and keeps existing age and place", () => {
  const state = createDescriptionSelectionState();
  applyDescriptionText(state, "Сыну 10 лет, Североморск, робототехника");
  applyDescriptionText(state, "не робототехника, а рисование", { mode: "edit" });

  assert.equal(state.fields.age, "10-12");
  assert.equal(state.fields.place, "Североморск");
  assert.deepEqual(state.fields.interests, ["creative", "calm"]);
  assert.equal(state.fields.interestsText, "рисование");
});

test("uses llm slots as validated enrichment for missing required fields", () => {
  const state = createDescriptionSelectionState();
  applyDescriptionText(state, "Сыну 10 лет");

  assert.equal(shouldUseLlmForDescription(state, "Сыну 10 лет"), true);
  applyLlmAnalysis(state, {
    filledSlots: {
      location: "Мурманск",
      interests: ["building", "logic"],
      budget: "до 1000 рублей",
      schedule: "вечером",
    },
  });

  assert.deepEqual(getMissingRequiredFields(state), []);
  assert.equal(state.fields.place, "Мурманск");
  assert.equal(state.fields.placeKnown, true);
  assert.deepEqual(state.fields.interests, ["building", "logic"]);
  assert.equal(state.fields.budget, "до 1000 рублей");
  assert.equal(state.fields.scheduleText, "вечером");
});

test("does not extract child special needs from free-text requests", () => {
  const state = createDescriptionSelectionState();
  applyDescriptionText(state, "Сыну 10 лет, Мурманск, робототехника, ОВЗ, СДВГ");

  assert.equal(state.fields.specialNeedsLabel, undefined);
  assert.equal(state.fields.specialNeedsOther, undefined);

  const profile = buildRecommendationProfile(state);
  assert.equal(profile.specialNeeds, undefined);
  assert.equal(profile.specialNeedsLabel, undefined);

  const pdfAnswers = buildPdfAnswers(state);
  assert.equal(pdfAnswers.specialNeeds, undefined);
  assert.equal(pdfAnswers.specialNeedsLabel, undefined);
});
