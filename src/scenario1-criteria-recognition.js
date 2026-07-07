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
const SCENARIO_1_CRITERIA_COLUMNS = SCENARIO_1_CRITERIA.map((criterion) => criterion.column);

const SCENARIO_1_CRITERIA_LOG_COLUMN_DEFINITIONS = [
  ["criterion_01_municipality_status", "text"],
  ["criterion_01_municipality_value", "text"],
  ["criterion_01_municipality_confidence", "confidence"],
  ["criterion_02_organization_restriction_status", "text"],
  ["criterion_02_organization_restriction_value", "text"],
  ["criterion_02_organization_restriction_confidence", "confidence"],
  ["criterion_03_age_status", "text"],
  ["criterion_03_age_bucket", "text"],
  ["criterion_03_age_years", "number"],
  ["criterion_03_age_text", "text"],
  ["criterion_03_age_confidence", "confidence"],
  ["criterion_04_cost_status", "text"],
  ["criterion_04_cost_value", "text"],
  ["criterion_04_cost_confidence", "confidence"],
  ["criterion_05_completed_program_exclusion_status", "text"],
  ["criterion_05_completed_program_exclusion_value", "text"],
  ["criterion_05_completed_program_exclusion_confidence", "confidence"],
  ["criterion_06_education_form_status", "text"],
  ["criterion_06_education_form_format", "text"],
  ["criterion_06_education_form_format_label", "text"],
  ["criterion_06_education_form_confidence", "confidence"],
  ["criterion_07_schedule_status", "text"],
  ["criterion_07_schedule_text", "text"],
  ["criterion_07_schedule_values", "array"],
  ["criterion_07_schedule_confidence", "confidence"],
  ["criterion_08_availability_status", "text"],
  ["criterion_08_availability_value", "text"],
  ["criterion_08_availability_confidence", "confidence"],
  ["criterion_09_direction_status", "text"],
  ["criterion_09_direction_value", "text"],
  ["criterion_09_direction_label", "text"],
  ["criterion_09_direction_confidence", "confidence"],
  ["criterion_10_group_size_status", "text"],
  ["criterion_10_group_size_value", "text"],
  ["criterion_10_group_size_confidence", "confidence"],
  ["criterion_11_program_topics_available_status", "text"],
  ["criterion_11_program_topics_available_value", "text"],
  ["criterion_11_program_topics_available_confidence", "confidence"],
  ["criterion_12_exact_interest_topic_status", "text"],
  ["criterion_12_exact_interest_topic_terms", "array"],
  ["criterion_12_exact_interest_topic_labels", "array"],
  ["criterion_12_exact_interest_topic_confidence", "confidence"],
  ["criterion_13_interest_level2_category_status", "text"],
  ["criterion_13_interest_level2_category_values", "array"],
  ["criterion_13_interest_level2_category_labels", "array"],
  ["criterion_13_interest_level2_category_confidence", "confidence"],
  ["criterion_14_interest_level1_section_status", "text"],
  ["criterion_14_interest_level1_section_direction", "text"],
  ["criterion_14_interest_level1_section_direction_label", "text"],
  ["criterion_14_interest_level1_section_confidence", "confidence"],
  ["criterion_15_fallback_text_keywords_status", "text"],
  ["criterion_15_fallback_text_keywords_value", "text"],
  ["criterion_15_fallback_text_keywords_confidence", "confidence"],
  ["criterion_16_interest_without_thematic_match_status", "text"],
  ["criterion_16_interest_without_thematic_match_interests", "array"],
  ["criterion_16_interest_without_thematic_match_specific_terms", "array"],
  ["criterion_16_interest_without_thematic_match_interests_text", "text"],
  ["criterion_16_interest_without_thematic_match_direction", "text"],
  ["criterion_16_interest_without_thematic_match_confidence", "confidence"],
  ["criterion_17_completed_exact_topic_match_status", "text"],
  ["criterion_17_completed_exact_topic_match_value", "text"],
  ["criterion_17_completed_exact_topic_match_confidence", "confidence"],
  ["criterion_18_new_topic_same_level2_status", "text"],
  ["criterion_18_new_topic_same_level2_value", "text"],
  ["criterion_18_new_topic_same_level2_confidence", "confidence"],
  ["criterion_19_new_topic_same_level1_status", "text"],
  ["criterion_19_new_topic_same_level1_value", "text"],
  ["criterion_19_new_topic_same_level1_confidence", "confidence"],
  ["criterion_20_no_completed_topic_link_status", "text"],
  ["criterion_20_no_completed_topic_link_value", "text"],
  ["criterion_20_no_completed_topic_link_confidence", "confidence"],
  ["criterion_21_depth_signal_status", "text"],
  ["criterion_21_depth_signal_value", "text"],
  ["criterion_21_depth_signal_confidence", "confidence"],
  ["criterion_22_no_depth_signal_repeat_status", "text"],
  ["criterion_22_no_depth_signal_repeat_value", "text"],
  ["criterion_22_no_depth_signal_repeat_confidence", "confidence"],
  ["criterion_23_repeat_completed_level2_status", "text"],
  ["criterion_23_repeat_completed_level2_value", "text"],
  ["criterion_23_repeat_completed_level2_confidence", "confidence"],
  ["criterion_24_new_level2_new_level1_status", "text"],
  ["criterion_24_new_level2_new_level1_value", "text"],
  ["criterion_24_new_level2_new_level1_confidence", "confidence"],
  ["criterion_25_new_level2_same_level1_status", "text"],
  ["criterion_25_new_level2_same_level1_value", "text"],
  ["criterion_25_new_level2_same_level1_confidence", "confidence"],
  ["criterion_26_any_classifier_topic_status", "text"],
  ["criterion_26_any_classifier_topic_value", "text"],
  ["criterion_26_any_classifier_topic_confidence", "confidence"],
  ["criterion_27_new_interest_program_level_status", "text"],
  ["criterion_27_new_interest_program_level_value", "text"],
  ["criterion_27_new_interest_program_level_confidence", "confidence"],
];

const SCENARIO_1_CRITERIA_LOG_COLUMNS = SCENARIO_1_CRITERIA_LOG_COLUMN_DEFINITIONS.map(([column]) => column);
const SCENARIO_1_CRITERIA_LOG_ARRAY_COLUMNS = new Set(
  SCENARIO_1_CRITERIA_LOG_COLUMN_DEFINITIONS
    .filter(([, type]) => type === "array")
    .map(([column]) => column),
);
const SCENARIO_1_CRITERIA_LOG_NUMBER_COLUMNS = new Set(
  SCENARIO_1_CRITERIA_LOG_COLUMN_DEFINITIONS
    .filter(([, type]) => type === "number")
    .map(([column]) => column),
);
const SCENARIO_1_CRITERIA_LOG_CONFIDENCE_COLUMNS = new Set(
  SCENARIO_1_CRITERIA_LOG_COLUMN_DEFINITIONS
    .filter(([, type]) => type === "confidence")
    .map(([column]) => column),
);

function buildScenario1CriteriaRecognitionRecord(options = {}) {
  const recognitionMethod = normalizeRecognitionMethod(options.recognitionMethod);
  const metadata = normalizeMetadata(options.metadata);
  const criteria = buildScenario1CriteriaDetails(options.state, {
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
    ...flattenScenario1Criteria(criteria),
  };
}

function buildScenario1CriteriaDetails(state = {}, options = {}) {
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

  if (recognitionMethod === "LLM") {
    applyModelCriterionConfidences(result, state.llm?.criterionConfidences);
  }

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

function flattenScenario1Criteria(criteria = {}) {
  const flat = createEmptyFlatCriteria();

  setSimpleCriterion(flat, "criterion_01_municipality", criteria.criterion_01_municipality);
  setSimpleCriterion(flat, "criterion_02_organization_restriction", criteria.criterion_02_organization_restriction);
  setAgeCriterion(flat, criteria.criterion_03_age);
  setSimpleCriterion(flat, "criterion_04_cost", criteria.criterion_04_cost);
  setSimpleCriterion(flat, "criterion_05_completed_program_exclusion", criteria.criterion_05_completed_program_exclusion);
  setEducationFormCriterion(flat, criteria.criterion_06_education_form);
  setScheduleCriterion(flat, criteria.criterion_07_schedule);
  setSimpleCriterion(flat, "criterion_08_availability", criteria.criterion_08_availability);
  setDirectionValueCriterion(flat, criteria.criterion_09_direction);
  setSimpleCriterion(flat, "criterion_10_group_size", criteria.criterion_10_group_size);
  setSimpleCriterion(flat, "criterion_11_program_topics_available", criteria.criterion_11_program_topics_available);
  setExactInterestCriterion(flat, criteria.criterion_12_exact_interest_topic);
  setInterestCategoryCriterion(flat, criteria.criterion_13_interest_level2_category);
  setDirectionCriterion(flat, "criterion_14_interest_level1_section", criteria.criterion_14_interest_level1_section);
  setSimpleCriterion(flat, "criterion_15_fallback_text_keywords", criteria.criterion_15_fallback_text_keywords);
  setInterestMismatchCriterion(flat, criteria.criterion_16_interest_without_thematic_match);

  for (const column of [
    "criterion_17_completed_exact_topic_match",
    "criterion_18_new_topic_same_level2",
    "criterion_19_new_topic_same_level1",
    "criterion_20_no_completed_topic_link",
    "criterion_21_depth_signal",
    "criterion_22_no_depth_signal_repeat",
    "criterion_23_repeat_completed_level2",
    "criterion_24_new_level2_new_level1",
    "criterion_25_new_level2_same_level1",
    "criterion_26_any_classifier_topic",
    "criterion_27_new_interest_program_level",
  ]) {
    setSimpleCriterion(flat, column, criteria[column]);
  }

  return flat;
}

function createEmptyFlatCriteria() {
  return Object.fromEntries(
    SCENARIO_1_CRITERIA_LOG_COLUMN_DEFINITIONS.map(([column, type]) => [
      column,
      type === "array" ? [] : null,
    ]),
  );
}

function setCommon(flat, prefix, criterion) {
  flat[`${prefix}_status`] = criterion?.status || "not_specified";
  flat[`${prefix}_confidence`] = normalizeConfidenceValue(criterion?.confidence);
}

function setSimpleCriterion(flat, prefix, criterion) {
  setCommon(flat, prefix, criterion);
  flat[`${prefix}_value`] = stringifyCriterionValue(criterion?.value);
}

function setAgeCriterion(flat, criterion) {
  setCommon(flat, "criterion_03_age", criterion);
  const value = criterion?.value || {};
  flat.criterion_03_age_bucket = value.age || null;
  flat.criterion_03_age_years = numberOrNull(value.ageYears);
  flat.criterion_03_age_text = value.ageText || null;
}

function setEducationFormCriterion(flat, criterion) {
  setCommon(flat, "criterion_06_education_form", criterion);
  const value = criterion?.value || {};
  flat.criterion_06_education_form_format = value.format || null;
  flat.criterion_06_education_form_format_label = value.formatLabel || null;
}

function setScheduleCriterion(flat, criterion) {
  setCommon(flat, "criterion_07_schedule", criterion);
  const value = criterion?.value || {};
  flat.criterion_07_schedule_text = value.scheduleText || null;
  flat.criterion_07_schedule_values = normalizeArray(value.schedule);
}

function setDirectionCriterion(flat, prefix, criterion) {
  setCommon(flat, prefix, criterion);
  const value = criterion?.value || {};
  flat[`${prefix}_direction`] = value.direction || null;
  flat[`${prefix}_direction_label`] = value.directionLabel || null;
}

function setDirectionValueCriterion(flat, criterion) {
  setCommon(flat, "criterion_09_direction", criterion);
  const value = criterion?.value || {};
  flat.criterion_09_direction_value = value.direction || null;
  flat.criterion_09_direction_label = value.directionLabel || null;
}

function setExactInterestCriterion(flat, criterion) {
  setCommon(flat, "criterion_12_exact_interest_topic", criterion);
  const value = criterion?.value || {};
  flat.criterion_12_exact_interest_topic_terms = normalizeArray(value.specificInterestTerms);
  flat.criterion_12_exact_interest_topic_labels = normalizeArray(value.specificInterestLabels);
}

function setInterestCategoryCriterion(flat, criterion) {
  setCommon(flat, "criterion_13_interest_level2_category", criterion);
  const value = criterion?.value || {};
  flat.criterion_13_interest_level2_category_values = normalizeArray(value.interests);
  flat.criterion_13_interest_level2_category_labels = normalizeArray(value.interestLabels);
}

function setInterestMismatchCriterion(flat, criterion) {
  setCommon(flat, "criterion_16_interest_without_thematic_match", criterion);
  const value = criterion?.value || {};
  flat.criterion_16_interest_without_thematic_match_interests = normalizeArray(value.interests);
  flat.criterion_16_interest_without_thematic_match_specific_terms = normalizeArray(value.specificInterestTerms);
  flat.criterion_16_interest_without_thematic_match_interests_text = value.interestsText || null;
  flat.criterion_16_interest_without_thematic_match_direction = value.direction || null;
}

function stringifyCriterionValue(value) {
  if (value === null || value === undefined || value === "") return null;
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") {
    return Object.values(value)
      .flat()
      .filter((item) => item !== null && item !== undefined && item !== "")
      .join(", ") || null;
  }
  return String(value);
}

function normalizeArray(value) {
  return Array.isArray(value)
    ? value.filter((item) => item !== null && item !== undefined && item !== "").map(String)
    : [];
}

function normalizeConfidenceValue(value) {
  return Number.isFinite(value) ? value : null;
}

function applyModelCriterionConfidences(criteria, rawConfidences = {}) {
  const confidences = normalizeModelCriterionConfidences(rawConfidences);
  for (const column of SCENARIO_1_CRITERIA_COLUMNS) {
    if (!criteria[column]) continue;
    criteria[column].confidence = Object.prototype.hasOwnProperty.call(confidences, column)
      ? confidences[column]
      : null;
  }
  return criteria;
}

function normalizeModelCriterionConfidences(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const result = {};
  for (const column of SCENARIO_1_CRITERIA_COLUMNS) {
    const confidence = normalizeModelConfidence(source[column] ?? source[`${column}_confidence`]);
    if (confidence !== null) result[column] = confidence;
  }
  return result;
}

function normalizeModelConfidence(value) {
  const raw = value && typeof value === "object" && !Array.isArray(value)
    ? value.confidence
    : value;
  if (raw === null || raw === undefined || raw === "") return null;
  const number = typeof raw === "string" ? Number(raw.trim().replace(",", ".")) : Number(raw);
  if (!Number.isFinite(number) || number < 0 || number > 1) return null;
  return Math.round(number * 1000) / 1000;
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
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
  SCENARIO_1_CRITERIA_LOG_ARRAY_COLUMNS,
  SCENARIO_1_CRITERIA_LOG_COLUMNS,
  SCENARIO_1_CRITERIA_LOG_CONFIDENCE_COLUMNS,
  SCENARIO_1_CRITERIA_LOG_NUMBER_COLUMNS,
  buildScenario1CriteriaDetails,
  buildScenario1CriteriaRecognitionRecord,
  buildScenario1CriteriaSnapshot: buildScenario1CriteriaDetails,
  calculateRecognitionConfidence,
};
