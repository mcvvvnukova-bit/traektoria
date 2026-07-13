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

test("treats multiple municipalities as place ambiguity", () => {
  const state = createDescriptionSelectionState();
  applyDescriptionText(state, "Сыну 10 лет, Мурманск и Североморск, робототехника");

  assert.equal(state.fields.place, "");
  assert.deepEqual(state.fields.placeCandidates, ["Мурманск", "Североморск"]);
  assert.equal(state.fields.placeAmbiguity, "place_multiple");
  assert.deepEqual(getMissingRequiredFields(state), ["place"]);
  assert.equal(
    buildRequiredClarificationPrompt(getMissingRequiredFields(state), state),
    "Вы указали несколько населенных пунктов: Мурманск, Североморск. Уточните, пожалуйста, в каком одном населенном пункте искать кружки.",
  );
});

test("keeps asking for place until one municipality is provided", () => {
  const state = createDescriptionSelectionState();
  applyDescriptionText(state, "Сыну 10 лет, Мурманск и Североморск, робототехника");
  applyDescriptionText(state, "Мурманск или Кола", { mode: "clarification" });

  assert.equal(state.fields.place, "");
  assert.deepEqual(state.fields.placeCandidates, ["Мурманск", "Кола"]);
  assert.equal(state.fields.placeAmbiguity, "place_multiple");

  applyDescriptionText(state, "Североморск", { mode: "clarification" });

  assert.equal(state.fields.place, "Североморск");
  assert.deepEqual(state.fields.placeCandidates, []);
  assert.equal(state.fields.placeAmbiguity, "");
  assert.deepEqual(getMissingRequiredFields(state), []);
});

test("treats Murmansk region as ambiguous place", () => {
  const state = createDescriptionSelectionState();
  applyDescriptionText(state, "Сыну 10 лет, Мурманская область, робототехника");

  assert.equal(state.fields.place, "");
  assert.deepEqual(state.fields.placeCandidates, []);
  assert.equal(state.fields.placeAmbiguity, "place_region");
  assert.deepEqual(getMissingRequiredFields(state), ["place"]);
  assert.equal(
    buildRequiredClarificationPrompt(getMissingRequiredFields(state), state),
    "Уточните, пожалуйста, конкретный населенный пункт Мурманской области, где искать кружки.",
  );
});

test("recognizes full Rosstat settlement list in rule-based parser", () => {
  const state = createDescriptionSelectionState();
  applyDescriptionText(state, "Дочке 9 лет, рисование в Варзуге");

  assert.deepEqual(getMissingRequiredFields(state), []);
  assert.equal(state.fields.place, "Варзуга");
  assert.equal(state.fields.placeKnown, true);
  assert.ok(state.fields.interests.includes("creative"));
});

test("recognizes railway station settlements from the Rosstat list", () => {
  const state = createDescriptionSelectionState();
  applyDescriptionText(state, "Сыну 10 лет, робототехника, ж/д ст Нял");

  assert.deepEqual(getMissingRequiredFields(state), []);
  assert.equal(state.fields.place, "Нял");
  assert.equal(state.fields.placeKnown, true);
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

test("uses llm criteria as validated enrichment for missing required fields", () => {
  const state = createDescriptionSelectionState();
  applyDescriptionText(state, "Сыну 10 лет");

  assert.equal(shouldUseLlmForDescription(state, "Сыну 10 лет"), true);
  applyLlmAnalysis(state, {
    criteria: {
      criterion_01_municipality: {
        status: "recognized",
        value: ["Мурманск"],
        confidence: 0.95,
      },
      criterion_04_cost: {
        status: "recognized",
        value: "до 1000 рублей",
        confidence: 0.8,
      },
      criterion_06_education_form: {
        status: "recognized",
        education_form_id: 3,
        format_label: "Заочная",
        confidence: 0.86,
      },
      criterion_07_schedule: {
        status: "recognized",
        schedule_text: "вечером",
        schedule_values: ["evening"],
        confidence: 0.75,
      },
      criterion_13_interest_level2_category: {
        status: "recognized",
        values: ["building", "logic"],
        labels: ["конструирование", "логика и программирование"],
        confidence: 0.9,
      },
    },
  });

  assert.deepEqual(getMissingRequiredFields(state), []);
  assert.equal(state.fields.place, "Мурманск");
  assert.equal(state.fields.placeKnown, true);
  assert.deepEqual(state.fields.interests, ["building", "logic"]);
  assert.equal(state.fields.budget, "до 1000 рублей");
  assert.equal(state.fields.educationFormId, 3);
  assert.equal(state.fields.educationFormLabel, "Заочная");
  assert.equal(state.fields.format, 3);
  assert.equal(state.fields.formatLabel, "Заочная");
  assert.equal(state.fields.scheduleText, "вечером");
  assert.equal(state.llm.criteria.criterion_01_municipality.confidence, 0.95);
});

test("recognizes PFDO education form ids from free text", () => {
  const mixed = createDescriptionSelectionState();
  applyDescriptionText(mixed, "Сыну 10 лет, Мурманск, робототехника, нужен очно-заочный формат");
  assert.equal(mixed.fields.educationFormId, 2);
  assert.equal(mixed.fields.educationFormLabel, "Очно-заочная");

  const remote = createDescriptionSelectionState();
  applyDescriptionText(remote, "Дочке 9 лет, рисование в Мурманске, только онлайн");
  assert.equal(remote.fields.educationFormId, 3);
  assert.equal(remote.fields.educationFormLabel, "Заочная");

  const inPerson = createDescriptionSelectionState();
  applyDescriptionText(inPerson, "Сыну 8 лет, шахматы в Коле, очно");
  assert.equal(inPerson.fields.educationFormId, 1);
  assert.equal(inPerson.fields.educationFormLabel, "Очная");
});

test("uses llm exact interest criteria as recommendation terms", () => {
  const state = createDescriptionSelectionState();

  applyLlmAnalysis(state, {
    criteria: {
      criterion_01_municipality: {
        status: "recognized",
        value: ["Оленегорск"],
        confidence: 0.95,
      },
      criterion_03_age: {
        status: "recognized",
        age_years: 13,
        age_text: "13 лет",
        confidence: 1,
      },
      criterion_12_exact_interest_topic: {
        status: "recognized",
        terms: ["баскетбол"],
        labels: ["баскетбол"],
        confidence: 0.95,
      },
      criterion_13_interest_level2_category: {
        status: "recognized",
        values: ["sports"],
        labels: ["спорт"],
        confidence: 0.9,
      },
    },
  });

  assert.deepEqual(getMissingRequiredFields(state), []);
  assert.equal(state.fields.age, "13+");
  assert.equal(state.fields.ageYears, 13);
  assert.equal(state.fields.ageText, "13 лет");
  assert.equal(state.fields.place, "Оленегорск");
  assert.ok(state.fields.interests.includes("sports"));
  assert.equal(state.fields.interestsText, "баскетбол");
  assert.deepEqual(state.fields.specificInterestLabels, ["баскетбол"]);
  assert.ok(state.fields.specificInterestTerms.includes("баскетбол"));
  assert.ok(state.fields.specificInterestTerms.includes("баскет"));

  const profile = buildRecommendationProfile(state);
  assert.equal(profile.age, "13+");
  assert.equal(profile.ageYears, 13);
  assert.equal(profile.ageText, "13 лет");
  assert.ok(profile.interests.includes("sports"));
  assert.deepEqual(profile.specificInterestLabels, ["баскетбол"]);
  assert.ok(profile.specificInterestTerms.includes("баскетбол"));
});

test("keeps unknown llm exact interest criteria as raw terms", () => {
  const state = createDescriptionSelectionState();

  applyLlmAnalysis(state, {
    criteria: {
      criterion_12_exact_interest_topic: {
        status: "recognized",
        terms: ["флорбол"],
        labels: ["флорбол"],
        confidence: 0.85,
      },
    },
  });

  assert.equal(state.fields.interestsText, "флорбол");
  assert.deepEqual(state.fields.specificInterestLabels, ["флорбол"]);
  assert.deepEqual(state.fields.specificInterestTerms, ["флорбол"]);
});

test("stores normalized llm criteria and ignores unknown criteria columns", () => {
  const state = createDescriptionSelectionState();

  applyLlmAnalysis(state, {
    criteria: {
      criterion_03_age: {
        status: "recognized",
        age_bucket: "10-12",
        age_years: "15",
        age_text: "15 лет",
        confidence: "0.82",
      },
      criterion_01_municipality: {
        status: "recognized",
        value: ["Мурманск"],
        confidence: 1.2,
      },
      unknown_column: {
        status: "recognized",
        value: "ignored",
        confidence: 1,
      },
    },
  });

  assert.equal(state.llm.criteria.criterion_03_age.confidence, 0.82);
  assert.equal(state.llm.criteria.criterion_03_age.age_bucket, "13+");
  assert.equal(state.llm.criteria.criterion_03_age.age_years, 15);
  assert.equal(state.fields.age, "13+");
  assert.equal(state.fields.ageYears, 15);
  assert.equal(state.fields.ageText, "15 лет");
  assert.equal(state.llm.criteria.criterion_01_municipality.confidence, null);
  assert.equal(state.llm.criteria.unknown_column, undefined);
  assert.equal(state.llm.criterionConfidences, undefined);
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
