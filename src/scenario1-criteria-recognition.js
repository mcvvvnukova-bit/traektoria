const SCENARIO_1_CRITERIA = [
  {
    number: 1,
    column: "criterion_01_municipality",
    name: "Населенный пункт программы",
    scenarios: ["С1", "С2", "С3", "С4"],
  },
  {
    number: 2,
    column: "criterion_02_organization_restriction",
    name: "Ограничение по организации",
    scenarios: ["С1", "С2", "С3", "С4"],
  },
  {
    number: 3,
    column: "criterion_03_age",
    name: "Возраст программы",
    scenarios: ["С1", "С2", "С3", "С4"],
  },
  {
    number: 4,
    column: "criterion_04_cost",
    name: "Стоимость группы или программы",
    scenarios: ["С1", "С2", "С3", "С4"],
  },
  {
    number: 5,
    column: "criterion_05_completed_program_exclusion",
    name: "Исключение уже пройденных программ",
    scenarios: ["С3", "С4"],
  },
  {
    number: 6,
    column: "criterion_06_education_form",
    name: "Форма обучения",
    scenarios: ["С1", "С2", "С3", "С4"],
  },
  {
    number: 7,
    column: "criterion_07_schedule",
    name: "Попадание в расписание",
    scenarios: ["С1", "С2", "С3", "С4"],
  },
  {
    number: 8,
    column: "criterion_08_availability",
    name: "Наличие мест / открыта запись",
    scenarios: ["С1", "С2", "С3", "С4"],
  },
  {
    number: 9,
    column: "criterion_09_direction",
    name: "Направленность программы",
    scenarios: ["С1", "С2", "С3", "С4"],
  },
  {
    number: 10,
    column: "criterion_10_group_size",
    name: "Размер группы",
    scenarios: ["С1", "С2", "С3", "С4"],
  },
  {
    number: 11,
    column: "criterion_11_program_topics_available",
    name: "У программы есть темы из документов",
    scenarios: ["С1", "С2", "С3", "С4"],
  },
  {
    number: 12,
    column: "criterion_12_exact_interest_topic",
    name: "Точное совпадение интереса с нормализованной темой",
    scenarios: ["С1", "С2", "С3", "С4"],
  },
  {
    number: 13,
    column: "criterion_13_interest_level2_category",
    name: "Совпадение интереса с категорией level 2",
    scenarios: ["С1", "С2", "С3", "С4"],
  },
  {
    number: 14,
    column: "criterion_14_interest_level1_section",
    name: "Совпадение интереса с разделом level 1",
    scenarios: ["С1", "С2", "С3", "С4"],
  },
  {
    number: 15,
    column: "criterion_15_fallback_text_keywords",
    name: "Fallback по названию, аннотации, ключевым словам",
    scenarios: ["С1", "С2", "С3", "С4"],
  },
  {
    number: 16,
    column: "criterion_16_interest_without_thematic_match",
    name: "Пользователь указал интерес, но нет тематического совпадения",
    scenarios: ["С1", "С2", "С3", "С4"],
  },
  {
    number: 17,
    column: "criterion_17_completed_exact_topic_match",
    name: "Совпадение с точной пройденной темой",
    scenarios: ["С3"],
  },
  {
    number: 18,
    column: "criterion_18_new_topic_same_level2",
    name: "Новая тема в той же категории level 2",
    scenarios: ["С3"],
  },
  {
    number: 19,
    column: "criterion_19_new_topic_same_level1",
    name: "Новая тема в том же разделе level 1",
    scenarios: ["С3"],
  },
  {
    number: 20,
    column: "criterion_20_no_completed_topic_link",
    name: "Нет тематической связи с пройденным",
    scenarios: ["С3"],
  },
  {
    number: 21,
    column: "criterion_21_depth_signal",
    name: "Depth-сигнал углубления",
    scenarios: ["С3"],
  },
  {
    number: 22,
    column: "criterion_22_no_depth_signal_repeat",
    name: "Нет depth-сигнала при простом повторе темы",
    scenarios: ["С3"],
  },
  {
    number: 23,
    column: "criterion_23_repeat_completed_level2",
    name: "Повтор изученной категории level 2",
    scenarios: ["С4"],
  },
  {
    number: 24,
    column: "criterion_24_new_level2_new_level1",
    name: "Новая категория level 2 в новом разделе level 1",
    scenarios: ["С4"],
  },
  {
    number: 25,
    column: "criterion_25_new_level2_same_level1",
    name: "Новая категория level 2 в том же разделе level 1",
    scenarios: ["С4"],
  },
  {
    number: 26,
    column: "criterion_26_any_classifier_topic",
    name: "Любая содержательная тема по классификатору",
    scenarios: ["С4"],
  },
  {
    number: 27,
    column: "criterion_27_new_interest_program_level",
    name: "Уровень программы для новых интересов",
    scenarios: ["С4"],
  },
];

const SCENARIO_1_CRITERIA_COLUMNS = SCENARIO_1_CRITERIA.map((item) => item.column);

function buildScenario1CriteriaRecognitionRecord(options = {}) {
  const recognitionMethod = normalizeRecognitionMethod(options.recognitionMethod);
  const metadata = normalizeMetadata(options.metadata);
  const criteria = buildScenario1CriteriaSnapshot(options.state, {
    recognitionMethod,
  });

  return {
    platform: options.platform || "telegram",
    sessionId: stringify(options.sessionId),
    channel: buildChannelValue(options.platform, metadata),
    channelId: metadata.channelId || null,
    channelType: metadata.channelType || null,
    inputText: String(options.inputText || ""),
    recognitionMethod,
    recognitionConfidence: calculateRecognitionConfidence(criteria, options.state, recognitionMethod),
    criteria,
  };
}

function buildScenario1CriteriaSnapshot(state = {}, options = {}) {
  const recognitionMethod = normalizeRecognitionMethod(options.recognitionMethod);
  const fields = state.fields || {};
  const ambiguities = new Set(state.ambiguities || []);
  const hasInterestSignal = hasAnyInterestSignal(fields);
  const specificInterestTerms = fields.specificInterestTerms || [];
  const specificInterestLabels = fields.specificInterestLabels || [];
  const interests = fields.interests || [];
  const interestLabels = fields.interestLabels || [];
  const result = {};

  for (const definition of SCENARIO_1_CRITERIA) {
    result[definition.column] = baseCriterion(definition, {
      status: definition.scenarios.includes("С1") ? "not_specified" : "not_applicable",
      value: null,
      confidence: null,
      sourceFields: [],
      recognitionMethod,
    });
  }

  result.criterion_01_municipality = baseCriterion(SCENARIO_1_CRITERIA[0], {
    status: fields.place ? (fields.placeKnown === false ? "recognized_unverified" : "recognized") : "missing_required",
    value: fields.place || null,
    confidence: fields.place ? (fields.placeKnown === false ? 0.6 : 0.95) : 0,
    sourceFields: ["fields.place", "fields.placeKnown"],
    recognitionMethod,
  });

  result.criterion_02_organization_restriction = baseCriterion(SCENARIO_1_CRITERIA[1], {
    status: "not_specified",
    value: null,
    confidence: null,
    sourceFields: [],
    recognitionMethod,
    note: "Scenario 1 currently stores free-text place separately from organization restrictions.",
  });

  result.criterion_03_age = baseCriterion(SCENARIO_1_CRITERIA[2], {
    status: fields.age ? (ambiguities.has("age_approximate") || ambiguities.has("age_range") ? "recognized_ambiguous" : "recognized") : "missing_required",
    value: fields.age ? {
      age: fields.age,
      ageYears: fields.ageYears || null,
      ageText: fields.ageText || "",
    } : null,
    confidence: fields.age ? (ambiguities.has("age_approximate") || ambiguities.has("age_range") ? 0.65 : 0.95) : 0,
    sourceFields: ["fields.age", "fields.ageYears", "fields.ageText"],
    recognitionMethod,
  });

  result.criterion_04_cost = baseCriterion(SCENARIO_1_CRITERIA[3], {
    status: fields.budget ? "recognized" : "not_specified",
    value: fields.budget || null,
    confidence: fields.budget ? 0.85 : null,
    sourceFields: ["fields.budget"],
    recognitionMethod,
  });

  result.criterion_06_education_form = baseCriterion(SCENARIO_1_CRITERIA[5], {
    status: fields.format ? "recognized" : "not_specified",
    value: fields.format ? {
      format: fields.format,
      formatLabel: fields.formatLabel || "",
    } : null,
    confidence: fields.format ? 0.85 : null,
    sourceFields: ["fields.format", "fields.formatLabel"],
    recognitionMethod,
  });

  result.criterion_07_schedule = baseCriterion(SCENARIO_1_CRITERIA[6], {
    status: fields.scheduleText || fields.schedule?.length ? "recognized" : "not_specified",
    value: fields.scheduleText || fields.schedule?.length ? {
      scheduleText: fields.scheduleText || "",
      schedule: fields.schedule || [],
    } : null,
    confidence: fields.scheduleText || fields.schedule?.length ? 0.85 : null,
    sourceFields: ["fields.schedule", "fields.scheduleText"],
    recognitionMethod,
  });

  result.criterion_08_availability = baseCriterion(SCENARIO_1_CRITERIA[7], {
    status: "not_in_user_text",
    value: null,
    confidence: null,
    sourceFields: [],
    recognitionMethod,
    note: "This criterion is evaluated from PFDO program and group data, not from the user text.",
  });

  result.criterion_09_direction = baseCriterion(SCENARIO_1_CRITERIA[8], {
    status: fields.direction ? "recognized" : "not_specified",
    value: fields.direction ? {
      direction: fields.direction,
      directionLabel: fields.directionLabel || "",
    } : null,
    confidence: fields.direction ? 0.85 : null,
    sourceFields: ["fields.direction", "fields.directionLabel"],
    recognitionMethod,
  });

  result.criterion_10_group_size = baseCriterion(SCENARIO_1_CRITERIA[9], {
    status: fields.groupSize || fields.clarifyGroup ? "recognized" : "not_specified",
    value: fields.groupSize || fields.clarifyGroup || null,
    confidence: fields.groupSize || fields.clarifyGroup ? 0.8 : null,
    sourceFields: ["fields.groupSize", "fields.clarifyGroup"],
    recognitionMethod,
  });

  result.criterion_11_program_topics_available = baseCriterion(SCENARIO_1_CRITERIA[10], {
    status: "not_in_user_text",
    value: null,
    confidence: null,
    sourceFields: [],
    recognitionMethod,
    note: "This criterion is evaluated from PFDO topic tables, not from the user text.",
  });

  result.criterion_12_exact_interest_topic = baseCriterion(SCENARIO_1_CRITERIA[11], {
    status: specificInterestTerms.length ? "recognized" : "not_specified",
    value: specificInterestTerms.length ? {
      specificInterestTerms,
      specificInterestLabels,
    } : null,
    confidence: specificInterestTerms.length ? 0.9 : null,
    sourceFields: ["fields.specificInterestTerms", "fields.specificInterestLabels"],
    recognitionMethod,
  });

  result.criterion_13_interest_level2_category = baseCriterion(SCENARIO_1_CRITERIA[12], {
    status: interests.length ? (fields.broadInterest ? "recognized_ambiguous" : "recognized") : "not_specified",
    value: interests.length ? {
      interests,
      interestLabels,
    } : null,
    confidence: interests.length ? (fields.broadInterest ? 0.65 : 0.8) : null,
    sourceFields: ["fields.interests", "fields.interestLabels", "fields.broadInterest"],
    recognitionMethod,
  });

  result.criterion_14_interest_level1_section = baseCriterion(SCENARIO_1_CRITERIA[13], {
    status: fields.direction ? "recognized" : "not_specified",
    value: fields.direction ? {
      direction: fields.direction,
      directionLabel: fields.directionLabel || "",
    } : null,
    confidence: fields.direction ? 0.75 : null,
    sourceFields: ["fields.direction", "fields.directionLabel"],
    recognitionMethod,
  });

  result.criterion_15_fallback_text_keywords = baseCriterion(SCENARIO_1_CRITERIA[14], {
    status: fields.interestsText ? "recognized" : "not_specified",
    value: fields.interestsText || null,
    confidence: fields.interestsText ? 0.7 : null,
    sourceFields: ["fields.interestsText"],
    recognitionMethod,
  });

  result.criterion_16_interest_without_thematic_match = baseCriterion(SCENARIO_1_CRITERIA[15], {
    status: hasInterestSignal ? "pending_scoring" : "missing_required",
    value: hasInterestSignal ? {
      interests,
      specificInterestTerms,
      interestsText: fields.interestsText || "",
      direction: fields.direction || null,
    } : null,
    confidence: hasInterestSignal ? 0.75 : 0,
    sourceFields: ["fields.interests", "fields.specificInterestTerms", "fields.interestsText", "fields.direction"],
    recognitionMethod,
    note: "The final mismatch decision is made during scoring against PFDO topic data.",
  });

  return result;
}

function baseCriterion(definition, details = {}) {
  return {
    number: definition.number,
    name: definition.name,
    scenarios: definition.scenarios,
    appliesToScenario1: definition.scenarios.includes("С1"),
    status: details.status || "not_specified",
    value: details.value ?? null,
    confidence: details.confidence ?? null,
    sourceFields: details.sourceFields || [],
    recognitionMethod: details.recognitionMethod || "regexp",
    note: details.note || "",
  };
}

function calculateRecognitionConfidence(criteria, state = {}, recognitionMethod = "regexp") {
  const confidenceValues = Object.values(criteria)
    .filter((criterion) => criterion.appliesToScenario1)
    .filter((criterion) => criterion.status !== "not_in_user_text")
    .map((criterion) => criterion.confidence)
    .filter((value) => Number.isFinite(value));

  if (!confidenceValues.length) return 0;

  const average = confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length;
  const missingPenalty = countMissingRequired(state.fields || {}) * 0.12;
  const ambiguityPenalty = (state.ambiguities || []).length * 0.04;
  const llmErrorPenalty = recognitionMethod === "LLM" && state.llm?.error ? 0.2 : 0;

  return roundConfidence(average - missingPenalty - ambiguityPenalty - llmErrorPenalty);
}

function countMissingRequired(fields = {}) {
  let count = 0;
  if (!fields.age) count += 1;
  if (!fields.place) count += 1;
  if (!hasAnyInterestSignal(fields)) count += 1;
  return count;
}

function hasAnyInterestSignal(fields = {}) {
  return Boolean(
    fields.direction ||
    fields.interestsText ||
    fields.broadInterest ||
    (Array.isArray(fields.interests) && fields.interests.length) ||
    (Array.isArray(fields.specificInterestTerms) && fields.specificInterestTerms.length)
  );
}

function normalizeRecognitionMethod(value) {
  return value === "LLM" ? "LLM" : "regexp";
}

function buildChannelValue(platform, metadata = {}) {
  const normalizedPlatform = platform || "telegram";
  return metadata.channelId ? `${normalizedPlatform}:${metadata.channelId}` : normalizedPlatform;
}

function normalizeMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") return {};
  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined && value !== null && value !== ""),
  );
}

function stringify(value) {
  if (value === null || value === undefined || value === "") {
    throw new Error("Missing session id");
  }
  return String(value);
}

function roundConfidence(value) {
  return Math.max(0, Math.min(0.999, Math.round(Number(value || 0) * 1000) / 1000));
}

module.exports = {
  SCENARIO_1_CRITERIA,
  SCENARIO_1_CRITERIA_COLUMNS,
  buildScenario1CriteriaRecognitionRecord,
  buildScenario1CriteriaSnapshot,
  calculateRecognitionConfidence,
};
