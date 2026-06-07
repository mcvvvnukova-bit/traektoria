function extractTopicsFromText({ text, documentPath, documentFormat }) {
  const warnings = [];
  if (!text || !text.trim()) {
    return {
      topics: [],
      warnings: ["No readable text content extracted from document."],
    };
  }

  const normalizedText = normalizeText(text);
  const physicalLines = normalizedText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const lines = buildLogicalLines(normalizedText);
  const topics = [];

  pushUniqueTopics(topics, extractThemeHeadings(lines));
  pushUniqueTopics(topics, extractTabularTopics(physicalLines));
  pushUniqueTopics(topics, extractHourHeadings(lines));
  pushUniqueTopics(topics, extractNumberedTopics(lines));
  pushUniqueTopics(topics, extractYearProgramTopics(lines));

  if (topics.length === 0) {
    warnings.push(`No topic-like patterns found in ${documentFormat} file ${documentPath}.`);
  }

  return {
    topics,
    warnings,
  };
}

function normalizeText(value) {
  return value
    .replaceAll("\ufeff", "")
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .replaceAll("\f", "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/[–—]/g, "-");
}

function buildLogicalLines(text) {
  const physicalLines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const logicalLines = [];
  for (let index = 0; index < physicalLines.length; index += 1) {
    let current = physicalLines[index];

    while (index + 1 < physicalLines.length && shouldAppendLine(current, physicalLines[index + 1])) {
      current = `${current} ${physicalLines[index + 1]}`.replace(/\s+/g, " ").trim();
      index += 1;
    }

    logicalLines.push(current);
  }

  return logicalLines;
}

function shouldAppendLine(current, next) {
  if (!next) return false;
  if (looksLikeSectionBoundary(next)) return false;
  if (/^\d+(?:\.\d+)+/.test(next)) return false;
  if (/^Тема\s+\d+/i.test(next)) return false;
  if (next.length <= 3) return false;

  if (/^\d+(?:\.\d+)+\s+/.test(current) && current.length < 80) {
    return true;
  }

  if (/^\d+\s+/.test(current) && current.length < 60) {
    return true;
  }

  if (!/[.!?:)]$/.test(current) && next[0] && next[0] === next[0].toLowerCase()) {
    return true;
  }

  return false;
}

function looksLikeSectionBoundary(line) {
  return (
    /^Модуль\s+\d+/i.test(line) ||
    /^Первый год обучения/i.test(line) ||
    /^Второй год обучения/i.test(line) ||
    /^Третий год обучения/i.test(line) ||
    /^IV?\./.test(line) ||
    /^Учебно/i.test(line) ||
    /^Содержание/i.test(line) ||
    /^Перечень/i.test(line)
  );
}

function extractThemeHeadings(lines) {
  const topics = [];

  for (const line of lines) {
    const match = line.match(/^Тема\s+\d+[.:]?\s*(.+)$/i);
    if (!match) continue;

    const cleaned = cleanupTopic(match[1]);
    if (!cleaned) continue;
    topics.push({
      topic_raw: cleaned,
      source_section: "Тема N",
      source_excerpt: line,
    });
  }

  return topics;
}

function extractNumberedTopics(lines) {
  const topics = [];

  for (const line of lines) {
    const decimalMatch = line.match(/^(\d+(?:\.\d+)+)\s+(.+)$/);
    if (decimalMatch) {
      const cleaned = cleanupTopic(decimalMatch[2]);
      if (cleaned) {
        topics.push({
          topic_raw: cleaned,
          source_section: "Нумерованный план",
          source_excerpt: line,
        });
      }
    }
  }

  return topics;
}

function extractTabularTopics(physicalLines) {
  const topics = [];

  for (let index = 0; index < physicalLines.length; index += 1) {
    let line = physicalLines[index];
    if (!/^\d+(?:\.\d+)?\s+/.test(line)) continue;

    let nextLine = physicalLines[index + 1] || "";
    if (
      nextLine &&
      !/^\d+(?:\.\d+)?\s+/.test(nextLine) &&
      !looksLikeSectionBoundary(nextLine) &&
      line.length < 80
    ) {
      line = `${line} ${nextLine}`.replace(/\s+/g, " ").trim();
    }

    const tableMatch = line.match(/^\d+(?:\.\d+)?\s+(.+?)\s+\d+\s+\d+\s+\d+(?:\s+.*)?$/);
    if (!tableMatch) continue;

    const cleaned = cleanupTopic(tableMatch[1]);
    if (!cleaned) continue;
    topics.push({
      topic_raw: cleaned,
      source_section: "Табличный учебный план",
      source_excerpt: line,
    });
  }

  return topics;
}

function extractHourHeadings(lines) {
  const topics = [];

  for (const line of lines) {
    const match = line.match(/^(.+?)\s*\((\d+)\s*ч(?:ас|аса|асов)?\.?\)\s*$/i);
    if (!match) continue;

    const cleaned = cleanupTopic(match[1]);
    if (!cleaned) continue;
    topics.push({
      topic_raw: cleaned,
      source_section: "Заголовок с часами",
      source_excerpt: line,
    });
  }

  return topics;
}

function extractYearProgramTopics(lines) {
  const topics = [];
  let currentSection = "";
  let insideYearBlock = false;

  for (const line of lines) {
    if (/^Первый год обучения/i.test(line)) {
      currentSection = "Первый год обучения";
      insideYearBlock = true;
      continue;
    }
    if (/^Второй год обучения/i.test(line)) {
      currentSection = "Второй год обучения";
      insideYearBlock = true;
      continue;
    }
    if (/^Третий год обучения/i.test(line)) {
      currentSection = "Третий год обучения";
      insideYearBlock = true;
      continue;
    }
    if (/^МЕТОДИЧЕСКОЕ ОБЕСПЕЧЕНИЕ/i.test(line)) {
      insideYearBlock = false;
      continue;
    }
    if (!insideYearBlock) continue;
    if (shouldSkipYearBlockLine(line)) continue;

    const cleaned = cleanupTopic(line);
    if (!cleaned) continue;

    topics.push({
      topic_raw: cleaned,
      source_section: currentSection,
      source_excerpt: line,
    });
  }

  return topics;
}

function shouldSkipYearBlockLine(line) {
  return (
    /^(ожидаемые результаты|личностные результаты|метапредметные результаты|предметные результаты)/i.test(line) ||
    /^(текущий контроль|итоговый контроль|итоговой аттестацией|общий учебно-тематический план|тема теория практика всего|итого:)/i.test(line) ||
    /^- /.test(line)
  );
}

function cleanupTopic(rawTopic) {
  let value = String(rawTopic || "").trim();
  if (!value) return "";

  value = value
    .replace(/\s+/g, " ")
    .replace(/\b\d+\s+\d+\s+\d+\b.*$/u, "")
    .replace(/\b(Задания на платформе|Проект|Практическое задание|Проведение опроса|Итоговая аттестация)\b.*$/iu, "")
    .replace(/\s*[-–—]?\s*(Теория|Практика)\s*\(\d+\s*час[а-я]*\)\s*:?/giu, "")
    .replace(/\s*\d+\s*час[а-я.]*\s*$/iu, "")
    .replace(/["«»]/g, '"')
    .trim();

  if (!value) return "";
  if (value.length < 3) return "";
  if (value.length > 180) return "";
  if (/^(№|N|п\/п)$/i.test(value)) return "";
  if (/^[\d\s.,:-]+$/.test(value)) return "";
  if (/^(всего|теория|практика|форма контроля|день аудиторных занятий)$/i.test(value)) return "";
  if (/^№\s*\d+/i.test(value)) return "";
  if (isLegalBoilerplate(value)) return "";
  if (isScheduleLine(value)) return "";
  if ((value.match(/;/g) || []).length >= 2) return "";

  return value;
}

function isLegalBoilerplate(value) {
  return /(федеральн(ый|ого)\s+закон|приказ|постановление|санпин|распоряжение|устав|локальные акты|методические рекомендации)/i.test(
    value,
  );
}

function isScheduleLine(value) {
  return /(январь|февраль|март|апрель|май|июнь|июль|август|сентябрь|октябрь|ноябрь|декабрь)/i.test(
    value,
  );
}

function pushUniqueTopics(target, topics) {
  const seen = new Set(target.map((item) => item.topic_raw.toLowerCase()));
  for (const topic of topics) {
    const key = topic.topic_raw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    target.push(topic);
  }
}

module.exports = {
  extractTopicsFromText,
};
