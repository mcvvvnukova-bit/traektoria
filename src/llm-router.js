const { createChatCompletionText, isLlmEnabled } = require("./llm-client");
const { SCENARIO_1_CRITERIA } = require("./scenario1-criteria-recognition");

const ALLOWED_SCENARIOS = new Set([
  "first_time_selection",
  "switch_program",
  "build_trajectory",
  "clarify_preferences",
  "clarify_constraints",
  "ready_to_recommend",
  "fallback",
]);

const ALLOWED_AGES = new Set(["3-4", "5-6", "7-9", "10-12", "13+"]);
const ALLOWED_EXPERIENCE = new Set(["none", "tried", "active", "new"]);
const ALLOWED_INTERESTS = new Set(["creative", "building", "sports", "social", "logic", "calm"]);
const ALLOWED_AVOIDANCES = new Set(["noise", "strict", "stage", "routine", "intense", "unknown"]);
const ALLOWED_ADAPTATION = new Set(["fast", "careful", "soft", "depends"]);
const ALLOWED_GOALS = new Set(["interest", "first_try", "strengths", "social", "discipline", "discover"]);
const ALLOWED_CLARIFY_GROUP = new Set(["small_calm", "active_group", "structured", "free"]);
const ALLOWED_CLARIFY_FOCUS = new Set(["hands", "logic", "social", "mixed"]);
const SCENARIO_1_CRITERION_CONFIDENCE_KEYS = SCENARIO_1_CRITERIA.map((criterion) => criterion.column);

function isEnabled() {
  return isLlmEnabled("free_text") ||
    isLlmEnabled("description_selection") ||
    isLlmEnabled("trajectory_deep");
}

function isScenario1LlmOnly(session) {
  return process.env.SCENARIO1_LLM_ONLY === "true" &&
    session?.scenario === "description_selection";
}

async function analyzeFreeText(session, text) {
  const step = llmStepForSession(session);
  if (!isLlmEnabled(step)) return null;
  if (!text || !text.trim()) return null;

  const content = await createChatCompletionText({
    step,
    temperature: 0.1,
    maxTokens: 1000,
    responseFormat: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: buildSystemPrompt(),
      },
      {
        role: "user",
        content: buildUserPrompt(session, text),
      },
    ],
  });
  if (!content) {
    throw new Error("LLM returned empty content");
  }

  const parsed = extractJson(content);
  const analysis = normalizeAnalysis(parsed);
  if (isScenario1LlmOnly(session)) return analysis;
  return applyHeuristics(text, analysis);
}

function llmStepForSession(session) {
  if (session?.scenario === "trajectory_deep") return "trajectory_deep";
  if (session?.scenario === "description_selection") return "description_selection";
  return "free_text";
}

function buildSystemPrompt() {
  return [
    "Ты анализируешь сообщения родителей для Telegram-бота по подбору кружков.",
    "Твоя задача: свести свободный текст к ограниченному набору сценариев и заполненных слотов.",
    "Нельзя придумывать факты. Если данных нет, ставь null или пустой массив.",
    "Не заполняй avoidances, adaptation, clarifyGroup и clarifyFocus без прямых словесных сигналов в сообщении.",
    "age возвращай как диапазон, а точный числовой возраст пользователя возвращай отдельно в ageYears.",
    "Если в сообщении есть числовой возраст со словом 'лет', 'года', 'год' или 'л.', обязательно заполни age и ageYears.",
    "Правила age: 3-4 года -> '3-4'; 5-6 лет -> '5-6'; 7-9 лет -> '7-9'; 10-12 лет -> '10-12'; 13 лет и старше -> '13+'.",
    "Примеры age: '13 лет' -> '13+', '9 лет' -> '7-9', '10 лет' -> '10-12'.",
    "Отвечай только JSON-объектом без markdown и пояснений.",
    "Допустимые scenario:",
    "- first_time_selection",
    "- switch_program",
    "- build_trajectory",
    "- clarify_preferences",
    "- clarify_constraints",
    "- ready_to_recommend",
    "- fallback",
    "Допустимые значения age: 3-4, 5-6, 7-9, 10-12, 13+",
    "Допустимые значения experience: none, tried, active, new",
    "Допустимые interests: creative, building, sports, social, logic, calm",
    "interests — это широкие категории. Конкретное занятие пользователя возвращай отдельно в specificInterests.",
    "Например: 'баскетбол' -> interests: ['sports'], specificInterests: ['баскетбол']; 'робототехника' -> interests: ['building','logic'], specificInterests: ['робототехника'].",
    "Если пользователь назвал конкретное занятие, например футбол, баскетбол, рисование, робототехника, шахматы, обязательно заполни specificInterests.",
    "Допустимые avoidances: noise, strict, stage, routine, intense, unknown",
    "Допустимые adaptation: fast, careful, soft, depends",
    "Допустимые goal: interest, first_try, strengths, social, discipline, discover",
    "Допустимые clarifyGroup: small_calm, active_group, structured, free",
    "Допустимые clarifyFocus: hands, logic, social, mixed",
    "location заполняй только населенным пунктом Мурманской области из списка:",
    "Мурманск, Североморск, Апатиты, Кировск, Мончегорск, Кандалакша, Кола, Оленегорск, Полярный, Полярные Зори, Снежногорск, Заозерск, Гаджиево, Видяево, Заполярный, Никель, Ковдор, Умба, Ловозеро, Ревда.",
    "Нормализуй location к именительному падежу из списка: 'в Оленегорске' -> 'Оленегорск', 'в Мурманске' -> 'Мурманск'.",
    "Если новое сообщение состоит только из населенного пункта, например 'Оленегорск' или 'Мурманск', это тоже location.",
    "Если указан район, организация или неясное место без населенного пункта, например 'центр города', оставь location: null.",
    "Для scenario=description_selection верни criterion_confidences: объект с confidence распознавания по критериям С1.",
    `Ключи criterion_confidences: ${SCENARIO_1_CRITERION_CONFIDENCE_KEYS.join(", ")}`,
    "Значение confidence: число от 0 до 1 только если ты явно оценил критерий по сообщению пользователя.",
    "Если confidence по критерию нет, не выдумывай: поставь null или не включай этот ключ.",
    "Для scenario=description_selection также верни criteria: объект с найденными критериями С1.",
    "criteria используется для записи в плоскую таблицу логирования. Не копируй значения из filled_slots автоматически: распознавай каждый критерий отдельно по сообщению пользователя.",
    "Если критерий распознан, обязательно укажи status, найденное значение в полях критерия и confidence от 0 до 1.",
    "Если критерий не распознан по сообщению пользователя, можешь не включать его в criteria.",
    "Формат criteria:",
    '"criterion_01_municipality":{"status":"recognized","value":"Мурманск","confidence":0.95}',
    '"criterion_03_age":{"status":"recognized","age_bucket":"5-6","age_years":5,"age_text":"5 лет","confidence":1}',
    '"criterion_04_cost":{"status":"recognized","value":"бесплатно","confidence":0.8}',
    '"criterion_06_education_form":{"status":"recognized","format":"offline","format_label":"Очно","confidence":0.8}',
    '"criterion_07_schedule":{"status":"recognized","schedule_text":"по выходным","schedule_values":["weekends"],"confidence":0.75}',
    '"criterion_09_direction":{"status":"recognized","direction":"science","direction_label":"Естественно-научная","confidence":0.8}',
    '"criterion_10_group_size":{"status":"recognized","value":"маленькая группа","confidence":0.7}',
    '"criterion_12_exact_interest_topic":{"status":"recognized","terms":["шахматы"],"labels":["шахматы"],"confidence":0.95}',
    '"criterion_13_interest_level2_category":{"status":"recognized","values":["logic"],"labels":["логика и программирование"],"confidence":0.9}',
    '"criterion_14_interest_level1_section":{"status":"recognized","direction":"science","direction_label":"Естественно-научная","confidence":0.9}',
    '"criterion_15_fallback_text_keywords":{"status":"recognized","value":"шахматы","confidence":0.8}',
    '"criterion_16_interest_without_thematic_match":{"status":"pending_scoring","interests":["logic"],"specific_terms":["шахматы"],"interests_text":"шахматы","direction":"science","confidence":0.7}',
    "JSON-формат:",
    '{"scenario":"fallback","message_for_user":"","filled_slots":{"age":null,"ageYears":null,"ageText":"","experience":null,"interests":[],"specificInterests":[],"avoidances":[],"adaptation":null,"goal":null,"location":null,"budget":null,"schedule":null,"clarifyGroup":null,"clarifyFocus":null},"criterion_confidences":{},"criteria":{}}',
    "message_for_user: короткая реплика на русском, максимум 18 слов. Если сказать нечего, верни пустую строку.",
  ].join("\n");
}

function applyHeuristics(text, analysis) {
  const normalizedText = ` ${String(text).toLowerCase()} `;
  const slots = { ...analysis.filledSlots };

  const ageBucket = detectAgeBucket(normalizedText);
  if (ageBucket) slots.age = ageBucket;

  const experience = detectExperience(normalizedText);
  slots.experience = experience;

  const heuristicInterests = detectInterests(normalizedText);
  if (heuristicInterests.length) {
    slots.interests = heuristicInterests;
  }

  const heuristicAvoidances = detectAvoidances(normalizedText);
  slots.avoidances = heuristicAvoidances.length ? heuristicAvoidances : [];

  const adaptation = detectAdaptation(normalizedText);
  slots.adaptation = adaptation;

  const goal = detectGoal(normalizedText);
  slots.goal = goal;

  const budget = detectBudget(String(text));
  if (budget) slots.budget = budget;

  const schedule = detectSchedule(String(text));
  if (schedule) slots.schedule = schedule;

  return {
    ...analysis,
    scenario: detectScenario(normalizedText, slots),
    messageForUser: "",
    filledSlots: slots,
  };
}

function buildUserPrompt(session, text) {
  return [
    `Текущее состояние сессии: ${JSON.stringify(session)}`,
    `Новое сообщение пользователя: ${JSON.stringify(text)}`,
    "Извлекай данные из нового сообщения. Не копируй null из текущего состояния, если новое сообщение содержит значение.",
    "Верни только JSON.",
  ].join("\n");
}

function extractJson(content) {
  const raw = String(content).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0 || end <= start) {
    throw new Error("Local LLM did not return JSON");
  }
  return JSON.parse(raw.slice(start, end + 1));
}

function normalizeAnalysis(parsed) {
  const filled = parsed?.filled_slots || {};
  const age = normalizeAge(filled.age, filled.ageYears || filled.age_years, filled.ageText || filled.age_text);
  return {
    scenario: normalizeScenario(parsed?.scenario),
    messageForUser: normalizeShortText(parsed?.message_for_user),
    filledSlots: {
      age: age.age,
      ageYears: age.ageYears,
      ageText: age.ageText,
      experience: normalizeEnum(filled.experience, ALLOWED_EXPERIENCE),
      interests: normalizeArray(filled.interests, ALLOWED_INTERESTS),
      specificInterests: normalizeTextArray(filled.specificInterests || filled.specific_interests),
      avoidances: normalizeArray(filled.avoidances, ALLOWED_AVOIDANCES),
      adaptation: normalizeEnum(filled.adaptation, ALLOWED_ADAPTATION),
      goal: normalizeEnum(filled.goal, ALLOWED_GOALS),
      location: normalizeFreeText(filled.location),
      budget: normalizeFreeText(filled.budget),
      schedule: normalizeFreeText(filled.schedule),
      clarifyGroup: normalizeEnum(filled.clarifyGroup, ALLOWED_CLARIFY_GROUP),
      clarifyFocus: normalizeEnum(filled.clarifyFocus, ALLOWED_CLARIFY_FOCUS),
    },
    criterionConfidences: normalizeCriterionConfidences(
      parsed?.criterion_confidences ||
        parsed?.criteria_confidences ||
        parsed?.criterionConfidences ||
        parsed?.criteriaConfidences,
    ),
    criteria: normalizeCriteria(
      parsed?.criteria ||
        parsed?.criterion_results ||
        parsed?.criterionResults ||
        parsed?.criterion_values ||
        parsed?.criterionValues,
    ),
  };
}

function normalizeCriteria(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return JSON.parse(JSON.stringify(value));
}

function normalizeScenario(value) {
  return ALLOWED_SCENARIOS.has(value) ? value : "fallback";
}

function normalizeEnum(value, allowed) {
  return allowed.has(value) ? value : null;
}

function normalizeAge(value, yearsValue, textValue) {
  const text = String(value ?? "").trim();
  const ageText = normalizeFreeText(textValue);
  const enumValue = normalizeEnum(value, ALLOWED_AGES);
  const explicitYears = normalizeAgeYears(yearsValue);
  if (enumValue) {
    return {
      age: enumValue,
      ageYears: explicitYears,
      ageText: ageText || (explicitYears ? `${explicitYears} лет` : ""),
    };
  }

  const range = text.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})/);
  if (range) {
    const first = Number(range[1]);
    const second = Number(range[2]);
    const ageYears = explicitYears || Math.round((first + second) / 2);
    return {
      age: ageBucketFromYears(ageYears),
      ageYears,
      ageText: ageText || `${first}-${second} лет`,
    };
  }

  const numeric = text.match(/(\d{1,2})/);
  const ageYears = explicitYears || (numeric ? Number(numeric[1]) : null);
  if (!ageYears) {
    return {
      age: null,
      ageYears: null,
      ageText: ageText || "",
    };
  }
  return {
    age: ageBucketFromYears(ageYears),
    ageYears,
    ageText: ageText || `${ageYears} лет`,
  };
}

function normalizeAgeYears(value) {
  const text = String(value ?? "").trim();
  const match = text.match(/(\d{1,2})/);
  if (!match) return null;
  const years = Number(match[1]);
  return ageBucketFromYears(years) ? years : null;
}

function normalizeArray(value, allowed) {
  const list = Array.isArray(value) ? value : [];
  return [...new Set(list.filter((item) => allowed.has(item)))];
}

function normalizeTextArray(value) {
  const list = Array.isArray(value) ? value : [];
  return [...new Set(list
    .map((item) => normalizeFreeText(item))
    .filter(Boolean))]
    .slice(0, 6);
}

function normalizeShortText(value) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 180);
}

function normalizeFreeText(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizeCriterionConfidences(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const result = {};
  for (const key of SCENARIO_1_CRITERION_CONFIDENCE_KEYS) {
    const confidence = normalizeConfidence(source[key] ?? source[`${key}_confidence`]);
    if (confidence !== null) result[key] = confidence;
  }
  return result;
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

function detectAgeBucket(text) {
  const match = text.match(/(\d{1,2})\s*(?:лет|года|год|л\.)/i);
  if (!match) return null;
  const age = Number(match[1]);
  return ageBucketFromYears(age);
}

function ageBucketFromYears(age) {
  if (age >= 3 && age <= 4) return "3-4";
  if (age >= 5 && age <= 6) return "5-6";
  if (age >= 7 && age <= 9) return "7-9";
  if (age >= 10 && age <= 12) return "10-12";
  if (age >= 13) return "13+";
  return null;
}

function detectExperience(text) {
  if (/(уже ход|уже заним|ходит в круж|занимаетс)/i.test(text)) return "active";
  if (/(ищем|хотим).{0,20}нов/i.test(text)) return "new";
  if (/(пробовал|пробовали|ходили,? но|не зашло|не закрепил)/i.test(text)) return "tried";
  if (/(не ходил|никогда не ходил|пока не ходил)/i.test(text)) return "none";
  return null;
}

function detectInterests(text) {
  const matches = [];
  if (/(рис|леп|твор|дизайн|мастер|худож|придум)/i.test(text)) matches.push("creative");
  if (/(робот|констру|собират|инжен|3d|модел|техн)/i.test(text)) matches.push("building");
  if (/(спорт|плав|футбол|хокке|гимнаст|самбо|дзюдо|борьб|бег|волейбол|баскетбол)/i.test(text)) matches.push("sports");
  if (/(обща|друз|команд|театр|сцен|выступ)/i.test(text)) matches.push("social");
  if (/(логик|математ|программ|шахмат|как все устроено|как устроено)/i.test(text)) matches.push("logic");
  if (/(робот|программ)/i.test(text)) matches.push("logic");
  if (/(спокой|усидчив|в своем темпе|не спеша)/i.test(text)) matches.push("calm");
  return [...new Set(matches)];
}

function detectAvoidances(text) {
  const matches = [];
  if (/(не любит|боится|избега).{0,20}(шум|шумн|больш(ие|их) групп)/i.test(text)) matches.push("noise");
  if (/(не любит|боится|избега).{0,20}(жестк|строг)/i.test(text)) matches.push("strict");
  if (/(не любит|боится|избега).{0,20}(выступ|сцен)/i.test(text)) matches.push("stage");
  if (/(не любит|скучно|устает).{0,20}(однообраз|рутин)/i.test(text)) matches.push("routine");
  if (/(слишком актив|перегруз|устает от темпа|не любит интенсив)/i.test(text)) matches.push("intense");
  if (/(сложно сказать|пока не знаю)/i.test(text)) matches.push("unknown");
  return [...new Set(matches)];
}

function detectAdaptation(text) {
  if (/(сразу проб|быстро включа)/i.test(text)) return "fast";
  if (/(сначала присматрива|осторожно вход|нужно освоитьс)/i.test(text)) return "careful";
  if (/(мягк.*адаптац|спокойн.*адаптац|нужно время на адаптац)/i.test(text)) return "soft";
  if (/(зависит от обстанов|зависит от ситуации)/i.test(text)) return "depends";
  return null;
}

function detectGoal(text) {
  if (/(найти хороший первый опыт|первый кружок|в первый раз)/i.test(text)) return "first_try";
  if (/(развить сильн|сильные стороны)/i.test(text)) return "strengths";
  if (/(больше общени|друз|общаться)/i.test(text)) return "social";
  if (/(дисциплин|регулярност|режим)/i.test(text)) return "discipline";
  if (/(понять,? что подходит|попробовать разное|не знаем,? что подойдет)/i.test(text)) return "discover";
  if (/(интересно|чтобы нравил|нравится)/i.test(text)) return "interest";
  return null;
}

function detectBudget(text) {
  const match = text.match(/до\s*([\d\s]+)\s*(?:₽|руб|рубл)/i) || text.match(/бюджет\s*[:до]*\s*([\d\s]+)\s*(?:₽|руб|рубл)?/i);
  if (!match) return null;
  return `до ${match[1].replace(/\s+/g, " ").trim()} рублей`;
}

function detectSchedule(text) {
  const hints = [];
  if (/суббот/i.test(text)) hints.push("суббота");
  if (/воскрес/i.test(text)) hints.push("воскресенье");
  if (/будн/i.test(text)) hints.push("будни");
  if (/вечер/i.test(text)) hints.push("вечером");
  if (/утр/i.test(text)) hints.push("утром");
  if (/после школы/i.test(text)) hints.push("после школы");
  return hints.length ? hints.join(", ") : null;
}

function detectScenario(text, slots) {
  if (/(траектор|план на год|годовой план)/i.test(text)) return "build_trajectory";
  if (slots.experience === "active" || slots.experience === "new") return "switch_program";
  if (slots.location || slots.budget || slots.schedule) {
    if (hasInterestSignal(slots) || slots.goal) return "first_time_selection";
    return "clarify_constraints";
  }
  if (hasInterestSignal(slots) || slots.goal || slots.age) return "clarify_preferences";
  return "fallback";
}

function hasInterestSignal(slots) {
  return Boolean(
    slots?.interests?.length ||
    slots?.specificInterests?.length,
  );
}

module.exports = {
  isEnabled,
  analyzeFreeText,
};
