const LOCAL_LLM_ENABLED = process.env.LOCAL_LLM_ENABLED === "true";
const LOCAL_LLM_API_URL =
  process.env.LOCAL_LLM_API_URL || "http://127.0.0.1:8012/v1/chat/completions";
const LOCAL_LLM_MODEL = process.env.LOCAL_LLM_MODEL || "qwen2.5-3b-instruct-q4_k_m";
const LOCAL_LLM_TIMEOUT_MS = Number(process.env.LOCAL_LLM_TIMEOUT_MS || 20000);

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

function isEnabled() {
  return LOCAL_LLM_ENABLED;
}

function isScenario1LlmOnly(session) {
  return process.env.SCENARIO1_LLM_ONLY === "true" &&
    session?.scenario === "description_selection";
}

async function analyzeFreeText(session, text) {
  if (!LOCAL_LLM_ENABLED) return null;
  if (!text || !text.trim()) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOCAL_LLM_TIMEOUT_MS);

  try {
    const response = await fetch(LOCAL_LLM_API_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: LOCAL_LLM_MODEL,
        temperature: 0.1,
        max_tokens: 400,
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
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Local LLM HTTP ${response.status}`);
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Local LLM returned empty content");
    }

    const parsed = extractJson(content);
    const analysis = normalizeAnalysis(parsed);
    if (isScenario1LlmOnly(session)) return analysis;
    return applyHeuristics(text, analysis);
  } finally {
    clearTimeout(timer);
  }
}

function buildSystemPrompt() {
  return [
    "Ты анализируешь сообщения родителей для Telegram-бота по подбору кружков.",
    "Твоя задача: свести свободный текст к ограниченному набору сценариев и заполненных слотов.",
    "Нельзя придумывать факты. Если данных нет, ставь null или пустой массив.",
    "Не заполняй avoidances, adaptation, clarifyGroup и clarifyFocus без прямых словесных сигналов в сообщении.",
    "Не выводи возраст как число. Возвращай только один из диапазонов.",
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
    "Допустимые avoidances: noise, strict, stage, routine, intense, unknown",
    "Допустимые adaptation: fast, careful, soft, depends",
    "Допустимые goal: interest, first_try, strengths, social, discipline, discover",
    "Допустимые clarifyGroup: small_calm, active_group, structured, free",
    "Допустимые clarifyFocus: hands, logic, social, mixed",
    "JSON-формат:",
    '{"scenario":"fallback","message_for_user":"","filled_slots":{"age":null,"experience":null,"interests":[],"avoidances":[],"adaptation":null,"goal":null,"location":null,"budget":null,"schedule":null,"clarifyGroup":null,"clarifyFocus":null}}',
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
  return {
    scenario: normalizeScenario(parsed?.scenario),
    messageForUser: normalizeShortText(parsed?.message_for_user),
    filledSlots: {
      age: normalizeEnum(filled.age, ALLOWED_AGES),
      experience: normalizeEnum(filled.experience, ALLOWED_EXPERIENCE),
      interests: normalizeArray(filled.interests, ALLOWED_INTERESTS),
      avoidances: normalizeArray(filled.avoidances, ALLOWED_AVOIDANCES),
      adaptation: normalizeEnum(filled.adaptation, ALLOWED_ADAPTATION),
      goal: normalizeEnum(filled.goal, ALLOWED_GOALS),
      location: normalizeFreeText(filled.location),
      budget: normalizeFreeText(filled.budget),
      schedule: normalizeFreeText(filled.schedule),
      clarifyGroup: normalizeEnum(filled.clarifyGroup, ALLOWED_CLARIFY_GROUP),
      clarifyFocus: normalizeEnum(filled.clarifyFocus, ALLOWED_CLARIFY_FOCUS),
    },
  };
}

function normalizeScenario(value) {
  return ALLOWED_SCENARIOS.has(value) ? value : "fallback";
}

function normalizeEnum(value, allowed) {
  return allowed.has(value) ? value : null;
}

function normalizeArray(value, allowed) {
  const list = Array.isArray(value) ? value : [];
  return [...new Set(list.filter((item) => allowed.has(item)))];
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

function detectAgeBucket(text) {
  const match = text.match(/(\d{1,2})\s*(?:лет|года|год|л\.)/i);
  if (!match) return null;
  const age = Number(match[1]);
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
    if (slots.interests.length || slots.goal) return "first_time_selection";
    return "clarify_constraints";
  }
  if (slots.interests.length || slots.goal || slots.age) return "clarify_preferences";
  return "fallback";
}

module.exports = {
  isEnabled,
  analyzeFreeText,
};
