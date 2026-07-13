const { analyzeQueryInterests } = require("./query-ontology");
const { findMurmanskSettlements } = require("./murmansk-settlements");
const { SCENARIO_1_CRITERIA_COLUMNS } = require("./scenario1-criteria-recognition");

const AGE_LABELS = {
  "3-4": "3-4 года",
  "5-6": "5-6 лет",
  "7-9": "7-9 лет",
  "10-12": "10-12 лет",
  "13+": "13 лет и старше",
};

const DIRECTION_RULES = [
  {
    value: "technical",
    label: "Техническая",
    interests: ["building", "logic"],
    pattern: /техническ|робот|программ|инженер|констру|3d|модел|информат|технолог/i,
  },
  {
    value: "art",
    label: "Художественная",
    interests: ["creative"],
    pattern: /художеств|рисован|рисовать|лепк|дизайн|музык|вокал|танц|театр|творческ/i,
  },
  {
    value: "sport",
    label: "Физкультурно-спортивная",
    interests: ["sports"],
    pattern: /спорт|плаван|футбол|хокке|гимнаст|самбо|дзюдо|борьб|баскет|волей/i,
  },
  {
    value: "social",
    label: "Социально-гуманитарная",
    interests: ["social"],
    pattern: /социальн|гуманитар|общени|лидер|журналист|волонтер|английск|язык/i,
  },
  {
    value: "science",
    label: "Естественно-научная",
    interests: ["logic"],
    pattern: /естественно|научн|биолог|хими|физик|математ|исследован|эколог/i,
  },
  {
    value: "tourism",
    label: "Туристско-краеведческая",
    interests: ["sports", "social"],
    pattern: /туризм|турист|краевед|поход|экскурс|ориентирован/i,
  },
];

const INTEREST_RULES = [
  ["creative", "творчество", /рис|леп|твор|дизайн|мастер|худож|придум|музык|танц|поделк|вокал/i],
  ["building", "конструирование", /робот|констру|собират|инженер|3d|модел|техн/i],
  ["sports", "спорт", /спорт|плав|футбол|хокке|гимнаст|самбо|дзюдо|борьб|бег|волейбол|баскетбол/i],
  ["social", "общение", /обща|друз|команд|театр|сцен|выступ|лидер|журналист/i],
  ["logic", "логика и программирование", /логик|математ|программ|шахмат|как все устроено|информат|физик/i],
  ["calm", "спокойные занятия", /спокой|усидчив|в своем темпе|не спеша/i],
];

const SCENARIO_1_CRITERIA_COLUMN_SET = new Set(SCENARIO_1_CRITERIA_COLUMNS);
const RECOGNIZED_CRITERION_STATUSES = new Set([
  "recognized",
  "recognized_ambiguous",
  "recognized_unverified",
  "pending_scoring",
]);
const KNOWN_CRITERION_STATUSES = new Set([
  ...RECOGNIZED_CRITERION_STATUSES,
  "missing_required",
  "not_specified",
  "not_in_user_text",
  "not_applicable",
]);
const ALLOWED_INTEREST_VALUES = new Set(INTEREST_RULES.map(([value]) => value));
const ALLOWED_DIRECTION_VALUES = new Set(DIRECTION_RULES.map((item) => item.value));
const ALLOWED_FORMAT_VALUES = new Set(["online", "offline"]);
const ALLOWED_SCHEDULE_VALUES = new Set(["weekdays", "weekends", "morning", "evening"]);
const FORMAT_LABELS = {
  online: "Онлайн",
  offline: "Офлайн",
};
const SCHEDULE_LABELS = {
  weekdays: "будни",
  weekends: "выходные",
  morning: "утром",
  evening: "вечером",
};

const LEGACY_MUNICIPALITY_RULES = [
  ["Мурманск", /(?:^|[^а-яё])мурманск(?:е|а|у|ом)?(?=$|[^а-яё])/i],
  ["Североморск", /североморск|североморске/i],
  ["Апатиты", /апатит/i],
  ["Кировск", /кировск|кировске/i],
  ["Мончегорск", /мончегорск|мончегорске/i],
  ["Кандалакша", /кандалакш/i],
  ["Кола", /(?:^|[^а-яё])кол[аеу](?=$|[^а-яё])/i],
  ["Оленегорск", /оленегорск|оленегорске/i],
  ["Полярный", /полярн(ый|ом)/i],
  ["Полярные Зори", /полярн(ые|ых)\s+зор/i],
  ["Снежногорск", /снежногорск|снежногорске/i],
  ["Заозерск", /заозерск|заозерске/i],
  ["Гаджиево", /гаджиев/i],
  ["Видяево", /видяев/i],
  ["Заполярный", /заполярн(ый|ом)/i],
  ["Никель", /никел/i],
  ["Ковдор", /ковдор/i],
  ["Умба", /умб[аеу]/i],
  ["Ловозеро", /ловозер/i],
  ["Ревда", /ревд[аеу]/i],
];

function createDescriptionSelectionState() {
  return {
    originalText: "",
    clarifications: [],
    edits: [],
    fields: {
      age: null,
      ageYears: null,
      ageText: "",
      place: "",
      placeKnown: false,
      placeCandidates: [],
      placeAmbiguity: "",
      interestsText: "",
      interests: [],
      interestLabels: [],
      specificInterestTerms: [],
      specificInterestLabels: [],
      excludedSpecificInterestTerms: [],
      broadInterest: false,
      direction: null,
      directionLabel: "",
      goal: null,
      goalLabel: "",
      budget: "",
      schedule: [],
      scheduleText: "",
      format: null,
      formatLabel: "",
      avoidances: [],
      avoidanceLabels: [],
      adaptation: null,
      clarifyGroup: null,
      clarifyFocus: null,
    },
    ambiguities: [],
    llm: {
      attempted: false,
      applied: false,
      error: "",
      criteria: {},
    },
    lastResult: null,
    pdfPath: "",
  };
}

function ensureDescriptionSelectionState(session) {
  if (!session.descriptionSelection) {
    session.descriptionSelection = createDescriptionSelectionState();
  }
  if (!session.descriptionSelection.fields) {
    session.descriptionSelection.fields = createDescriptionSelectionState().fields;
  }
  if (!Array.isArray(session.descriptionSelection.clarifications)) {
    session.descriptionSelection.clarifications = [];
  }
  if (!Array.isArray(session.descriptionSelection.edits)) {
    session.descriptionSelection.edits = [];
  }
  if (!session.descriptionSelection.llm || typeof session.descriptionSelection.llm !== "object") {
    session.descriptionSelection.llm = createDescriptionSelectionState().llm;
  }
  if (!session.descriptionSelection.llm.criteria ||
    typeof session.descriptionSelection.llm.criteria !== "object" ||
    Array.isArray(session.descriptionSelection.llm.criteria)) {
    session.descriptionSelection.llm.criteria = {};
  }
  return session.descriptionSelection;
}

function applyDescriptionText(state, text, options = {}) {
  const mode = options.mode || "description";
  const value = String(text || "").trim();
  if (!value) {
    state.ambiguities = buildAmbiguities(state);
    return state;
  }

  if (mode === "description" && !state.originalText) {
    state.originalText = value;
  } else if (mode === "edit") {
    state.edits.push(value);
  } else {
    state.clarifications.push(value);
  }

  const parseText = mode === "edit" ? extractPositiveCorrectionText(value) : value;
  const patch = parseDescriptionText(parseText);
  mergeFields(state.fields, patch.fields, { mode, rawText: value });
  state.ambiguities = buildAmbiguities(state, patch.ambiguities);
  state.lastResult = null;
  return state;
}

function shouldUseLlmForDescription(state, text) {
  const value = String(text || "").trim();
  if (!value) return false;
  return getMissingRequiredFields(state).length > 0 ||
    buildAmbiguities(state).length > 0 ||
    value.length > 160;
}

function applyLlmAnalysis(state, analysis, options = {}) {
  const criteria = normalizeModelCriteria(analysis?.criteria);
  state.llm = {
    ...(state.llm || {}),
    attempted: true,
    applied: false,
    error: "",
    criteria,
  };

  const patch = buildFieldsPatchFromCriteria(criteria);
  mergeFields(state.fields, patch, { mode: options.mode || "llm" });
  state.ambiguities = buildAmbiguities(state);
  state.llm.applied = Object.values(patch).some(isMeaningfulPatchValue);
  return state.llm.applied;
}

function buildFieldsPatchFromCriteria(criteria = {}) {
  const patch = {};

  applyCriteriaMunicipalityPatch(patch, criteria.criterion_01_municipality);
  applyCriteriaAgePatch(patch, criteria.criterion_03_age);
  applyCriteriaCostPatch(patch, criteria.criterion_04_cost);
  applyCriteriaEducationFormPatch(patch, criteria.criterion_06_education_form);
  applyCriteriaSchedulePatch(patch, criteria.criterion_07_schedule);
  applyCriteriaDirectionPatch(patch, criteria.criterion_09_direction);
  applyCriteriaGroupSizePatch(patch, criteria.criterion_10_group_size);
  applyCriteriaExactInterestPatch(patch, criteria.criterion_12_exact_interest_topic);
  applyCriteriaInterestCategoryPatch(patch, criteria.criterion_13_interest_level2_category);
  applyCriteriaDirectionPatch(patch, criteria.criterion_14_interest_level1_section);
  applyCriteriaFallbackKeywordsPatch(patch, criteria.criterion_15_fallback_text_keywords);
  applyCriteriaInterestMismatchPatch(patch, criteria.criterion_16_interest_without_thematic_match);

  return patch;
}

function applyCriteriaMunicipalityPatch(patch, criterion) {
  if (!isRecognizedCriterion(criterion)) return;
  const values = criterionTextArray(readCriterionValue(criterion, "value"));
  if (!values.length) return;

  if (values.some(mentionsMurmanskRegion)) {
    patch.placeCandidates = [];
    patch.placeAmbiguity = "place_region";
    return;
  }

  const candidates = [];
  let unverifiedPlace = "";
  for (const value of values) {
    const place = detectPlace(value);
    if (place.place) {
      candidates.push(place.place);
    } else if (place.candidates?.length) {
      candidates.push(...place.candidates);
    } else {
      unverifiedPlace = cleanupPlace(value);
      if (unverifiedPlace) candidates.push(unverifiedPlace);
    }
  }

  const uniqueCandidates = [...new Set(candidates.filter(Boolean))];
  if (!uniqueCandidates.length) return;

  if (criterion.status === "recognized_ambiguous" || uniqueCandidates.length > 1) {
    patch.placeCandidates = uniqueCandidates;
    patch.placeAmbiguity = "place_multiple";
    return;
  }

  patch.place = uniqueCandidates[0];
  patch.placeKnown = criterion.status !== "recognized_unverified" && !unverifiedPlace;
  patch.placeCandidates = [];
  patch.placeAmbiguity = "";
}

function applyCriteriaAgePatch(patch, criterion) {
  if (!isRecognizedCriterion(criterion)) return;
  const years = coerceAgeYears(readCriterionValue(criterion, "age_years", "ageYears", "years")) ||
    coerceAgeYears(readCriterionValue(criterion, "age_text", "ageText", "text"));
  const bucket = years ? ageBucket(years) : null;
  if (!bucket) return;

  patch.age = bucket;
  if (years) patch.ageYears = years;
  patch.ageText = criterionText(readCriterionValue(criterion, "age_text", "ageText", "text")) ||
    (years ? `${years} лет` : AGE_LABELS[bucket] || bucket);
}

function applyCriteriaCostPatch(patch, criterion) {
  if (!isRecognizedCriterion(criterion)) return;
  const value = criterionText(readCriterionValue(criterion, "value", "text"));
  if (value) patch.budget = value;
}

function applyCriteriaEducationFormPatch(patch, criterion) {
  if (!isRecognizedCriterion(criterion)) return;
  const format = normalizeEnumValue(readCriterionValue(criterion, "format"), ALLOWED_FORMAT_VALUES);
  if (!format) return;
  patch.format = format;
  patch.formatLabel = criterionText(readCriterionValue(criterion, "format_label", "formatLabel", "label")) ||
    FORMAT_LABELS[format] ||
    "";
}

function applyCriteriaSchedulePatch(patch, criterion) {
  if (!isRecognizedCriterion(criterion)) return;
  const schedule = normalizeEnumArray(
    readCriterionValue(criterion, "schedule_values", "scheduleValues", "values", "schedule"),
    ALLOWED_SCHEDULE_VALUES,
  );
  const scheduleText = criterionText(readCriterionValue(criterion, "schedule_text", "scheduleText", "text", "value"));
  const detected = scheduleText ? detectSchedule(scheduleText) : { values: [], text: "" };
  const values = [...new Set([...schedule, ...(detected.values || [])])];
  if (!values.length && !scheduleText) return;
  patch.schedule = values;
  patch.scheduleText = scheduleText || labelsForSchedule(values);
}

function applyCriteriaDirectionPatch(patch, criterion) {
  if (!isRecognizedCriterion(criterion)) return;
  const direction = normalizeEnumValue(readCriterionValue(criterion, "direction", "value"), ALLOWED_DIRECTION_VALUES);
  if (!direction) return;
  const rule = DIRECTION_RULES.find((item) => item.value === direction);
  if (!patch.direction) {
    patch.direction = direction;
    patch.directionLabel = criterionText(readCriterionValue(criterion, "direction_label", "directionLabel", "label")) ||
      rule?.label ||
      "";
  }
  addPatchInterests(patch, rule?.interests || []);
  if (!patch.interestsText && patch.directionLabel) patch.interestsText = patch.directionLabel;
}

function applyCriteriaGroupSizePatch(patch, criterion) {
  if (!isRecognizedCriterion(criterion)) return;
  const value = criterionText(readCriterionValue(criterion, "value", "text"));
  if (value) patch.groupSize = value;
}

function applyCriteriaExactInterestPatch(patch, criterion) {
  if (!isRecognizedCriterion(criterion)) return;
  const terms = criterionTextArray(readCriterionValue(
    criterion,
    "terms",
    "specific_terms",
    "specificTerms",
    "specificInterestTerms",
  ));
  const labels = criterionTextArray(readCriterionValue(
    criterion,
    "labels",
    "specific_labels",
    "specificLabels",
    "specificInterestLabels",
  ));
  const specificInterestPatch = buildSpecificInterestPatch(labels.length ? labels : terms);
  if (!specificInterestPatch.specificInterestTerms?.length) return;

  patch.specificInterestTerms = mergeUniqueValues(patch.specificInterestTerms, specificInterestPatch.specificInterestTerms);
  patch.specificInterestLabels = mergeUniqueValues(patch.specificInterestLabels, specificInterestPatch.specificInterestLabels);
  patch.interestsText = patch.specificInterestLabels.join(", ");
  patch.broadInterest = false;
  addPatchInterests(patch, specificInterestPatch.interests);
  if (specificInterestPatch.direction && !patch.direction) {
    patch.direction = specificInterestPatch.direction;
    patch.directionLabel = specificInterestPatch.directionLabel;
  }
}

function applyCriteriaInterestCategoryPatch(patch, criterion) {
  if (!isRecognizedCriterion(criterion)) return;
  const values = normalizeEnumArray(readCriterionValue(criterion, "values", "interests"), ALLOWED_INTEREST_VALUES);
  if (!values.length) return;
  addPatchInterests(patch, values);
  const labels = criterionTextArray(readCriterionValue(criterion, "labels", "interestLabels", "interest_labels"));
  if (labels.length) {
    patch.interestLabels = mergeUniqueValues(patch.interestLabels, labels);
    if (!patch.interestsText) patch.interestsText = labels.join(", ");
  }
  patch.broadInterest = criterion.status === "recognized_ambiguous";
}

function applyCriteriaFallbackKeywordsPatch(patch, criterion) {
  if (!isRecognizedCriterion(criterion)) return;
  const value = criterionText(readCriterionValue(criterion, "value", "text"));
  if (value && !patch.interestsText) patch.interestsText = value;
}

function applyCriteriaInterestMismatchPatch(patch, criterion) {
  if (!isRecognizedCriterion(criterion)) return;
  addPatchInterests(patch, normalizeEnumArray(readCriterionValue(criterion, "interests"), ALLOWED_INTEREST_VALUES));

  const specificTerms = criterionTextArray(readCriterionValue(
    criterion,
    "specific_terms",
    "specificTerms",
    "specificInterestTerms",
  ));
  const specificInterestPatch = buildSpecificInterestPatch(specificTerms);
  if (specificInterestPatch.specificInterestTerms?.length) {
    patch.specificInterestTerms = mergeUniqueValues(patch.specificInterestTerms, specificInterestPatch.specificInterestTerms);
    patch.specificInterestLabels = mergeUniqueValues(patch.specificInterestLabels, specificInterestPatch.specificInterestLabels);
    patch.broadInterest = false;
  }

  const interestsText = criterionText(readCriterionValue(criterion, "interests_text", "interestsText", "text", "value"));
  if (interestsText && !patch.interestsText) patch.interestsText = interestsText;

  const direction = normalizeEnumValue(readCriterionValue(criterion, "direction"), ALLOWED_DIRECTION_VALUES);
  if (direction && !patch.direction) {
    const rule = DIRECTION_RULES.find((item) => item.value === direction);
    patch.direction = direction;
    patch.directionLabel = rule?.label || "";
    addPatchInterests(patch, rule?.interests || []);
  }
}

function buildSpecificInterestPatch(value) {
  const specificInterests = normalizeSpecificInterestInputs(value);
  if (!specificInterests.length) {
    return {
      interests: [],
      specificInterestTerms: [],
      specificInterestLabels: [],
      direction: null,
      directionLabel: "",
    };
  }

  const interests = new Set();
  const terms = new Set();
  const labels = new Set();
  const directions = new Map();

  for (const item of specificInterests) {
    const termCount = terms.size;
    const labelCount = labels.size;
    const queryInterests = analyzeQueryInterests(`хочет ${item}`);
    for (const interest of queryInterests.broadInterests || []) interests.add(interest);
    for (const term of queryInterests.specificInterestTerms || []) terms.add(term);
    for (const label of queryInterests.specificInterestLabels || []) labels.add(label);
    if (queryInterests.direction) directions.set(queryInterests.direction, queryInterests.directionLabel);

    const normalized = normalizeText(item).trim();
    if (!normalized) continue;
    if (terms.size === termCount) terms.add(normalized);
    if (labels.size === labelCount) labels.add(normalized);
  }

  const [direction, directionLabel] = directions.size === 1
    ? [...directions.entries()][0]
    : [null, ""];

  return {
    interests: [...interests],
    specificInterestTerms: [...terms],
    specificInterestLabels: [...labels],
    direction,
    directionLabel,
  };
}

function normalizeSpecificInterestInputs(value) {
  const list = Array.isArray(value) ? value : [];
  return [...new Set(list
    .map((item) => String(item || "")
      .replace(/[.,;:!?]+$/g, "")
      .trim())
    .filter(Boolean))]
    .slice(0, 6);
}

function recordLlmError(state, error) {
  state.llm = {
    ...(state.llm || {}),
    attempted: true,
    applied: false,
    error: error?.message || String(error || "unknown_error"),
    criteria: {},
  };
}

function normalizeModelCriteria(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result = {};
  for (const [column, rawCriterion] of Object.entries(value)) {
    if (!SCENARIO_1_CRITERIA_COLUMN_SET.has(column)) continue;
    if (!rawCriterion || typeof rawCriterion !== "object" || Array.isArray(rawCriterion)) continue;

    const criterion = JSON.parse(JSON.stringify(rawCriterion));
    criterion.status = normalizeCriterionStatus(criterion.status, criterion);
    const confidence = normalizeConfidence(criterion.confidence);
    criterion.confidence = confidence;
    normalizeModelCriterionFields(column, criterion);
    result[column] = criterion;
  }
  return result;
}

function normalizeModelCriterionFields(column, criterion) {
  switch (column) {
    case "criterion_01_municipality": {
      const values = criterionTextArray(readCriterionValue(criterion, "value"))
        .map((item) => normalizeSettlementName(item))
        .filter(Boolean);
      if (values.length) criterion.value = [...new Set(values)];
      break;
    }
    case "criterion_03_age": {
      removeAgeBucketFields(criterion);
      const years = coerceAgeYears(readCriterionValue(criterion, "age_years", "ageYears", "years")) ||
        coerceAgeYears(readCriterionValue(criterion, "age_text", "ageText", "text"));
      const bucket = years ? ageBucket(years) : null;
      if (bucket) criterion.age_bucket = bucket;
      if (years) criterion.age_years = years;
      const ageText = criterionText(readCriterionValue(criterion, "age_text", "ageText", "text"));
      if (ageText) criterion.age_text = ageText;
      break;
    }
    case "criterion_06_education_form": {
      const format = normalizeEnumValue(readCriterionValue(criterion, "format"), ALLOWED_FORMAT_VALUES);
      if (format) {
        criterion.format = format;
        criterion.format_label = criterionText(readCriterionValue(criterion, "format_label", "formatLabel", "label")) ||
          FORMAT_LABELS[format];
      }
      break;
    }
    case "criterion_07_schedule": {
      const values = normalizeEnumArray(
        readCriterionValue(criterion, "schedule_values", "scheduleValues", "values", "schedule"),
        ALLOWED_SCHEDULE_VALUES,
      );
      const scheduleText = criterionText(readCriterionValue(criterion, "schedule_text", "scheduleText", "text", "value"));
      if (values.length) criterion.schedule_values = values;
      if (scheduleText) criterion.schedule_text = scheduleText;
      break;
    }
    case "criterion_09_direction":
    case "criterion_14_interest_level1_section": {
      const direction = normalizeEnumValue(readCriterionValue(criterion, "direction", "value"), ALLOWED_DIRECTION_VALUES);
      if (direction) {
        const rule = DIRECTION_RULES.find((item) => item.value === direction);
        criterion.direction = direction;
        criterion.direction_label = criterionText(readCriterionValue(criterion, "direction_label", "directionLabel", "label")) ||
          rule?.label ||
          "";
      }
      break;
    }
    case "criterion_12_exact_interest_topic": {
      const terms = criterionTextArray(readCriterionValue(
        criterion,
        "terms",
        "specific_terms",
        "specificTerms",
        "specificInterestTerms",
      ));
      const labels = criterionTextArray(readCriterionValue(
        criterion,
        "labels",
        "specific_labels",
        "specificLabels",
        "specificInterestLabels",
      ));
      if (terms.length) criterion.terms = terms;
      if (labels.length) criterion.labels = labels;
      break;
    }
    case "criterion_13_interest_level2_category": {
      const values = normalizeEnumArray(readCriterionValue(criterion, "values", "interests"), ALLOWED_INTEREST_VALUES);
      const labels = criterionTextArray(readCriterionValue(criterion, "labels", "interestLabels", "interest_labels"));
      if (values.length) criterion.values = values;
      if (labels.length) criterion.labels = labels;
      break;
    }
    case "criterion_16_interest_without_thematic_match": {
      const interests = normalizeEnumArray(readCriterionValue(criterion, "interests"), ALLOWED_INTEREST_VALUES);
      const specificTerms = criterionTextArray(readCriterionValue(
        criterion,
        "specific_terms",
        "specificTerms",
        "specificInterestTerms",
      ));
      const interestsText = criterionText(readCriterionValue(criterion, "interests_text", "interestsText", "text", "value"));
      const direction = normalizeEnumValue(readCriterionValue(criterion, "direction"), ALLOWED_DIRECTION_VALUES);
      if (interests.length) criterion.interests = interests;
      if (specificTerms.length) criterion.specific_terms = specificTerms;
      if (interestsText) criterion.interests_text = interestsText;
      if (direction) criterion.direction = direction;
      break;
    }
    default:
      break;
  }
}

function removeAgeBucketFields(criterion) {
  delete criterion.age_bucket;
  delete criterion.ageBucket;
  delete criterion.bucket;
  delete criterion.age;
  if (criterion.value && typeof criterion.value === "object" && !Array.isArray(criterion.value)) {
    delete criterion.value.age_bucket;
    delete criterion.value.ageBucket;
    delete criterion.value.bucket;
    delete criterion.value.age;
  }
}

function normalizeCriterionStatus(value, criterion) {
  const status = String(value || "").trim();
  if (KNOWN_CRITERION_STATUSES.has(status)) return status;
  return hasCriterionPayload(criterion) ? "recognized_unverified" : "not_specified";
}

function hasCriterionPayload(criterion) {
  if (!criterion || typeof criterion !== "object" || Array.isArray(criterion)) return false;
  for (const [key, value] of Object.entries(criterion)) {
    if (key === "status" || key === "confidence" || key === "note") continue;
    if (isMeaningfulPatchValue(value)) return true;
    if (value && typeof value === "object" && !Array.isArray(value) && Object.values(value).some(isMeaningfulPatchValue)) {
      return true;
    }
  }
  return false;
}

function isRecognizedCriterion(criterion) {
  return Boolean(criterion && RECOGNIZED_CRITERION_STATUSES.has(criterion.status));
}

function readCriterionValue(criterion, ...keys) {
  if (!criterion || typeof criterion !== "object" || Array.isArray(criterion)) return undefined;
  const valueObject = criterion.value && typeof criterion.value === "object" && !Array.isArray(criterion.value)
    ? criterion.value
    : {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(criterion, key)) return criterion[key];
    if (Object.prototype.hasOwnProperty.call(valueObject, key)) return valueObject[key];
  }
  return undefined;
}

function criterionText(value) {
  const values = criterionTextArray(value);
  return values.join(", ");
}

function criterionTextArray(value) {
  const source = Array.isArray(value)
    ? value
    : value && typeof value === "object"
      ? Object.values(value).flat()
      : [value];
  return [...new Set(source
    .map((item) => String(item ?? "").trim())
    .filter(Boolean))]
    .slice(0, 8);
}

function normalizeSettlementName(value) {
  const text = criterionText(value);
  if (!text) return "";
  if (mentionsMurmanskRegion(text)) return "Мурманская область";
  const place = detectPlace(text);
  if (place.place) return place.place;
  const candidates = place.candidates || [];
  if (candidates.length === 1) return candidates[0];
  return cleanupPlace(text);
}

function normalizeEnumValue(value, allowed) {
  const text = String(value ?? "").trim();
  return allowed.has(text) ? text : null;
}

function normalizeEnumArray(value, allowed) {
  return criterionTextArray(value)
    .map((item) => normalizeEnumValue(item, allowed))
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index);
}

function coerceAgeYears(value) {
  const match = String(value ?? "").match(/(\d{1,2})/);
  if (!match) return null;
  const years = Number(match[1]);
  return ageBucket(years) ? years : null;
}

function addPatchInterests(patch, values) {
  const interests = normalizeEnumArray(values, ALLOWED_INTEREST_VALUES);
  if (!interests.length) return;
  patch.interests = mergeUniqueValues(patch.interests, interests);
  patch.interestLabels = labelsForInterests(patch.interests);
  patch.broadInterest = false;
}

function mergeUniqueValues(left = [], right = []) {
  return [...new Set([...(left || []), ...(right || [])].filter(Boolean))];
}

function labelsForSchedule(values = []) {
  return values.map((value) => SCHEDULE_LABELS[value]).filter(Boolean).join(", ");
}

function isMeaningfulPatchValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.values(value).some(isMeaningfulPatchValue);
  return value !== null && value !== undefined && value !== "";
}

function normalizeConfidence(value) {
  const raw = value && typeof value === "object" && !Array.isArray(value)
    ? value.confidence
    : value;
  if (raw === null || raw === undefined || raw === "") return null;
  const number = typeof raw === "string" ? Number(raw.trim().replace(",", ".")) : Number(raw);
  if (!Number.isFinite(number) || number < 0 || number > 1) return null;
  return Math.round(number * 1000) / 1000;
}

function parseDescriptionText(text) {
  const normalized = normalizeText(text);
  const fields = {};
  const ambiguities = [];

  const age = detectAge(text);
  if (age) {
    fields.age = age.age;
    fields.ageYears = age.ageYears;
    fields.ageText = age.ageText;
    if (age.ambiguous) ambiguities.push(age.ambiguity);
  }

  const place = detectPlace(text);
  if (place.place) {
    fields.place = place.place;
    fields.placeKnown = place.known;
    fields.placeCandidates = [];
    fields.placeAmbiguity = "";
    if (place.ambiguous) ambiguities.push(place.ambiguity || "place_unknown");
  } else if (place.ambiguous) {
    fields.placeCandidates = place.candidates || [];
    fields.placeAmbiguity = place.ambiguity || "place_unknown";
    ambiguities.push(place.ambiguity || "place_unknown");
  }

  const interests = detectInterests(text);
  if (interests.values.length || interests.broad) {
    fields.interests = interests.values;
    fields.interestLabels = interests.labels;
    fields.interestsText = interests.text;
    fields.broadInterest = interests.broad;
    if (interests.broad) ambiguities.push("interest_broad");
  }

  const direction = detectDirection(text);
  if (direction) {
    fields.direction = direction.value;
    fields.directionLabel = direction.label;
    fields.interests = [...new Set([...(fields.interests || []), ...direction.interests])];
    fields.interestLabels = labelsForInterests(fields.interests);
    if (!fields.interestsText) fields.interestsText = direction.label;
  }

  const queryInterests = analyzeQueryInterests(text);
  if (queryInterests.specificInterestTerms.length) {
    fields.specificInterestTerms = queryInterests.specificInterestTerms;
    fields.specificInterestLabels = queryInterests.specificInterestLabels;
    if (queryInterests.specificInterestLabels.length) {
      fields.interestsText = queryInterests.specificInterestLabels.join(", ");
    }
  }
  if (queryInterests.excludedSpecificInterestTerms.length) {
    fields.excludedSpecificInterestTerms = queryInterests.excludedSpecificInterestTerms;
  }
  if (queryInterests.broadInterests.length) {
    fields.interests = [...new Set([...(fields.interests || []), ...queryInterests.broadInterests])];
    fields.interestLabels = labelsForInterests(fields.interests);
    if (!fields.interestsText) fields.interestsText = fields.interestLabels.join(", ");
  }
  if (queryInterests.direction && !fields.direction) {
    fields.direction = queryInterests.direction;
    fields.directionLabel = queryInterests.directionLabel;
  }

  const budget = detectBudget(text);
  if (budget) fields.budget = budget;

  const schedule = detectSchedule(text);
  if (schedule.values.length) {
    fields.schedule = schedule.values;
    fields.scheduleText = schedule.text;
  }

  const format = detectFormat(normalized);
  if (format) {
    fields.format = format.value;
    fields.formatLabel = format.label;
  }

  const goal = detectGoal(normalized);
  if (goal) {
    fields.goal = goal.value;
    fields.goalLabel = goal.label;
  }

  const avoidances = detectAvoidances(normalized);
  if (avoidances.values.length) {
    fields.avoidances = avoidances.values;
    fields.avoidanceLabels = avoidances.labels;
  }

  if (hasMultipleDirections(text)) ambiguities.push("multiple_directions");
  if (hasInterestConflict(fields, normalized)) ambiguities.push("interest_conflict");

  return {
    fields,
    ambiguities,
  };
}

function extractPositiveCorrectionText(text) {
  const match = String(text || "").match(/(?:^|\s)не\s+.+?\s+а\s+(.+)$/i);
  return match ? match[1].trim() : text;
}

function mergeFields(target, patch, options = {}) {
  const mode = options.mode || "description";
  const isCorrection = mode === "edit" && /(^|\s)не\s+.+\s+а\s+/i.test(options.rawText || "");
  const replaceArrays = mode === "edit" || isCorrection;

  for (const [key, value] of Object.entries(patch)) {
    if (value == null || value === "") continue;
    if (key === "place" && value) {
      target.placeCandidates = [];
      target.placeAmbiguity = "";
    }
    if (Array.isArray(value)) {
      if (key === "placeCandidates" || replaceArrays || !Array.isArray(target[key])) {
        target[key] = [...value];
      } else {
        target[key] = [...new Set([...(target[key] || []), ...value])];
      }
      continue;
    }
    target[key] = value;
  }
}

function getMissingRequiredFields(state) {
  const fields = state.fields || {};
  const missing = [];
  if (!fields.age) missing.push("age");
  if (!fields.place) missing.push("place");
  if (!hasInterestOrDirection(fields)) missing.push("interest");
  return missing;
}

function hasInterestOrDirection(fields) {
  return Boolean(
    fields.direction ||
    (Array.isArray(fields.interests) && fields.interests.length) ||
    (Array.isArray(fields.specificInterestTerms) && fields.specificInterestTerms.length) ||
    fields.broadInterest ||
    fields.interestsText,
  );
}

function shouldConfirmSummary(state) {
  return getMissingRequiredFields(state).length === 0 && buildAmbiguities(state).length > 0;
}

function buildRequiredClarificationPrompt(missing, state = {}) {
  if (missing.includes("place") && hasPlaceSelectionAmbiguity(state)) {
    return buildSingleFieldPrompt("place", state);
  }

  const labels = missing.map((field) => {
    if (field === "age") return "сколько лет ребенку";
    if (field === "place") return "где искать занятия";
    return "какие интересы или направление важны";
  });
  if (labels.length === 1) {
    return buildSingleFieldPrompt(missing[0]);
  }
  return `Чтобы подобрать программы, уточните, пожалуйста: ${joinRussianList(labels)}.`;
}

function buildSingleFieldPrompt(field, state = {}) {
  if (field === "age") return "Уточните, пожалуйста, сколько лет ребенку.";
  if (field === "place") {
    const fields = state.fields || {};
    const candidates = fields.placeCandidates || [];
    if (candidates.length > 1) {
      return `Вы указали несколько населенных пунктов: ${candidates.join(", ")}. Уточните, пожалуйста, в каком одном населенном пункте искать кружки.`;
    }
    if (fields.placeAmbiguity === "place_region") {
      return "Уточните, пожалуйста, конкретный населенный пункт Мурманской области, где искать кружки.";
    }
    return "Уточните, пожалуйста, где искать занятия: населенный пункт, район или организация.";
  }
  return "Уточните, пожалуйста, какие интересы ребенка или направленность программы важны.";
}

function buildSummaryText(state) {
  const fields = state.fields || {};
  const parts = [];
  if (fields.ageText) parts.push(`возраст: ${fields.ageText}`);
  if (fields.place) parts.push(`место: ${fields.place}`);
  const interestLabel = fields.interestsText || fields.directionLabel || labelsForInterests(fields.interests).join(", ");
  if (interestLabel) parts.push(`интересы/направление: ${interestLabel}`);
  if (fields.scheduleText) parts.push(`время: ${fields.scheduleText}`);
  if (fields.budget) parts.push(`бюджет: ${fields.budget}`);
  if (fields.avoidanceLabels?.length) parts.push(`ограничения: ${fields.avoidanceLabels.join(", ")}`);
  return `Я понял запрос так: ${parts.join("; ")}. Все верно?`;
}

function buildRecommendationProfile(state) {
  const fields = state.fields || {};
  const interests = new Set(fields.interests || []);
  const direction = DIRECTION_RULES.find((item) => item.value === fields.direction);
  for (const interest of direction?.interests || []) interests.add(interest);

  return {
    age: fields.age || "7-9",
    ageYears: fields.ageYears || null,
    ageText: fields.ageText || "",
    experience: "new",
    interests: [...interests],
    avoidances: (fields.avoidances || []).filter((item) => item !== "unknown"),
    adaptation: fields.adaptation || null,
    goal: fields.goal || "discover",
    location: fields.place,
    budget: fields.budget,
    schedule: fields.scheduleText,
    scheduleValues: fields.schedule || [],
    format: fields.format,
    formatLabel: fields.formatLabel,
    clarifyGroup: fields.clarifyGroup || null,
    clarifyFocus: fields.clarifyFocus || null,
    groupSize: fields.groupSize || null,
    directionLabel: fields.directionLabel,
    direction: fields.direction,
    interestsText: fields.interestsText || "",
    specificInterestTerms: fields.specificInterestTerms || [],
    specificInterestLabels: fields.specificInterestLabels || [],
    excludedSpecificInterestTerms: fields.excludedSpecificInterestTerms || [],
  };
}

function buildPdfAnswers(state) {
  const fields = state.fields || {};
  return {
    ageText: fields.ageText || AGE_LABELS[fields.age] || "",
    age: fields.age || "",
    interestsText: fields.interestsText || fields.directionLabel || labelsForInterests(fields.interests).join(", "),
    interests: fields.interests || [],
    specificInterestTerms: fields.specificInterestTerms || [],
    specificInterestLabels: fields.specificInterestLabels || [],
    goal: fields.goal || "discover",
    goalLabel: fields.goalLabel || "Подобрать подходящие занятия",
    schedule: fields.schedule || [],
    format: fields.format || null,
    formatLabel: fields.formatLabel || "Любой формат",
    place: fields.place || "",
    cost: fields.budget || "",
    wantsRefinement: false,
    groupSizeLabel: "",
    avoidanceLabels: fields.avoidanceLabels || [],
    avoidanceCustom: "",
    direction: fields.direction || null,
    directionLabel: fields.directionLabel || "",
  };
}

function buildHistoryPayload(state) {
  return {
    originalText: state.originalText,
    clarifications: state.clarifications || [],
    edits: state.edits || [],
    fields: state.fields || {},
    ambiguities: buildAmbiguities(state),
    llm: state.llm || {},
  };
}

function buildDescriptionResultMessage(state, result) {
  const items = result?.items || [];
  if (!items.length) {
    return (
      "По заданным условиям подходящих программ не нашлось.\n\n" +
      "Попробуйте расширить место поиска, выбрать более широкое направление или убрать ограничение по расписанию/бюджету."
    );
  }

  const lines = ["Я нашел подходящие программы:", ""];
  items.slice(0, 10).forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.program}`,
      `Адрес: ${item.district}`,
      `Расписание: ${item.schedule}`,
      `Стоимость: ${item.price}`,
      `Онлайн-запись: ${item.sourceUrl || "ссылка уточняется"}`,
      "",
    );
  });

  if (items.length < 3 || result?.isSparse) {
    lines.push("Я нашел мало точных совпадений. Можно расширить место поиска, возрастной диапазон, направление, расписание или бюджет.");
  }

  return lines.join("\n");
}

function buildAmbiguities(state, extra = []) {
  const fields = state.fields || {};
  const values = new Set(extra.filter(Boolean));
  if (fields.ageText && !/^\d{1,2}\s*лет?$|^\d{1,2}$/i.test(fields.ageText) && fields.age) {
    values.add("age_approximate");
  }
  if (fields.place && fields.placeKnown === false && !looksLikeOrganizationOrDistrict(fields.place)) {
    values.add("place_unknown");
  }
  if ((fields.placeCandidates || []).length > 1) values.add("place_multiple");
  if (fields.placeAmbiguity === "place_region") values.add("place_region");
  if (fields.broadInterest) values.add("interest_broad");
  if (fields.interests?.includes("sports") && fields.avoidances?.includes("intense")) {
    values.add("interest_conflict");
  }
  return [...values];
}

function isApproximateAgeText(value) {
  return /школьник|подросток|первоклассник/i.test(String(value || ""));
}

function detectAge(text) {
  const range = String(text).match(/(\d{1,2})\s*[-–]\s*(\d{1,2})\s*(?:лет|года|год|л\.)?/i);
  if (range) {
    const first = Number(range[1]);
    const second = Number(range[2]);
    const avg = Math.round((first + second) / 2);
    return {
      age: ageBucket(avg),
      ageYears: avg,
      ageText: `${first}-${second} лет`,
      ambiguous: true,
      ambiguity: "age_range",
    };
  }

  const numeric = String(text).match(/(?:^|\D)(\d{1,2})\s*(?:лет|года|год|л\.)?/i);
  if (numeric) {
    const ageYears = Number(numeric[1]);
    const bucket = ageBucket(ageYears);
    if (bucket) {
      return {
        age: bucket,
        ageYears,
        ageText: `${ageYears} лет`,
        ambiguous: false,
      };
    }
  }

  const normalized = normalizeText(text);
  if (/первоклассник|первый класс/.test(normalized)) {
    return { age: "7-9", ageYears: 7, ageText: "первоклассник", ambiguous: true, ambiguity: "age_approximate" };
  }
  if (/подросток/.test(normalized)) {
    return { age: "13+", ageYears: 13, ageText: "подросток", ambiguous: true, ambiguity: "age_approximate" };
  }
  if (/школьник/.test(normalized)) {
    return { age: "7-9", ageYears: 8, ageText: "школьник", ambiguous: true, ambiguity: "age_approximate" };
  }
  return null;
}

function ageBucket(age) {
  if (age >= 3 && age <= 4) return "3-4";
  if (age >= 5 && age <= 6) return "5-6";
  if (age >= 7 && age <= 9) return "7-9";
  if (age >= 10 && age <= 12) return "10-12";
  if (age >= 13 && age <= 18) return "13+";
  return null;
}

function detectPlace(text) {
  const knownPlaces = findKnownMunicipalities(text);
  if (knownPlaces.length > 1) {
    return {
      place: "",
      known: false,
      ambiguous: true,
      ambiguity: "place_multiple",
      candidates: knownPlaces,
    };
  }
  if (knownPlaces.length === 1) {
    return {
      place: knownPlaces[0],
      known: true,
      ambiguous: false,
      candidates: [],
    };
  }

  if (mentionsMurmanskRegion(text)) {
    return {
      place: "",
      known: false,
      ambiguous: true,
      ambiguity: "place_region",
      candidates: [],
    };
  }

  const placeMatch = String(text).match(/(?:\bв|\bво|\bг\.|\bгород|\bрайон|\bпоселок|\bпгт|\bзато|\bискать в)\s+([А-ЯЁ][а-яё-]+(?:\s+[А-ЯЁ][а-яё-]+)?)/);
  if (placeMatch) {
    const place = cleanupPlace(placeMatch[1]);
    if (place) {
      return {
        place,
        known: false,
        ambiguous: !looksLikeOrganizationOrDistrict(place),
      };
    }
  }

  const orgMatch = String(text).match(/\b(кванториум|лапландия|дворец|центр\s+[А-ЯЁа-яё -]+|школ[аеуы]\s+\d+)\b/i);
  if (orgMatch) {
    return { place: cleanupPlace(orgMatch[0]), known: false, ambiguous: false };
  }

  return { place: "", known: false, ambiguous: false };
}

function findKnownMunicipalities(text) {
  const matches = findMurmanskSettlements(text);
  for (const [place, pattern] of LEGACY_MUNICIPALITY_RULES) {
    if (pattern.test(text)) matches.push(place);
  }
  return [...new Set(matches)];
}

function mentionsMurmanskRegion(text) {
  return /мурманск(?:ая|ой|ую)?\s+област/i.test(String(text || ""));
}

function hasPlaceSelectionAmbiguity(state = {}) {
  const fields = state.fields || {};
  return (fields.placeCandidates || []).length > 1 || fields.placeAmbiguity === "place_region";
}

function cleanupPlace(value) {
  return String(value || "")
    .replace(/[.,;:!?]+$/g, "")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function looksLikeOrganizationOrDistrict(value) {
  return /(район|кванториум|лапландия|дворец|центр|школ|дом творчества|цдт|ддт)/i.test(value);
}

function detectInterests(text) {
  const values = [];
  const labels = [];
  for (const [value, label, pattern] of INTEREST_RULES) {
    if (pattern.test(text)) {
      values.push(value);
      labels.push(label);
    }
  }

  const broad = /что-нибудь полезн|для развития|пока не знаем|не знаем что|попробовать разное|любой кружок/i.test(text);
  return {
    values: [...new Set(values)],
    labels: [...new Set(labels)],
    text: labels.length ? [...new Set(labels)].join(", ") : (broad ? "широкий запрос на развитие" : ""),
    broad,
  };
}

function detectDirection(text) {
  return DIRECTION_RULES.find((item) => item.pattern.test(text)) || null;
}

function detectBudget(text) {
  if (/бесплатн/i.test(text)) return "бесплатно";
  const match = String(text).match(/до\s*([\d\s]+)\s*(?:₽|руб|рубл)/i) ||
    String(text).match(/бюджет\s*[:до ]*\s*([\d\s]+)\s*(?:₽|руб|рубл)?/i);
  if (!match) return "";
  return `до ${match[1].replace(/\s+/g, " ").trim()} рублей`;
}

function detectSchedule(text) {
  const normalized = normalizeText(text);
  const values = [];
  const labels = [];
  addSchedule(values, labels, /будн|после школы/.test(normalized), "weekdays", "будни");
  addSchedule(values, labels, /выходн|суббот|воскрес/.test(normalized), "weekends", "выходные");
  addSchedule(values, labels, /утр/.test(normalized), "morning", "утром");
  addSchedule(values, labels, /вечер|после школы/.test(normalized), "evening", "вечером");
  return {
    values: [...new Set(values)],
    text: [...new Set(labels)].join(", "),
  };
}

function addSchedule(values, labels, condition, value, label) {
  if (!condition) return;
  values.push(value);
  labels.push(label);
}

function detectFormat(text) {
  if (/онлайн|дистанц/.test(text)) return { value: "online", label: "Онлайн" };
  if (/офлайн|очно|рядом/.test(text)) return { value: "offline", label: "Офлайн" };
  return null;
}

function detectGoal(text) {
  if (/первый кружок|первый опыт|в первый раз/.test(text)) return { value: "first_try", label: "Первый опыт" };
  if (/практическ|навык|сильн/.test(text)) return { value: "strengths", label: "Практические навыки" };
  if (/общени|друз/.test(text)) return { value: "social", label: "Общение" };
  if (/дисциплин|режим/.test(text)) return { value: "discipline", label: "Дисциплина" };
  if (/интерес|нрав/.test(text)) return { value: "interest", label: "Интерес к теме" };
  return null;
}

function detectAvoidances(text) {
  const values = [];
  const labels = [];
  addAvoidance(values, labels, /(не любит|боится|избега).{0,24}(шум|шумн|больш)/.test(text), "noise", "Шумные группы");
  addAvoidance(values, labels, /(не любит|боится|избега).{0,24}(жестк|строг)/.test(text), "strict", "Жесткая дисциплина");
  addAvoidance(values, labels, /(не любит|боится|избега).{0,24}(выступ|сцен)/.test(text), "stage", "Выступления");
  addAvoidance(values, labels, /(однообраз|рутин)/.test(text), "routine", "Однообразные задания");
  addAvoidance(values, labels, /(слишком актив|перегруз|интенсив|активный темп)/.test(text), "intense", "Слишком активный темп");
  return {
    values: [...new Set(values)],
    labels: [...new Set(labels)],
  };
}

function addAvoidance(values, labels, condition, value, label) {
  if (!condition) return;
  values.push(value);
  labels.push(label);
}

function hasMultipleDirections(text) {
  return DIRECTION_RULES.filter((item) => item.pattern.test(text)).length > 1;
}

function hasInterestConflict(fields, normalizedText) {
  return Boolean(
    (fields.interests || []).includes("sports") &&
    (/не любит актив|не подходит актив|не любит интенсив|спокойн/.test(normalizedText) || (fields.avoidances || []).includes("intense")),
  );
}

function labelsForInterests(values = []) {
  return values
    .map((value) => INTEREST_RULES.find((item) => item[0] === value)?.[1])
    .filter(Boolean);
}

function labelsForAvoidances(values = []) {
  const labels = {
    noise: "Шумные группы",
    strict: "Жесткая дисциплина",
    stage: "Выступления",
    routine: "Однообразные задания",
    intense: "Слишком активный темп",
  };
  return values.map((value) => labels[value]).filter(Boolean);
}

function normalizeGoalValue(value) {
  if (value === "practical_skills") return "strengths";
  if (value === "communication") return "social";
  return value;
}

function goalLabel(value) {
  const labels = {
    interest: "Интерес к теме",
    first_try: "Первый опыт",
    strengths: "Практические навыки",
    social: "Общение",
    discipline: "Дисциплина",
    discover: "Понять, что подойдет",
  };
  return labels[value] || "";
}

function joinRussianList(values) {
  if (values.length <= 1) return values.join("");
  if (values.length === 2) return `${values[0]} и ${values[1]}`;
  return `${values.slice(0, -1).join(", ")} и ${values[values.length - 1]}`;
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/ё/g, "е");
}

module.exports = {
  createDescriptionSelectionState,
  ensureDescriptionSelectionState,
  applyDescriptionText,
  shouldUseLlmForDescription,
  applyLlmAnalysis,
  recordLlmError,
  parseDescriptionText,
  getMissingRequiredFields,
  shouldConfirmSummary,
  buildRequiredClarificationPrompt,
  buildSingleFieldPrompt,
  buildSummaryText,
  buildRecommendationProfile,
  buildPdfAnswers,
  buildHistoryPayload,
  buildDescriptionResultMessage,
};
