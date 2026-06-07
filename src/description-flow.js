const os = require("node:os");
const path = require("node:path");

const { SCENARIO_1 } = require("./flow");
const {
  createDescriptionSelectionState,
  ensureDescriptionSelectionState,
  applyDescriptionText,
  shouldUseLlmForDescription,
  applyLlmAnalysis,
  recordLlmError,
  getMissingRequiredFields,
  shouldConfirmSummary,
  buildRequiredClarificationPrompt,
  buildSingleFieldPrompt,
  buildSummaryText,
  buildRecommendationProfile,
  buildPdfAnswers,
  buildHistoryPayload,
  buildDescriptionResultMessage,
} = require("./description-selection");

function isDescriptionStep(step) {
  return String(step || "").startsWith("s1_");
}

function isDescriptionCallback(data) {
  return String(data || "").startsWith("s1:");
}

async function startDescriptionFlow(context) {
  const { target, session, persistSession, sendMessage } = context;
  session.step = "s1_wait_description";
  session.scenario = {
    id: "description_selection",
    label: "Подобрать по описанию",
  };
  session.descriptionSelection = createDescriptionSelectionState();
  await persistSession(target, session);
  return sendMessage(target, SCENARIO_1.intro);
}

async function handleDescriptionText(context) {
  const { target, text, session, persistSession, sendMessage } = context;
  const state = ensureDescriptionSelectionState(session);
  const mode = session.step === "s1_wait_edit"
    ? "edit"
    : session.step === "s1_wait_required_clarification"
      ? "clarification"
      : "description";

  applyDescriptionText(state, text, { mode });
  await enrichDescriptionWithLlm(context, state, text, mode);
  const missing = getMissingRequiredFields(state);
  if (missing.length) {
    session.step = "s1_wait_required_clarification";
    await persistSession(target, session);
    const prompt = missing.length === 1 && state.clarifications.length > 0
      ? buildSingleFieldPrompt(missing[0])
      : buildRequiredClarificationPrompt(missing);
    return sendMessage(target, prompt);
  }

  if (shouldConfirmSummary(state)) {
    session.step = "s1_confirm_summary";
    await persistSession(target, session);
    return sendMessage(target, buildSummaryText(state), SCENARIO_1.confirmation.keyboard);
  }

  return showDescriptionResults(context);
}

async function enrichDescriptionWithLlm(context, state, text, mode) {
  if (!context.analyzeFreeText) return;
  if (!shouldUseLlmForDescription(state, text)) return;

  try {
    const analysis = await context.analyzeFreeText({
      scenario: "description_selection",
      mode,
      current: state,
    }, text);
    if (analysis) {
      applyLlmAnalysis(state, analysis, { mode: mode === "edit" ? "edit" : "llm" });
    }
  } catch (error) {
    recordLlmError(state, error);
    console.warn("Description selection LLM analysis skipped:", error.message);
  }
}

async function handleDescriptionCallback(context) {
  const { target, data, session, persistSession, sendMessage } = context;
  ensureDescriptionSelectionState(session);
  if (!isDescriptionStep(session.step)) {
    return sendMessage(target, "Этот сценарий больше не активен. Нажмите /start и выберите доступный вариант.");
  }

  if (data === "s1:confirm") {
    return showDescriptionResults(context);
  }

  if (data === "s1:edit") {
    session.step = "s1_wait_edit";
    await persistSession(target, session);
    return sendMessage(target, SCENARIO_1.edit.text);
  }

  if (data === "s1:pdf:yes") {
    return sendDescriptionPdf(context);
  }

  if (data === "s1:pdf:no") {
    session.descriptionSelection.pdfRequested = false;
    await persistSession(target, session);
    return sendMessage(target, "Хорошо. Чтобы начать новый подбор, нажмите /start.");
  }

  return sendMessage(target, "Этот сценарий больше не активен. Нажмите /start и выберите доступный вариант.");
}

async function showDescriptionResults(context) {
  const {
    target,
    session,
    persistSession,
    sendMessage,
    getRecommendations,
    logRecommendation,
    normalizeTarget,
  } = context;
  const state = ensureDescriptionSelectionState(session);
  session.step = "s1_results";
  await persistSession(target, session);
  await sendMessage(target, SCENARIO_1.searching);

  let result;
  try {
    result = await getRecommendations(buildRecommendationProfile(state), {
      limit: 10,
      strict: true,
      sparseThreshold: 3,
    });
  } catch (error) {
    console.error("Description selection recommendations failed:", error);
    return sendMessage(target, "Не удалось подобрать программы по этим данным. Попробуйте начать заново через /start.");
  }

  state.lastResult = result;
  await persistSession(target, session);

  const normalizedTarget = normalizeTarget(target);
  await logRecommendation(normalizedTarget.platform, normalizedTarget.id, {
    ...result,
    scenario: "description_selection",
    answers: buildHistoryPayload(state),
  });

  const text = buildDescriptionResultMessage(state, result);
  for (const chunk of splitMessage(text)) {
    await sendMessage(target, chunk);
  }

  if (!result.items?.length) {
    return sendMessage(target, "Чтобы изменить критерии, нажмите /start и начните подбор заново.");
  }

  session.step = "s1_pdf";
  await persistSession(target, session);
  return sendMessage(target, SCENARIO_1.pdfDownload.text, SCENARIO_1.pdfDownload.keyboard);
}

async function sendDescriptionPdf(context) {
  const {
    target,
    session,
    persistSession,
    sendMessage,
    sendDocument,
    createSelectionPdf,
    normalizeTarget,
  } = context;
  const state = ensureDescriptionSelectionState(session);
  const result = state.lastResult;
  if (!result?.items?.length) {
    return sendMessage(target, "Не нашел последнюю подборку. Начните новый подбор через /start.");
  }

  try {
    state.pdfRequested = true;
    await persistSession(target, session);
    await sendMessage(target, "Готовлю PDF-файл с подборкой...");
    const normalizedTarget = normalizeTarget(target);
    const outputPath = path.join(
      process.env.PDF_OUTPUT_DIR || path.join(os.tmpdir(), "telegram-bot-pdfs"),
      `selection-${normalizedTarget.platform}-${normalizedTarget.id}-${Date.now()}.pdf`,
    );
    await createSelectionPdf({
      outputPath,
      answers: buildPdfAnswers(state),
      result,
    });
    state.pdfPath = outputPath;
    await persistSession(target, session);
    return sendDocument(target, outputPath, "Подборка программ");
  } catch (error) {
    console.error("Description selection PDF delivery failed:", error);
    return sendMessage(target, "Не удалось подготовить PDF-файл. Попробуйте нажать кнопку скачивания еще раз.");
  }
}

function splitMessage(text, limit = 3500) {
  const chunks = [];
  let current = "";
  for (const block of String(text).split("\n\n")) {
    const next = current ? `${current}\n\n${block}` : block;
    if (next.length > limit && current) {
      chunks.push(current);
      current = block;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

module.exports = {
  isDescriptionStep,
  isDescriptionCallback,
  startDescriptionFlow,
  handleDescriptionText,
  handleDescriptionCallback,
  splitMessage,
  enrichDescriptionWithLlm,
};
