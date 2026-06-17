const fs = require("node:fs/promises");
const path = require("node:path");
const zlib = require("node:zlib");
const { createQrMatrix } = require("./qr-code");

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_X = 34;
const COLORS = {
  ink: "#15131F",
  muted: "#74708F",
  soft: "#F0EEFF",
  softLine: "#DDD8FF",
  purple: "#5A45F4",
  purpleSoftBorder: "#E5E1FF",
  green: "#2E9E56",
  red: "#D94B40",
  redSoft: "#FFE6E2",
  amber: "#C47A12",
  amberSoft: "#FFF2D8",
  white: "#FFFFFF",
};
const UNKNOWN_VALUE_LABEL = "Уточните при записи";

const FONT_PATHS = {
  regular: [
    process.env.PDF_FONT_PATH,
    process.env.PDF_FONT_REGULAR_PATH,
    path.join(__dirname, "../assets/fonts/GolosText-Regular.ttf"),
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/Library/Fonts/Arial Unicode.ttf",
  ].filter(Boolean),
  medium: [
    process.env.PDF_FONT_MEDIUM_PATH,
    path.join(__dirname, "../assets/fonts/GolosText-Medium.ttf"),
  ].filter(Boolean),
  semibold: [
    process.env.PDF_FONT_SEMIBOLD_PATH,
    path.join(__dirname, "../assets/fonts/GolosText-SemiBold.ttf"),
  ].filter(Boolean),
  bold: [
    process.env.PDF_FONT_BOLD_PATH,
    path.join(__dirname, "../assets/fonts/GolosText-Bold.ttf"),
  ].filter(Boolean),
};

const PDF_FONTS = [
  { key: "regular", resource: "F1", baseName: "GolosTextRegular" },
  { key: "medium", resource: "F2", baseName: "GolosTextMedium" },
  { key: "semibold", resource: "F3", baseName: "GolosTextSemiBold" },
  { key: "bold", resource: "F4", baseName: "GolosTextBold" },
];
const IMAGE_PATHS = {
  logo: path.join(__dirname, "../assets/images/trajectory-talents-logo.png"),
};

async function createSelectionPdf({ outputPath, answers, result }) {
  const fonts = await loadFonts();
  const images = await loadImages();
  const pages = buildPages(answers || {}, result || {});
  const usedCodepoints = collectCodepoints(pages);
  const pdf = buildPdf({ pages, fonts, images, usedCodepoints });

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, pdf);
  return outputPath;
}

async function loadImages() {
  const logoBytes = await fs.readFile(IMAGE_PATHS.logo);
  return [{
    key: "logo",
    resource: "ImLogo",
    ...decodePngImage(logoBytes),
  }];
}

async function loadFonts() {
  const regularPath = await findFontPath(FONT_PATHS.regular, "regular");
  const regularBytes = await fs.readFile(regularPath);
  const regularFont = {
    key: "regular",
    resource: "F1",
    baseName: "GolosTextRegular",
    bytes: regularBytes,
    cmap: parseCmap(regularBytes),
  };

  const fonts = [regularFont];
  for (const font of PDF_FONTS.slice(1)) {
    const fontPath = await findFontPath(FONT_PATHS[font.key], font.key, regularPath);
    const bytes = fontPath === regularPath ? regularBytes : await fs.readFile(fontPath);
    fonts.push({
      ...font,
      bytes,
      cmap: fontPath === regularPath ? regularFont.cmap : parseCmap(bytes),
    });
  }
  return fonts;
}

async function findFontPath(paths, label, fallbackPath = null) {
  for (const fontPath of paths) {
    try {
      await fs.access(fontPath);
      return fontPath;
    } catch (_) {
      // Try the next configured font path.
    }
  }
  if (fallbackPath) return fallbackPath;
  throw new Error(`No PDF ${label} font found. Set PDF_FONT_PATH to a TTF font with Cyrillic support.`);
}

function buildPages(answers, result) {
  const pages = [{ elements: [] }];
  const context = {
    pages,
    page: pages[0],
    y: 30,
    date: formatDate(new Date()),
    place: answers.place || "вашем городе",
  };

  drawHeader(context.page, context.date);
  drawHero(context, answers);
  drawParameters(context, answers);
  context.y += 24;
  drawSectionTitle(context, "Рекомендованные кружки");

  const items = (result.items || []).slice(0, 10);
  if (!items.length) {
    drawEmptyState(context);
  } else {
    items.forEach((item) => drawProgramCard(context, item));
  }

  addFooters(pages, context.date);
  return pages;
}

function drawHeader(page, date) {
  page.elements.push(
    { type: "image", image: "logo", x: MARGIN_X + 2, y: 27, w: 28, h: 22 },
    { type: "text", text: "Траектория талантов", x: MARGIN_X + 34, y: 43, size: 14, color: COLORS.ink, font: "semibold" },
    { type: "text", text: `Рекомендации от ${date}`, x: PAGE_WIDTH - MARGIN_X - 123, y: 41, size: 9, color: COLORS.muted, font: "medium" },
  );
}

function drawHero(context, answers) {
  const place = formatHeroPlace(answers.place);
  drawTextRuns(context.page, [
    { text: "Кружки ", color: COLORS.ink },
    { text: "для вашего", color: COLORS.purple },
  ], MARGIN_X, 96, 34, "bold");
  drawTextRuns(context.page, [
    { text: "ребенка", color: COLORS.purple },
    { text: place, color: COLORS.ink },
  ], MARGIN_X, 134, 34, "bold");
  context.page.elements.push({
    type: "text",
    text: "Мы подобрали для вас кружки, которые подходят по возрасту, интересам и другим указанным параметрам.",
    x: MARGIN_X,
    y: 180,
    size: 12,
    color: COLORS.muted,
    maxWidth: 420,
    font: "regular",
  });
  context.y = 207;
}

function drawParameters(context, answers) {
  const panelX = MARGIN_X;
  const panelY = context.y;
  const panelW = PAGE_WIDTH - MARGIN_X * 2;
  const extra = answers.wantsRefinement ? 76 : 0;
  const panelH = 188 + extra;
  context.page.elements.push({ type: "rect", x: panelX, y: panelY, w: panelW, h: panelH, r: 14, fill: COLORS.soft });
  context.page.elements.push({
    type: "text",
    text: "По каким параметрам мы подбирали",
    x: panelX + 14,
    y: panelY + 30,
    size: 14,
    color: COLORS.ink,
    font: "semibold",
  });

  const params = [
    ["ВОЗРАСТ", answers.ageText || "не указан"],
    ["ИНТЕРЕСЫ", answers.interestsText || "не указаны"],
    ["ЦЕЛИ", formatGoals(answers)],
    ["КОГДА УДОБНО", formatSchedule(answers.schedule)],
    ["ФОРМАТ", answers.formatLabel || "не указан"],
    ["МЕСТО", answers.place || "не указано"],
    ["СТОИМОСТЬ", answers.cost || "не указана"],
  ];
  if (answers.wantsRefinement) {
    params.push(
      ["РАЗМЕР ГРУППЫ", answers.groupSizeLabel || "не указан"],
      ["НЕ ПОДХОДИТ", formatAvoidances(answers)],
      ["НАПРАВЛЕННОСТЬ", answers.directionLabel || "не указана"],
    );
  }

  params.forEach(([label, value], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = panelX + 14 + column * 255;
    const y = panelY + 47 + row * 35;
    drawParameter(context.page, x, y, label, value, index);
  });
  context.y = panelY + panelH;
}

function drawParameter(page, x, y, label, value, index) {
  page.elements.push(
    { type: "rect", x, y, w: 22, h: 22, r: 5, fill: COLORS.white },
    { type: "icon", name: parameterIcon(index), x: x + 6, y: y + 6, size: 10, color: COLORS.purple },
    { type: "text", text: label, x: x + 32, y: y + 9, size: 7.5, color: COLORS.muted, font: "medium" },
    {
      type: "text",
      text: String(value),
      x: x + 32,
      y: y + 23,
      size: 11,
      color: COLORS.ink,
      font: "medium",
      maxWidth: 190,
      maxLines: 1,
    },
  );
}

function drawScheduleChips(page, x, y, schedule) {
  const chips = parseScheduleChips(schedule);
  if (!chips.length) {
    page.elements.push({ type: "text", text: UNKNOWN_VALUE_LABEL, x, y: y + 13, size: 8.5, color: COLORS.muted, font: "regular" });
    return;
  }
  let cursor = x;
  for (const chip of chips.slice(0, 3)) {
    const dayWidth = estimateTextWidth(chip.day, 8);
    const timeWidth = estimateTextWidth(chip.time, 8);
    const width = Math.max(45, dayWidth + timeWidth + 24);
    page.elements.push(
      { type: "rect", x: cursor, y, w: width, h: 17, r: 8.5, fill: COLORS.white, stroke: COLORS.purpleSoftBorder },
      { type: "text", text: `${chip.day} ·`, x: cursor + 6, y: y + 12, size: 8, color: COLORS.ink, font: "medium" },
      { type: "text", text: chip.time, x: cursor + 6 + dayWidth + 8, y: y + 12, size: 8, color: COLORS.purple, font: "semibold" },
    );
    cursor += width + 4;
  }
}

function drawPrice(page, x, y, price) {
  const value = normalizeUnknownValue(price);
  const match = value.match(/^(.+?)(\s+(по сертификату|за период))$/i);
  const main = match ? match[1] : value;
  const suffix = match ? match[2].trim() : "";
  page.elements.push({ type: "text", text: main, x, y, size: 12, color: /^бесплат/i.test(main) ? COLORS.green : COLORS.ink, font: "semibold" });
  if (suffix) {
    page.elements.push({
      type: "text",
      text: suffix,
      x: x + estimateTextWidth(main, 12) + 5,
      y,
      size: 8.5,
      color: COLORS.muted,
      font: "regular",
    });
  }
}

function parameterIcon(index) {
  return ["person", "heart", "target", "calendar", "home", "pin", "document", "plus", "group", "x", "arrow"][index] || "plus";
}

function drawSectionTitle(context, title) {
  ensureSpace(context, 44);
  context.page.elements.push({ type: "text", text: title, x: MARGIN_X, y: context.y + 24, size: 22, color: COLORS.ink, font: "bold" });
  context.y += 44;
}

function drawEmptyState(context) {
  ensureSpace(context, 90);
  context.page.elements.push(
    { type: "rect", x: MARGIN_X, y: context.y, w: PAGE_WIDTH - MARGIN_X * 2, h: 78, r: 10, fill: COLORS.white, stroke: COLORS.softLine },
    {
      type: "text",
      text: "Подходящие программы не найдены. Попробуйте расширить место занятий, бюджет или расписание.",
      x: MARGIN_X + 16,
      y: context.y + 30,
      size: 11,
      color: COLORS.muted,
      font: "regular",
      maxWidth: PAGE_WIDTH - MARGIN_X * 2 - 32,
    },
  );
  context.y += 100;
}

function drawProgramCard(context, item) {
  const titleText = item.program || "Название программы уточняется";
  const addressText = normalizeUnknownValue(item.district);
  const titleSize = 14;
  const addressSize = 9.5;
  const titleLines = wrapText(titleText, titleSize, 350, 3);
  const addressLines = wrapText(addressText, addressSize, 330, 2);
  const titleY = 25;
  const addressY = titleY + titleLines.length * titleSize * 1.22 + 3;
  const scheduleIconY = addressY + addressLines.length * addressSize * 1.22 + 5;
  const scheduleLabelY = scheduleIconY + 8;
  const scheduleValueY = scheduleIconY + 16;
  const periodValueY = scheduleIconY + 29;
  const dividerOffsetY = Math.max(scheduleValueY + 28, periodValueY + 18);
  const lowerBlockOffsetY = dividerOffsetY + 11; // 20px in the 1080px-wide Figma frame scaled to this PDF page.
  const cardH = Math.max(145, lowerBlockOffsetY + 36);
  ensureSpace(context, cardH + 16);

  const x = MARGIN_X;
  const y = context.y;
  const w = PAGE_WIDTH - MARGIN_X * 2;
  const periodText = normalizeUnknownValue(item.period);
  const periodUnknown = periodText === UNKNOWN_VALUE_LABEL;
  context.page.elements.push({ type: "rect", x, y, w, h: cardH, r: 12, fill: COLORS.white, stroke: COLORS.softLine });

  context.page.elements.push(
    { type: "text", text: titleText, x: x + 14, y: y + titleY, size: titleSize, color: COLORS.ink, font: "bold", maxWidth: 350, maxLines: 3 },
    { type: "icon", name: "pin", x: x + 14, y: y + addressY - 9, size: 9, color: COLORS.purple },
    { type: "text", text: addressText, x: x + 27, y: y + addressY, size: addressSize, color: COLORS.muted, maxWidth: 330, maxLines: 2 },
    { type: "icon", name: "clock", x: x + 14, y: y + scheduleIconY, size: 8, color: COLORS.purple },
    { type: "text", text: "РАСПИСАНИЕ", x: x + 27, y: y + scheduleLabelY, size: 7.5, color: COLORS.muted, font: "medium" },
    { type: "icon", name: "calendar", x: x + 278, y: y + scheduleIconY, size: 8, color: COLORS.purple },
    { type: "text", text: "ПЕРИОД", x: x + 291, y: y + scheduleLabelY, size: 7.5, color: COLORS.muted, font: "medium" },
    {
      type: "text",
      text: periodText,
      x: x + 278,
      y: y + periodValueY,
      size: 8.5,
      color: periodUnknown ? COLORS.muted : COLORS.ink,
      font: periodUnknown ? "regular" : "semibold",
      maxWidth: 150,
      maxLines: 1,
    },
  );
  drawScheduleChips(context.page, x + 14, y + scheduleValueY, item.schedule);

  const dividerY = y + dividerOffsetY;
  const lowerBlockY = y + lowerBlockOffsetY;
  context.page.elements.push(
    { type: "line", x1: x + 14, y1: dividerY, x2: x + w - 14, y2: dividerY, color: COLORS.softLine, dash: [3, 3] },
  );
  drawPrice(context.page, x + 14, lowerBlockY + 14, item.price);
  drawAvailability(context.page, x + 248, lowerBlockY + 1, item);
  drawEnrollButton(context.page, x + w - 88, lowerBlockY, item.sourceUrl);
  drawQr(context.page, x + w - 72, y + 17, 62, item.sourceUrl);

  context.y += cardH + 14;
}

function drawAvailability(page, x, y, item) {
  const availablePlacesRaw = item.availablePlaces ?? item.availableGroups;
  const availablePlaces = Number(availablePlacesRaw);
  const enrollmentClosed = Number(item.enrollment) === 3;
  if (availablePlacesRaw == null || availablePlacesRaw === "" || !Number.isFinite(availablePlaces)) {
    page.elements.push({ type: "text", text: "Места уточняются", x: x + 30, y: y + 13, size: 8.5, color: COLORS.muted, font: "semibold" });
    return;
  }
  if (enrollmentClosed || availablePlaces <= 0) {
    page.elements.push({ type: "text", text: "Свободных мест нет", x: x + 30, y: y + 13, size: 8.5, color: COLORS.red, font: "semibold" });
    return;
  }

  const label = formatPlaces(availablePlaces);
  const pillWidth = Math.max(42, estimateTextWidth(label, 8) + 12);
  const labelY = y + 16;
  const pillY = labelY - 13;
  page.elements.push(
    { type: "text", text: "Свободно:", x, y: labelY, size: 8.5, color: COLORS.muted, font: "regular" },
    { type: "rect", x: x + 47, y: pillY, w: pillWidth, h: 18, r: 9, fill: COLORS.amberSoft },
    { type: "text", text: label, x: x + 53, y: pillY + 13, size: 8, color: COLORS.amber, font: "semibold" },
  );
}

function drawEnrollButton(page, x, y, sourceUrl) {
  const buttonW = 74;
  const buttonH = 19.3; // 35px in the 1080px-wide Figma frame scaled to this PDF page.
  const fontSize = 8;
  const label = sourceUrl ? "Записаться" : "Ссылка";
  const iconSize = 7;
  const gap = 5;
  const labelW = estimateTextWidth(label, fontSize);
  const contentW = labelW + gap + iconSize;
  const contentX = x + (buttonW - contentW) / 2;
  const labelY = y + buttonH / 2 + fontSize * 0.38;
  const iconY = y + (buttonH - iconSize) / 2;

  page.elements.push(
    { type: "rect", x, y, w: buttonW, h: buttonH, r: buttonH / 2, fill: COLORS.purple },
    { type: "text", text: label, x: contentX, y: labelY, size: fontSize, color: COLORS.white, font: "semibold" },
    { type: "icon", name: "arrow", x: contentX + labelW + gap, y: iconY, size: iconSize, color: COLORS.white },
  );
  if (sourceUrl) {
    page.elements.push({ type: "link", x, y, w: buttonW, h: buttonH, url: sourceUrl });
  }
}

function drawQr(page, x, y, size, sourceUrl) {
  page.elements.push({ type: "rect", x: x - 6, y: y - 6, w: size + 12, h: size + 12, r: 10, fill: COLORS.soft });
  if (!sourceUrl) {
    page.elements.push({ type: "text", text: "QR", x: x + 20, y: y + 32, size: 12, color: COLORS.muted, font: "semibold" });
    return;
  }
  try {
    page.elements.push({ type: "qr", matrix: createQrMatrix(sourceUrl).modules, x, y, size, r: 10, color: COLORS.ink });
  } catch (_) {
    page.elements.push({ type: "text", text: "QR", x: x + 20, y: y + 32, size: 12, color: COLORS.muted, font: "semibold" });
  }
}

function ensureSpace(context, height) {
  if (context.y + height <= PAGE_HEIGHT - 58) return;
  const page = { elements: [] };
  context.pages.push(page);
  context.page = page;
  drawHeader(page, context.date);
  context.y = 78;
  page.elements.push({ type: "text", text: "Рекомендованные кружки", x: MARGIN_X, y: context.y + 20, size: 18, color: COLORS.ink, font: "bold" });
  context.y += 42;
}

function addFooters(pages, date) {
  pages.forEach((page, index) => {
    page.elements.push(
      { type: "text", text: `Рекомендации от ${date}`, x: MARGIN_X, y: PAGE_HEIGHT - 22, size: 8.5, color: COLORS.muted, font: "regular" },
      { type: "text", text: String(index + 1).padStart(2, "0"), x: PAGE_WIDTH - MARGIN_X - 12, y: PAGE_HEIGHT - 22, size: 8.5, color: COLORS.muted, font: "regular" },
    );
  });
}

function drawTextRuns(page, runs, x, y, size, font = "regular") {
  let cursor = x;
  for (const run of runs) {
    page.elements.push({ type: "text", text: run.text, x: cursor, y, size, color: run.color, font });
    cursor += estimateTextWidth(run.text, size);
  }
}

function formatDate(date) {
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatHeroPlace(place) {
  const value = String(place || "").trim();
  if (!value) return "рядом с вами";
  if (/^в\s+/i.test(value) || /^во\s+/i.test(value)) return value;
  if (/^мурманск$/i.test(value)) return "в Мурманске";
  return `в ${value}`;
}

function formatGoals(answers) {
  const values = Array.isArray(answers.goalLabels) ? answers.goalLabels : [];
  if (values.length) return values.join(", ");
  return answers.goalLabel || "не указаны";
}

function formatAvoidances(answers) {
  const values = [...(answers.avoidanceLabels || [])];
  if (answers.avoidanceCustom) values.push(answers.avoidanceCustom);
  return values.length ? values.join(", ") : "не указано";
}

function formatSchedule(values) {
  const labels = {
    weekdays: "будни",
    weekends: "выходные",
    morning: "утром",
    evening: "вечером",
    any: "время не важно",
  };
  const result = (values || []).map((value) => labels[value]).filter(Boolean);
  return result.length ? result.join(", ") : "не указано";
}

function normalizeUnknownValue(value) {
  const text = String(value || "").trim();
  if (!text) return UNKNOWN_VALUE_LABEL;
  const normalized = text.toLowerCase().replace(/ё/g, "е");
  if (
    normalized === "уточняется" ||
    normalized === "адрес уточняется" ||
    normalized === "условия на карточке pfdo" ||
    normalized.includes("уточняется на карточке") ||
    normalized.includes("уточнить на карточке") ||
    normalized.includes("смотрите условия на карточке")
  ) {
    return UNKNOWN_VALUE_LABEL;
  }
  return text;
}

function parseScheduleChips(schedule) {
  const value = String(schedule || "");
  const pattern =
    /(Понедельник|Вторник|Среда|Четверг|Пятница|Суббота|Воскресенье|Пн|Вт|Ср|Чт|Пт|Сб|Вс)\s*[·:,-]?\s*(\d{1,2}:\d{2})/giu;
  const chips = [];
  let match;
  while ((match = pattern.exec(value))) {
    chips.push({
      day: normalizeScheduleDay(match[1]),
      time: match[2],
    });
  }
  if (chips.length) return chips;
  const fallback = value.match(/(\d{1,2}:\d{2})/g) || [];
  return fallback.slice(0, 3).map((time) => ({ day: "", time }));
}

function normalizeScheduleDay(day) {
  const normalized = String(day || "").toLowerCase().replace(/ё/g, "е");
  const labels = {
    понедельник: "Пн",
    вторник: "Вт",
    среда: "Ср",
    четверг: "Чт",
    пятница: "Пт",
    суббота: "Сб",
    воскресенье: "Вс",
    пн: "Пн",
    вт: "Вт",
    ср: "Ср",
    чт: "Чт",
    пт: "Пт",
    сб: "Сб",
    вс: "Вс",
  };
  return labels[normalized] || day;
}

function formatPlaces(count) {
  const value = Number(count);
  if (!Number.isFinite(value)) return "уточнить";
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return `${value} место`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${value} места`;
  return `${value} мест`;
}

function wrapText(text, fontSize, maxWidth, maxLines = Infinity) {
  if (!maxWidth) return [String(text)];
  const maxChars = Math.max(8, Math.floor(maxWidth / (fontSize * 0.54)));
  const words = String(text).split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
      if (lines.length >= maxLines) break;
    } else {
      current = next;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    lines[lines.length - 1] = `${lines[lines.length - 1].replace(/[.,;:!?]*$/, "")}...`;
  }
  return lines;
}

function estimateTextWidth(text, fontSize) {
  return String(text).length * fontSize * 0.62;
}

function collectCodepoints(pages) {
  const points = new Set();
  for (const page of pages) {
    for (const element of page.elements) {
      if (element.type !== "text") continue;
      for (const char of element.text) {
        const point = char.codePointAt(0);
        if (point <= 0xffff) points.add(point);
      }
    }
  }
  return [...points].sort((a, b) => a - b);
}

function buildPdf({ pages, fonts, images, usedCodepoints }) {
  const objects = [];
  const addObject = (content) => {
    objects.push(Buffer.isBuffer(content) ? content : Buffer.from(String(content), "binary"));
    return objects.length;
  };
  const streamObject = (dict, stream) => {
    const body = Buffer.concat([
      Buffer.from(`${dict} /Length ${stream.length} >>\nstream\n`, "binary"),
      stream,
      Buffer.from("\nendstream", "binary"),
    ]);
    return addObject(body);
  };

  const fontIds = new Map();
  for (const font of fonts) {
    const fontFileId = streamObject("<<", font.bytes);
    const cidMap = buildCidToGidMap(usedCodepoints, font.cmap);
    const cidMapId = streamObject("<<", cidMap);
    const toUnicodeId = streamObject("<<", Buffer.from(buildToUnicodeCMap(usedCodepoints), "utf-8"));
    const descriptorId = addObject(
      `<< /Type /FontDescriptor /FontName /${font.baseName} /Flags 4 ` +
        "/FontBBox [-1200 -500 2400 1400] /ItalicAngle 0 /Ascent 1000 /Descent -300 " +
        `/CapHeight 700 /StemV 80 /FontFile2 ${fontFileId} 0 R >>`,
    );
    const widths = buildWidths(usedCodepoints, font.cmap);
    const cidFontId = addObject(
      `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${font.baseName} ` +
        "/CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> " +
        `/FontDescriptor ${descriptorId} 0 R /DW 560 ${widths} /CIDToGIDMap ${cidMapId} 0 R >>`,
    );
    const fontId = addObject(
      `<< /Type /Font /Subtype /Type0 /BaseFont /${font.baseName} /Encoding /Identity-H ` +
        `/DescendantFonts [${cidFontId} 0 R] /ToUnicode ${toUnicodeId} 0 R >>`,
    );
    fontIds.set(font.resource, fontId);
  }
  const fontResources = [...fontIds.entries()].map(([resource, id]) => `/${resource} ${id} 0 R`).join(" ");
  const imageIds = new Map();
  for (const image of images) {
    let maskPart = "";
    if (image.alpha) {
      const maskId = streamObject(
        `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} ` +
          "/ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode",
        zlib.deflateSync(image.alpha),
      );
      maskPart = `/SMask ${maskId} 0 R `;
    }
    const imageId = streamObject(
      `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode ${maskPart}`,
      zlib.deflateSync(image.rgb),
    );
    imageIds.set(image.resource, imageId);
  }
  const imageResources = [...imageIds.entries()].map(([resource, id]) => `/${resource} ${id} 0 R`).join(" ");

  const pageIds = [];
  const contentIds = [];
  const pageAnnotationIds = [];
  for (const page of pages) {
    const content = Buffer.from(buildPageContent(page.elements), "binary");
    contentIds.push(streamObject("<<", content));
    pageAnnotationIds.push(buildPageAnnotations(page.elements, addObject));
    pageIds.push(null);
  }

  const pagesIdPlaceholder = objects.length + pageIds.length + 1;
  for (let i = 0; i < pages.length; i += 1) {
    const annotations = pageAnnotationIds[i].length
      ? `/Annots [${pageAnnotationIds[i].map((id) => `${id} 0 R`).join(" ")}] `
      : "";
    pageIds[i] = addObject(
      `<< /Type /Page /Parent ${pagesIdPlaceholder} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
        `${annotations}/Resources << /Font << ${fontResources} >> /XObject << ${imageResources} >> >> /Contents ${contentIds[i]} 0 R >>`,
    );
  }

  const pagesId = addObject(
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`,
  );
  const catalogId = addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  return serializePdf(objects, catalogId);
}

function buildPageAnnotations(elements, addObject) {
  return elements
    .filter((element) => element.type === "link" && element.url)
    .map((element) => {
      const rect = [
        element.x,
        PAGE_HEIGHT - element.y - element.h,
        element.x + element.w,
        PAGE_HEIGHT - element.y,
      ].map(num).join(" ");
      return addObject(
        `<< /Type /Annot /Subtype /Link /Rect [${rect}] /Border [0 0 0] ` +
          `/A << /S /URI /URI ${pdfLiteralString(element.url)} >> >>`,
      );
    });
}

function buildPageContent(elements) {
  const commands = [];
  for (const element of elements) {
    if (element.type === "text") drawText(commands, element);
    if (element.type === "rect") drawRect(commands, element);
    if (element.type === "line") drawLine(commands, element);
    if (element.type === "qr") drawQrModules(commands, element);
    if (element.type === "icon") drawIcon(commands, element);
    if (element.type === "image") drawImage(commands, element);
    if (element.type === "logo") drawLogo(commands, element);
  }
  return commands.join("\n");
}

function drawImage(commands, element) {
  const resource = element.image === "logo" ? "ImLogo" : element.image;
  commands.push("q");
  commands.push(
    `${num(element.w)} 0 0 ${num(element.h)} ${num(element.x)} ${num(PAGE_HEIGHT - element.y - element.h)} cm /${resource} Do`,
  );
  commands.push("Q");
}

function drawLogo(commands, element) {
  const x = element.x;
  const y = element.y;
  const w = element.w;
  const h = element.h;
  commands.push("q");
  commands.push(`${rgb(COLORS.purple)} rg`);
  polygonPath(commands, [
    [x + w * 0.12, yPdf(y + h * 0.45)],
    [x + w * 0.50, yPdf(y + h * 0.14)],
    [x + w * 0.88, yPdf(y + h * 0.45)],
    [x + w * 0.50, yPdf(y + h * 0.66)],
  ]);
  commands.push("f");
  commands.push(`${rgb("#5ED4FF")} RG`);
  commands.push("1.6 w");
  commands.push(`${num(x + w * 0.25)} ${num(yPdf(y + h * 0.60))} m ${num(x + w * 0.25)} ${num(yPdf(y + h * 0.78))} ${num(x + w * 0.50)} ${num(yPdf(y + h * 0.88))} ${num(x + w * 0.75)} ${num(yPdf(y + h * 0.78))} c S`);
  commands.push(`${rgb("#5ED4FF")} rg`);
  circlePath(commands, x + w * 0.06, yPdf(y + h * 0.78), 1.5);
  commands.push("f");
  commands.push(`${rgb(COLORS.purple)} rg`);
  drawSpark(commands, x + w * 0.92, y + h * 0.10, 3);
  commands.push(`${rgb("#5ED4FF")} rg`);
  drawSpark(commands, x + w * 0.02, y + h * 0.64, 2.3);
  commands.push("Q");
}

function drawIcon(commands, element) {
  const x = element.x;
  const y = element.y;
  const s = element.size;
  const c = element.color || COLORS.purple;
  commands.push("q");
  commands.push(`${rgb(c)} RG`);
  commands.push(`${rgb(c)} rg`);
  commands.push("1 w");
  const cx = x + s / 2;
  const cy = y + s / 2;

  if (element.name === "person") {
    circlePath(commands, cx, yPdf(y + s * 0.32), s * 0.22);
    commands.push("S");
    commands.push(`${num(x + s * 0.20)} ${num(yPdf(y + s * 0.88))} m`);
    commands.push(`${num(x + s * 0.25)} ${num(yPdf(y + s * 0.62))} ${num(x + s * 0.75)} ${num(yPdf(y + s * 0.62))} ${num(x + s * 0.80)} ${num(yPdf(y + s * 0.88))} c S`);
  } else if (element.name === "heart") {
    commands.push(`${num(cx)} ${num(yPdf(y + s * 0.82))} m`);
    commands.push(`${num(x + s * 0.08)} ${num(yPdf(y + s * 0.48))} ${num(x + s * 0.15)} ${num(yPdf(y + s * 0.12))} ${num(cx)} ${num(yPdf(y + s * 0.28))} c`);
    commands.push(`${num(x + s * 0.85)} ${num(yPdf(y + s * 0.12))} ${num(x + s * 0.92)} ${num(yPdf(y + s * 0.48))} ${num(cx)} ${num(yPdf(y + s * 0.82))} c S`);
  } else if (element.name === "target") {
    circlePath(commands, cx, yPdf(cy), s * 0.42);
    commands.push("S");
    circlePath(commands, cx, yPdf(cy), s * 0.18);
    commands.push("S");
    circlePath(commands, cx, yPdf(cy), s * 0.04);
    commands.push("f");
  } else if (element.name === "calendar") {
    roundedRectPath(commands, x + s * 0.12, yPdf(y + s * 0.88), s * 0.76, s * 0.68, 1.5);
    commands.push("S");
    commands.push(`${num(x + s * 0.12)} ${num(yPdf(y + s * 0.38))} m ${num(x + s * 0.88)} ${num(yPdf(y + s * 0.38))} l S`);
    commands.push(`${num(x + s * 0.32)} ${num(yPdf(y + s * 0.08))} m ${num(x + s * 0.32)} ${num(yPdf(y + s * 0.22))} l S`);
    commands.push(`${num(x + s * 0.68)} ${num(yPdf(y + s * 0.08))} m ${num(x + s * 0.68)} ${num(yPdf(y + s * 0.22))} l S`);
  } else if (element.name === "home") {
    polygonPath(commands, [[cx, yPdf(y + s * 0.10)], [x + s * 0.88, yPdf(y + s * 0.46)], [x + s * 0.78, yPdf(y + s * 0.46)], [x + s * 0.78, yPdf(y + s * 0.88)], [x + s * 0.24, yPdf(y + s * 0.88)], [x + s * 0.24, yPdf(y + s * 0.46)], [x + s * 0.12, yPdf(y + s * 0.46)]]);
    commands.push("S");
  } else if (element.name === "pin") {
    circlePath(commands, cx, yPdf(y + s * 0.38), s * 0.16);
    commands.push("S");
    commands.push(`${num(cx)} ${num(yPdf(y + s * 0.95))} m`);
    commands.push(`${num(x + s * 0.17)} ${num(yPdf(y + s * 0.48))} ${num(x + s * 0.25)} ${num(yPdf(y + s * 0.10))} ${num(cx)} ${num(yPdf(y + s * 0.10))} c`);
    commands.push(`${num(x + s * 0.75)} ${num(yPdf(y + s * 0.10))} ${num(x + s * 0.83)} ${num(yPdf(y + s * 0.48))} ${num(cx)} ${num(yPdf(y + s * 0.95))} c S`);
  } else if (element.name === "document") {
    roundedRectPath(commands, x + s * 0.22, yPdf(y + s * 0.90), s * 0.56, s * 0.72, 1.2);
    commands.push("S");
    commands.push(`${num(x + s * 0.34)} ${num(yPdf(y + s * 0.48))} m ${num(x + s * 0.66)} ${num(yPdf(y + s * 0.48))} l S`);
    commands.push(`${num(x + s * 0.34)} ${num(yPdf(y + s * 0.62))} m ${num(x + s * 0.62)} ${num(yPdf(y + s * 0.62))} l S`);
  } else if (element.name === "clock") {
    circlePath(commands, cx, yPdf(cy), s * 0.42);
    commands.push("S");
    commands.push(`${num(cx)} ${num(yPdf(cy))} m ${num(cx)} ${num(yPdf(y + s * 0.27))} l ${num(x + s * 0.67)} ${num(yPdf(y + s * 0.62))} l S`);
  } else if (element.name === "arrow") {
    commands.push(`${num(x + s * 0.20)} ${num(yPdf(y + s * 0.80))} m ${num(x + s * 0.80)} ${num(yPdf(y + s * 0.20))} l S`);
    commands.push(`${num(x + s * 0.45)} ${num(yPdf(y + s * 0.20))} m ${num(x + s * 0.80)} ${num(yPdf(y + s * 0.20))} l ${num(x + s * 0.80)} ${num(yPdf(y + s * 0.55))} l S`);
  } else if (element.name === "x") {
    commands.push(`${num(x + s * 0.25)} ${num(yPdf(y + s * 0.25))} m ${num(x + s * 0.75)} ${num(yPdf(y + s * 0.75))} l S`);
    commands.push(`${num(x + s * 0.75)} ${num(yPdf(y + s * 0.25))} m ${num(x + s * 0.25)} ${num(yPdf(y + s * 0.75))} l S`);
  } else {
    commands.push(`${num(cx)} ${num(yPdf(y + s * 0.20))} m ${num(cx)} ${num(yPdf(y + s * 0.80))} l S`);
    commands.push(`${num(x + s * 0.20)} ${num(yPdf(cy))} m ${num(x + s * 0.80)} ${num(yPdf(cy))} l S`);
  }
  commands.push("Q");
}

function drawText(commands, element) {
  const lines = wrapText(element.text, element.size, element.maxWidth, element.maxLines);
  lines.forEach((line, index) => {
    commands.push("BT");
    commands.push(`${rgb(element.color || COLORS.ink)} rg`);
    commands.push(`/${fontResource(element.font)} ${num(element.size)} Tf`);
    commands.push(`1 0 0 1 ${num(element.x)} ${num(PAGE_HEIGHT - element.y - index * element.size * 1.22)} Tm`);
    commands.push(`${hexString(line)} Tj`);
    commands.push("ET");
  });
}

function fontResource(font) {
  const map = {
    regular: "F1",
    medium: "F2",
    semibold: "F3",
    bold: "F4",
  };
  return map[font] || "F1";
}

function drawRect(commands, element) {
  commands.push("q");
  if (element.fill) commands.push(`${rgb(element.fill)} rg`);
  if (element.stroke) {
    commands.push(`${rgb(element.stroke)} RG`);
    commands.push(`${num(element.strokeWidth || 0.6)} w`);
  }
  roundedRectPath(commands, element.x, PAGE_HEIGHT - element.y - element.h, element.w, element.h, element.r || 0);
  commands.push(element.fill && element.stroke ? "B" : element.fill ? "f" : "S");
  commands.push("Q");
}

function drawLine(commands, element) {
  commands.push("q");
  commands.push(`${rgb(element.color || COLORS.softLine)} RG`);
  commands.push(`${num(element.width || 0.6)} w`);
  if (element.dash) {
    commands.push(`[${element.dash.map(num).join(" ")}] 0 d`);
  }
  commands.push(`${num(element.x1)} ${num(PAGE_HEIGHT - element.y1)} m ${num(element.x2)} ${num(PAGE_HEIGHT - element.y2)} l S`);
  commands.push("Q");
}

function drawQrModules(commands, element) {
  const quiet = 4;
  const matrix = element.matrix || [];
  const moduleCount = matrix.length + quiet * 2;
  const moduleSize = element.size / moduleCount;
  commands.push("q");
  commands.push(`${rgb(COLORS.white)} rg`);
  roundedRectPath(commands, element.x, PAGE_HEIGHT - element.y - element.size, element.size, element.size, element.r || 0);
  commands.push("f");
  commands.push(`${rgb(element.color || COLORS.ink)} rg`);
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix[y].length; x += 1) {
      if (!matrix[y][x]) continue;
      const rx = element.x + (x + quiet) * moduleSize;
      const ry = PAGE_HEIGHT - element.y - (y + quiet + 1) * moduleSize;
      commands.push(`${num(rx)} ${num(ry)} ${num(moduleSize)} ${num(moduleSize)} re f`);
    }
  }
  commands.push("Q");
}

function roundedRectPath(commands, x, y, w, h, r) {
  if (!r) {
    commands.push(`${num(x)} ${num(y)} ${num(w)} ${num(h)} re`);
    return;
  }
  const c = r * 0.5522847498;
  commands.push(`${num(x + r)} ${num(y)} m`);
  commands.push(`${num(x + w - r)} ${num(y)} l`);
  commands.push(`${num(x + w - r + c)} ${num(y)} ${num(x + w)} ${num(y + r - c)} ${num(x + w)} ${num(y + r)} c`);
  commands.push(`${num(x + w)} ${num(y + h - r)} l`);
  commands.push(`${num(x + w)} ${num(y + h - r + c)} ${num(x + w - r + c)} ${num(y + h)} ${num(x + w - r)} ${num(y + h)} c`);
  commands.push(`${num(x + r)} ${num(y + h)} l`);
  commands.push(`${num(x + r - c)} ${num(y + h)} ${num(x)} ${num(y + h - r + c)} ${num(x)} ${num(y + h - r)} c`);
  commands.push(`${num(x)} ${num(y + r)} l`);
  commands.push(`${num(x)} ${num(y + r - c)} ${num(x + r - c)} ${num(y)} ${num(x + r)} ${num(y)} c`);
  commands.push("h");
}

function circlePath(commands, cx, cy, r) {
  const c = r * 0.5522847498;
  commands.push(`${num(cx + r)} ${num(cy)} m`);
  commands.push(`${num(cx + r)} ${num(cy + c)} ${num(cx + c)} ${num(cy + r)} ${num(cx)} ${num(cy + r)} c`);
  commands.push(`${num(cx - c)} ${num(cy + r)} ${num(cx - r)} ${num(cy + c)} ${num(cx - r)} ${num(cy)} c`);
  commands.push(`${num(cx - r)} ${num(cy - c)} ${num(cx - c)} ${num(cy - r)} ${num(cx)} ${num(cy - r)} c`);
  commands.push(`${num(cx + c)} ${num(cy - r)} ${num(cx + r)} ${num(cy - c)} ${num(cx + r)} ${num(cy)} c`);
  commands.push("h");
}

function polygonPath(commands, points) {
  if (!points.length) return;
  commands.push(`${num(points[0][0])} ${num(points[0][1])} m`);
  for (const [x, y] of points.slice(1)) {
    commands.push(`${num(x)} ${num(y)} l`);
  }
  commands.push("h");
}

function drawSpark(commands, x, y, r) {
  const cx = x;
  const cy = yPdf(y);
  commands.push(`${num(cx)} ${num(cy + r)} m ${num(cx)} ${num(cy - r)} l S`);
  commands.push(`${num(cx - r)} ${num(cy)} m ${num(cx + r)} ${num(cy)} l S`);
}

function yPdf(y) {
  return PAGE_HEIGHT - y;
}

function rgb(hex) {
  const normalized = String(hex).replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  return `${num(r)} ${num(g)} ${num(b)}`;
}

function num(value) {
  return Number(value).toFixed(3).replace(/\.?0+$/, "");
}

function hexString(text) {
  const bytes = [];
  for (const char of String(text)) {
    const point = char.codePointAt(0);
    if (point > 0xffff) continue;
    bytes.push((point >> 8) & 0xff, point & 0xff);
  }
  return `<${Buffer.from(bytes).toString("hex").toUpperCase()}>`;
}

function pdfLiteralString(value) {
  return `(${String(value).replace(/([\\()])/g, "\\$1")})`;
}

function serializePdf(objects, catalogId) {
  const parts = [Buffer.from("%PDF-1.7\n%\xFF\xFF\xFF\xFF\n", "binary")];
  const offsets = [0];
  let offset = parts[0].length;

  objects.forEach((object, index) => {
    offsets.push(offset);
    const prefix = Buffer.from(`${index + 1} 0 obj\n`, "binary");
    const suffix = Buffer.from("\nendobj\n", "binary");
    parts.push(prefix, object, suffix);
    offset += prefix.length + object.length + suffix.length;
  });

  const xrefOffset = offset;
  const xref = [
    "xref",
    `0 ${objects.length + 1}`,
    "0000000000 65535 f ",
    ...offsets.slice(1).map((value) => `${String(value).padStart(10, "0")} 00000 n `),
    "trailer",
    `<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>`,
    "startxref",
    String(xrefOffset),
    "%%EOF",
    "",
  ].join("\n");
  parts.push(Buffer.from(xref, "binary"));
  return Buffer.concat(parts);
}

function buildCidToGidMap(codepoints, cmap) {
  const max = Math.max(0, ...codepoints);
  const map = Buffer.alloc((max + 1) * 2);
  for (const point of codepoints) {
    const gid = cmap.glyphIdFor(point);
    map.writeUInt16BE(gid, point * 2);
  }
  return map;
}

function buildWidths(codepoints, cmap) {
  const parts = [];
  let index = 0;
  while (index < codepoints.length) {
    const start = codepoints[index];
    const widths = [cmap.widthFor(start)];
    let current = start;
    index += 1;
    while (index < codepoints.length && codepoints[index] === current + 1) {
      current = codepoints[index];
      widths.push(cmap.widthFor(current));
      index += 1;
    }
    parts.push(`${start} [${widths.join(" ")}]`);
  }
  return parts.length ? `/W [${parts.join(" ")}]` : "";
}

function buildToUnicodeCMap(codepoints) {
  const chunks = [];
  for (let i = 0; i < codepoints.length; i += 100) {
    const slice = codepoints.slice(i, i + 100);
    chunks.push(`${slice.length} beginbfchar`);
    for (const point of slice) {
      const hex = point.toString(16).toUpperCase().padStart(4, "0");
      chunks.push(`<${hex}> <${hex}>`);
    }
    chunks.push("endbfchar");
  }

  return [
    "/CIDInit /ProcSet findresource begin",
    "12 dict begin",
    "begincmap",
    "/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def",
    "/CMapName /Adobe-Identity-UCS def",
    "/CMapType 2 def",
    "1 begincodespacerange",
    "<0000> <FFFF>",
    "endcodespacerange",
    ...chunks,
    "endcmap",
    "CMapName currentdict /CMap defineresource pop",
    "end",
    "end",
  ].join("\n");
}

function decodePngImage(bytes) {
  const signature = "89504e470d0a1a0a";
  if (bytes.subarray(0, 8).toString("hex") !== signature) {
    throw new Error("Unsupported logo image: expected PNG");
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idatChunks = [];

  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const data = bytes.subarray(dataStart, dataEnd);

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data.readUInt8(8);
      colorType = data.readUInt8(9);
      interlace = data.readUInt8(12);
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }

    offset = dataEnd + 4;
  }

  if (bitDepth !== 8 || ![2, 6].includes(colorType) || interlace !== 0) {
    throw new Error("Unsupported logo PNG format");
  }

  const channels = colorType === 6 ? 4 : 3;
  const rowLength = width * channels;
  const inflated = zlib.inflateSync(Buffer.concat(idatChunks));
  const raw = Buffer.alloc(width * height * channels);
  let inputOffset = 0;

  for (let rowIndex = 0; rowIndex < height; rowIndex += 1) {
    const filter = inflated[inputOffset];
    inputOffset += 1;
    const rowStart = rowIndex * rowLength;
    const previousStart = rowStart - rowLength;

    for (let i = 0; i < rowLength; i += 1) {
      const value = inflated[inputOffset + i];
      const left = i >= channels ? raw[rowStart + i - channels] : 0;
      const up = rowIndex > 0 ? raw[previousStart + i] : 0;
      const upLeft = rowIndex > 0 && i >= channels ? raw[previousStart + i - channels] : 0;
      raw[rowStart + i] = unfilterPngByte(filter, value, left, up, upLeft);
    }
    inputOffset += rowLength;
  }

  const rgb = Buffer.alloc(width * height * 3);
  const alpha = colorType === 6 ? Buffer.alloc(width * height) : null;
  let alphaOpaque = true;
  for (let source = 0, target = 0, alphaIndex = 0; source < raw.length; source += channels, target += 3, alphaIndex += 1) {
    rgb[target] = raw[source];
    rgb[target + 1] = raw[source + 1];
    rgb[target + 2] = raw[source + 2];
    if (alpha) {
      alpha[alphaIndex] = raw[source + 3];
      if (raw[source + 3] !== 255) alphaOpaque = false;
    }
  }

  return {
    width,
    height,
    rgb,
    alpha: alpha && !alphaOpaque ? alpha : null,
  };
}

function unfilterPngByte(filter, value, left, up, upLeft) {
  if (filter === 0) return value;
  if (filter === 1) return (value + left) & 0xff;
  if (filter === 2) return (value + up) & 0xff;
  if (filter === 3) return (value + Math.floor((left + up) / 2)) & 0xff;
  if (filter === 4) return (value + paethPredictor(left, up, upLeft)) & 0xff;
  throw new Error(`Unsupported PNG filter type ${filter}`);
}

function paethPredictor(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);
  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) return left;
  if (upDistance <= upLeftDistance) return up;
  return upLeft;
}

function parseCmap(font) {
  const tables = readTableDirectory(font);
  const cmapTable = tables.cmap;
  if (!cmapTable) throw new Error("Font does not contain a cmap table");
  const metrics = parseFontMetrics(font, tables);

  const cmapOffset = cmapTable.offset;
  const count = font.readUInt16BE(cmapOffset + 2);
  let selected = null;
  for (let i = 0; i < count; i += 1) {
    const record = cmapOffset + 4 + i * 8;
    const platformId = font.readUInt16BE(record);
    const encodingId = font.readUInt16BE(record + 2);
    const subtableOffset = cmapOffset + font.readUInt32BE(record + 4);
    const format = font.readUInt16BE(subtableOffset);
    if (format === 4 && platformId === 3 && (encodingId === 1 || encodingId === 0)) {
      selected = subtableOffset;
      break;
    }
    if (format === 4 && !selected) selected = subtableOffset;
  }
  if (!selected) throw new Error("Font does not contain a BMP cmap format 4 subtable");
  const cmap = parseCmapFormat4(font, selected);
  return {
    glyphIdFor: cmap.glyphIdFor,
    widthFor(codepoint) {
      const glyphId = cmap.glyphIdFor(codepoint);
      return metrics.widthFor(glyphId);
    },
  };
}

function readTableDirectory(font) {
  const numTables = font.readUInt16BE(4);
  const tables = {};
  for (let i = 0; i < numTables; i += 1) {
    const offset = 12 + i * 16;
    const tag = font.toString("ascii", offset, offset + 4);
    tables[tag] = {
      offset: font.readUInt32BE(offset + 8),
      length: font.readUInt32BE(offset + 12),
    };
  }
  return tables;
}

function parseFontMetrics(font, tables) {
  const head = tables.head;
  const hhea = tables.hhea;
  const hmtx = tables.hmtx;
  const maxp = tables.maxp;
  if (!head || !hhea || !hmtx || !maxp) {
    return { widthFor: () => 560 };
  }
  const unitsPerEm = font.readUInt16BE(head.offset + 18) || 1000;
  const numberOfHMetrics = font.readUInt16BE(hhea.offset + 34);
  const numGlyphs = font.readUInt16BE(maxp.offset + 4);
  const lastMetricOffset = hmtx.offset + Math.max(0, numberOfHMetrics - 1) * 4;
  const lastAdvance = numberOfHMetrics ? font.readUInt16BE(lastMetricOffset) : 560;
  const widths = new Array(numGlyphs);

  for (let glyphId = 0; glyphId < numGlyphs; glyphId += 1) {
    const advance = glyphId < numberOfHMetrics
      ? font.readUInt16BE(hmtx.offset + glyphId * 4)
      : lastAdvance;
    widths[glyphId] = Math.max(0, Math.round((advance / unitsPerEm) * 1000));
  }

  return {
    widthFor(glyphId) {
      return widths[glyphId] || 560;
    },
  };
}

function parseCmapFormat4(font, offset) {
  const segCount = font.readUInt16BE(offset + 6) / 2;
  const endCodeOffset = offset + 14;
  const startCodeOffset = endCodeOffset + segCount * 2 + 2;
  const idDeltaOffset = startCodeOffset + segCount * 2;
  const idRangeOffsetOffset = idDeltaOffset + segCount * 2;
  const segments = [];

  for (let i = 0; i < segCount; i += 1) {
    segments.push({
      end: font.readUInt16BE(endCodeOffset + i * 2),
      start: font.readUInt16BE(startCodeOffset + i * 2),
      delta: font.readInt16BE(idDeltaOffset + i * 2),
      rangeOffset: font.readUInt16BE(idRangeOffsetOffset + i * 2),
      rangeOffsetAddress: idRangeOffsetOffset + i * 2,
    });
  }

  return {
    glyphIdFor(codepoint) {
      for (const segment of segments) {
        if (codepoint < segment.start || codepoint > segment.end) continue;
        if (segment.rangeOffset === 0) {
          return (codepoint + segment.delta) & 0xffff;
        }
        const glyphIndexAddress = segment.rangeOffsetAddress + segment.rangeOffset + (codepoint - segment.start) * 2;
        if (glyphIndexAddress + 2 > font.length) return 0;
        const glyphIndex = font.readUInt16BE(glyphIndexAddress);
        if (glyphIndex === 0) return 0;
        return (glyphIndex + segment.delta) & 0xffff;
      }
      return 0;
    },
  };
}

module.exports = {
  createSelectionPdf,
};
