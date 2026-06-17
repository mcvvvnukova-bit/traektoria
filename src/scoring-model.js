const SCENARIO_DESCRIPTION = "s1";
const SCENARIO_AGENT = "s2";
const SCENARIO_DEEP = "s3";
const SCENARIO_WIDE = "s4";

const THEME_SCORE_CAP = 200;
const TRAJECTORY_SCORE_CAP = 200;
const ENROLLMENT_CLOSED = 3;
const WIDE_DIRECTORY_LEVEL_IDS = new Set([1, 2, 4, 5]);
const DEEP_DIRECTORY_LEVEL_IDS = new Set([2, 3, 5]);

const AGE_BUCKET_YEARS = {
  "3-4": 4,
  "5-6": 6,
  "7-9": 8,
  "10-12": 11,
  "13+": 13,
};

const DIRECTION_LABELS = {
  technical: "Техническая",
  art: "Художественная",
  sport: "Физкультурно-спортивная",
  social: "Социально-гуманитарная",
  science: "Естественно-научная",
  tourism: "Туристско-краеведческая",
  any: "",
};

const INTEREST_TERMS = {
  creative: ["твор", "рис", "живопис", "дизайн", "театр", "музык", "танц", "хореограф", "вокал", "декор"],
  building: ["робот", "констру", "инженер", "модел", "техн", "3d", "maker", "макет"],
  sports: ["спорт", "плав", "футбол", "хокк", "борьб", "гимнаст", "туризм", "ориентир"],
  social: ["театр", "журналист", "лидер", "дебат", "коммуник", "волонтер", "медиа"],
  logic: ["математ", "программ", "физик", "информат", "логик", "робот", "шахмат"],
  calm: ["мастер", "студия", "твор", "шахмат", "модел", "рис", "лепк"],
};

const ADVANCED_TOPIC_PATTERNS = [
  /углуб/i,
  /проект/i,
  /разработ/i,
  /исслед/i,
  /соревн/i,
  /олимпиад/i,
  /модел/i,
  /программ/i,
  /констру/i,
  /инженер/i,
  /практик/i,
];

function scoreProgramCandidate(candidate, rawContext = {}) {
  const context = normalizeScoringContext(rawContext);
  const specificInterestResult = scoreSpecificInterestBlock(candidate, context);
  const hardFilter = evaluateHardFilters(candidate, context, specificInterestResult);
  if (!hardFilter.passes) {
    return buildResult({
      score: 0,
      passesFilters: false,
      eligible: false,
      exclusionReason: hardFilter.reason,
      criteriaScores: hardFilter.criteriaScores,
      ageEligible: hardFilter.ageEligible,
      ...withoutOwnScore(specificInterestResult),
    });
  }

  const criteriaScores = { ...hardFilter.criteriaScores };
  let score = 0;

  const topicPresenceScore = scoreTopicPresence(candidate);
  criteriaScores.topicPresence = topicPresenceScore;
  score += topicPresenceScore;

  criteriaScores.specificInterests = specificInterestResult.score;
  score += specificInterestResult.score;
  if (
    context.specificInterestTerms.length &&
    !context.interests.length &&
    !specificInterestResult.specificInterestMatch
  ) {
    return buildResult({
      score: 0,
      passesFilters: true,
      eligible: false,
      exclusionReason: "interest_mismatch",
      criteriaScores,
      ageEligible: hardFilter.ageEligible,
      ...withoutOwnScore(specificInterestResult),
    });
  }

  const interestResult = scoreInterestBlock(candidate, context);
  criteriaScores.interests = interestResult.score;
  if (interestResult.exclusionReason && !specificInterestResult.specificInterestMatch) {
    return buildResult({
      score: 0,
      passesFilters: true,
      eligible: false,
      exclusionReason: interestResult.exclusionReason,
      criteriaScores,
      ageEligible: hardFilter.ageEligible,
      ...mergeInterestSignals(specificInterestResult, interestResult),
    });
  }
  if (!interestResult.exclusionReason) {
    score += interestResult.score;
  }
  const interestSignals = mergeInterestSignals(specificInterestResult, interestResult);

  const scheduleScore = scoreSchedule(candidate, context);
  criteriaScores.schedule = scheduleScore;
  score += scheduleScore;

  const availabilityScore = scoreAvailability(candidate);
  criteriaScores.availability = availabilityScore;
  score += availabilityScore;

  const directionScore = scoreDirection(
    candidate,
    context,
    interestResult.exactTopicMatch || specificInterestResult.specificInterestMatch,
  );
  criteriaScores.direction = directionScore;
  score += directionScore;

  const groupSizeScore = scoreGroupSize(candidate, context);
  criteriaScores.groupSize = groupSizeScore;
  score += groupSizeScore;

  let trajectoryResult = {};
  if (context.scenario === SCENARIO_DEEP) {
    trajectoryResult = scoreDeepTrajectory(candidate, context);
  } else if (context.scenario === SCENARIO_WIDE) {
    trajectoryResult = scoreWideTrajectory(candidate, context);
  }

  if (trajectoryResult.exclusionReason) {
    return buildResult({
      score: 0,
      passesFilters: true,
      eligible: false,
      exclusionReason: trajectoryResult.exclusionReason,
      criteriaScores: {
        ...criteriaScores,
        trajectory: 0,
      },
      ageEligible: hardFilter.ageEligible,
      ...interestSignals,
      ...withoutOwnScore(trajectoryResult),
    });
  }

  if (trajectoryResult.score) {
    criteriaScores.trajectory = trajectoryResult.score;
    score += trajectoryResult.score;
  }

  return buildResult({
    score,
    passesFilters: true,
    eligible: score > 0,
    criteriaScores,
    ageEligible: hardFilter.ageEligible,
    ...interestSignals,
    ...withoutOwnScore(trajectoryResult),
  });
}

function scoreRecommendationCandidate(program, topics, profile, ageYears, criteria = {}, mode = "deep") {
  const scenario = mode === SCENARIO_WIDE || mode === "wide" ? SCENARIO_WIDE : SCENARIO_DEEP;
  const candidate = {
    ...program,
    topics: topics || program.topics || [],
  };
  return scoreProgramCandidate(candidate, {
    ...criteria,
    scenario,
    ageYears,
    completedTopicProfile: profile,
    completedProgramIds: criteria.completedProgramIds,
  });
}

function scoreCandidateForNewInterests(program, topics, profile, ageYears, criteria = {}) {
  return scoreRecommendationCandidate(program, topics, profile, ageYears, criteria, SCENARIO_WIDE);
}

function buildResult(result) {
  return {
    score: result.score || 0,
    passesFilters: result.passesFilters !== false,
    eligible: Boolean(result.eligible),
    exclusionReason: result.exclusionReason || "",
    criteriaScores: result.criteriaScores || {},
    topicKeyMatches: result.topicKeyMatches || [],
    categoryMatches: result.categoryMatches || [],
    newRelatedTopics: result.newRelatedTopics || [],
    depthSignals: result.depthSignals || [],
    noveltySignals: result.noveltySignals || [],
    exactTopicMatch: Boolean(result.exactTopicMatch),
    fallbackTopicMatch: Boolean(result.fallbackTopicMatch),
    specificInterestMatch: Boolean(result.specificInterestMatch),
    specificInterestScore: result.specificInterestScore || 0,
    specificInterestMatchLevel: result.specificInterestMatchLevel || "",
    ageEligible: result.ageEligible !== false,
  };
}

function normalizeScoringContext(rawContext = {}) {
  const ageYears = nullableNumber(rawContext.ageYears) || ageBucketToYears(rawContext.age);
  const ageRangeYears = normalizeAgeRangeYears(rawContext.ageRangeYears) || (ageYears ? { min: ageYears, max: ageYears } : null);
  const directionLabel = rawContext.directionLabel || directionLabelFromCode(rawContext.direction);
  return {
    ...rawContext,
    scenario: normalizeScenario(rawContext.scenario),
    ageYears,
    ageRangeYears,
    ageRangeMonths: ageRangeYears
      ? { min: Math.round(ageRangeYears.min * 12), max: Math.round(ageRangeYears.max * 12) }
      : null,
    municipalityId: nullableNumber(rawContext.municipalityId),
    organizationId: nullableNumber(rawContext.organizationId),
    organizationName: rawContext.organizationName || rawContext.organization || "",
    budgetAmount: extractPriceAmount(rawContext.budget || rawContext.cost),
    scheduleText: rawContext.scheduleText || rawContext.schedule || "",
    scheduleValues: Array.isArray(rawContext.schedule) ? rawContext.schedule : [],
    directionLabel,
    format: rawContext.format || rawContext.educationForm || rawContext.formatLabel || "",
    groupSize: rawContext.groupSize || groupSizeFromClarifier(rawContext.clarifyGroup),
    interests: normalizeInterestInputs(rawContext),
    specificInterestTerms: normalizeSpecificInterestTerms(rawContext.specificInterestTerms),
    specificInterestLabels: normalizeSpecificInterestTerms(rawContext.specificInterestLabels),
    excludedSpecificInterestTerms: normalizeSpecificInterestTerms(rawContext.excludedSpecificInterestTerms),
    completedProgramIds: new Set((rawContext.completedProgramIds || []).map(Number).filter(Number.isFinite)),
    completedTopicProfile: rawContext.completedTopicProfile || rawContext.topicProfile || {},
  };
}

function normalizeScenario(value) {
  if (value === SCENARIO_AGENT || value === "agent") return SCENARIO_AGENT;
  if (value === SCENARIO_DEEP || value === "deep") return SCENARIO_DEEP;
  if (value === SCENARIO_WIDE || value === "wide") return SCENARIO_WIDE;
  return SCENARIO_DESCRIPTION;
}

function normalizeInterestInputs(context) {
  const interests = [];
  for (const value of context.interests || []) {
    if (!value || value === "any" || value === "unknown") continue;
    interests.push({ value, terms: termsForInterest(value), explicit: true });
  }

  for (const value of splitInterestText(context.interestsText || context.interestText || "")) {
    interests.push({ value, terms: termsForInterest(value), explicit: true });
  }

  return uniqueBy(interests, (item) => normalizeText(item.value));
}

function normalizeSpecificInterestTerms(values) {
  return [...new Set((values || [])
    .map(normalizeText)
    .map((value) => value.trim())
    .filter((value) => value.length >= 3))];
}

function splitInterestText(value) {
  return String(value || "")
    .split(/[,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function termsForInterest(value) {
  const normalized = normalizeText(value);
  const predefined = INTEREST_TERMS[normalized];
  if (predefined) return predefined.map(normalizeText);
  const words = normalized.split(/\s+/).filter((word) => word.length > 3);
  return words.length ? words : [normalized].filter(Boolean);
}

function evaluateHardFilters(candidate, context, specificInterestResult = {}) {
  const criteriaScores = {};

  const candidateMunicipalityId = nullableNumber(candidate.municipalityId ?? candidate.municipality_id);
  if (context.municipalityId != null && candidateMunicipalityId != null && candidateMunicipalityId !== context.municipalityId) {
    return { passes: false, reason: "municipality_mismatch", criteriaScores };
  }

  if (context.organizationId != null || context.organizationName) {
    const orgMatches = matchesOrganization(candidate, context);
    if (!orgMatches) return { passes: false, reason: "organization_mismatch", criteriaScores };
  }

  if (context.excludedSpecificInterestTerms.length && matchesSpecificInterestTerms(candidate, context.excludedSpecificInterestTerms)) {
    return { passes: false, reason: "excluded_specific_interest", criteriaScores };
  }

  if (context.ageRangeMonths && !matchesAge(candidate, context.ageRangeMonths)) {
    if (!specificInterestResult.specificInterestMatch) {
      return { passes: false, reason: "age_mismatch", criteriaScores, ageEligible: false };
    }
    criteriaScores.age = -100;
    return { passes: true, criteriaScores, ageEligible: false };
  }

  if (context.budgetAmount != null && !matchesBudget(candidate, context.budgetAmount)) {
    return { passes: false, reason: "budget_mismatch", criteriaScores };
  }

  if (context.completedProgramIds.has(Number(candidate.id))) {
    return { passes: false, reason: "completed_program", criteriaScores };
  }

  if (!matchesEducationForm(candidate, context)) {
    return { passes: false, reason: "education_form_mismatch", criteriaScores };
  }

  return { passes: true, criteriaScores, ageEligible: true };
}

function matchesOrganization(candidate, context) {
  const candidateOrgId = nullableNumber(candidate.organizationId ?? candidate.organization_id);
  if (context.organizationId != null && candidateOrgId === context.organizationId) return true;
  if (context.organizationId != null && candidateOrgId != null) return false;

  const requested = normalizeText(context.organizationName);
  if (!requested) return true;
  const values = [
    candidate.organizationName,
    candidate.organization_name,
    candidate.venue,
  ].map(normalizeText).filter(Boolean);
  if (!values.length) return true;
  return values.some((value) => value.includes(requested) || requested.includes(value));
}

function matchesAge(candidate, ageRangeMonths) {
  const min = nullableNumber(candidate.ageMinMonths ?? candidate.age_min ?? candidate.ageGroupMin);
  const max = nullableNumber(candidate.ageMaxMonths ?? candidate.age_max ?? candidate.ageGroupMax);
  if (min != null && min > ageRangeMonths.max) return false;
  if (max != null && max < ageRangeMonths.min) return false;
  return true;
}

function matchesBudget(candidate, budgetAmount) {
  const groups = candidate.groups || [];
  const groupPrices = groups.map((group) => extractPriceAmount(group.period_price ?? group.periodPrice)).filter((value) => value != null);
  if (groupPrices.length) return groupPrices.some((price) => price <= budgetAmount);

  const modules = candidate.modules || [];
  const modulePrices = modules
    .flatMap((moduleItem) => [moduleItem.price, moduleItem.normative_price ?? moduleItem.normativePrice])
    .map(extractPriceAmount)
    .filter((value) => value != null);
  if (modulePrices.length) return modulePrices.some((price) => price <= budgetAmount);

  const programPrice = extractPriceAmount(candidate.price);
  if (programPrice != null) return programPrice <= budgetAmount;
  return true;
}

function matchesEducationForm(candidate, context) {
  const requested = normalizeText(context.format);
  if (!requested || requested.includes("люб") || requested === "any") return true;

  const label = normalizeText(candidate.eduFormName || candidate.educationFormName || candidate.formatLabel || "");
  const eduForm = nullableNumber(candidate.eduForm ?? candidate.edu_form);
  if (!label && eduForm == null) return true;

  if (requested.includes("офлайн") || requested.includes("очн")) {
    if (label) return label.includes("очн") && !label.includes("заочн");
    return true;
  }

  if (requested.includes("онлайн") || requested.includes("заоч")) {
    if (label) return label.includes("заоч") || label.includes("дистан");
    return true;
  }

  return true;
}

function scoreTopicPresence(candidate) {
  if (candidate.topicsKnown === false) return 0;
  return (candidate.topics || []).length ? 10 : -10;
}

function scoreInterestBlock(candidate, context) {
  const interests = context.interests || [];
  if (!interests.length) return { score: 0 };

  const topics = candidate.topics || [];
  const hasTopicData = topics.length > 0;
  let score = 0;
  let exactTopicMatch = false;
  let fallbackTopicMatch = false;
  const topicKeyMatches = [];
  const categoryMatches = [];

  for (const interest of interests) {
    const best = scoreSingleInterest(candidate, topics, interest, hasTopicData);
    if (best.score === 100) exactTopicMatch = true;
    if (best.fallback) fallbackTopicMatch = true;
    score += best.score;
    topicKeyMatches.push(...best.topicKeyMatches);
    categoryMatches.push(...best.categoryMatches);
  }

  score = Math.min(score, THEME_SCORE_CAP);
  if (score <= 0) {
    return {
      score: 0,
      exclusionReason: "interest_mismatch",
      exactTopicMatch,
      fallbackTopicMatch,
      topicKeyMatches,
      categoryMatches,
    };
  }

  return {
    score,
    exactTopicMatch,
    fallbackTopicMatch,
    topicKeyMatches: uniqueBy(topicKeyMatches, topicIdentity),
    categoryMatches: uniqueBy(categoryMatches, topicIdentity),
  };
}

function scoreSpecificInterestBlock(candidate, context) {
  const terms = context.specificInterestTerms || [];
  if (!terms.length) {
    return {
      score: 0,
      specificInterestScore: 0,
      specificInterestMatch: false,
      specificInterestMatchLevel: "",
      topicKeyMatches: [],
      categoryMatches: [],
    };
  }

  return scoreSpecificInterestTerms(candidate, terms);
}

function matchesSpecificInterestTerms(candidate, terms) {
  return scoreSpecificInterestTerms(candidate, normalizeSpecificInterestTerms(terms)).specificInterestMatch;
}

function scoreSpecificInterestTerms(candidate, terms) {
  const normalizedTerms = normalizeSpecificInterestTerms(terms);
  const topics = candidate.topics || [];

  const level3Matches = topics.filter((topic) =>
    textMatchesTerms([topic.key, topic.name, topic.normalizedTopicKey, topic.normalizedTopicName], normalizedTerms),
  );
  if (level3Matches.length) {
    return buildSpecificInterestResult({
      score: 180,
      level: "topic_level_3",
      topicKeyMatches: level3Matches,
    });
  }

  const level2Matches = topics.filter((topic) =>
    textMatchesTerms([topic.categoryCode, topic.categoryName], normalizedTerms),
  );
  if (level2Matches.length) {
    return buildSpecificInterestResult({
      score: 130,
      level: "topic_level_2",
      categoryMatches: level2Matches,
    });
  }

  const level1Matches = topics.filter((topic) =>
    textMatchesTerms([topic.parentCode, topic.parentName], normalizedTerms),
  );
  if (level1Matches.length) {
    return buildSpecificInterestResult({
      score: 80,
      level: "topic_level_1",
      categoryMatches: level1Matches,
    });
  }

  if (textMatchesTerms([candidate.name, candidate.program, candidate.searchName, ...(candidate.keywords || [])], normalizedTerms)) {
    return buildSpecificInterestResult({
      score: 110,
      level: "text_strong",
    });
  }

  const hasTopicData = topics.length > 0;
  if (!hasTopicData && textMatchesTerms([candidate.annotation, candidate.task, candidate.summary], normalizedTerms)) {
    return buildSpecificInterestResult({
      score: 40,
      level: "text_weak",
    });
  }

  return buildSpecificInterestResult({
    score: 0,
    level: "",
  });
}

function buildSpecificInterestResult({ score, level, topicKeyMatches = [], categoryMatches = [] }) {
  return {
    score,
    specificInterestScore: score,
    specificInterestMatch: score > 0,
    specificInterestMatchLevel: level,
    topicKeyMatches: uniqueBy(topicKeyMatches, topicIdentity),
    categoryMatches: uniqueBy(categoryMatches, topicIdentity),
  };
}

function scoreSingleInterest(candidate, topics, interest, hasTopicData) {
  const exactMatches = topics.filter((topic) =>
    textMatchesTerms([topic.key, topic.name, topic.normalizedTopicKey, topic.normalizedTopicName], interest.terms),
  );
  if (exactMatches.length) {
    return {
      score: 100,
      topicKeyMatches: exactMatches,
      categoryMatches: [],
    };
  }

  const level2Matches = topics.filter((topic) =>
    textMatchesTerms([topic.categoryCode, topic.categoryName], interest.terms),
  );
  if (level2Matches.length) {
    return {
      score: 70,
      topicKeyMatches: [],
      categoryMatches: level2Matches,
    };
  }

  const level1Matches = topics.filter((topic) =>
    textMatchesTerms([topic.parentCode, topic.parentName], interest.terms),
  );
  if (level1Matches.length) {
    return {
      score: 30,
      topicKeyMatches: [],
      categoryMatches: level1Matches,
    };
  }

  if (!hasTopicData) {
    const fallback = scoreFallbackInterest(candidate, interest.terms);
    if (fallback > 0) {
      return {
        score: fallback,
        fallback: true,
        topicKeyMatches: [],
        categoryMatches: [],
      };
    }
  }

  return {
    score: 0,
    topicKeyMatches: [],
    categoryMatches: [],
  };
}

function scoreFallbackInterest(candidate, terms) {
  const strongText = [
    candidate.name,
    candidate.program,
    candidate.searchName,
    ...(candidate.keywords || []),
  ];
  if (textMatchesTerms(strongText, terms)) return 20;

  const weakText = [candidate.annotation, candidate.task, candidate.summary, candidate.directionName];
  return textMatchesTerms(weakText, terms) ? 10 : 0;
}

function textMatchesTerms(values, terms) {
  const haystack = normalizeText((values || []).filter(Boolean).join(" "));
  if (!haystack) return false;
  return (terms || []).some((term) => {
    const normalized = normalizeText(term);
    return normalized.length >= 3 && haystack.includes(normalized);
  });
}

function scoreSchedule(candidate, context) {
  const request = parseScheduleRequest(context);
  if (!request.hasRequest) return 0;

  const groups = candidate.groups || [];
  const scores = groups.map((group) => scoreGroupSchedule(group, request)).filter((value) => value != null);
  if (!scores.length) return 0;
  return Math.max(...scores);
}

function parseScheduleRequest(context) {
  const text = normalizeText([context.scheduleText, ...(context.scheduleValues || [])].join(" "));
  const days = new Set();
  const periods = new Set();

  if (/будн|weekday/.test(text)) days.add("weekday");
  if (/выход|суб|воск|weekend/.test(text)) days.add("weekend");
  if (/пон|пн|monday/.test(text)) days.add("monday");
  if (/втор|вт|tuesday/.test(text)) days.add("tuesday");
  if (/сред|ср|wednesday/.test(text)) days.add("wednesday");
  if (/четв|чт|thursday/.test(text)) days.add("thursday");
  if (/пят|пт|friday/.test(text)) days.add("friday");
  if (/суб|сб|saturday/.test(text)) days.add("saturday");
  if (/воск|вс|sunday/.test(text)) days.add("sunday");

  if (/утр|morning/.test(text)) periods.add("morning");
  if (/день|днем|днём|afternoon|day/.test(text)) periods.add("day");
  if (/веч|evening/.test(text)) periods.add("evening");

  return {
    days,
    periods,
    hasRequest: days.size > 0 || periods.size > 0,
  };
}

function scoreGroupSchedule(group, request) {
  const entries = collectScheduleEntries(group);
  if (!entries.length) return null;

  const dimensions = [];
  if (request.days.size) {
    dimensions.push(matchesScheduleDays(entries, request.days));
  }
  if (request.periods.size) {
    dimensions.push(matchesSchedulePeriods(entries, request.periods));
  }

  if (!dimensions.length) return null;
  if (dimensions.every(Boolean)) return 60;
  if (dimensions.some(Boolean)) return 30;
  return -60;
}

function collectScheduleEntries(group) {
  const entries = [];
  for (const period of group?.periods || []) {
    for (const [dayKey, dayEntries] of Object.entries(period.schedule || {})) {
      for (const entry of dayEntries || []) {
        entries.push({
          day: normalizeWeekday(entry.week_day || dayKey),
          startTime: entry.start_time || entry.startTime,
        });
      }
    }
  }
  for (const entry of group?.scheduleEntries || []) {
    entries.push({
      day: normalizeWeekday(entry.week_day || entry.weekDay),
      startTime: entry.start_time || entry.startTime,
    });
  }
  return entries.filter((entry) => entry.day || entry.startTime);
}

function matchesScheduleDays(entries, requestedDays) {
  return entries.some((entry) => {
    if (!entry.day) return false;
    if (requestedDays.has(entry.day)) return true;
    if (requestedDays.has("weekday") && isWeekday(entry.day)) return true;
    if (requestedDays.has("weekend") && isWeekend(entry.day)) return true;
    return false;
  });
}

function matchesSchedulePeriods(entries, requestedPeriods) {
  return entries.some((entry) => {
    const period = timePeriod(entry.startTime);
    return period && requestedPeriods.has(period);
  });
}

function scoreAvailability(candidate) {
  if (Number(candidate.enrollment) === ENROLLMENT_CLOSED) return -25;
  const groups = candidate.groups || [];
  const freePlaces = groups
    .map((group) => nullableNumber(group.free_places_counter ?? group.freePlacesCounter))
    .filter((value) => value != null);
  if (!freePlaces.length) return 0;
  if (freePlaces.some((value) => value > 0)) return 50;
  return 25;
}

function scoreDirection(candidate, context, exactTopicMatch) {
  const requested = normalizeText(context.directionLabel);
  if (!requested || requested.includes("не важно") || requested === "any") return 0;
  const actual = normalizeText(candidate.directionName || candidate.direction?.name);
  if (!actual) return 0;
  if (actual.includes(requested) || requested.includes(actual)) return 30;
  return exactTopicMatch ? 0 : -30;
}

function scoreGroupSize(candidate, context) {
  const requested = normalizeText(context.groupSize);
  if (!requested || requested === "any") return 0;
  const modules = candidate.modules || [];
  const scores = modules.map((moduleItem) => scoreModuleGroupSize(moduleItem, requested)).filter((value) => value != null);
  if (!scores.length) return 0;
  return Math.max(...scores);
}

function scoreModuleGroupSize(moduleItem, requested) {
  const min = nullableNumber(moduleItem.min_child_group ?? moduleItem.minChildGroup);
  const max = nullableNumber(moduleItem.max_child_group ?? moduleItem.maxChildGroup);
  if (min == null && max == null) return null;
  const average = min != null && max != null ? (min + max) / 2 : min ?? max;
  let actual = "medium";
  if (max != null && max <= 10 || average <= 10) actual = "small";
  else if (min != null && min >= 15 || average >= 16) actual = "large";
  return actual === requested ? 20 : -20;
}

function scoreDeepTrajectory(candidate, context) {
  const topics = candidate.topics || [];
  const profile = context.completedTopicProfile || {};
  const completedTopicKeys = new Set(profile.topicKeys || []);
  const completedLevel2Keys = completedLevel2KeySet(profile);
  const completedLevel1Keys = completedLevel1KeySet(profile);

  const topicKeyMatches = topics.filter((topic) => topic.key && completedTopicKeys.has(topic.key));
  const sameLevel2NewTopics = topics.filter((topic) =>
    topicMatchesAnyKey(topic, completedLevel2Keys, "level2") && !topicKeyMatches.includes(topic),
  );
  const sameLevel1NewTopics = topics.filter((topic) =>
    topicMatchesAnyKey(topic, completedLevel1Keys, "level1") &&
    !topicMatchesAnyKey(topic, completedLevel2Keys, "level2")
  );

  if (!topicKeyMatches.length && !sameLevel2NewTopics.length && !sameLevel1NewTopics.length) {
    return {
      score: 0,
      exclusionReason: "no_completed_topic_link",
      topicKeyMatches,
      categoryMatches: [],
      newRelatedTopics: [],
      depthSignals: [],
    };
  }

  const depthSignals = collectDepthSignals(candidate, topics, profile, context.ageYears);
  let score = 0;
  if (topicKeyMatches.length) score += 30;
  if (sameLevel2NewTopics.length) score += 70;
  if (sameLevel1NewTopics.length) score += 40;
  if (depthSignals.length) score += 80;
  if (!depthSignals.length && topicKeyMatches.length && !sameLevel2NewTopics.length && !sameLevel1NewTopics.length) {
    score -= 10;
  }

  return {
    score: Math.min(score, TRAJECTORY_SCORE_CAP),
    topicKeyMatches,
    categoryMatches: uniqueBy([...sameLevel2NewTopics, ...sameLevel1NewTopics], topicIdentity),
    newRelatedTopics: uniqueBy([...sameLevel2NewTopics, ...sameLevel1NewTopics], topicIdentity),
    depthSignals,
  };
}

function scoreWideTrajectory(candidate, context) {
  const topics = candidate.topics || [];
  const profile = context.completedTopicProfile || {};
  const completedLevel2Keys = completedLevel2KeySet(profile);
  const completedLevel1Keys = completedLevel1KeySet(profile);
  const meaningfulTopics = topics.filter(hasMeaningfulClassifierTopic);
  const repeatedLevel2Topics = meaningfulTopics.filter((topic) => topicMatchesAnyKey(topic, completedLevel2Keys, "level2"));

  if (repeatedLevel2Topics.length) {
    return {
      score: 0,
      exclusionReason: "repeated_level2_topic",
      categoryMatches: repeatedLevel2Topics,
      newRelatedTopics: [],
      noveltySignals: [],
    };
  }

  if (!meaningfulTopics.length) {
    return {
      score: 0,
      exclusionReason: "no_meaningful_topics",
      newRelatedTopics: [],
      noveltySignals: [],
    };
  }

  const sameLevel1Topics = meaningfulTopics.filter((topic) => topicMatchesAnyKey(topic, completedLevel1Keys, "level1"));
  const differentLevel1Topics = meaningfulTopics.filter((topic) => !topicMatchesAnyKey(topic, completedLevel1Keys, "level1"));
  const uniqueMeaningfulTopics = uniqueBy(meaningfulTopics, topicIdentity);
  const noveltySignals = [];
  let score = 0;

  if (differentLevel1Topics.length) {
    score += 100;
    noveltySignals.push("добавляет новый раздел тем");
  }
  if (sameLevel1Topics.length) {
    score += 40;
    noveltySignals.push("новая категория в уже знакомом разделе");
  }

  score += Math.min(uniqueMeaningfulTopics.length * 10, 50);
  if (WIDE_DIRECTORY_LEVEL_IDS.has(Number(candidate.directoryLevelId ?? candidate.directory_level_id))) {
    score += 50;
  }

  return {
    score: Math.min(score, TRAJECTORY_SCORE_CAP),
    newRelatedTopics: uniqueMeaningfulTopics,
    noveltySignals,
  };
}

function completedLevel2KeySet(profile) {
  const keys = new Set(profile.categoryKeys || []);
  for (const category of profile.categories || []) {
    for (const key of topicClassifierKeys(category.code, category.name)) keys.add(key);
  }
  return keys;
}

function completedLevel1KeySet(profile) {
  return new Set(profile.parentCategoryKeys || []);
}

function collectDepthSignals(candidate, topics, profile, ageYears) {
  const signals = [];
  const directoryLevelId = Number(candidate.directoryLevelId ?? candidate.directory_level_id);
  if (DEEP_DIRECTORY_LEVEL_IDS.has(directoryLevelId)) {
    signals.push("уровень программы подходит для углубления");
  }

  const combinedText = normalizeText([
    candidate.name,
    candidate.program,
    candidate.annotation,
    candidate.task,
    candidate.directionName,
    ...(candidate.keywords || []),
    ...topics.map((topic) => topic.name),
  ].join(" "));

  if (ADVANCED_TOPIC_PATTERNS.some((pattern) => pattern.test(combinedText))) {
    signals.push("продвинутые темы или проектная работа");
  }

  const minAge = monthsToYears(candidate.ageMinMonths ?? candidate.age_min);
  if (minAge != null && Number(ageYears) >= minAge && minAge >= Number(ageYears) - 1) {
    signals.push("рассчитана на текущий или более старший возраст");
  }

  const hoursTotal = topics.reduce((sum, topic) => sum + Number(topic.hoursTotal || 0), 0);
  if (profile.averageHours && topics.length && hoursTotal / topics.length > profile.averageHours * 1.15) {
    signals.push("больший объем часов по связанным темам");
  }

  const practiceHours = topics.reduce((sum, topic) => sum + Number(topic.hoursPractice || 0), 0);
  if (practiceHours > 0 && practiceHours >= hoursTotal * 0.4) {
    signals.push("заметная практическая часть");
  }

  return [...new Set(signals)];
}

function hasMeaningfulClassifierTopic(topic) {
  return topicLevel2Keys(topic).length > 0 || topicLevel1Keys(topic).length > 0;
}

function topicMatchesAnyKey(topic, keySet, level) {
  if (!keySet?.size) return false;
  const keys = level === "level1" ? topicLevel1Keys(topic) : topicLevel2Keys(topic);
  return keys.some((key) => keySet.has(key));
}

function topicLevel2Keys(topic) {
  return topicClassifierKeys(topic?.categoryCode, topic?.categoryName);
}

function topicLevel1Keys(topic) {
  return topicClassifierKeys(topic?.parentCode, topic?.parentName);
}

function topicClassifierKeys(code, name) {
  const keys = [];
  const cleanCode = cleanClassifierLabel(code);
  const cleanName = cleanClassifierLabel(name);
  if (cleanName && isGenericClassifierLabel(cleanName)) return keys;
  if (cleanCode && !isGenericClassifierLabel(cleanCode)) keys.push(`code:${normalizeText(cleanCode)}`);
  if (cleanName && !isGenericClassifierLabel(cleanName)) keys.push(`name:${normalizeText(cleanName)}`);
  return keys;
}

function cleanClassifierLabel(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  const normalized = normalizeText(text);
  if (!text || normalized === "unknown" || normalized === "unknown_content") return "";
  return text;
}

function isGenericClassifierLabel(value) {
  const normalized = normalizeText(value);
  return normalized === "предметные темы без категории" ||
    normalized === "предметная тема без категории" ||
    normalized === "прочее" ||
    normalized === "без категории";
}

function normalizeWeekday(value) {
  const normalized = normalizeText(value);
  const labels = {
    monday: "monday",
    tuesday: "tuesday",
    wednesday: "wednesday",
    thursday: "thursday",
    friday: "friday",
    saturday: "saturday",
    sunday: "sunday",
    понедельник: "monday",
    вторник: "tuesday",
    среда: "wednesday",
    четверг: "thursday",
    пятница: "friday",
    суббота: "saturday",
    воскресенье: "sunday",
    пн: "monday",
    вт: "tuesday",
    ср: "wednesday",
    чт: "thursday",
    пт: "friday",
    сб: "saturday",
    вс: "sunday",
  };
  return labels[normalized] || normalized;
}

function isWeekday(day) {
  return ["monday", "tuesday", "wednesday", "thursday", "friday"].includes(day);
}

function isWeekend(day) {
  return day === "saturday" || day === "sunday";
}

function timePeriod(value) {
  const match = String(value || "").match(/(\d{1,2})/);
  if (!match) return "";
  const hour = Number(match[1]);
  if (!Number.isFinite(hour)) return "";
  if (hour < 12) return "morning";
  if (hour < 17) return "day";
  return "evening";
}

function directionLabelFromCode(value) {
  return DIRECTION_LABELS[value] || "";
}

function groupSizeFromClarifier(value) {
  if (value === "small_calm") return "small";
  if (value === "active_group") return "large";
  return value || "";
}

function ageBucketToYears(value) {
  return AGE_BUCKET_YEARS[value] || null;
}

function normalizeAgeRangeYears(range) {
  if (!range) return null;
  const min = nullableNumber(range.min);
  const max = nullableNumber(range.max);
  if (min == null && max == null) return null;
  const normalizedMin = min ?? 3;
  const normalizedMax = max ?? 18;
  if (normalizedMin > normalizedMax) return null;
  return { min: normalizedMin, max: normalizedMax };
}

function monthsToYears(value) {
  const number = nullableNumber(value);
  if (number == null) return null;
  return Math.round(number / 12);
}

function extractPriceAmount(value) {
  if (value == null || value === "") return null;
  if (/бесплат/i.test(String(value))) return 0;
  const normalized = String(value).replace(/\s/g, "").replace(",", ".");
  const match = normalized.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const amount = Number(match[1]);
  return Number.isFinite(amount) ? amount : null;
}

function nullableNumber(value) {
  if (value == null || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeText(value) {
  return String(value || "").toLowerCase().replace(/ё/g, "е");
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const result = [];
  for (const item of items || []) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function withoutOwnScore(value) {
  const { score, ...rest } = value || {};
  return rest;
}

function mergeInterestSignals(specificInterestResult, interestResult) {
  const specificSignals = withoutOwnScore(specificInterestResult);
  const broadSignals = withoutOwnScore(interestResult);
  if (specificInterestResult?.specificInterestMatch && broadSignals.exclusionReason === "interest_mismatch") {
    broadSignals.exclusionReason = "";
  }

  return {
    ...specificSignals,
    ...broadSignals,
    topicKeyMatches: uniqueBy([
      ...(specificInterestResult?.topicKeyMatches || []),
      ...(interestResult?.topicKeyMatches || []),
    ], topicIdentity),
    categoryMatches: uniqueBy([
      ...(specificInterestResult?.categoryMatches || []),
      ...(interestResult?.categoryMatches || []),
    ], topicIdentity),
    specificInterestMatch: Boolean(specificInterestResult?.specificInterestMatch),
    specificInterestScore: specificInterestResult?.specificInterestScore || 0,
    specificInterestMatchLevel: specificInterestResult?.specificInterestMatchLevel || "",
  };
}

function topicIdentity(topic) {
  return [
    topic?.key,
    topic?.name,
    topic?.categoryCode,
    topic?.categoryName,
    topic?.parentCode,
    topic?.parentName,
  ].map(normalizeText).join("|");
}

module.exports = {
  SCENARIO_DESCRIPTION,
  SCENARIO_AGENT,
  SCENARIO_DEEP,
  SCENARIO_WIDE,
  scoreProgramCandidate,
  scoreRecommendationCandidate,
  scoreCandidateForNewInterests,
  collectDepthSignals,
  normalizeScoringContext,
  extractPriceAmount,
  normalizeText,
  topicClassifierKeys,
  topicLevel1Keys,
  topicLevel2Keys,
  topicMatchesAnyKey,
  hasMeaningfulClassifierTopic,
};
