const MONTH_PATTERN =
  "(?:январь|февраль|март|апрель|май|июнь|июль|август|сентябрь|октябрь|ноябрь|декабрь)";
const MONTH_RE = new RegExp(`^(?:${MONTH_PATTERN})(?:\\s+(?:${MONTH_PATTERN}))*\\s+`, "iu");
const BASIC_STUDY_PLAN_DATE_MONTH_RE =
  /^(?:\d{1,2}\s+(?:и\s+)?|\d{1,2}\s*\(\d{1,2}\)\s+)(?:январ[ья]|феврал[ья]|март[а]?|апрел[ья]|ма[йя]|июн[ья]|юн[ья]|июл[ья]|юл[ья]|август[а]?|сентябр[ья]|октябр[ья]|ноябр[ья]|декабр[ья])(?=\s|$|[.,)])/iu;
const SECTION_RE =
  /(учебн[оы]\s*[- ]?\s*тематическ|календарн[оы]\s*[- ]?\s*тематическ|календарн(?:ый|ого)\s+учебн(?:ый|ого)\s+график|годовой\s+учебн[оы]\s*[- ]?\s*тренировочн|тематическ[ийого]+\s+план|название\s+(?:раздела|темы).*количество\s+час|тема\s+занятия|виды\s+подготовки|теория\s+практика\s+всего|тема\s+теория\s+практика\s+всего)/iu;
const HARD_STOP_RE =
  /^(содержание\s+программы|методическ|материально|список\s+литературы|литература|условия\s+реализации|оценочн|планируемые\s+результаты|контрольн(?:ые|ых)\s+норматив|приложение)/iu;
const TOTAL_RE = /^(итого(?::|\s|$)|всего(?::|\s|$)|всего\s+час|общее\s+количество)/iu;
const PAGE_NUMBER_RE = /^\d{1,3}$/u;

function extractCalendarTopicsFromText({ text, documentPath, documentFormat }) {
  const warnings = [];
  if (!text || !text.trim()) {
    return {
      topics: [],
      warnings: ["No readable text content extracted from document."],
    };
  }

  const lines = normalizeText(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const rawLines = normalizeTextPreservingSpaces(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const topics = [];
  const seen = new Set();
  const programSubjectVolumeRows = extractProgramSubjectVolumeRows(lines);
  const courseYearStudyPlanRows = extractCourseYearStudyPlanRows(lines);
  const numberedScheduleRows = extractNumberedScheduleRows(lines);
  const calendarStudyScheduleRows = extractCalendarStudyScheduleRows(lines);
  const simpleCalendarThematicPlanningRows = extractSimpleCalendarThematicPlanningRows(lines);
  const lessonNumberStudyPlanRows = extractLessonNumberStudyPlanRows(lines);
  const appendixCalendarPlanningRows = extractAppendixCalendarPlanningRows(lines);
  const studyPlanContentHourRows = extractStudyPlanContentHourRows(lines);
  const moduleStudyPlanContentRows = extractModuleStudyPlanContentRows(lines);
  const sectionContentTopicRows = extractSectionContentTopicRows(lines);
  const theoryPracticeTotalStudyPlanRows = extractTheoryPracticeTotalStudyPlanRows(lines);
  const slashHourThematicPlanRows = extractSlashHourThematicPlanRows(lines);
  const lessonThematicPlanningRows = extractLessonThematicPlanningRows(lines);
  const multilineThematicPlanRows = extractMultilineThematicPlanRows(lines);
  const rawDelimitedTableRows = extractDelimitedTableRows(lines);
  const selectedDelimitedTableRows = selectPreferredDelimitedTableRows(rawDelimitedTableRows).map(
    repairMalformedDelimitedHours,
  );
  const fragmentedDocxCalendarRows = extractFragmentedDocxCalendarRows(lines);
  const delimitedTableRows = shouldPreferFragmentedDocxCalendarRows(
    fragmentedDocxCalendarRows,
    selectedDelimitedTableRows,
  )
    ? fragmentedDocxCalendarRows
    : selectedDelimitedTableRows;
  const textutilDelimitedStudyPlanRows = extractTextutilDelimitedStudyPlanRows(text);
  const verticalStudyPlanRows = extractVerticalStudyPlanRows(lines);
  const cellWiseStudyPlanRows = extractCellWiseStudyPlanRows(lines);
  const coursePlanningSummaryRows = extractCoursePlanningSummaryRows(lines);
  const compactStudyPlanRows = extractCompactStudyPlanRows(lines);
  const romanContentStudyPlanRows = extractRomanContentStudyPlanRows(lines);
  const touristCampOcrStudyPlanRows = extractTouristCampOcrStudyPlanRows(lines);
  const genericNumberedStudyPlanRows = extractGenericNumberedStudyPlanRows(lines);
  const alphabeticTourismStudyPlanRows = extractAlphabeticTourismStudyPlanRows(lines);
  const annualStudyPlanRows = extractAnnualStudyPlanRows(rawLines);
  const ocrSplitHeaderStudyPlanRows = extractOcrSplitHeaderStudyPlanRows(lines);
  const moduleBasicStudyPlanRows = extractModuleBasicStudyPlanRows(lines);
  const yearlyBasicStudyPlanRows = extractYearlyBasicStudyPlanRows(lines);
  const secondYearTableThreeStudyPlanRows = extractSecondYearTableThreeStudyPlanRows(lines);
  const terminalYearBasicStudyPlanRows = extractTerminalYearBasicStudyPlanRows(lines);
  const namedStudyPlanRows = extractNamedStudyPlanRows(lines);
  const basicStudyPlanRows = extractBasicStudyPlanRows(lines);
  const contentLessonHourRows = extractContentLessonHourRows(lines);
  const appendixLearningScheduleRows = extractAppendixLearningScheduleRows(lines);
  const contentSectionTheoryPracticeRows = extractContentSectionTheoryPracticeRows(lines);
  const sectionedTheoryPracticeStudyPlanRows = extractSectionedTheoryPracticeStudyPlanRows(lines);
  const singleRowThematicPlanRows = extractSingleRowThematicPlanRows(lines);
  const courseStructureRows = extractCourseStructureRows(lines);
  const simpleTopicHourPlanRows = extractSimpleTopicHourPlanRows(lines);
  const academicCalendarScheduleRows = extractAcademicCalendarScheduleRows(lines);
  const sectionTopicHourPlanRows = extractSectionTopicHourPlanRows(lines);
  const nestedSectionTopicHourPlanRows = extractNestedSectionTopicHourPlanRows(lines);
  const topicHeadingHourRows = extractTopicHeadingHourRows(lines);
  const titleFirstCellWiseStudyPlanRows = extractTitleFirstCellWiseStudyPlanRows(lines);
  const simpleThematicPlanningRows = extractSimpleThematicPlanningRows(lines);
  const monthlySectionThematicPlanRows = extractMonthlySectionThematicPlanRows(lines);
  const contentProgramVolumeRows = extractContentProgramVolumeRows(lines);
  const courseContentTopicHourRows = extractCourseContentTopicHourRows(lines);
  const totalOnlyStudyPlanRows = extractTotalOnlyStudyPlanRows(lines);
  const lessonRangeCalendarRows = extractLessonRangeCalendarRows(lines);
  const perspectivePlanningRows = extractPerspectivePlanningRows(lines);
  const ocrColumnarStudyPlanRows = extractOcrColumnarStudyPlanRows(lines);
  const nonDelimitedRows = selectFirstTopicRows([
    programSubjectVolumeRows,
    courseYearStudyPlanRows,
    numberedScheduleRows,
    calendarStudyScheduleRows,
    simpleCalendarThematicPlanningRows,
    lessonNumberStudyPlanRows,
    appendixCalendarPlanningRows,
    studyPlanContentHourRows,
    moduleStudyPlanContentRows,
    sectionContentTopicRows,
    theoryPracticeTotalStudyPlanRows,
    slashHourThematicPlanRows,
    lessonThematicPlanningRows,
    annualStudyPlanRows,
    multilineThematicPlanRows,
    textutilDelimitedStudyPlanRows,
    verticalStudyPlanRows,
    cellWiseStudyPlanRows,
    coursePlanningSummaryRows,
    compactStudyPlanRows,
    alphabeticTourismStudyPlanRows,
    ocrSplitHeaderStudyPlanRows,
    moduleBasicStudyPlanRows,
    yearlyBasicStudyPlanRows,
    secondYearTableThreeStudyPlanRows,
    terminalYearBasicStudyPlanRows,
    namedStudyPlanRows,
    basicStudyPlanRows,
    romanContentStudyPlanRows,
    touristCampOcrStudyPlanRows,
    genericNumberedStudyPlanRows,
    contentLessonHourRows,
    appendixLearningScheduleRows,
    contentSectionTheoryPracticeRows,
    sectionedTheoryPracticeStudyPlanRows,
    singleRowThematicPlanRows,
    courseStructureRows,
    simpleTopicHourPlanRows,
    academicCalendarScheduleRows,
    nestedSectionTopicHourPlanRows,
    sectionTopicHourPlanRows,
    topicHeadingHourRows,
    titleFirstCellWiseStudyPlanRows,
    simpleThematicPlanningRows,
    monthlySectionThematicPlanRows,
    contentProgramVolumeRows,
    courseContentTopicHourRows,
    totalOnlyStudyPlanRows,
    lessonRangeCalendarRows,
    perspectivePlanningRows,
    ocrColumnarStudyPlanRows,
  ]);
  const selectedRows = shouldPreferDelimitedTableRows(delimitedTableRows, nonDelimitedRows, { documentFormat })
    ? delimitedTableRows
    : nonDelimitedRows;

  if (selectedRows) {
    topics.push(...selectedRows);
  } else {
    if (delimitedTableRows.length >= 3) {
      pushUniqueTopics(topics, seen, delimitedTableRows);
    } else {
      let insidePlan = false;
      let currentSection = "";
      let buffer = [];
      let rowsSinceSection = 0;
      let nonRowAfterRows = 0;

      for (const rawLine of lines) {
        const line = cleanupLine(rawLine);
        if (!line) continue;
        if (isStructuredDocxTableLine(line)) continue;

        if (SECTION_RE.test(line)) {
          insidePlan = true;
          currentSection = line.slice(0, 180);
          buffer = [];
          rowsSinceSection = 0;
          nonRowAfterRows = 0;
          continue;
        }

        const yearSection = detectYearSection(line);
        if (yearSection && insidePlan) {
          currentSection = yearSection;
          buffer = [];
          nonRowAfterRows = 0;
          continue;
        }

        if (!insidePlan && !looksLikeStandaloneCalendarRow(line)) {
          continue;
        }

        if (insidePlan && HARD_STOP_RE.test(line)) {
          insidePlan = false;
          buffer = [];
          continue;
        }

        if (shouldSkipLine(line)) {
          continue;
        }

        const row = parseCalendarRow(line, buffer, currentSection);
        if (row) {
          pushUnique(topics, seen, row);
          buffer = [];
          rowsSinceSection += 1;
          nonRowAfterRows = 0;
          continue;
        }

        if (insidePlan && shouldBufferLine(line)) {
          buffer.push(line);
          if (buffer.length > 8) {
            buffer.shift();
          }
          nonRowAfterRows += rowsSinceSection > 0 ? 1 : 0;
          if (rowsSinceSection > 0 && nonRowAfterRows > 35) {
            insidePlan = false;
            buffer = [];
          }
        }
      }

      pushUniqueTopics(topics, seen, extractVerticalCalendarRows(lines));
      pushUniqueTopics(topics, seen, extractWideTrainingPlanRows(lines));
    }
  }

  const cleanedTopics = postProcessExtractedTopics(topics);
  const orderedTopics = assignStableTopicOrders(cleanedTopics).map((topic) => ({
    ...topic,
    document_path: documentPath,
    document_format: documentFormat,
  }));

  if (!orderedTopics.length) {
    warnings.push(`No calendar-topic rows found in ${documentFormat} file ${documentPath}.`);
  }

  return {
    topics: orderedTopics,
    warnings,
  };
}

function assignStableTopicOrders(topics) {
  const candidateOrders = topics.map((topic, index) => {
    if (Number.isInteger(topic.topic_order) && topic.topic_order > 0) return topic.topic_order;
    return index + 1;
  });
  const seen = new Set();
  let previous = 0;
  const canPreserveSourceOrder = candidateOrders.every((order) => {
    if (!Number.isInteger(order) || order <= previous || seen.has(order)) return false;
    seen.add(order);
    previous = order;
    return true;
  });

  return topics.map((topic, index) => ({
    ...topic,
    topic_order: canPreserveSourceOrder ? candidateOrders[index] : index + 1,
  }));
}

function selectFirstTopicRows(candidates) {
  const eligible = candidates
    .map((rows, index) => ({ rows, index, quality: scoreTopicCandidateRows(rows) }))
    .filter((candidate) => candidate.quality.count >= 3);
  if (!eligible.length) return null;

  let selected = eligible[0];
  for (const candidate of eligible.slice(1)) {
    if (shouldPreferTopicCandidate(candidate, selected)) {
      selected = candidate;
    }
  }

  return selected.rows;
}

function shouldPreferTopicCandidate(candidate, selected) {
  if (candidate.quality.bad) return false;
  if (selected.quality.bad) return true;
  if (isTerminalYearBasicStudyPlanCandidate(candidate.quality) && isPlainBasicStudyPlanCandidate(selected.quality)) {
    if (isCoherentMultiYearBasicStudyPlan(selected.quality.rows) && selected.quality.count > candidate.quality.count) return false;
    return true;
  }
  if (isTerminalYearBasicStudyPlanCandidate(selected.quality) && isPlainBasicStudyPlanCandidate(candidate.quality)) {
    if (isCoherentMultiYearBasicStudyPlan(candidate.quality.rows) && candidate.quality.count > selected.quality.count) return true;
    return false;
  }
  if (isSecondYearTableThreeCandidate(candidate.quality) && (isBasicStudyPlanCandidate(selected.quality) || isAggregateStudyPlanCandidate(selected.quality))) return true;
  if (isSecondYearTableThreeCandidate(selected.quality) && (isBasicStudyPlanCandidate(candidate.quality) || isAggregateStudyPlanCandidate(candidate.quality))) return false;
  if (isAlphabeticTourismCandidate(candidate.quality) && isBasicStudyPlanCandidate(selected.quality)) return true;
  if (isAlphabeticTourismCandidate(selected.quality) && isBasicStudyPlanCandidate(candidate.quality)) return false;
  if (isLessonNumberStudyPlanCandidate(candidate.quality) && isAggregateStudyPlanCandidate(selected.quality)) return true;
  if (isLessonNumberStudyPlanCandidate(selected.quality) && isAggregateStudyPlanCandidate(candidate.quality)) return false;
  if (isCourseYearStudyPlanCandidate(candidate.quality) && isProgramSubjectVolumeCandidate(selected.quality)) return true;
  if (isCourseYearStudyPlanCandidate(selected.quality) && isProgramSubjectVolumeCandidate(candidate.quality)) return false;
  if (isProgramSubjectVolumeCandidate(candidate.quality)) {
    return shouldPreferProgramSubjectVolumeCandidate(candidate.quality, selected.quality);
  }
  if (isProgramSubjectVolumeCandidate(selected.quality)) {
    return !shouldPreferProgramSubjectVolumeCandidate(selected.quality, candidate.quality);
  }
  if (isTitleFirstCellWiseCandidate(candidate.quality) && isBasicStudyPlanCandidate(selected.quality)) {
    return haveComparableStudyPlanCoverage(candidate.quality, selected.quality);
  }
  if (isTitleFirstCellWiseCandidate(selected.quality) && isBasicStudyPlanCandidate(candidate.quality)) {
    return !haveComparableStudyPlanCoverage(candidate.quality, selected.quality);
  }
  if (isCompleteAnnualStudyPlanCandidate(selected.quality) && isBasicStudyPlanCandidate(candidate.quality)) {
    return false;
  }
  if (isCompleteAnnualStudyPlanCandidate(candidate.quality) && isBasicStudyPlanCandidate(selected.quality)) {
    return true;
  }
  if (isFocusedStudyPlanCandidate(candidate.quality) && isContentSectionCandidate(selected.quality)) {
    return Math.abs(candidate.quality.total - selected.quality.total) <= Math.max(1, selected.quality.total * 0.02);
  }
  if (isContentSectionCandidate(candidate.quality) && isFocusedStudyPlanCandidate(selected.quality)) {
    return Math.abs(candidate.quality.total - selected.quality.total) > Math.max(1, selected.quality.total * 0.02);
  }
  if (shouldPreferAggregateStudyPlanOverDetailedContentLessons(candidate.quality, selected.quality)) return true;
  if (shouldPreferAggregateStudyPlanOverDetailedContentLessons(selected.quality, candidate.quality)) return false;
  if (shouldPreferCompactMonthlyCalendarOverBasic(candidate.quality, selected.quality)) return true;
  if (shouldPreferCompactMonthlyCalendarOverBasic(selected.quality, candidate.quality)) return false;
  if (isNestedSectionTopicCandidate(candidate.quality) && isAggregateSectionTopicCandidate(selected.quality)) {
    return haveComparableStudyPlanTotal(candidate.quality, selected.quality) && candidate.quality.count > selected.quality.count;
  }
  if (isNestedSectionTopicCandidate(selected.quality) && isAggregateSectionTopicCandidate(candidate.quality)) {
    return !(haveComparableStudyPlanTotal(candidate.quality, selected.quality) && selected.quality.count > candidate.quality.count);
  }
  if (isRicherBasicOverMultilineCandidate(candidate.quality, selected.quality)) return true;
  if (isRicherBasicOverMultilineCandidate(selected.quality, candidate.quality)) return false;
  if (isBasicMultilinePair(candidate.quality, selected.quality)) {
    return !shouldPreferMultilineOverBasic(selected.quality, candidate.quality);
  }
  if (isBasicMultilinePair(selected.quality, candidate.quality)) {
    return shouldPreferMultilineOverBasic(candidate.quality, selected.quality);
  }
  if (shouldPreferSimpleTopicHourPlanOverCalendar(candidate.quality, selected.quality)) return true;
  if (shouldPreferSimpleTopicHourPlanOverCalendar(selected.quality, candidate.quality)) return false;
  if (isOverextendedBasicCandidate(selected.quality, candidate.quality)) return true;
  if (isOverextendedBasicCandidate(candidate.quality, selected.quality)) return false;
  if (isLessNoisyBasicOverGenericCandidate(candidate.quality, selected.quality)) return true;
  if (isLessNoisyBasicOverGenericCandidate(selected.quality, candidate.quality)) return false;
  if (candidateLooksLikeSuperset(candidate.quality.rows, selected.quality.rows)) return true;
  if (selected.quality.count >= candidate.quality.count && candidate.quality.count < selected.quality.count + 3) return false;
  if (candidate.quality.count >= selected.quality.count + 3 && candidate.quality.total <= Math.max(500, selected.quality.total * 3)) {
    if (
      selected.quality.total >= 50 &&
      Math.abs(candidate.quality.total - selected.quality.total) <= selected.quality.total * 0.05 &&
      !candidateLooksLikeSuperset(candidate.quality.rows, selected.quality.rows)
    ) {
      return false;
    }
    return true;
  }
  return candidate.quality.score > selected.quality.score * 1.25;
}

function scoreTopicCandidateRows(rows) {
  const processed = postProcessExtractedTopics(rows || []);
  const total = sumTopicHoursTotal(processed);
  const source = getDominantTopicCandidateSource(rows);
  const hugeHourRows = processed.filter((row) => Number(row.hours_total ?? row.hoursTotal) > 150).length;
  const bibliographicRows = processed.filter((row) => isBibliographicTopicName(row.topic_name)).length;
  const count = processed.length;

  return {
    rows: processed,
    count,
    total,
    source,
    bad:
      count < 3 ||
      total > 1000 ||
      hugeHourRows > Math.max(1, Math.floor(count * 0.1)) ||
      bibliographicRows > Math.max(1, Math.floor(count * 0.2)),
    score: scoreStudyPlanRange(processed) + count * 25 - hugeHourRows * 100 - bibliographicRows * 80,
  };
}

function getDominantTopicCandidateSource(rows) {
  const counts = new Map();
  for (const row of rows || []) {
    const source = cleanupLine(row?.raw_payload?.parser || row?.source_section || "");
    if (!source) continue;
    counts.set(source, (counts.get(source) || 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || "";
}

function isOverextendedBasicCandidate(left, right) {
  if (!/^basic-study-plan$/iu.test(left.source)) return false;
  if (!/^(generic-numbered-study-plan|cell-wise-study-plan|title-first-cell-wise-study-plan|multiline-thematic-plan)$/iu.test(right.source)) {
    return false;
  }
  if (isCoherentMultiYearBasicStudyPlan(left.rows) && candidateLooksLikeSuperset(left.rows, right.rows)) {
    return false;
  }
  if (right.count < 8 && left.count >= 12 && left.total <= 500) {
    return false;
  }
  if (/^generic-numbered-study-plan$/iu.test(right.source) && right.count < 18 && left.count >= 30 && left.total <= 300) {
    return false;
  }
  if (left.count < right.count * 2) return false;
  return left.total > Math.max(right.total * 2, right.total + 100);
}

function isCoherentMultiYearBasicStudyPlan(rows) {
  if (!Array.isArray(rows) || rows.length < 40) return false;

  const planNumbers = rows.map((row) => cleanupLine(row.plan_number || row.raw_payload?.plan_number || ""));
  const dottedRows = planNumbers.filter((number) => /^\d+\.\d+/u.test(number)).length;
  if (dottedRows < Math.ceil(rows.length * 0.55)) return false;

  const yearSections = new Set(
    rows
      .map((row) => cleanupLine(row.section_title || row.raw_payload?.year_section || ""))
      .filter((section) => /учебн(?:ый|ого)\s+план\s+\d+[- ]?го\s+года\s+обучения/iu.test(section)),
  );
  if (yearSections.size >= 2) return true;

  const firstRows = planNumbers.filter((number) => number === "1").length;
  const finalRows = planNumbers.filter((number) => /^(?:9|10)$/u.test(number)).length;
  return firstRows >= 2 && finalRows >= 2;
}

function isFocusedStudyPlanCandidate(quality) {
  return /^(basic-study-plan|second-year-table-three-study-plan|named-study-plan|annual-study-plan|generic-numbered-study-plan|tourist-camp-ocr-study-plan|monthly-section-thematic-plan|cell-wise-study-plan|title-first-cell-wise-study-plan|course-planning-summary|compact-study-plan|simple-topic-hour-plan|section-topic-hour-plan|textutil-delimited-study-plan|alphabetic-tourism-study-plan|course-year-study-plan|lesson-number-study-plan|theory-practice-study-plan)$/iu.test(
    quality.source || "",
  );
}

function isNestedSectionTopicCandidate(quality) {
  return /^section-topic-nested-hour-plan$/iu.test(quality.source || "");
}

function isAggregateSectionTopicCandidate(quality) {
  return /^section-topic-hour-plan$/iu.test(quality.source || "");
}

function haveComparableStudyPlanTotal(left, right) {
  if (!left || !right || left.total <= 0 || right.total <= 0) return false;
  return Math.abs(left.total - right.total) <= Math.max(3, Math.max(left.total, right.total) * 0.03);
}

function isAlphabeticTourismCandidate(quality) {
  return /^alphabetic-tourism-study-plan$/iu.test(quality.source || "");
}

function isBasicStudyPlanCandidate(quality) {
  return /^(basic-study-plan|terminal-year-basic-study-plan)$/iu.test(quality.source || "");
}

function isPlainBasicStudyPlanCandidate(quality) {
  return /^basic-study-plan$/iu.test(quality.source || "");
}

function isTerminalYearBasicStudyPlanCandidate(quality) {
  return /^terminal-year-basic-study-plan$/iu.test(quality.source || "");
}

function isSecondYearTableThreeCandidate(quality) {
  return /^second-year-table-three-study-plan$/iu.test(quality.source || "");
}

function isProgramSubjectVolumeCandidate(quality) {
  return /^program-subject-volume-plan$/iu.test(quality.source || "");
}

function isCourseYearStudyPlanCandidate(quality) {
  return /^course-year-study-plan$/iu.test(quality.source || "");
}

function isLessonNumberStudyPlanCandidate(quality) {
  return /^lesson-number-study-plan$/iu.test(quality.source || "");
}

function isAggregateStudyPlanCandidate(quality) {
  return /^(basic-study-plan|generic-numbered-study-plan)$/iu.test(quality.source || "");
}

function shouldPreferProgramSubjectVolumeCandidate(candidate, selected) {
  if (!isProgramSubjectVolumeCandidate(candidate)) return false;
  if (!selected || selected.count <= 0 || selected.total <= 0) return true;
  const comparableTotal = Math.abs(candidate.total - selected.total) <= Math.max(4, candidate.total * 0.05);
  if (comparableTotal && selected.count >= candidate.count + 4) return false;
  return candidate.total >= selected.total + Math.max(12, selected.total * 0.2);
}

function isTitleFirstCellWiseCandidate(quality) {
  return /^title-first-cell-wise-study-plan$/iu.test(quality.source || "");
}

function haveComparableStudyPlanCoverage(left, right) {
  if (!left || !right) return false;
  if (left.count < Math.max(3, right.count - 2)) return false;
  if (right.count < Math.max(3, left.count - 2)) return false;
  if (left.total <= 0 || right.total <= 0) return true;
  return Math.abs(left.total - right.total) <= Math.max(3, Math.max(left.total, right.total) * 0.08);
}

function isRicherBasicOverMultilineCandidate(candidate, selected) {
  if (!/^basic-study-plan$/iu.test(candidate.source || "")) return false;
  if (!/^multiline-thematic-plan$/iu.test(selected.source || "")) return false;
  if (candidate.count <= selected.count) return false;
  if (candidate.total <= 0 || selected.total <= 0) return false;
  return Math.abs(candidate.total - selected.total) <= Math.max(12, selected.total * 0.08);
}

function isBasicMultilinePair(basic, multiline) {
  return /^basic-study-plan$/iu.test(basic?.source || "") && /^multiline-thematic-plan$/iu.test(multiline?.source || "");
}

function shouldPreferMultilineOverBasic(multiline, basic) {
  if (!/^multiline-thematic-plan$/iu.test(multiline?.source || "")) return false;
  if (!/^basic-study-plan$/iu.test(basic?.source || "")) return false;
  if (hasNestedMultilineTopicNumbers(multiline.rows)) return true;
  if (multiline.count < Math.max(3, basic.count - 2)) return false;
  if (basic.total <= 0 || multiline.total <= 0) return true;
  return Math.abs(multiline.total - basic.total) <= Math.max(3, basic.total * 0.08);
}

function hasNestedMultilineTopicNumbers(rows) {
  if (!Array.isArray(rows) || rows.length < 4) return false;
  const nested = rows.filter((row) => /^\d+\.\d+(?:\.\d+)?$/u.test(cleanupLine(row?.raw_payload?.topic_number || "")));
  return nested.length >= Math.ceil(rows.length * 0.7);
}

function shouldPreferSimpleTopicHourPlanOverCalendar(candidate, selected) {
  if (!/^simple-topic-hour-plan$/iu.test(candidate?.source || "")) return false;
  if (!isCalendarCandidateSource(selected?.source || "")) return false;
  if (candidate.count < 3 || candidate.total <= 0 || selected.total <= 0) return false;
  return Math.abs(candidate.total - selected.total) <= Math.max(1, selected.total * 0.02);
}

function isCalendarCandidateSource(source) {
  return /^(?:simple-calendar-thematic-planning|calendar-study-schedule|academic-calendar-schedule|lesson-range-calendar|appendix-calendar-planning)$/iu.test(
    cleanupLine(source || ""),
  );
}

function isLessNoisyBasicOverGenericCandidate(basic, generic) {
  if (!/^basic-study-plan$/iu.test(basic?.source || "")) return false;
  if (!/^generic-numbered-study-plan$/iu.test(generic?.source || "")) return false;
  if (basic.count < Math.max(3, generic.count - 2)) return false;
  if (basic.total <= 0 || generic.total <= basic.total * 1.2) return false;
  return candidateLooksLikeSuperset(generic.rows || [], basic.rows || []);
}

function isCompleteAnnualStudyPlanCandidate(quality) {
  if (!/^annual-study-plan$/iu.test(quality.source || "")) return false;
  if (!quality || quality.count < 20) return false;

  const yearSections = new Set(
    (quality.rows || [])
      .map((row) => cleanupLine(row.section_title || row.raw_payload?.year_section || ""))
      .filter((section) => /учебн(?:ый|ого)\s+план\s+\d+[- ]?го\s+года\s+обучения/iu.test(section)),
  );
  return yearSections.size >= 2;
}

function isContentSectionCandidate(quality) {
  return /^(?:content-section-theory-practice|course-content-topic-hour-plan)$/iu.test(quality.source || "");
}

function shouldPreferAggregateStudyPlanOverDetailedContentLessons(candidate, selected) {
  if (!isAggregateTotalOnlyStudyPlanCandidate(candidate)) return false;
  if (!isDetailedContentLessonCandidate(selected)) return false;
  if (!haveComparableStudyPlanTotal(candidate, selected)) return false;
  return selected.count >= candidate.count * 2;
}

function isAggregateTotalOnlyStudyPlanCandidate(quality) {
  if (!/^total-only-study-plan$/iu.test(quality?.source || "")) return false;
  if (quality.count < 3 || quality.count > 15 || quality.total <= 0) return false;
  const aggregateRows = (quality.rows || []).filter((row) => Number(row.hours_total ?? row.hoursTotal) > 2).length;
  return aggregateRows >= Math.ceil(quality.count * 0.4);
}

function isDetailedContentLessonCandidate(quality) {
  if (!/^content-lesson-hour-plan$/iu.test(quality?.source || "")) return false;
  if (quality.count < 8 || quality.total <= 0) return false;
  const lowHourRows = (quality.rows || []).filter((row) => {
    const hoursTotal = Number(row.hours_total ?? row.hoursTotal);
    return Number.isFinite(hoursTotal) && hoursTotal <= 2;
  }).length;
  return lowHourRows >= Math.ceil(quality.count * 0.8);
}

function shouldPreferCompactMonthlyCalendarOverBasic(candidate, selected) {
  if (!/^compact-monthly-calendar-study-schedule$/iu.test(candidate?.source || "")) return false;
  if (!/^basic-study-plan$/iu.test(selected?.source || "")) return false;
  if (candidate.count < 6 || candidate.total <= 0) return false;
  return selected.total > candidate.total * 1.4;
}

function candidateLooksLikeSuperset(candidateRows, selectedRows) {
  if (!candidateRows.length || !selectedRows.length) return false;
  if (candidateRows.length <= selectedRows.length) return false;

  const candidateKeys = new Set(candidateRows.map((row) => normalizeTopicComparisonKey(row.topic_name)).filter(Boolean));
  const selectedKeys = selectedRows.map((row) => normalizeTopicComparisonKey(row.topic_name)).filter(Boolean);
  if (!selectedKeys.length) return false;
  const covered = selectedKeys.filter((key) => candidateKeys.has(key)).length;
  return covered >= Math.ceil(selectedKeys.length * 0.8);
}

function isBibliographicTopicName(value) {
  const text = cleanupLine(value);
  return /(список\s+литературы|литература|издательство|учебное\s+пособие|https?:\/\/|www\.|\b[12]\d{3}\b.*\bс\.)/iu.test(
    text,
  );
}

function shouldPreferDelimitedTableRows(delimitedRows, fallbackRows, context = {}) {
  if (delimitedRows.length < 3) return false;
  if (!fallbackRows || fallbackRows.length < 3) return true;
  if (hasFocusedNonDelimitedStudyPlanRows(fallbackRows) && delimitedRows.length > fallbackRows.length) {
    if (String(context.documentFormat || "").toLowerCase() !== "docx") return false;
    if (isDetailedScheduleRowSet(delimitedRows) || isCalendarScheduleRowSet(delimitedRows)) {
      return shouldPreferMoreCompleteDelimitedScheduleRows(delimitedRows, fallbackRows);
    }
  }
  if (
    hasFocusedNonDelimitedStudyPlanRows(fallbackRows) &&
    String(context.documentFormat || "").toLowerCase() === "docx" &&
    shouldPreferStructuredStudyPlanOverDuplicatedFocusedRows(delimitedRows, fallbackRows)
  ) {
    return true;
  }
  if (isDetailedScheduleRowSet(delimitedRows) && hasAggregateRows(fallbackRows)) return true;
  if (
    (isDetailedScheduleRowSet(delimitedRows) || isCalendarScheduleRowSet(delimitedRows)) &&
    isDelimitedScheduleContinuationOfFallback(delimitedRows, fallbackRows)
  ) {
    return true;
  }
  if (delimitedRows.length < fallbackRows.length) return false;
  if (delimitedRows.length > Math.max(fallbackRows.length + 5, Math.ceil(fallbackRows.length * 1.25))) return false;
  return countSplitHourRows(delimitedRows) > countSplitHourRows(fallbackRows);
}

function countSplitHourRows(rows) {
  return rows.filter((row) => row.hours_theory != null && row.hours_practice != null).length;
}

function hasAggregateRows(rows) {
  return rows.some((row) => Number(row.hours_total ?? row.hoursTotal) >= 12);
}

function hasFocusedNonDelimitedStudyPlanRows(rows) {
  if (!Array.isArray(rows) || rows.length < 3) return false;
  const focusedRows = rows.filter((row) => {
    const source = cleanupLine(row?.source_section ?? row?.sourceSection ?? "");
    const parser = cleanupLine(row?.raw_payload?.parser ?? row?.rawPayload?.parser ?? "");
    return /^(basic-study-plan|named-study-plan|annual-study-plan|cell-wise-study-plan|title-first-cell-wise-study-plan|course-planning-summary|compact-study-plan|simple-topic-hour-plan|section-topic-hour-plan|generic-numbered-study-plan|textutil-delimited-study-plan|alphabetic-tourism-study-plan|lesson-number-study-plan)$/iu.test(
      source || parser,
    );
  });
  return focusedRows.length >= Math.ceil(rows.length * 0.7);
}

function isDelimitedScheduleContinuationOfFallback(delimitedRows, fallbackRows) {
  if (!Array.isArray(delimitedRows) || !Array.isArray(fallbackRows)) return false;
  if (fallbackRows.length < 3 || delimitedRows.length <= fallbackRows.length) return false;
  if (!fallbackRows.every(isCalendarLikeFallbackRow)) return false;

  return fallbackRows.every((fallbackRow, index) => {
    const delimitedRow = delimitedRows[index];
    if (!delimitedRow) return false;

    const fallbackOrder = Number(fallbackRow.topic_order ?? fallbackRow.topicOrder);
    const delimitedOrder = Number(delimitedRow.topic_order ?? delimitedRow.topicOrder);
    if (Number.isInteger(fallbackOrder) && Number.isInteger(delimitedOrder) && fallbackOrder !== delimitedOrder) {
      return false;
    }

    const fallbackName = normalizeTopicComparisonKey(fallbackRow.topic_name ?? fallbackRow.topicName);
    const delimitedName = normalizeTopicComparisonKey(delimitedRow.topic_name ?? delimitedRow.topicName);
    if (!fallbackName || fallbackName !== delimitedName) return false;

    const fallbackTotal = Number(fallbackRow.hours_total ?? fallbackRow.hoursTotal);
    const delimitedTotal = Number(delimitedRow.hours_total ?? delimitedRow.hoursTotal);
    if (Number.isFinite(fallbackTotal) && Number.isFinite(delimitedTotal)) {
      return Math.abs(fallbackTotal - delimitedTotal) < 0.001;
    }
    return true;
  });
}

function isCalendarLikeFallbackRow(row) {
  const source = cleanupLine(row?.source_section ?? row?.sourceSection ?? "");
  const parser = cleanupLine(row?.raw_payload?.parser ?? row?.rawPayload?.parser ?? "");
  return /календар|график|schedule|lesson-range-calendar|vertical-calendar|numbered-calendar/iu.test(`${source} ${parser}`);
}

function isDetailedScheduleRowSet(rows) {
  if (!Array.isArray(rows) || rows.length < 8) return false;
  const scheduleRows = rows.filter((row) => {
    const payload = row.raw_payload || row.rawPayload || {};
    const header = (payload.header_cells || []).join(" ");
    return /форма\s+занят/iu.test(header) && /тема\s+занят/iu.test(header);
  });
  if (scheduleRows.length < Math.max(8, Math.ceil(rows.length * 0.7))) return false;
  const smallHourRows = scheduleRows.filter((row) => {
    const total = Number(row.hours_total ?? row.hoursTotal);
    return Number.isFinite(total) && total > 0 && total <= 6;
  });
  return smallHourRows.length >= Math.ceil(scheduleRows.length * 0.8);
}

function extractLessonNumberStudyPlanRows(lines) {
  const startIndex = findLessonNumberStudyPlanHeaderIndex(lines);
  if (startIndex < 0) return [];

  const rows = [];
  let currentSection = "Учебный план";
  let summaryHours = null;

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line || isLessonNumberStudyPlanHeaderLine(line)) continue;
    if (/^приложение\s*№?\s*\d+/iu.test(line)) break;

    const total = parseLessonNumberStudyPlanTotalLine(line);
    if (total) {
      summaryHours = total;
      break;
    }

    const section = parseLessonNumberStudyPlanSectionLine(lines, index);
    if (section) {
      currentSection = section;
      continue;
    }

    const start = parseLessonNumberStudyPlanRowStart(line);
    if (!start) continue;

    const segment = [];
    if (start.title) segment.push(start.title);
    let nextIndex = index + 1;
    let rawHourValues = start.hourValues || null;

    while (!rawHourValues && nextIndex < lines.length) {
      const nextLine = cleanupLine(lines[nextIndex]);
      if (!nextLine || isLessonNumberStudyPlanHeaderLine(nextLine)) {
        nextIndex += 1;
        continue;
      }
      const numericHours = parseLessonNumberStudyPlanNumericHoursLine(nextLine);
      if (numericHours && segment.length) {
        rawHourValues = numericHours;
        nextIndex += 1;
        break;
      }
      const split = splitLessonNumberStudyPlanHoursTail(nextLine);
      if (split) {
        if (split.titlePart) segment.push(split.titlePart);
        rawHourValues = split.values;
        nextIndex += 1;
        break;
      }
      if (
        /^приложение\s*№?\s*\d+/iu.test(nextLine) ||
        parseLessonNumberStudyPlanTotalLine(nextLine) ||
        parseLessonNumberStudyPlanRowStart(nextLine)
      ) {
        break;
      }

      segment.push(nextLine);
      nextIndex += 1;
      if (segment.length > 18) break;
    }

    const topicName = cleanupBasicStudyPlanTopicName(segment.join(" "));
    if (rawHourValues && isValidLessonNumberStudyPlanTopic(topicName)) {
      rows.push({
        plan_number: String(start.number),
        section_title: currentSection,
        topic_name: topicName,
        hours_theory: 0,
        hours_practice: 0,
        hours_total: rawHourValues[0],
        activity_type: "не определено",
        control_form: "",
        source_section: "lesson-number-study-plan",
        source_excerpt: [line, ...segment, rawHourValues.join(" ")].join(" / ").slice(0, 1500),
        confidence: 0.86,
        raw_payload: {
          parser: "lesson-number-study-plan",
          plan_number: String(start.number),
          raw_hour_values: rawHourValues,
          parsed_lines: [line, ...segment],
          ...(!isValidTopic(topicName) ? { allow_generic_topic: true } : {}),
        },
      });
    }

    index = Math.max(index, nextIndex - 1);
  }

  return finalizeLessonNumberStudyPlanRows(rows, summaryHours);
}

function findLessonNumberStudyPlanHeaderIndex(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!/^учебн(?:ый|ого)\s+план$/iu.test(line)) continue;

    const window = lines
      .slice(index, index + 16)
      .map(cleanupLine)
      .join(" ");
    if (/№\s+заняти\s*я/iu.test(window) && /тема\s+занятия/iu.test(window) && /комбини/iu.test(window)) {
      return index;
    }
  }

  return -1;
}

function isLessonNumberStudyPlanHeaderLine(line) {
  return /^(?:№|заняти|я|тема\s+занятия|всего|теория|практи|ка|комбини|рованное|занятие)$/iu.test(cleanupLine(line));
}

function parseLessonNumberStudyPlanSectionLine(lines, index) {
  const line = cleanupLine(lines[index]);
  if (!line || splitLessonNumberStudyPlanHoursTail(line) || parseLessonNumberStudyPlanRowStart(line)) return "";
  if (!isValidTopic(cleanupTopicName(line))) return "";

  const nextIndex = findNextNonEmptyLineIndex(lines, index + 1, index + 4);
  if (nextIndex < 0) return "";
  const nextLine = cleanupLine(lines[nextIndex]);
  const nextRowStart = parseLessonNumberStudyPlanRowStart(nextLine);
  if (
    (parseLessonNumberStudyPlanNumericHoursLine(nextLine) && !(nextRowStart && /^\d{1,2}[.)]?$/u.test(nextLine))) ||
    splitLessonNumberStudyPlanHoursTail(nextLine)
  ) {
    return "";
  }
  if (!nextRowStart) return "";
  return cleanupBasicStudyPlanTopicName(line);
}

function parseLessonNumberStudyPlanRowStart(line) {
  const cleaned = cleanupLine(line);
  if (/^\d+(?:[,.]\d+)?(?:\s+\d+(?:[,.]\d+)?)+$/u.test(cleaned)) return null;
  const match = cleaned.match(/^(\d{1,2})[.)]?\s*(.*)$/u);
  if (!match) return null;
  const number = Number(match[1]);
  if (!Number.isInteger(number) || number <= 0 || number > 40) return null;

  const split = splitLessonNumberStudyPlanHoursTail(match[2] || "");
  return {
    number,
    title: split ? split.titlePart : cleanupLine(match[2] || ""),
    hourValues: split ? split.values : null,
  };
}

function parseLessonNumberStudyPlanNumericHoursLine(line) {
  const cleaned = cleanupLine(line);
  if (!/^\d+(?:[,.]\d+)?(?:\s+\d+(?:[,.]\d+)?){0,3}$/u.test(cleaned)) return null;
  const values = cleaned.split(/\s+/u).map(parseHourCell).filter((value) => value != null);
  if (!values.length || values.some((value) => value <= 0 || value > 100)) return null;
  return values;
}

function isValidLessonNumberStudyPlanTopic(topicName) {
  const text = cleanupLine(topicName);
  if (isValidTopic(text)) return true;
  if (text.length <= 260 || text.length > 700) return false;
  if (/^[\d\s.,:-]+$/u.test(text) || isTotalTopicName(text) || isServiceOnlyTopicName(text)) return false;
  if (/(?:федеральн|постановление|приказ|санпин|литератур|нормативно|концепци|распоряжение|www\.|http)/iu.test(text)) {
    return false;
  }
  return /[А-ЯЁа-яё]/u.test(text);
}

function splitLessonNumberStudyPlanHoursTail(line) {
  const cleaned = cleanupLine(line);
  if (!cleaned) return null;

  const match = cleaned.match(/^(.*?)(?:\s+|^)(\d+(?:[,.]\d+)?(?:\s+\d+(?:[,.]\d+)?){0,3})$/u);
  if (!match) return null;

  const values = match[2]
    .split(/\s+/u)
    .map(parseHourCell)
    .filter((value) => value != null);
  if (!values.length || values.some((value) => value <= 0 || value > 100)) return null;

  const titlePart = cleanupLine(match[1] || "");
  if (!titlePart && values.length === 1) return null;

  return { titlePart, values };
}

function parseLessonNumberStudyPlanTotalLine(line) {
  const match = cleanupLine(line).match(/^итого\s*:?\s+(\d+(?:[,.]\d+)?(?:\s+\d+(?:[,.]\d+)?){0,3})$/iu);
  if (!match) return null;
  const values = match[1].split(/\s+/u).map(parseHourCell).filter((value) => value != null);
  if (!values.length) return null;
  return {
    total: values[0] || 0,
    theory: values[1] || 0,
    practice: values[2] || 0,
    combined: values[3] || 0,
  };
}

function finalizeLessonNumberStudyPlanRows(rows, summaryHours) {
  if (rows.length < 6) return [];

  const normalizedRows = rows.map((row) => mapLessonNumberStudyPlanHours(row));
  if (summaryHours) {
    allocateLessonNumberStudyPlanAmbiguousHours(normalizedRows, summaryHours);
  }

  const total = sumTopicHoursTotal(normalizedRows);
  if (summaryHours && Math.abs(total - summaryHours.total) > 0.01) return [];
  return normalizedRows;
}

function mapLessonNumberStudyPlanHours(row) {
  const values = row.raw_payload?.raw_hour_values || [];
  const hoursTotal = values[0] || row.hours_total || 0;
  let hoursTheory = 0;
  let hoursPractice = 0;
  let combinedHours = 0;
  let ambiguousHours = 0;

  if (values.length >= 4) {
    hoursTheory = values[1] || 0;
    hoursPractice = values[2] || 0;
    combinedHours = values[3] || 0;
  } else if (values.length === 3) {
    hoursTheory = values[1] || 0;
    hoursPractice = values[2] || 0;
  } else if (values.length === 2) {
    ambiguousHours = values[1] || 0;
  } else if (values.length === 1) {
    ambiguousHours = values[0] || 0;
  }

  return {
    ...row,
    hours_theory: hoursTheory,
    hours_practice: roundHour(hoursPractice + combinedHours),
    hours_total: hoursTotal,
    activity_type: inferLessonThematicPlanningActivityType({
      hoursTheory,
      hoursPractice: roundHour(hoursPractice + combinedHours),
    }),
    raw_payload: {
      ...row.raw_payload,
      combined_hours: combinedHours,
      ambiguous_hour_value: ambiguousHours,
    },
  };
}

function allocateLessonNumberStudyPlanAmbiguousHours(rows, summaryHours) {
  let theoryUsed = sumLessonNumberStudyPlanColumn(rows, "hours_theory");
  let practiceUsed = sumLessonNumberStudyPlanColumn(rows, "hours_practice");
  let combinedUsed = rows.reduce((sum, row) => sum + (normalizeNullableHour(row.raw_payload?.combined_hours) || 0), 0);

  for (const row of rows) {
    const ambiguous = normalizeNullableHour(row.raw_payload?.ambiguous_hour_value) || 0;
    if (ambiguous <= 0) continue;

    const preferPractice =
      isLessonNumberStudyPlanPracticeTopic(row.topic_name) &&
      practiceUsed + ambiguous <= (summaryHours.practice || 0) + 0.01;
    const preferCombined =
      !preferPractice &&
      combinedUsed + ambiguous <= (summaryHours.combined || 0) + 0.01;

    if (preferPractice) {
      row.hours_practice = roundHour((row.hours_practice || 0) + ambiguous);
      practiceUsed = roundHour(practiceUsed + ambiguous);
      row.raw_payload.ambiguous_hour_resolution = "practice";
    } else if (preferCombined) {
      row.hours_practice = roundHour((row.hours_practice || 0) + ambiguous);
      row.raw_payload.combined_hours = roundHour((row.raw_payload.combined_hours || 0) + ambiguous);
      combinedUsed = roundHour(combinedUsed + ambiguous);
      row.raw_payload.ambiguous_hour_resolution = "combined";
    } else if (theoryUsed + ambiguous <= (summaryHours.theory || 0) + 0.01) {
      row.hours_theory = roundHour((row.hours_theory || 0) + ambiguous);
      theoryUsed = roundHour(theoryUsed + ambiguous);
      row.raw_payload.ambiguous_hour_resolution = "theory";
    } else {
      row.hours_practice = roundHour((row.hours_practice || 0) + ambiguous);
      practiceUsed = roundHour(practiceUsed + ambiguous);
      row.raw_payload.ambiguous_hour_resolution = "practice-fallback";
    }

    row.activity_type = inferLessonThematicPlanningActivityType({
      hoursTheory: row.hours_theory,
      hoursPractice: row.hours_practice,
    });
  }
}

function sumLessonNumberStudyPlanColumn(rows, key) {
  return roundHour(rows.reduce((sum, row) => sum + (normalizeNullableHour(row[key]) || 0), 0));
}

function isLessonNumberStudyPlanPracticeTopic(topicName) {
  const text = cleanupLine(topicName);
  return /^экскурсия\b/iu.test(text) && !/(?:квест|презентац|выставк|бесед|инструктаж|туристическ|правила|игр)/iu.test(text);
}

function extractNumberedScheduleRows(lines) {
  const topics = [];
  const expandedLines = expandEmbeddedScheduleRowStarts(lines);
  const headerIndex = findNumberedScheduleHeaderIndex(expandedLines);
  if (headerIndex < 0) return topics;

  let expectedNumber = 1;
  let index = headerIndex + 1;

  while (index < expandedLines.length) {
    const line = cleanupLine(expandedLines[index]);
    if (!line) {
      index += 1;
      continue;
    }
    if (TOTAL_RE.test(line)) break;

    const start = readExpectedScheduleRowStart(expandedLines, index, expectedNumber);
    if (!start) {
      index += 1;
      continue;
    }

    const endIndex = findNextScheduleRowIndex(expandedLines, start.nextIndex, expectedNumber + 1);
    const segment = [];
    if (start.remainder) {
      segment.push(start.remainder);
    }
    for (let rowIndex = start.nextIndex; rowIndex < endIndex; rowIndex += 1) {
      const segmentLine = cleanupLine(expandedLines[rowIndex]);
      if (!segmentLine || PAGE_NUMBER_RE.test(segmentLine)) continue;
      segment.push(segmentLine);
    }

    const topic = parseNumberedScheduleSegment({
      rowNumber: expectedNumber,
      segment,
      currentSection: cleanupLine(expandedLines[headerIndex]),
    });

    if (topic) {
      topics.push(topic);
      expectedNumber += 1;
      index = endIndex;
      continue;
    }

    index = start.nextIndex;
  }

  return topics;
}

function expandEmbeddedScheduleRowStarts(lines) {
  const expanded = [];
  const embeddedRowStartRe =
    /\s+(\d{1,3}\s+(?:Аудиторн|Практическ|Проект|Соревнован|Экскурс))/giu;

  for (const rawLine of lines) {
    const line = cleanupLine(rawLine);
    if (!line) continue;
    const parts = line.replace(embeddedRowStartRe, "\n$1").split("\n");
    for (const part of parts) {
      const cleaned = cleanupLine(part);
      if (cleaned) expanded.push(cleaned);
    }
  }

  return expanded;
}

function extractCalendarStudyScheduleRows(lines) {
  const modularRows = extractModularCalendarStudyScheduleRows(lines);
  if (modularRows.length) return modularRows;
  const datedRows = extractDatedCalendarStudyScheduleRows(lines);
  if (datedRows.length) return datedRows;
  const timetableRows = extractTimetableCalendarStudyScheduleRows(lines);
  if (timetableRows.length) return timetableRows;
  const compactMonthlyRows = extractCompactMonthlyCalendarStudyScheduleRows(lines);
  if (compactMonthlyRows.length) return compactMonthlyRows;
  return extractMonthlyCalendarStudyScheduleRows(lines);
}

function extractModularCalendarStudyScheduleRows(lines) {
  const headerIndex = findModularCalendarStudyScheduleHeaderIndex(lines);
  if (headerIndex < 0) return [];

  const firstModuleIndex = findModularCalendarModuleIndex(lines, 1, headerIndex);
  const secondModuleIndex = findModularCalendarModuleIndex(lines, 2, firstModuleIndex + 1);
  const thirdModuleIndex = findModularCalendarModuleIndex(lines, 3, secondModuleIndex + 1);
  if (firstModuleIndex < 0 || secondModuleIndex < 0 || thirdModuleIndex < 0) return [];

  const endIndex = findModularCalendarStudyScheduleEndIndex(lines, thirdModuleIndex + 1);
  const rows = [
    ...extractModularCalendarModule12Rows(lines, 1, firstModuleIndex, secondModuleIndex),
    ...extractModularCalendarModule12Rows(lines, 2, secondModuleIndex, thirdModuleIndex),
    ...extractModularCalendarModule3Rows(lines, thirdModuleIndex, endIndex),
  ];

  const moduleCount = new Set(rows.map((row) => row.raw_payload?.module_title).filter(Boolean)).size;
  return rows.length >= 25 && moduleCount >= 3 && sumTopicHoursTotal(rows) > 0 ? rows : [];
}

function findModularCalendarStudyScheduleHeaderIndex(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!/^календарн(?:ый|ого)\s+учебн(?:ый|ого)\s+график$/iu.test(line)) continue;

    const window = lines
      .slice(index, index + 120)
      .map(cleanupLine)
      .join(" ");
    if (/модуль\s+1/iu.test(window) && /тема\s+занятия/iu.test(window) && /кол\s*-?\s*во\s+час|кол-?во\s+час/iu.test(window)) {
      return index;
    }
  }

  return -1;
}

function findModularCalendarModuleIndex(lines, moduleNumber, startIndex) {
  if (startIndex < 0) return -1;
  const moduleRe = new RegExp(`^модуль\\s+${moduleNumber}$`, "iu");
  for (let index = startIndex; index < lines.length; index += 1) {
    if (moduleRe.test(cleanupLine(lines[index]))) return index;
  }
  return -1;
}

function findModularCalendarStudyScheduleEndIndex(lines, startIndex) {
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (/^формы\s+отслеживания\s+и\s+фиксации\s+образовательных/iu.test(line)) return index;
    if (/^список\s+литературы/iu.test(line)) return index;
  }
  return lines.length;
}

function extractModularCalendarModule12Rows(lines, moduleNumber, startIndex, endIndex) {
  const rows = [];
  let expectedNumber = 1;
  let index = startIndex + 1;

  while (index < endIndex) {
    if (!isModularCalendarModule12RowStart(lines, index, expectedNumber)) {
      index += 1;
      continue;
    }

    const nextIndex = findNextModularCalendarModule12RowIndex(lines, index + 1, expectedNumber + 1, endIndex);
    const segment = collectModularCalendarSegmentLines(lines, index, nextIndex);
    const row = parseModularCalendarModule12Segment(segment, moduleNumber, expectedNumber);
    if (row) rows.push(row);

    expectedNumber += 1;
    index = nextIndex;
  }

  return rows;
}

function isModularCalendarModule12RowStart(lines, index, expectedNumber) {
  return new RegExp(`^${expectedNumber}\\s+\\d{2}(?:\\s|$)`, "u").test(cleanupLine(lines[index]));
}

function findNextModularCalendarModule12RowIndex(lines, startIndex, nextNumber, endIndex) {
  for (let index = startIndex; index < endIndex; index += 1) {
    const line = cleanupLine(lines[index]);
    if (isModularCalendarModule12RowStart(lines, index, nextNumber)) return index;
    if (/^модуль\s+\d+$/iu.test(line)) return index;
  }
  return endIndex;
}

function collectModularCalendarSegmentLines(lines, startIndex, endIndex) {
  const segment = [];
  for (let index = startIndex; index < endIndex; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line || isModularCalendarPageNumberLine(line)) continue;
    segment.push(line);
  }
  return segment;
}

function parseModularCalendarModule12Segment(segment, moduleNumber, rowNumber) {
  if (!segment.length) return null;

  const firstLine = cleanupLine(segment[0]).replace(new RegExp(`^${rowNumber}\\s+\\d{2}\\s*`, "u"), "");
  const lines = [firstLine, ...segment.slice(1)].filter(Boolean);
  const topicParts = [];
  const controlParts = [];
  let hoursTotal = null;
  let sawHourColumn = false;
  let sawPlaceColumn = false;

  for (const rawLine of lines) {
    const line = cleanupLine(rawLine);
    if (!line) continue;

    if (!sawHourColumn) {
      const hourMatch = line.match(/^(.*?)\b(\d+(?:[,.]\d+)?)\b\s*(.*)$/u);
      if (!hourMatch) continue;

      const parsedHours = parseHourCell(hourMatch[2]);
      if (parsedHours == null || parsedHours <= 0 || parsedHours > 12) continue;

      hoursTotal = parsedHours;
      sawHourColumn = true;
      const rest = cleanupLine(hourMatch[3]);
      if (rest) {
        const split = splitModularCalendarModule12PlaceAndControl(rest);
        if (split.topicPart) topicParts.push(split.topicPart);
        if (split.controlPart) controlParts.push(split.controlPart);
        if (split.sawPlace || split.controlPart) sawPlaceColumn = true;
      }
      continue;
    }

    if (sawPlaceColumn) {
      const split = splitModularCalendarModule12PlaceAndControl(line);
      if (split.controlPart) controlParts.push(split.controlPart);
      continue;
    }

    if (isModularCalendarModule12ControlLine(line)) {
      controlParts.push(line);
      sawPlaceColumn = true;
      continue;
    }

    if (isModularCalendarModule12PlaceLine(line)) {
      sawPlaceColumn = true;
      continue;
    }

    const split = splitModularCalendarModule12PlaceAndControl(line);
    if (split.topicPart) topicParts.push(split.topicPart);
    if (split.controlPart) controlParts.push(split.controlPart);
    if (split.sawPlace || split.controlPart) sawPlaceColumn = true;
  }

  return buildModularCalendarRow({
    moduleNumber,
    planNumber: `${moduleNumber}.${rowNumber}`,
    rowNumber: String(rowNumber),
    topicParts,
    controlParts,
    hoursTotal,
    sourceLines: segment,
  });
}

function splitModularCalendarModule12PlaceAndControl(line) {
  let text = cleanupLine(line);
  let controlPart = "";

  const controlMatch = text.match(/(?:^|\s)(тестирование|практикум|мастер\s*[-–—]?\s*класс|зач[её]т)\.?$/iu);
  if (controlMatch) {
    controlPart = cleanupLine(controlMatch[1]);
    text = cleanupLine(text.slice(0, controlMatch.index));
  }

  let sawPlace = false;
  const placeMatch = text.match(/(?:^|\s)(каб\.?\s*№?\s*\d+|музей|актовый\s+зал|спортивн(?:ый)?\s+зал|спортивн|ый\s+зал|зал)$/iu);
  if (placeMatch) {
    sawPlace = true;
    text = cleanupLine(text.slice(0, placeMatch.index));
  }

  return {
    topicPart: text,
    controlPart,
    sawPlace,
  };
}

function isModularCalendarModule12PlaceLine(line) {
  return /^(?:музей|каб\.?\s*№?\s*\d+|актовый|актовый\s+зал|спортивн|спортивный\s+зал|ый\s+зал|зал)$/iu.test(
    cleanupLine(line),
  );
}

function isModularCalendarModule12ControlLine(line) {
  return /^(?:тестирование|практикум|мастер\s*[-–—]?\s*класс|зач[её]т)$/iu.test(cleanupLine(line));
}

function extractModularCalendarModule3Rows(lines, startIndex, endIndex) {
  const rows = [];
  let expectedNumber = 1;
  let index = startIndex + 1;

  while (index < endIndex) {
    const start = readModularCalendarModule3RowStart(lines, index, expectedNumber);
    if (!start) {
      index += 1;
      continue;
    }

    const nextExpectedNumber = start.endNumber + 1;
    const nextIndex = findNextModularCalendarModule3RowIndex(lines, start.nextIndex, nextExpectedNumber, endIndex);
    const segment = [start.topicStart, ...collectModularCalendarSegmentLines(lines, start.nextIndex, nextIndex)];
    const row = parseModularCalendarModule3Segment(start, segment);
    if (row) rows.push(row);

    expectedNumber = nextExpectedNumber;
    index = nextIndex;
  }

  return rows;
}

function readModularCalendarModule3RowStart(lines, index, expectedNumber) {
  const line = cleanupLine(lines[index]);
  if (!line || isModularCalendarPageNumberLine(line)) return null;

  const splitRangeEndLine = cleanupLine(lines[index + 1]);
  if (new RegExp(`^${expectedNumber}\\s*[-–—]\\s*$`, "u").test(line) && /^\d{1,3}$/u.test(splitRangeEndLine)) {
    const rangeEnd = Number(splitRangeEndLine);
    const nextLine = cleanupLine(lines[index + 2]);
    const nextMatch = nextLine.match(/^(\d{2})\s+(.+)$/u);
    if (!Number.isInteger(rangeEnd) || rangeEnd < expectedNumber || !nextMatch) return null;
    return {
      rowNumber: `${expectedNumber}-${rangeEnd}`,
      startNumber: expectedNumber,
      endNumber: rangeEnd,
      topicStart: cleanupLine(nextMatch[2]),
      nextIndex: index + 3,
      sourceStart: [line, splitRangeEndLine, nextLine],
    };
  }

  const match = line.match(new RegExp(`^${expectedNumber}(?:[-–—](\\d{1,3}))?\\s+(?:\\d{2}\\s+)?(.+)$`, "u"));
  if (!match) return null;

  const rangeEnd = match[1] ? Number(match[1]) : expectedNumber;
  if (!Number.isInteger(rangeEnd) || rangeEnd < expectedNumber) return null;
  return {
    rowNumber: match[1] ? `${expectedNumber}-${rangeEnd}` : String(expectedNumber),
    startNumber: expectedNumber,
    endNumber: rangeEnd,
    topicStart: cleanupLine(match[2]),
    nextIndex: index + 1,
    sourceStart: [line],
  };
}

function findNextModularCalendarModule3RowIndex(lines, startIndex, nextNumber, endIndex) {
  for (let index = startIndex; index < endIndex; index += 1) {
    if (readModularCalendarModule3RowStart(lines, index, nextNumber)) return index;
    if (/^формы\s+отслеживания/iu.test(cleanupLine(lines[index]))) return index;
  }
  return endIndex;
}

function parseModularCalendarModule3Segment(start, segment) {
  const topicParts = [];
  const controlParts = [];
  let hoursTotal = null;
  let collectingControl = false;

  for (const rawLine of segment) {
    const line = cleanupLine(rawLine);
    if (!line) continue;

    if (collectingControl) {
      controlParts.push(line);
      continue;
    }

    if (hoursTotal != null && isModularCalendarModule3ControlStartLine(line)) {
      controlParts.push(line);
      collectingControl = true;
      continue;
    }

    if (hoursTotal == null) {
      const parsedHour = parseModularCalendarModule3HourLine(line, topicParts.length > 0);
      if (parsedHour) {
        if (parsedHour.topicPart) topicParts.push(parsedHour.topicPart);
        hoursTotal = parsedHour.hoursTotal;
        if (parsedHour.controlPart) {
          controlParts.push(parsedHour.controlPart);
          collectingControl = true;
        }
        continue;
      }
    }

    topicParts.push(line);
  }

  return buildModularCalendarRow({
    moduleNumber: 3,
    planNumber: `3.${start.rowNumber}`,
    rowNumber: start.rowNumber,
    topicParts,
    controlParts,
    hoursTotal,
    sourceLines: [...start.sourceStart, ...segment],
  });
}

function parseModularCalendarModule3HourLine(line, hasTopicParts) {
  const text = cleanupLine(line);
  if (hasTopicParts) {
    const singleHourMatch = text.match(/^(\d+(?:[,.]\d+)?)(?:\s+(.+))?$/u);
    if (singleHourMatch) {
      const hoursTotal = parseHourCell(singleHourMatch[1]);
      if (hoursTotal == null || hoursTotal <= 0 || hoursTotal > 40) return null;
      return {
        topicPart: "",
        hoursTotal,
        controlPart: cleanupLine(singleHourMatch[2] || ""),
      };
    }
  }

  const trailingHourMatch = text.match(/^(.+?)\s+(\d+(?:[,.]\d+)?)$/u);
  if (trailingHourMatch) {
    const hoursTotal = parseHourCell(trailingHourMatch[2]);
    if (hoursTotal == null || hoursTotal <= 0 || hoursTotal > 40) return null;
    return {
      topicPart: cleanupLine(trailingHourMatch[1]),
      hoursTotal,
      controlPart: "",
    };
  }

  const controlTailMatch = text.match(/^(.+?)\s+(\d+(?:[,.]\d+)?)\s+(.+)$/u);
  if (controlTailMatch && isModularCalendarModule3ControlStartLine(controlTailMatch[3])) {
    const hoursTotal = parseHourCell(controlTailMatch[2]);
    if (hoursTotal == null || hoursTotal <= 0 || hoursTotal > 40) return null;
    return {
      topicPart: cleanupLine(controlTailMatch[1]),
      hoursTotal,
      controlPart: cleanupLine(controlTailMatch[3]),
    };
  }

  return null;
}

function isModularCalendarModule3ControlStartLine(line) {
  return /^(?:тестирование|опрос|выполнен|выполнение|выпуск|участие|практическая|наблюдения?|диагностические|задания|коллективный|анализ|творческих|ситуативные|тренинги|работ;|объединения;|конкурсах;?)/iu.test(
    cleanupLine(line),
  );
}

function buildModularCalendarRow({ moduleNumber, planNumber, rowNumber, topicParts, controlParts, hoursTotal, sourceLines }) {
  if (hoursTotal == null || hoursTotal <= 0) return null;

  const topicName = cleanupModularCalendarStudyScheduleTopic(topicParts.join(" "));
  const isAllowedTopic = isValidScheduleTopic(topicName) || isAllowedModularCalendarStudyScheduleTopic(topicName);
  if (!isAllowedTopic) return null;

  const controlForm = cleanupControlForm(cleanupModularCalendarStudyScheduleTopic(controlParts.join(" ")));
  const shouldBypassGenericTopicFilter = !isValidTopic(topicName) || isBibliographicOrEquipmentTopic(topicName);
  return {
    plan_number: planNumber,
    section_title: `Календарный учебный график. Модуль ${moduleNumber}`,
    topic_name: topicName,
    hours_theory: null,
    hours_practice: null,
    hours_total: hoursTotal,
    activity_type: inferActivityType({
      topicName,
      controlForm,
      hoursTheory: null,
      hoursPractice: null,
    }),
    control_form: controlForm,
    source_section: "calendar-study-schedule",
    source_excerpt: sourceLines.join(" / ").slice(0, 1500),
    confidence: 0.87,
    raw_payload: {
      parser: "modular-calendar-study-schedule",
      module_title: `Модуль ${moduleNumber}`,
      row_number: rowNumber,
      plan_number: planNumber,
      source_lines: sourceLines,
      ...(shouldBypassGenericTopicFilter ? { allow_generic_topic: true } : {}),
    },
  };
}

function cleanupModularCalendarStudyScheduleTopic(value) {
  return cleanupCalendarStudyScheduleTopic(value)
    .replace(/историкокраеведческ/giu, "историко-краеведческ")
    .replace(/историкокультур/giu, "историко-культур")
    .replace(/тематикоэкспозицион/giu, "тематико-экспозицион")
    .replace(/архитектурнохудожествен/giu, "архитектурно-художествен")
    .replace(/(историко|тематико|архитектурно)\s*-\s+(?=краеведческ|культур|экспозицион|художествен)/giu, "$1-")
    .replace(/точностьи/giu, "точность и")
    .replace(/беседаанализ/giu, "беседа, анализ")
    .replace(/видеоматериал\s+ы/giu, "видеоматериалы")
    .replace(/исследовательск\s+ая/giu, "исследовательская")
    .replace(/дляшкольного/giu, "для школьного")
    .replace(/\s+/g, " ")
    .trim();
}

function isAllowedModularCalendarStudyScheduleTopic(topicName) {
  const text = cleanupLine(topicName);
  if (!text || text.length < 3 || text.length > 260) return false;
  if (/^[\d\s.,:-]+$/u.test(text)) return false;
  if (/^(месяц|тема|раздел|занятие|количество|форма|контроль|теория|практика|всего|час|часа|часов)$/iu.test(text)) {
    return false;
  }
  if (/федеральн|постановление|приказ|санпин|нормативно|распоряжение|www\.|http/iu.test(text)) {
    return false;
  }
  return /[А-ЯЁа-яё]/u.test(text);
}

function isModularCalendarPageNumberLine(line) {
  const number = Number(cleanupLine(line));
  return Number.isInteger(number) && number >= 20 && number <= 200;
}

function extractDatedCalendarStudyScheduleRows(lines) {
  const headerIndex = findCalendarStudyScheduleHeaderIndex(lines);
  if (headerIndex < 0) return [];

  const sectionTitles = extractCalendarStudyScheduleSectionTitles(lines);
  const rows = [];
  let expectedNumber = 1;
  let index = headerIndex + 1;

  while (index < lines.length) {
    const line = cleanupLine(lines[index]);
    if (rows.length && TOTAL_RE.test(line)) break;
    if (rows.length && /^(?:приложение|оценочные\s+материалы|список\s+литературы)/iu.test(line)) break;

    const start = readCalendarStudyScheduleRowStart(lines, index, expectedNumber);
    if (!start) {
      index += 1;
      continue;
    }

    const endIndex = findNextCalendarStudyScheduleRowIndex(lines, start.nextIndex, expectedNumber + 1);
    const segment = [];
    if (start.topicStart) segment.push(start.topicStart);
    for (let rowIndex = start.nextIndex; rowIndex < endIndex; rowIndex += 1) {
      const segmentLine = cleanupLine(lines[rowIndex]);
      if (!segmentLine || PAGE_NUMBER_RE.test(segmentLine)) continue;
      segment.push(segmentLine);
    }

    const row = parseCalendarStudyScheduleSegment({ start, segment, sectionTitles });
    if (row) {
      rows.push(row);
      expectedNumber += 1;
      index = endIndex;
      continue;
    }

    index = start.nextIndex;
  }

  return rows.length >= 6 && sumTopicHoursTotal(rows) > 0 ? rows : [];
}

function extractMonthlyCalendarStudyScheduleRows(lines) {
  const expandedLines = expandEmbeddedMonthlyCalendarStudyScheduleRows(lines);
  const headerIndex = findMonthlyCalendarStudyScheduleHeaderIndex(expandedLines);
  if (headerIndex < 0) return [];

  const rows = [];
  let expectedNumber = 1;
  let index = headerIndex + 1;

  while (index < expandedLines.length) {
    const line = cleanupLine(expandedLines[index]);
    if (rows.length && isMonthlyCalendarStudyScheduleTotalLine(line)) break;
    if (rows.length && /^(?:приложение|оценочные\s+материалы|список\s+литературы)/iu.test(line)) break;

    const start = readMonthlyCalendarStudyScheduleRowStart(expandedLines, index, expectedNumber);
    if (!start) {
      index += 1;
      continue;
    }

    const endIndex = findNextMonthlyCalendarStudyScheduleRowIndex(expandedLines, start.nextIndex, expectedNumber + 1);
    const segment = [];
    if (start.topicStart) segment.push(start.topicStart);
    for (let rowIndex = start.nextIndex; rowIndex < endIndex; rowIndex += 1) {
      const segmentLine = cleanupLine(expandedLines[rowIndex]);
      if (!segmentLine || PAGE_NUMBER_RE.test(segmentLine)) continue;
      segment.push(segmentLine);
    }

    const row = parseMonthlyCalendarStudyScheduleSegment({ start, segment });
    if (row) {
      rows.push(row);
      expectedNumber += 1;
      index = endIndex;
      continue;
    }

    index = start.nextIndex;
  }

  return rows.length >= 6 && sumTopicHoursTotal(rows) > 0 ? rows : [];
}

function extractCompactMonthlyCalendarStudyScheduleRows(lines) {
  const headerIndex = findCompactMonthlyCalendarStudyScheduleHeaderIndex(lines);
  if (headerIndex < 0) return [];

  const rows = [];
  let currentMode = "";
  let currentRow = null;

  const flushCurrentRow = () => {
    if (!currentRow) return;
    const row = buildCompactMonthlyCalendarStudyScheduleRow(currentRow);
    if (row) rows.push(row);
    currentRow = null;
  };

  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line || isCompactMonthlyCalendarStudyScheduleHeaderLine(line)) continue;
    if (/^итого\s+часов?/iu.test(line)) break;
    if (/^теори[яи]\s*:?\s*$/iu.test(line)) {
      flushCurrentRow();
      currentMode = "theory";
      continue;
    }
    if (/^практик[аи]\s*:?\s*$/iu.test(line)) {
      flushCurrentRow();
      currentMode = "practice";
      continue;
    }
    if (!currentMode) continue;

    const rowStart = readCompactMonthlyCalendarStudyScheduleRowStart(line);
    if (rowStart) {
      flushCurrentRow();
      currentRow = {
        mode: currentMode,
        rowNumber: rowStart.rowNumber,
        topicParts: [],
        hoursTotal: null,
        sourceLines: [line],
      };
      appendCompactMonthlyCalendarStudyScheduleRowLine(currentRow, rowStart.remainder);
      continue;
    }

    if (currentRow) {
      appendCompactMonthlyCalendarStudyScheduleRowLine(currentRow, line);
      if (!currentRow.sourceLines.includes(line)) currentRow.sourceLines.push(line);
    }
  }

  flushCurrentRow();

  const total = sumTopicHoursTotal(rows);
  return rows.length >= 6 && total > 0 ? rows : [];
}

function findCompactMonthlyCalendarStudyScheduleHeaderIndex(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!/календарн[а-яё]*\s*[- ]?\s*учебн[а-яё]*\s+график/iu.test(line)) continue;

    const window = lines
      .slice(index, index + 35)
      .map(cleanupLine)
      .join(" ");
    if (/содержание\s+занят/iu.test(window) && /январь.*февраль.*март.*апрель.*май/iu.test(window) && /теори[яи]/iu.test(window) && /практик[аи]/iu.test(window)) {
      return index;
    }
  }

  return -1;
}

function readCompactMonthlyCalendarStudyScheduleRowStart(line) {
  const match = cleanupLine(line).match(/^(\d{1,2})\.\s*(.+)$/u);
  if (!match) return null;

  const rowNumber = Number(match[1]);
  if (!Number.isInteger(rowNumber) || rowNumber <= 0 || rowNumber > 60) return null;

  return {
    rowNumber,
    remainder: cleanupLine(match[2]),
  };
}

function appendCompactMonthlyCalendarStudyScheduleRowLine(row, line) {
  const cleaned = cleanupLine(line);
  if (!cleaned) return;

  const parsed = parseCompactMonthlyCalendarStudyScheduleHoursTail(cleaned);
  if (parsed) {
    if (parsed.topicPart) row.topicParts.push(parsed.topicPart);
    row.hoursTotal = parsed.hoursTotal;
    return;
  }

  if (row.hoursTotal == null) row.topicParts.push(cleaned);
}

function parseCompactMonthlyCalendarStudyScheduleHoursTail(line) {
  const text = cleanupLine(line);
  const match = text.match(/^(.*?)(?:\s+)?(\d+(?:[,.]\d+)?(?:\s+\d+(?:[,.]\d+)?){1,7})$/u);
  if (!match) return null;

  const values = match[2].split(/\s+/u).map(parseHourCell).filter((value) => value != null);
  if (values.length < 2) return null;
  const hoursTotal = values[values.length - 1];
  const monthlySum = roundHour(values.slice(0, -1).reduce((sum, value) => sum + value, 0));
  if (hoursTotal == null || hoursTotal <= 0 || hoursTotal > 200) return null;
  if (Math.abs(monthlySum - hoursTotal) > 0.01) return null;

  return {
    topicPart: cleanupCalendarStudyScheduleTopic(match[1]),
    hoursTotal,
  };
}

function buildCompactMonthlyCalendarStudyScheduleRow(row) {
  if (row.hoursTotal == null || row.hoursTotal <= 0) return null;

  const topicName = cleanupCalendarStudyScheduleTopic(row.topicParts.join(" "));
  if (!isValidScheduleTopic(topicName) && !isCompactMonthlyCalendarGenericTopic(topicName)) return null;

  const isTheory = row.mode === "theory";
  const hoursTheory = isTheory ? row.hoursTotal : 0;
  const hoursPractice = isTheory ? 0 : row.hoursTotal;
  const modeTitle = isTheory ? "Теория" : "Практика";

  return {
    plan_number: String(row.rowNumber),
    section_title: `Календарный учебный график / ${modeTitle}`,
    topic_name: topicName,
    hours_theory: hoursTheory,
    hours_practice: hoursPractice,
    hours_total: row.hoursTotal,
    activity_type: inferActivityType({
      topicName,
      controlForm: "",
      hoursTheory,
      hoursPractice,
    }),
    control_form: "",
    source_section: "calendar-study-schedule",
    source_excerpt: row.sourceLines.join(" / ").slice(0, 1500),
    confidence: 0.87,
    raw_payload: {
      parser: "compact-monthly-calendar-study-schedule",
      row_number: row.rowNumber,
      mode: row.mode,
      ...(isCompactMonthlyCalendarGenericTopic(topicName) ? { allow_generic_topic: true } : {}),
    },
  };
}

function isCompactMonthlyCalendarGenericTopic(topicName) {
  return /^правила\s+поведения(?:\s|$)/iu.test(cleanupLine(topicName));
}

function isCompactMonthlyCalendarStudyScheduleHeaderLine(line) {
  return /^(?:№|п\\?\/?п|содержание\s+занят(?:ий)?|январь|февраль|март|апрель|май|часы)$/iu.test(cleanupLine(line));
}

function extractSimpleCalendarThematicPlanningRows(lines) {
  const headerIndex = findSimpleCalendarThematicPlanningHeaderIndex(lines);
  if (headerIndex < 0) return [];

  const endIndex = findSimpleCalendarThematicPlanningEndIndex(lines, headerIndex);
  const planTotal = extractSimpleCalendarThematicPlanningTotal(lines, headerIndex, endIndex);
  const rows = [];
  let currentSection = "Календарно-тематическое планирование";
  let currentRow = null;
  let expectedNumber = 1;

  const flushCurrentRow = () => {
    if (!currentRow) return;
    const row = buildSimpleCalendarThematicPlanningRow(currentRow, planTotal);
    if (row) rows.push(row);
    currentRow = null;
  };

  for (let index = headerIndex + 1; index < endIndex; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line || isSimpleCalendarThematicPlanningHeaderLine(line)) continue;
    if (TOTAL_RE.test(line)) break;

    const rowStart = readSimpleCalendarThematicPlanningRowStart(line, expectedNumber);
    if (rowStart) {
      flushCurrentRow();
      currentRow = {
        rowNumber: expectedNumber,
        sectionTitle: currentSection,
        topicParts: [],
        hoursTotal: null,
        sourceLines: [line],
        hoursLine: "",
      };
      if (rowStart.remainder) {
        appendSimpleCalendarThematicPlanningRowLine(currentRow, rowStart.remainder);
      }
      expectedNumber += 1;
      continue;
    }

    const section = parseSimpleCalendarThematicPlanningSectionLine(line);
    if (section) {
      flushCurrentRow();
      currentSection = section.title;
      continue;
    }

    if (currentRow && !isSimpleCalendarThematicPlanningNoiseLine(line, currentRow)) {
      appendSimpleCalendarThematicPlanningRowLine(currentRow, line);
    }
  }

  flushCurrentRow();

  const reconciledRows = reconcileSimpleCalendarThematicPlanningRows(rows, planTotal);
  if (reconciledRows.length < 6) return [];
  if (planTotal != null && Math.abs(sumTopicHoursTotal(reconciledRows) - planTotal) > 0.01) return [];
  return reconciledRows;
}

function findSimpleCalendarThematicPlanningHeaderIndex(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!/календарн[оы]\s*[- ]?\s*тематическ(?:ое|ий)?\s+планирован/iu.test(line)) continue;

    const window = lines
      .slice(index, index + 12)
      .map(cleanupLine)
      .join(" ");
    if (/тема\s+занят/iu.test(window) && /количество\s+час|кол-?во\s+час/iu.test(window)) return index;
  }

  return -1;
}

function findSimpleCalendarThematicPlanningEndIndex(lines, headerIndex) {
  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (TOTAL_RE.test(line)) return index + 1;
    if (index > headerIndex + 20 && /^(?:список\s+литературы|литература|методическ|материально)/iu.test(line)) {
      return index;
    }
  }
  return lines.length;
}

function extractSimpleCalendarThematicPlanningTotal(lines, headerIndex, endIndex) {
  for (let index = headerIndex + 1; index < endIndex; index += 1) {
    const match = cleanupLine(lines[index]).match(/^итого\s+(\d+(?:[,.]\d+)?)$/iu);
    if (!match) continue;
    return parseHourCell(match[1]);
  }
  return null;
}

function readSimpleCalendarThematicPlanningRowStart(line, expectedNumber) {
  const cleaned = cleanupLine(line);
  const prefixMatch = cleaned.match(/^(\d{1,3})\s+(.+)$/u);
  if (prefixMatch && Number(prefixMatch[1]) === expectedNumber) {
    return {
      remainder: cleanupLine(prefixMatch[2]),
    };
  }

  if (cleaned === String(expectedNumber)) {
    return {
      remainder: "",
    };
  }

  return null;
}

function parseSimpleCalendarThematicPlanningSectionLine(line) {
  const match = cleanupLine(line).match(/^(.+?)\s*\((\d+(?:[,.]\d+)?)\s*час(?:а|ов)?\)$/iu);
  if (!match) return null;

  const title = cleanupSimpleCalendarThematicPlanningTopic(match[1]);
  if (!isValidScheduleTopic(title)) return null;
  return {
    title,
    hoursTotal: parseHourCell(match[2]),
  };
}

function isSimpleCalendarThematicPlanningHeaderLine(line) {
  return /^(?:№|п\/?п|тема\s+занятия|тема|занятия|количество|кол-?во|часов)$/iu.test(cleanupLine(line));
}

function isSimpleCalendarThematicPlanningNoiseLine(line, currentRow) {
  const cleaned = cleanupLine(line);
  if (!PAGE_NUMBER_RE.test(cleaned)) return false;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return false;
  if (value > 12) return true;
  return currentRow?.hoursTotal != null;
}

function appendSimpleCalendarThematicPlanningRowLine(row, line) {
  const cleaned = cleanupLine(line);
  if (!cleaned || isSimpleCalendarThematicPlanningHeaderLine(cleaned)) return;
  if (!row.sourceLines.includes(cleaned)) row.sourceLines.push(cleaned);

  const standaloneHour = cleaned.match(/^(\d+(?:[,.]\d+)?)$/u);
  if (standaloneHour && row.topicParts.length > 0 && row.hoursTotal == null) {
    const hoursTotal = parseHourCell(standaloneHour[1]);
    if (isPlausibleSimpleCalendarThematicPlanningHours(hoursTotal)) {
      row.hoursTotal = hoursTotal;
      row.hoursLine = cleaned;
    }
    return;
  }

  const trailingHour = cleaned.match(/^(.+?)\s+(\d+(?:[,.]\d+)?)$/u);
  if (trailingHour) {
    const topicPart = cleanupSimpleCalendarThematicPlanningTopic(trailingHour[1]);
    const hoursTotal = parseHourCell(trailingHour[2]);
    if (isPlausibleSimpleCalendarThematicPlanningHours(hoursTotal) && isValidScheduleTopic(topicPart)) {
      row.topicParts.push(topicPart);
      if (row.hoursTotal == null) {
        row.hoursTotal = hoursTotal;
        row.hoursLine = cleaned;
      }
      return;
    }
  }

  if (row.hoursTotal == null) {
    row.topicParts.push(cleaned);
  }
}

function isPlausibleSimpleCalendarThematicPlanningHours(value) {
  return Number.isFinite(value) && value > 0 && value <= 12;
}

function buildSimpleCalendarThematicPlanningRow(row, planTotal) {
  const topicName = cleanupSimpleCalendarThematicPlanningTopic(row.topicParts.join(" "));
  if (!isValidScheduleTopic(topicName)) return null;

  return {
    plan_number: String(row.rowNumber),
    section_title: row.sectionTitle,
    topic_name: topicName,
    hours_theory: null,
    hours_practice: null,
    hours_total: row.hoursTotal,
    activity_type: inferActivityType({
      topicName,
      controlForm: "",
      hoursTheory: null,
      hoursPractice: null,
    }),
    control_form: "",
    source_section: "Календарно-тематическое планирование",
    source_excerpt: row.sourceLines.join(" / ").slice(0, 1500),
    confidence: row.hoursTotal == null ? 0.68 : 0.84,
    raw_payload: {
      parser: "simple-calendar-thematic-planning",
      row_number: row.rowNumber,
      plan_number: String(row.rowNumber),
      section_title: row.sectionTitle,
      hours_line: row.hoursLine,
      plan_total: planTotal,
    },
  };
}

function reconcileSimpleCalendarThematicPlanningRows(rows, planTotal) {
  if (planTotal == null) {
    return rows.filter((row) => row.hours_total != null);
  }

  const knownTotal = sumTopicHoursTotal(rows.filter((row) => row.hours_total != null));
  const missingRows = rows.filter((row) => row.hours_total == null);
  if (!missingRows.length) return rows;

  const missingTotal = roundHour(planTotal - knownTotal);
  if (missingTotal <= 0 || Math.abs(missingTotal - missingRows.length) > 0.01) {
    return rows.filter((row) => row.hours_total != null);
  }

  return rows.map((row) => {
    if (row.hours_total != null) return row;
    return {
      ...row,
      hours_total: 1,
      confidence: Math.min(row.confidence, 0.7),
      raw_payload: {
        ...row.raw_payload,
        hours_inferred: true,
      },
    };
  });
}

function cleanupSimpleCalendarThematicPlanningTopic(value) {
  return cleanupCalendarStudyScheduleTopic(value).trim();
}

function expandEmbeddedMonthlyCalendarStudyScheduleRows(lines) {
  const expanded = [];
  const rowStartRe = new RegExp(`\\s+(\\d{1,2}\\s+${MONTH_PATTERN})(?=\\s|$)`, "giu");

  for (const rawLine of lines) {
    const line = cleanupLine(rawLine);
    if (!line) continue;
    const parts = line
      .replace(rowStartRe, "\n$1")
      .replace(/\s+(\d{1,2}\s+итого\s*:)/giu, "\n$1")
      .split("\n");
    for (const part of parts) {
      const cleaned = cleanupLine(part);
      if (cleaned) expanded.push(cleaned);
    }
  }

  return expanded;
}

function findMonthlyCalendarStudyScheduleHeaderIndex(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!/календарн[а-яё]*\s*[- ]?\s*учебн[а-яё]*\s+график/iu.test(line)) continue;

    const window = lines
      .slice(index, index + 20)
      .map(cleanupLine)
      .join(" ");
    if (/месяц/iu.test(window) && /кол-?во\s+час/iu.test(window) && /тема\s+занят/iu.test(window)) {
      return index;
    }
  }

  return -1;
}

function readMonthlyCalendarStudyScheduleRowStart(lines, index, expectedNumber) {
  const line = cleanupLine(lines[index]);
  const match = line.match(new RegExp(`^${expectedNumber}\\s+(${MONTH_PATTERN})(?:\\s+(\\d+(?:[,.]\\d+)?))?(?:\\s+(.+))?$`, "iu"));
  if (!match) return null;

  const hoursTotal = match[2] ? parseHourCell(match[2]) : null;
  if (hoursTotal != null && (hoursTotal <= 0 || hoursTotal > 40)) return null;

  return {
    rowNumber: expectedNumber,
    month: cleanupLine(match[1]),
    hoursTotal,
    topicStart: cleanupLine(match[3] || ""),
    nextIndex: index + 1,
    sourceStart: line,
  };
}

function findNextMonthlyCalendarStudyScheduleRowIndex(lines, startIndex, nextNumber) {
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line) continue;
    if (isMonthlyCalendarStudyScheduleTotalLine(line)) return index;
    if (readMonthlyCalendarStudyScheduleRowStart(lines, index, nextNumber)) return index;
  }

  return lines.length;
}

function parseMonthlyCalendarStudyScheduleSegment({ start, segment }) {
  const topicParts = [];
  const controlParts = [];
  const sourceLines = [];
  let hoursTotal = start.hoursTotal;
  let sawHours = hoursTotal != null;
  let sawPlace = false;

  for (const rawLine of segment) {
    const line = cleanupLine(rawLine);
    if (!line || PAGE_NUMBER_RE.test(line) || isMonthlyCalendarStudyScheduleHeaderLine(line)) continue;
    sourceLines.push(line);

    if (!sawHours) {
      const hourMatch = line.match(/^(\d+(?:[,.]\d+)?)\s+(.+)$/u);
      if (!hourMatch) continue;
      hoursTotal = parseHourCell(hourMatch[1]);
      if (hoursTotal == null || hoursTotal <= 0 || hoursTotal > 40) return null;
      sawHours = true;
      const rest = cleanupLine(hourMatch[2]);
      if (rest) topicParts.push(rest);
      continue;
    }

    const split = splitCalendarStudyScheduleLine(line);
    if (isMonthlyCalendarStudySchedulePlacePrefixLine(line)) {
      sawPlace = true;
      if (split.controlPart) controlParts.push(split.controlPart);
      continue;
    }
    if (sawPlace || split.sawPlace || isMonthlyCalendarStudySchedulePlaceLine(line)) {
      sawPlace = true;
      if (split.controlPart) controlParts.push(split.controlPart);
      continue;
    }
    if (isCalendarStudyScheduleControlLine(line)) {
      controlParts.push(line);
      continue;
    }
    if (split.topicPart) topicParts.push(split.topicPart);
    if (split.controlPart) controlParts.push(split.controlPart);
  }

  if (hoursTotal == null || hoursTotal <= 0) return null;

  const topicName = cleanupCalendarStudyScheduleTopic(topicParts.join(" "));
  if (!isValidScheduleTopic(topicName)) return null;

  return {
    plan_number: String(start.rowNumber),
    section_title: "Календарный учебный график",
    topic_name: topicName,
    hours_theory: null,
    hours_practice: null,
    hours_total: hoursTotal,
    activity_type: "не определено",
    control_form: cleanupControlForm(cleanupCalendarStudyScheduleTopic(controlParts.join(" "))),
    source_section: "calendar-study-schedule",
    source_excerpt: [start.sourceStart, ...sourceLines].join(" / ").slice(0, 1500),
    confidence: 0.86,
    raw_payload: {
      parser: "monthly-calendar-study-schedule",
      row_number: start.rowNumber,
      month: start.month,
    },
  };
}

function isMonthlyCalendarStudyScheduleHeaderLine(line) {
  const cleaned = cleanupLine(line);
  return (
    isCalendarStudyScheduleHeaderLine(cleaned) ||
    /^(?:n|форма\s+занятия\s+кол-?во|часов\s+тема\s+занятия\s+место|аттестации\/контроля)$/iu.test(cleaned)
  );
}

function isMonthlyCalendarStudySchedulePlaceLine(line) {
  const cleaned = cleanupLine(line);
  return isCalendarStudySchedulePlaceLine(cleaned) || /^(?:г\.?\s*кировск[а,]?|кировск[а,]?|городской\s+парк\.?)$/iu.test(cleaned);
}

function isMonthlyCalendarStudySchedulePlacePrefixLine(line) {
  return /^(?:МБДОУ|г\.?\s*кировск|кировск|городской\s+парк)/iu.test(cleanupLine(line));
}

function isMonthlyCalendarStudyScheduleTotalLine(line) {
  const cleaned = cleanupLine(line);
  return TOTAL_RE.test(cleaned) || /^\d{1,2}\s+итого\s*:/iu.test(cleaned);
}

function findCalendarStudyScheduleHeaderIndex(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!/календарн[а-яё]*\s*[- ]?\s*учебн[а-яё]*\s+график/iu.test(line)) continue;

    const window = lines
      .slice(index, index + 18)
      .map(cleanupLine)
      .join(" ");
    if (/месяц/iu.test(window) && /число/iu.test(window) && /кол-?во\s+час/iu.test(window) && /номер\s+раздела/iu.test(window) && /тема\s+занят/iu.test(window)) {
      return index;
    }
  }

  return -1;
}

function extractCalendarStudyScheduleSectionTitles(lines) {
  const titles = new Map();
  for (const row of extractGenericNumberedStudyPlanRows(lines)) {
    const number = cleanupLine(row.plan_number || row.raw_payload?.plan_number || "");
    const title = cleanupLine(row.topic_name || "");
    if (/^\d+$/.test(number) && title) titles.set(number, title);
  }
  return titles;
}

function readCalendarStudyScheduleRowStart(lines, index, expectedNumber) {
  const line = cleanupLine(lines[index]);
  const prefixMatch = line.match(new RegExp(`^${expectedNumber}\\.\\s*(.*)$`, "u"));
  if (!prefixMatch) return null;

  let combined = cleanupLine(prefixMatch[1]);
  let nextIndex = index + 1;

  for (let attempts = 0; attempts < 5; attempts += 1) {
    const parsed = parseCalendarStudyScheduleStartText(combined);
    if (parsed) {
      return {
        ...parsed,
        rowNumber: expectedNumber,
        nextIndex,
        sourceStart: combined,
      };
    }

    if (nextIndex >= lines.length) break;
    const nextLine = cleanupLine(lines[nextIndex]);
    if (!nextLine || isCalendarStudyScheduleHeaderLine(nextLine)) {
      nextIndex += 1;
      continue;
    }
    if (/^\d{1,3}\.\s+/u.test(nextLine) || TOTAL_RE.test(nextLine)) break;

    combined = cleanupLine(`${combined} ${nextLine}`);
    nextIndex += 1;
  }

  return null;
}

function parseCalendarStudyScheduleStartText(value) {
  const text = cleanupLine(value);
  const monthPattern = `(${MONTH_PATTERN})`;
  const match = text.match(
    new RegExp(`^${monthPattern}\\s+(\\d{1,2})\\s+(\\d+(?:[,.]\\d+)?)\\s+(\\d{1,3})(?:\\s+(.+))?$`, "iu"),
  );
  if (!match) return null;

  const hoursTotal = parseHourCell(match[3]);
  const sectionNumber = Number(match[4]);
  if (!Number.isFinite(hoursTotal) || hoursTotal <= 0 || hoursTotal > 12) return null;
  if (!Number.isInteger(sectionNumber) || sectionNumber <= 0 || sectionNumber > 99) return null;

  return {
    month: cleanupLine(match[1]),
    day: Number(match[2]),
    hoursTotal,
    sectionNumber: String(sectionNumber),
    topicStart: cleanupLine(match[5] || ""),
  };
}

function findNextCalendarStudyScheduleRowIndex(lines, startIndex, nextNumber) {
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line) continue;
    if (TOTAL_RE.test(line)) return index;
    if (readCalendarStudyScheduleRowStart(lines, index, nextNumber)) return index;
  }

  return lines.length;
}

function parseCalendarStudyScheduleSegment({ start, segment, sectionTitles }) {
  const topicParts = [];
  const controlParts = [];
  const sourceLines = [];
  let sawPlace = false;

  for (const rawLine of segment) {
    const line = cleanupLine(rawLine);
    if (!line || PAGE_NUMBER_RE.test(line) || isCalendarStudyScheduleHeaderLine(line)) continue;
    sourceLines.push(line);

    if (topicParts.length && isCalendarStudyScheduleControlLine(line)) {
      controlParts.push(line);
      continue;
    }
    if (sawPlace && /^контроль$/iu.test(line)) {
      controlParts.push("Вводный контроль");
      continue;
    }
    if (sawPlace && isCalendarStudyScheduleStandaloneSectionLine(line)) {
      continue;
    }

    const split = splitCalendarStudyScheduleLine(line);
    if (!split.sawPlace && (isCalendarStudySchedulePlaceLine(line) || isCalendarStudySchedulePlaceContinuationLine(line))) {
      sawPlace = true;
      continue;
    }
    if (split.topicPart) topicParts.push(split.topicPart);
    if (split.controlPart) controlParts.push(split.controlPart);
    if (split.sawPlace) {
      sawPlace = true;
      continue;
    }

    if (isCalendarStudySchedulePlaceLine(line) || isCalendarStudySchedulePlaceContinuationLine(line)) {
      sawPlace = true;
      continue;
    }
  }

  const topicName = cleanupCalendarStudyScheduleTopic(topicParts.join(" "));
  if (!isValidScheduleTopic(topicName)) return null;

  const sectionTitle = sectionTitles.get(start.sectionNumber) || `Раздел ${start.sectionNumber}`;
  return {
    plan_number: String(start.rowNumber),
    section_title: sectionTitle,
    topic_name: topicName,
    hours_theory: null,
    hours_practice: null,
    hours_total: start.hoursTotal,
    activity_type: "не определено",
    control_form: cleanupControlForm(cleanupCalendarStudyScheduleTopic(controlParts.join(" "))),
    source_section: "calendar-study-schedule",
    source_excerpt: [String(start.rowNumber), start.sourceStart, ...sourceLines].join(" / ").slice(0, 1500),
    confidence: 0.86,
    raw_payload: {
      parser: "calendar-study-schedule",
      row_number: start.rowNumber,
      month: start.month,
      day: start.day,
      section_number: start.sectionNumber,
    },
  };
}

function extractTimetableCalendarStudyScheduleRows(lines) {
  const headerIndexes = findTimetableCalendarStudyScheduleHeaderIndexes(lines);
  const rows = [];

  for (let headerOffset = 0; headerOffset < headerIndexes.length; headerOffset += 1) {
    const headerIndex = headerIndexes[headerOffset];
    const nextHeaderIndex = headerIndexes[headerOffset + 1] ?? lines.length;
    const endIndex = findTimetableCalendarStudyScheduleEndIndex(lines, headerIndex, nextHeaderIndex);
    const blockTotal = extractTimetableCalendarStudyScheduleTotal(lines, headerIndex, endIndex);
    const sectionTitle = buildTimetableCalendarStudyScheduleSectionTitle(lines, headerIndex);
    const blockRows = extractTimetableCalendarStudyScheduleRowsFromRange({
      lines,
      headerIndex,
      endIndex,
      sectionTitle,
      blockTotal,
      blockIndex: headerOffset + 1,
    });
    if (isValidTimetableCalendarStudyScheduleBlock(blockRows, blockTotal)) {
      rows.push(...blockRows);
    }
  }

  if (rows.length >= 20) return rows;
  return extractNumberedTimetableCalendarStudyScheduleRows(lines);
}

function extractNumberedTimetableCalendarStudyScheduleRows(lines) {
  const headerIndexes = findTimetableCalendarStudyScheduleHeaderIndexes(lines);
  const rows = [];

  for (let headerOffset = 0; headerOffset < headerIndexes.length; headerOffset += 1) {
    const headerIndex = headerIndexes[headerOffset];
    const nextHeaderIndex = headerIndexes[headerOffset + 1] ?? lines.length;
    const endIndex = findTimetableCalendarStudyScheduleEndIndex(lines, headerIndex, nextHeaderIndex);
    const blockTotal = extractTimetableCalendarStudyScheduleTotal(lines, headerIndex, endIndex);
    const sectionTitle = buildTimetableCalendarStudyScheduleSectionTitle(lines, headerIndex);
    const blockRows = extractNumberedTimetableCalendarStudyScheduleRowsFromRange({
      lines,
      headerIndex,
      endIndex,
      sectionTitle,
      blockTotal,
      blockIndex: headerOffset + 1,
    });
    if (isValidTimetableCalendarStudyScheduleBlock(blockRows, blockTotal)) {
      rows.push(...blockRows);
    }
  }

  return rows.length >= 20 ? rows : [];
}

function findTimetableCalendarStudyScheduleHeaderIndexes(lines) {
  const indexes = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!/календарн[а-яё]*\s*[- ]?\s*учебн[а-яё]*\s+график/iu.test(line)) continue;

    const window = lines
      .slice(index, index + 24)
      .map(cleanupLine)
      .join(" ");
    if (
      /месяц/iu.test(window) &&
      /число/iu.test(window) &&
      /время/iu.test(window) &&
      /форма\s+занят/iu.test(window) &&
      /(?:количество|кол-?во)\s+час/iu.test(window) &&
      /тема\s+занят/iu.test(window) &&
      /место/iu.test(window) &&
      /контрол/iu.test(window)
    ) {
      indexes.push(index);
    }
  }

  return indexes;
}

function findTimetableCalendarStudyScheduleEndIndex(lines, headerIndex, nextHeaderIndex) {
  const hardEnd = Math.min(nextHeaderIndex, lines.length);
  for (let index = headerIndex + 1; index < hardEnd; index += 1) {
    const line = cleanupLine(lines[index]);
    if (isTimetableCalendarStudyScheduleTotalLine(line)) return index + 1;
    if (index > headerIndex + 40 && /^(?:приложение|оценочные\s+материалы|список\s+литературы)/iu.test(line)) {
      return index;
    }
  }
  return hardEnd;
}

function extractTimetableCalendarStudyScheduleTotal(lines, headerIndex, endIndex) {
  for (let index = headerIndex + 1; index < endIndex; index += 1) {
    const match = cleanupLine(lines[index]).match(/^итого\s*:?\s*(\d+(?:[,.]\d+)?)$/iu);
    if (!match) continue;
    return parseHourCell(match[1]);
  }
  return null;
}

function buildTimetableCalendarStudyScheduleSectionTitle(lines, headerIndex) {
  const levelLine = lines
    .slice(headerIndex + 1, headerIndex + 6)
    .map(cleanupLine)
    .find((line) => /\((?:стартов|базов)[^)]+\)/iu.test(line));
  if (!levelLine) return "Календарный учебный график";

  const level = cleanupLine(levelLine)
    .replace(/[()]/g, "")
    .replace(/\s*,\s*на\s+\d+(?:[,.]\d+)?\s*час(?:а|ов)?/iu, "");
  return level ? `Календарный учебный график: ${level}` : "Календарный учебный график";
}

function extractTimetableCalendarStudyScheduleRowsFromRange({
  lines,
  headerIndex,
  endIndex,
  sectionTitle,
  blockTotal,
  blockIndex,
}) {
  const rows = [];
  let expectedNumber = 1;
  let index = headerIndex + 1;

  while (index < endIndex) {
    const line = cleanupLine(lines[index]);
    if (!line || isTimetableCalendarStudyScheduleHeaderLine(line)) {
      index += 1;
      continue;
    }
    if (isTimetableCalendarStudyScheduleTotalLine(line)) break;

    const start = readTimetableCalendarStudyScheduleRowStart(lines, index, expectedNumber);
    if (!start) {
      index += 1;
      continue;
    }

    const nextIndex = findNextTimetableCalendarStudyScheduleRowIndex(lines, start.nextIndex, expectedNumber + 1, endIndex);
    const segment = [];
    if (start.remainder) segment.push(start.remainder);
    for (let rowIndex = start.nextIndex; rowIndex < nextIndex; rowIndex += 1) {
      const segmentLine = cleanupLine(lines[rowIndex]);
      if (!segmentLine) continue;
      segment.push(segmentLine);
    }

    const row = parseTimetableCalendarStudyScheduleSegment({
      start,
      segment,
      sectionTitle,
      blockTotal,
      blockIndex,
    });
    if (row) {
      rows.push(row);
      expectedNumber += 1;
      index = nextIndex;
      continue;
    }

    index = start.nextIndex;
  }

  return rows;
}

function extractNumberedTimetableCalendarStudyScheduleRowsFromRange({
  lines,
  headerIndex,
  endIndex,
  sectionTitle,
  blockTotal,
  blockIndex,
}) {
  const rows = [];
  let expectedNumber = 1;
  let index = headerIndex + 1;

  while (index < endIndex) {
    const line = cleanupLine(lines[index]);
    if (!line || isTimetableCalendarStudyScheduleHeaderLine(line)) {
      index += 1;
      continue;
    }
    if (isTimetableCalendarStudyScheduleTotalLine(line)) break;

    const start = readNumberedTimetableCalendarStudyScheduleRowStart(lines, index, expectedNumber);
    if (!start) {
      index += 1;
      continue;
    }

    const nextIndex = findNextNumberedTimetableCalendarStudyScheduleRowIndex(
      lines,
      start.nextIndex,
      expectedNumber + 1,
      endIndex,
    );
    const segment = [];
    if (start.remainder) segment.push(start.remainder);
    for (let rowIndex = start.nextIndex; rowIndex < nextIndex; rowIndex += 1) {
      const segmentLine = cleanupLine(lines[rowIndex]);
      if (!segmentLine) continue;
      segment.push(segmentLine);
    }

    const row = parseNumberedTimetableCalendarStudyScheduleSegment({
      start,
      segment,
      sectionTitle,
      blockTotal,
      blockIndex,
    });
    if (row) {
      rows.push(row);
      expectedNumber += 1;
      index = nextIndex;
      continue;
    }

    index = start.nextIndex;
  }

  return rows;
}

function readTimetableCalendarStudyScheduleRowStart(lines, index, expectedNumber) {
  const line = cleanupLine(lines[index]);
  const match = line.match(new RegExp(`^${expectedNumber}\\.\\s*(${MONTH_PATTERN})(?:\\s+(.+))?$`, "iu"));
  if (!match) return null;

  return {
    rowNumber: expectedNumber,
    month: cleanupLine(match[1]),
    remainder: cleanupLine(match[2] || ""),
    sourceStart: line,
    nextIndex: index + 1,
  };
}

function readNumberedTimetableCalendarStudyScheduleRowStart(lines, index, expectedNumber) {
  const line = cleanupLine(lines[index]);
  const match = line.match(new RegExp(`^${expectedNumber}\\.?(?:\\s+(.+))?$`, "u"));
  if (!match) return null;

  return {
    rowNumber: expectedNumber,
    month: "",
    remainder: cleanupLine(match[1] || ""),
    sourceStart: line,
    nextIndex: index + 1,
  };
}

function findNextTimetableCalendarStudyScheduleRowIndex(lines, startIndex, nextNumber, endIndex) {
  for (let index = startIndex; index < endIndex; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line) continue;
    if (isTimetableCalendarStudyScheduleTotalLine(line)) return index;
    if (readTimetableCalendarStudyScheduleRowStart(lines, index, nextNumber)) return index;
  }

  return endIndex;
}

function findNextNumberedTimetableCalendarStudyScheduleRowIndex(lines, startIndex, nextNumber, endIndex) {
  for (let index = startIndex; index < endIndex; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line) continue;
    if (isTimetableCalendarStudyScheduleTotalLine(line)) return index;
    if (readNumberedTimetableCalendarStudyScheduleRowStart(lines, index, nextNumber)) return index;
  }

  return endIndex;
}

function parseTimetableCalendarStudyScheduleSegment({ start, segment, sectionTitle, blockTotal, blockIndex }) {
  const sourceLines = [start.sourceStart];
  const activityParts = [];
  const topicParts = [];
  const controlParts = [];
  let hoursTotal = null;
  let activityLine = "";
  let sawPlace = false;

  const appendContentLine = (line) => {
    if (!line || isTimetableCalendarStudyScheduleHeaderLine(line) || isTimetableCalendarSectionHeadingLine(line)) return;

    const split = splitTimetableCalendarPlaceAndControlLine(line);
    if (split.sawPlace) sawPlace = true;

    if (split.topicPart) {
      topicParts.push(split.topicPart);
    }

    if (split.controlPart) {
      controlParts.push(split.controlPart);
      return;
    }

    if (sawPlace) {
      if (isTimetableCalendarControlLine(line)) {
        controlParts.push(line);
      } else if (!split.sawPlace && isValidScheduleTopic(cleanupTimetableCalendarStudyScheduleTopic(line))) {
        topicParts.push(line);
      }
      return;
    }

    if (isTimetableCalendarControlLine(line)) {
      controlParts.push(line);
      return;
    }

    if (!split.sawPlace) {
      topicParts.push(line);
    }
  };

  for (const rawLine of segment) {
    const line = cleanupLine(rawLine);
    if (!line || isTimetableCalendarStudyScheduleHeaderLine(line)) continue;
    if (isTimetableCalendarPageNumberLine(line)) continue;
    sourceLines.push(line);

    if (hoursTotal == null) {
      const combined = cleanupLine([...activityParts, line].join(" "));
      const hourSplit = splitTimetableCalendarActivityHours(combined);
      if (hourSplit) {
        hoursTotal = hourSplit.hoursTotal;
        activityLine = cleanupTimetableCalendarActivityLine(hourSplit.activityPart);
        if (hourSplit.topicPart) appendContentLine(hourSplit.topicPart);
        activityParts.length = 0;
        continue;
      }

      activityParts.push(line);
      continue;
    }

    appendContentLine(line);
  }

  if (hoursTotal == null || hoursTotal <= 0) return null;

  const topicName = cleanupTimetableCalendarStudyScheduleTopic(topicParts.join(" "));
  if (!isValidTimetableCalendarStudyScheduleTopic(topicName)) return null;

  const controlForm = cleanupControlForm(cleanupTimetableCalendarControlForm(controlParts.join(" ")));
  const shouldBypassGenericTopicFilter = !isValidTopic(topicName) || isBibliographicOrEquipmentTopic(topicName);
  return {
    plan_number: `${blockIndex}.${start.rowNumber}`,
    section_title: sectionTitle || "Календарный учебный график",
    topic_name: topicName,
    hours_theory: null,
    hours_practice: null,
    hours_total: hoursTotal,
    activity_type:
      normalizeTimetableCalendarActivityType(activityLine) ||
      inferActivityType({
        topicName,
        controlForm,
        hoursTheory: null,
        hoursPractice: null,
      }),
    control_form: controlForm,
    source_section: "calendar-study-schedule",
    source_excerpt: sourceLines.join(" / ").slice(0, 1500),
    confidence: 0.88,
    raw_payload: {
      parser: "timetable-calendar-study-schedule",
      row_number: start.rowNumber,
      plan_number: `${blockIndex}.${start.rowNumber}`,
      calendar_block: blockIndex,
      month: start.month,
      activity_line: activityLine,
      block_total: blockTotal,
      source_lines: sourceLines,
      ...(shouldBypassGenericTopicFilter ? { allow_generic_topic: true } : {}),
    },
  };
}

function parseNumberedTimetableCalendarStudyScheduleSegment({ start, segment, sectionTitle, blockTotal, blockIndex }) {
  const sourceLines = [start.sourceStart];
  const activityParts = [];
  const topicParts = [];
  const controlParts = [];
  let hoursTotal = null;
  let activityLine = "";
  let sawPlace = false;
  let sawControl = false;

  const appendContentLine = (rawLine) => {
    const line = cleanupLine(rawLine);
    if (!line || isTimetableCalendarStudyScheduleHeaderLine(line) || isTimetableCalendarPageNumberLine(line)) return;

    const split = splitNumberedTimetableCalendarPlaceAndControlLine(line);
    if (split.topicPart && !sawPlace) {
      topicParts.push(split.topicPart);
    }
    if (split.sawPlace) {
      sawPlace = true;
    }
    if (split.controlPart) {
      controlParts.push(split.controlPart);
      sawControl = true;
      return;
    }

    if (sawPlace) {
      if (isNumberedTimetableCalendarPlaceLine(line)) return;
      if (isNumberedTimetableCalendarControlLine(line) || isNumberedTimetableCalendarControlContinuationLine(line, controlParts)) {
        controlParts.push(line);
        sawControl = true;
        return;
      }
      if (sawControl && isNumberedTimetableCalendarLateTopicContinuationLine(line, topicParts)) {
        topicParts.push(line);
      }
      return;
    }

    if (isNumberedTimetableCalendarControlLine(line)) {
      controlParts.push(line);
      sawControl = true;
      return;
    }

    topicParts.push(line);
  };

  for (const rawLine of segment) {
    const line = cleanupLine(rawLine);
    if (!line || isTimetableCalendarStudyScheduleHeaderLine(line)) continue;
    if (isTimetableCalendarPageNumberLine(line)) continue;
    sourceLines.push(line);

    if (hoursTotal == null) {
      const combined = cleanupLine([...activityParts, line].join(" "));
      const hourSplit = splitTimetableCalendarActivityHours(combined);
      if (hourSplit) {
        hoursTotal = hourSplit.hoursTotal;
        activityLine = cleanupTimetableCalendarActivityLine(hourSplit.activityPart);
        if (hourSplit.topicPart) appendContentLine(hourSplit.topicPart);
        activityParts.length = 0;
        continue;
      }

      activityParts.push(line);
      continue;
    }

    appendContentLine(line);
  }

  if (hoursTotal == null || hoursTotal <= 0) return null;

  const topicName = cleanupTimetableCalendarStudyScheduleTopic(topicParts.join(" "));
  if (!isValidTimetableCalendarStudyScheduleTopic(topicName)) return null;

  const controlForm = cleanupControlForm(cleanupNumberedTimetableCalendarControlForm(controlParts.join(" ")));
  const shouldBypassGenericTopicFilter = !isValidTopic(topicName) || isBibliographicOrEquipmentTopic(topicName);
  return {
    plan_number: String(start.rowNumber),
    section_title: sectionTitle || "Календарный учебный график",
    topic_name: topicName,
    hours_theory: null,
    hours_practice: null,
    hours_total: hoursTotal,
    activity_type:
      normalizeTimetableCalendarActivityType(activityLine) ||
      inferActivityType({
        topicName,
        controlForm,
        hoursTheory: null,
        hoursPractice: null,
      }),
    control_form: controlForm,
    source_section: "calendar-study-schedule",
    source_excerpt: sourceLines.join(" / ").slice(0, 1500),
    confidence: 0.86,
    raw_payload: {
      parser: "numbered-timetable-calendar-study-schedule",
      row_number: start.rowNumber,
      plan_number: String(start.rowNumber),
      calendar_block: blockIndex,
      activity_line: activityLine,
      block_total: blockTotal,
      source_lines: sourceLines,
      ...(shouldBypassGenericTopicFilter ? { allow_generic_topic: true } : {}),
    },
  };
}

function splitTimetableCalendarActivityHours(value) {
  const text = cleanupLine(value);
  const matches = [...text.matchAll(/(?:^|\s)(\d+(?:[,.]\d+)?)(?=\s|$)/gu)];
  for (const match of matches) {
    const hoursTotal = parseHourCell(match[1]);
    if (hoursTotal == null || hoursTotal <= 0 || hoursTotal > 12) continue;

    const before = cleanupLine(text.slice(0, match.index));
    if (!looksLikeTimetableCalendarActivity(before)) continue;

    return {
      activityPart: before,
      hoursTotal,
      topicPart: cleanupLine(text.slice(match.index + match[0].length)),
    };
  }

  return null;
}

function looksLikeTimetableCalendarActivity(value) {
  const text = cleanupLine(value);
  if (!text) return false;
  return /(расписанию|беседа|презентац|викторин|теори[яи]|практик|практическ|контрольн|занятие|соревнован|экскурс)/iu.test(text);
}

function cleanupTimetableCalendarActivityLine(value) {
  return cleanupLine(value)
    .replace(new RegExp(`^${MONTH_PATTERN}\\s+`, "iu"), "")
    .replace(/^(?:по\s+)?расписанию\s*/iu, "")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTimetableCalendarActivityType(value) {
  const text = cleanupLine(value).toLowerCase();
  if (/теори/.test(text) && /практи/.test(text)) return "теория+практика";
  if (/теори/.test(text)) return "теория";
  if (/контроль/.test(text)) return "контроль";
  if (/практик|практическ|соревнован|экскурс/.test(text)) return "практика";
  if (/бесед|презентац|викторин/.test(text)) return "теория";
  return "";
}

function splitNumberedTimetableCalendarPlaceAndControlLine(value) {
  let text = cleanupLine(value);
  const placeMatch = findNumberedTimetableCalendarPlaceMatch(text);
  let topicPart = "";
  let controlPart = "";
  let sawPlace = false;

  if (placeMatch) {
    sawPlace = true;
    topicPart = cleanupLine(text.slice(0, placeMatch.index));
    text = cleanupLine(text.slice(placeMatch.index + placeMatch.text.length));
  }

  const controlMatch = sawPlace || isNumberedTimetableCalendarControlLine(text)
    ? findNumberedTimetableCalendarControlMatch(text)
    : null;
  if (controlMatch) {
    if (!sawPlace) topicPart = cleanupLine(text.slice(0, controlMatch.index));
    controlPart = cleanupLine(text.slice(controlMatch.index));
    return {
      topicPart,
      controlPart,
      sawPlace,
    };
  }

  return {
    topicPart,
    controlPart,
    sawPlace,
  };
}

function findNumberedTimetableCalendarPlaceMatch(value) {
  const text = cleanupLine(value);
  const match = text.match(
    /(^|\s)(мурманская\s+обл\.?|кольский\s+р-?|р-\s*н|н,\s*пгт|пгт\s+[А-ЯЁа-яё-]+|ул\s+[А-ЯЁа-яё-]+|молодежная|д\s+\d+|каб\.?|естествознания)(?=\s|,|\.|-|$)/iu,
  );
  return match ? { index: match.index + match[1].length, text: match[2] } : null;
}

function findNumberedTimetableCalendarControlMatch(value) {
  const text = cleanupLine(value);
  const match = text.match(
    /(^|\s)((?:текущая|промежуточная|итоговая)\s+аттестация|тестирование|экскурсия|защита\s+презентации|защита|аттестация)(?=\s|,|\.|$).*$/iu,
  );
  return match ? { index: match.index + match[1].length, text: cleanupLine(text.slice(match.index + match[1].length)) } : null;
}

function isNumberedTimetableCalendarPlaceLine(line) {
  const text = cleanupLine(line);
  const match = findNumberedTimetableCalendarPlaceMatch(text);
  return Boolean(match && match.index === 0);
}

function isNumberedTimetableCalendarControlLine(line) {
  return /^(?:текущая|промежуточная|итоговая|аттестация|текущая\s+аттестация|промежуточная\s+аттестация|итоговая\s+аттестация|тестирование|экскурсия|защита|защита\s+презентации)$/iu.test(
    cleanupLine(line),
  );
}

function isNumberedTimetableCalendarControlContinuationLine(line, controlParts) {
  const previous = cleanupLine((controlParts || []).join(" "));
  const cleaned = cleanupLine(line);
  if (!previous || !cleaned) return false;
  if (/^(?:текущая|промежуточная|итоговая)$/iu.test(previous) && /^аттестация$/iu.test(cleaned)) return true;
  if (/^защита$/iu.test(previous) && /^презентации$/iu.test(cleaned)) return true;
  return false;
}

function isNumberedTimetableCalendarLateTopicContinuationLine(line, topicParts) {
  const cleaned = cleanupLine(line);
  if (!cleaned || cleaned.length > 120 || isTotalTopicName(cleaned)) return false;
  if (isNumberedTimetableCalendarPlaceLine(cleaned) || isNumberedTimetableCalendarControlLine(cleaned)) return false;
  if (/^(?:н,|пгт|ул|молодежная|д\s+\d+|каб\.?|естествознания)$/iu.test(cleaned)) return false;
  if (!/[А-ЯЁа-яё]/u.test(cleaned)) return false;

  const previousTopic = cleanupLine((topicParts || []).join(" "));
  if (/(?:^|\s)(?:и|с|со|по|в|во|на|для|при|от|до|из|к|ко)$/iu.test(previousTopic)) return true;
  if (/[,;:-]$/u.test(previousTopic)) return true;
  if (/^[а-яё]/u.test(cleaned)) return true;
  return false;
}

function cleanupNumberedTimetableCalendarControlForm(value) {
  return cleanupTimetableCalendarControlForm(value)
    .replace(/\b(текущая|промежуточная|итоговая)\s+аттестация\b/giu, (_, kind) => `${kind} аттестация`)
    .replace(/\bзащита\s+презентации\b/giu, "Защита презентации")
    .replace(/\s+/g, " ")
    .trim();
}

function splitTimetableCalendarPlaceAndControlLine(value) {
  let text = cleanupLine(value);
  const placeMatch = findTimetableCalendarPlaceMatch(text);
  let topicPart = "";
  let controlPart = "";
  let sawPlace = false;

  if (placeMatch) {
    sawPlace = true;
    topicPart = cleanupLine(text.slice(0, placeMatch.index));
    text = cleanupLine(text.slice(placeMatch.index + placeMatch.text.length));
  }

  const controlMatch = findTimetableCalendarControlMatch(text);
  if (controlMatch) {
    if (!sawPlace) topicPart = cleanupLine(text.slice(0, controlMatch.index));
    controlPart = cleanupLine(text.slice(controlMatch.index));
    return {
      topicPart,
      controlPart,
      sawPlace,
    };
  }

  if (sawPlace) {
    return {
      topicPart,
      controlPart: isTimetableCalendarControlLine(text) ? text : "",
      sawPlace,
    };
  }

  return {
    topicPart: "",
    controlPart: "",
    sawPlace: false,
  };
}

function findTimetableCalendarPlaceMatch(value) {
  const text = cleanupLine(value);
  const match = text.match(
    /(^|\s)(учебн(?:ый|ом)?\s+кабинет|учебн(?:ый|ом)?|кабинет|стадион|спортивн(?:ая|ой)?\s+площадк[аеи]?|спортивн(?:ая|ой)?|площадк[аеи]?|территория\s+ЦВР|территория|ЦВР|лесопарков(?:ая|ой)?\s+зон[аеи]?|лесопарков(?:ая|ой)?|зон[аеи]?|парк|природ[ае]|музе[йя])(?=\s|,|\\.|$)/iu,
  );
  return match ? { index: match.index + match[1].length, text: match[2] } : null;
}

function findTimetableCalendarControlMatch(value) {
  const text = cleanupLine(value);
  const match = text.match(
    /(^|\s)(собеседование|тестирование|наблюдение|самостоятельная\s+работа|краткий\s+опрос|блиц-опрос|опрос|зач[её]т|соревнование|проверка\s+тур\.?\s*навыков|проверка|тур\.?\s*навыков)(?=\s|,|\\.|$).*$/iu,
  );
  return match ? { index: match.index + match[1].length, text: cleanupLine(text.slice(match.index + match[1].length)) } : null;
}

function isTimetableCalendarControlLine(line) {
  const text = cleanupLine(line);
  return /^(?:собеседование,?|тестирование,?|наблюдение,?|самостоятельная(?:\s+работа)?|работа|краткий\s+опрос|блиц-опрос,?|опрос,?|зач[её]т|соревнование|проверка|тур\.?\s*навыков\.?)$/iu.test(
    text,
  );
}

function cleanupTimetableCalendarControlForm(value) {
  return cleanupLine(value)
    .replace(/\bсамостоятельная\s+работа\b/giu, "самостоятельная работа")
    .replace(/\bсамостоятельная\s+работа\s+работа\b/giu, "самостоятельная работа")
    .replace(/\bпроверка\s+тур\.?\s*навыков\b/giu, "проверка тур. навыков")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanupTimetableCalendarStudyScheduleTopic(value) {
  return cleanupCalendarStudyScheduleTopic(value)
    .replace(/\b180и\s+360\b/giu, "180 и 360")
    .replace(/([.!?])(?=[А-ЯЁ])/gu, "$1 ")
    .replace(/заливглавная/giu, "залив - главная")
    .replace(/маршрутапутешествия/giu, "маршрута-путешествия")
    .replace(/\s+(?:беседа|консультация),?(?=\s|$)/giu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isValidTimetableCalendarStudyScheduleTopic(topic) {
  if (isValidScheduleTopic(topic)) return true;
  const text = cleanupLine(topic);
  if (!text || text.length < 3 || text.length > 600) return false;
  if (/^[\d\s.,:-]+$/u.test(text)) return false;
  if (/^(месяц|тема|раздел|занятие|количество|форма|контроль|теория|практика|всего)$/iu.test(text)) return false;
  if (/федеральн|постановление|приказ|санпин|нормативно|концепци|распоряжение|www\.|http/iu.test(text)) {
    return false;
  }
  return /[А-ЯЁа-яё]/u.test(text);
}

function isTimetableCalendarStudyScheduleHeaderLine(line) {
  const cleaned = cleanupLine(line);
  return (
    isCalendarStudyScheduleHeaderLine(cleaned) ||
    /^(?:время|проведения|форма\s+занятия|количество|часов\s+тема\s+занятия\s+место|проведения\s+форма\s+контроля|форма\s+контроля)$/iu.test(
      cleaned,
    )
  );
}

function isTimetableCalendarStudyScheduleTotalLine(line) {
  return /^итого\s*:?\s*\d+(?:[,.]\d+)?$/iu.test(cleanupLine(line));
}

function isTimetableCalendarPageNumberLine(line) {
  const number = Number(cleanupLine(line));
  return Number.isInteger(number) && number >= 20 && number <= 200;
}

function isTimetableCalendarSectionHeadingLine(line) {
  return /^(?:заключительное\s+занятие)$/iu.test(cleanupLine(line));
}

function isValidTimetableCalendarStudyScheduleBlock(rows, blockTotal) {
  if (!Array.isArray(rows) || rows.length < 20) return false;
  if (blockTotal == null) return true;
  return Math.abs(sumTopicHoursTotal(rows) - blockTotal) <= 0.01;
}

function isCalendarStudyScheduleHeaderLine(line) {
  return /^(?:№|п\/п|месяц|число|время|проведения|занятия|кол-?во|часов|номер|раздела|тема\s+занятия|место|форма|контроля)$/iu.test(
    cleanupLine(line),
  );
}

function splitCalendarStudyScheduleLine(line) {
  let text = cleanupLine(line);
  const controlMatch = text.match(
    /(вводный\s+контроль|решение\s+кейсов|наблюдение(?:,\s*консультация)?|консультация|опрос|деловая\s+игра|мозговой\s+штурм|игра|викторина|выставка\s+творческих\s+работ|выставка|тест)\b.*$/iu,
  );
  const controlPart = controlMatch && controlMatch.index > 0 ? cleanupLine(text.slice(controlMatch.index)) : "";
  if (controlPart) text = cleanupLine(text.slice(0, controlMatch.index));

  const placeMatch = text.match(
    /(МБДОУ|МБОУДО|МБОУ|МБУ|Музей|Национальн(?:ый|ом)?|библиотек[аи]?|центр\s+детского\s+творчества|культурный\s+центр).*$/iu,
  );
  const sawPlace = Boolean(placeMatch);
  if (placeMatch && placeMatch.index >= 0) {
    text = cleanupLine(text.slice(0, placeMatch.index));
  }

  return {
    topicPart: text,
    controlPart,
    sawPlace,
  };
}

function isCalendarStudyScheduleControlLine(line) {
  return /^(?:вводный\s+контроль|решение\s+кейсов|наблюдение,?|консультация|наблюдение,\s*консультация|опрос|деловая\s+игра|мозговой\s+штурм|игра|викторина|выставка\s+творческих\s+работ|выставка|тест)$/iu.test(
    cleanupLine(line),
  );
}

function isCalendarStudySchedulePlaceLine(line) {
  const cleaned = cleanupLine(line);
  if (isLikelyPlace(cleaned)) return true;
  return /^(?:МБДОУ|МБОУДО|МБОУ|МБУ|Музей,?|Национальн(?:ый|ом)?|библиотек[аи]?|культурный\s+центр)$/iu.test(cleaned);
}

function isCalendarStudySchedulePlaceContinuationLine(line) {
  return /^(?:детского|творчества.*|средня|средняя|я\s+средня|общеобразователь(?:ная)?|ная\s+школа.*|школа|музей|библиотека|село)$/iu.test(
    cleanupLine(line),
  );
}

function isCalendarStudyScheduleStandaloneSectionLine(line) {
  return /^(?:защита\s+проекта)$/iu.test(cleanupLine(line));
}

function cleanupCalendarStudyScheduleTopic(value) {
  return cleanupThematicText(value)
    .replace(/\s+([.,;:])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function extractStudyPlanContentHourRows(lines) {
  const topics = [];
  const startIndex = findStudyPlanContentHourStartIndex(lines);
  if (startIndex < 0) return topics;

  let currentModule = "";
  const planRows = extractStudyPlanTableRowsBeforeContent(lines, startIndex);

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line || PAGE_NUMBER_RE.test(line)) continue;
    if (/^\d+(?:\.\d+)*\s+планируемые\s+результаты/iu.test(line)) break;
    if (/^ii\.\s+/iu.test(line)) break;

    const moduleTitle = parseStudyPlanContentModuleTitle(line);
    if (moduleTitle) {
      currentModule = moduleTitle;
      const nextLine = cleanupLine(lines[index + 1]);
      if (
        /[,،]\s*$/u.test(currentModule) &&
        nextLine &&
        !parseStudyPlanContentTopicStart(nextLine) &&
        !parseStudyPlanContentModuleTitle(nextLine)
      ) {
        currentModule = cleanupStudyPlanContentText(`${currentModule} ${nextLine}`);
        index += 1;
      }
      continue;
    }

    const topicStart = parseStudyPlanContentTopicStart(line);
    if (!topicStart) continue;

    const segment = [topicStart.text];
    let nextIndex = index + 1;
    for (; nextIndex < lines.length; nextIndex += 1) {
      const nextLine = cleanupLine(lines[nextIndex]);
      if (!nextLine || PAGE_NUMBER_RE.test(nextLine)) continue;
      if (
        parseStudyPlanContentTopicStart(nextLine) ||
        parseStudyPlanContentModuleTitle(nextLine) ||
        /^\d+(?:\.\d+)*\s+планируемые\s+результаты/iu.test(nextLine) ||
        /^ii\.\s+/iu.test(nextLine)
      ) {
        break;
      }
      segment.push(nextLine);
      if (extractStudyPlanContentHours(segment.join(" "))) {
        nextIndex += 1;
        break;
      }
    }

    const row = parseStudyPlanContentTopicSegment({
      topicNumber: topicStart.number,
      segment,
      currentModule,
      planRow: planRows[topics.length],
    });
    if (row) topics.push(row);
    index = nextIndex - 1;
  }

  return topics;
}

function findStudyPlanContentHourStartIndex(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!/^содержание\s+учебного\s+плана$/iu.test(line)) continue;

    const window = lines
      .slice(index + 1, index + 18)
      .map(cleanupLine)
      .join(" ");
    if (/модуль\s+\d+/iu.test(window) && /тема\s+\d+\s*:/iu.test(window) && /час/iu.test(window)) {
      return index;
    }
  }

  return -1;
}

function extractStudyPlanTableRowsBeforeContent(lines, contentStartIndex) {
  let planStartIndex = -1;
  for (let index = contentStartIndex - 1; index >= 0; index -= 1) {
    if (/^\d+(?:\.\d+)*\s+учебный\s+план$/iu.test(cleanupLine(lines[index]))) {
      planStartIndex = index + 1;
      break;
    }
  }
  if (planStartIndex < 0) return [];

  const rows = [];
  for (let index = planStartIndex; index < contentStartIndex; index += 1) {
    const line = cleanupLine(lines[index]);
    const start = line.match(/^(\d{1,3})\.\s*(.+)$/u);
    if (!start || /^(итого|всего)/iu.test(start[2])) continue;

    const segment = [start[2]];
    let nextIndex = index + 1;
    for (; nextIndex < contentStartIndex; nextIndex += 1) {
      const nextLine = cleanupLine(lines[nextIndex]);
      if (!nextLine) continue;
      if (/^модуль\s+\d+/iu.test(nextLine) || /^\d{1,3}\.\s+/.test(nextLine)) break;
      segment.push(nextLine);
    }

    const parsed = parseStudyPlanTableHoursSegment(segment);
    if (parsed) rows.push(parsed);
    index = nextIndex - 1;
  }

  return rows;
}

function parseStudyPlanTableHoursSegment(segment) {
  const text = cleanupStudyPlanContentText(segment.join(" "));
  const match = text.match(/(\d+(?:[,.]\d+)?)\s+(-|\d+(?:[,.]\d+)?)\s+(-|\d+(?:[,.]\d+)?)(?:\s+(.+))?/u);
  if (!match) return null;

  const hoursTotal = parseHourCell(match[1]);
  const hoursTheory = parseHourCell(match[2]);
  const hoursPractice = parseHourCell(match[3]);
  if (!isPlausibleHours(hoursTheory, hoursPractice, hoursTotal)) return null;

  return {
    hoursTotal,
    hoursTheory,
    hoursPractice,
    controlForm: cleanupControlForm(match[4] || ""),
  };
}

function parseStudyPlanContentModuleTitle(line) {
  const match = cleanupLine(line).match(/^(модуль\s+\d+\.?\s+.+)$/iu);
  if (!match) return "";
  return cleanupStudyPlanContentText(match[1]);
}

function parseStudyPlanContentTopicStart(line) {
  const match = cleanupLine(line).match(/^тема\s+(\d+(?:\.\d+)*)\s*:\s*(.+)$/iu);
  if (!match) return null;
  return {
    number: match[1],
    text: match[2],
  };
}

function parseStudyPlanContentTopicSegment({ topicNumber, segment, currentModule, planRow }) {
  const joined = cleanupStudyPlanContentText(segment.join(" "));
  const hours = extractStudyPlanContentHours(joined);
  if (!hours) return null;

  const topicName = cleanupStudyPlanContentTopicName(joined.slice(0, hours.matchIndex));
  if (!isValidScheduleTopic(topicName)) return null;
  const hoursTotal = planRow?.hoursTotal ?? hours.hoursTotal;
  const hoursTheory = planRow?.hoursTheory ?? null;
  const hoursPractice = planRow?.hoursPractice ?? null;

  return {
    section_title: currentModule,
    topic_name: topicName,
    hours_theory: hoursTheory,
    hours_practice: hoursPractice,
    hours_total: hoursTotal,
    activity_type: inferActivityTypeFromHours(hoursTheory, hoursPractice),
    control_form: "",
    source_section: "Содержание учебного плана",
    source_excerpt: [currentModule, `Тема ${topicNumber}`, ...segment].join(" / ").slice(0, 1500),
    confidence: 0.88,
    raw_payload: {
      parser: "study-plan-content-hours",
      module_title: currentModule,
      topic_number: topicNumber,
      plan_row_hours_total: planRow?.hoursTotal ?? null,
      plan_row_hours_theory: planRow?.hoursTheory ?? null,
      plan_row_hours_practice: planRow?.hoursPractice ?? null,
      plan_row_control_form: planRow?.controlForm ?? "",
      source_lines: segment,
    },
  };
}

function extractStudyPlanContentHours(value) {
  const text = cleanupStudyPlanContentText(value);
  const match = text.match(/[-–—]\s*(\d+(?:[,.]\d+)?)\s*час(?:а|ов)?\.?\s*$/iu);
  if (!match) return null;
  const hoursTotal = parseHourCell(match[1]);
  if (!Number.isFinite(hoursTotal) || hoursTotal <= 0 || hoursTotal > 1000) return null;
  return {
    hoursTotal,
    matchIndex: match.index,
  };
}

function cleanupStudyPlanContentTopicName(value) {
  return cleanupStudyPlanContentText(value)
    .replace(/^[\s:.-]+/u, "")
    .replace(/[.]\s*$/u, "")
    .trim();
}

function cleanupStudyPlanContentText(value) {
  return String(value || "")
    .replace(/[«»]/g, "\"")
    .replace(/([А-Яа-яЁё])-\s+([А-Яа-яЁё])/gu, "$1-$2")
    .replace(/(^|\s)((?:[А-Яа-яЁё]\s+){2,}[А-Яа-яЁё])(?=\s|$)/gu, (_match, prefix, spaced) => `${prefix}${spaced.replace(/\s+/g, "")}`)
    .replace(/\s+([.,;:])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function extractModuleStudyPlanContentRows(lines) {
  const topics = [];
  const blocks = findModuleStudyPlanBlocks(lines);

  for (const block of blocks) {
    const contentSections = extractModuleContentSections(lines, block.contentStartIndex, block.contentEndIndex);

    if (shouldUseModulePlanSectionsAsRows({ block, contentSections, lines })) {
      topics.push(...buildModuleStudyPlanSectionRows(block));
      continue;
    }

    for (const planSection of block.planSections) {
      const contentSection = contentSections.get(planSection.number);
      const topicNames = contentSection?.topics?.length
        ? contentSection.topics
        : [contentSection?.title || planSection.title];

      const allocations = allocateModuleSectionHours({
        hoursTotal: planSection.hoursTotal,
        hoursTheory: planSection.hoursTheory,
        hoursPractice: planSection.hoursPractice,
        count: topicNames.length,
      });

      topicNames.forEach((topicName, index) => {
        const cleanedTopicName = cleanupModuleStudyPlanText(topicName);
        if (!isValidScheduleTopic(cleanedTopicName)) return;
        const allocation = allocations[index] || {};

        topics.push({
          section_title: cleanupModuleStudyPlanText(`${block.moduleTitle}. ${planSection.title}`),
          topic_name: cleanedTopicName,
          hours_theory: allocation.hoursTheory,
          hours_practice: allocation.hoursPractice,
          hours_total: allocation.hoursTotal,
          activity_type: inferActivityTypeFromHours(allocation.hoursTheory, allocation.hoursPractice),
          control_form: "",
          source_section: "Учебный план и содержание программы",
          source_excerpt: [block.moduleTitle, planSection.sourceLine, cleanedTopicName].join(" / ").slice(0, 1500),
          confidence: 0.84,
          raw_payload: {
            parser: "module-study-plan-content",
            module_title: block.moduleTitle,
            section_number: planSection.number,
            section_title: planSection.title,
            section_hours_total: planSection.hoursTotal,
            section_hours_theory: planSection.hoursTheory,
            section_hours_practice: planSection.hoursPractice,
            topics_in_section: topicNames.length,
          },
        });
      });
    }
  }

  return topics;
}

function shouldUseModulePlanSectionsAsRows({ block, contentSections, lines }) {
  if (!block || !Array.isArray(block.planSections)) return false;
  if (block.planSections.length < 3 || block.planSections.length > 8) return false;
  if (!contentSections || contentSections.size < Math.ceil(block.planSections.length * 0.6)) return false;

  const matchedPlanSections = block.planSections.filter((planSection) => contentSections.has(planSection.number)).length;
  if (matchedPlanSections < Math.ceil(block.planSections.length * 0.6)) return false;

  const contentTopicCount = [...contentSections.values()].reduce(
    (sum, section) => sum + (Array.isArray(section.topics) ? section.topics.length : 0),
    0,
  );
  if (contentTopicCount < block.planSections.length) return false;

  const contentLines = lines.slice(block.contentStartIndex, block.contentEndIndex).map(cleanupLine);
  if (contentLines.some(isExplicitModuleContentTopicHoursLine)) return false;

  return true;
}

function isExplicitModuleContentTopicHoursLine(line) {
  const cleaned = cleanupLine(line);
  return /^тема\s+\d+(?:\.\d+)*\b.+(?:[-:]\s*)?\d+(?:[,.]\d+)?\s*час(?:а|ов)?\.?$/iu.test(cleaned);
}

function buildModuleStudyPlanSectionRows(block) {
  return block.planSections
    .map((planSection) => {
      const topicName = cleanupModuleStudyPlanText(planSection.title);
      if (!isValidScheduleTopic(topicName)) return null;

      return {
        section_title: block.moduleTitle,
        topic_name: topicName,
        hours_theory: planSection.hoursTheory,
        hours_practice: planSection.hoursPractice,
        hours_total: planSection.hoursTotal,
        activity_type: inferActivityTypeFromHours(planSection.hoursTheory, planSection.hoursPractice),
        control_form: "",
        source_section: "Учебный план реализации программы",
        source_excerpt: [block.moduleTitle, planSection.sourceLine].join(" / ").slice(0, 1500),
        confidence: 0.88,
        raw_payload: {
          parser: "module-study-plan-section",
          module_title: block.moduleTitle,
          section_number: planSection.number,
          section_title: planSection.title,
          section_hours_total: planSection.hoursTotal,
          section_hours_theory: planSection.hoursTheory,
          section_hours_practice: planSection.hoursPractice,
          section_level_hours: true,
        },
      };
    })
    .filter(Boolean);
}

function findModuleStudyPlanBlocks(lines) {
  const blocks = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!/^\d+(?:\.\d+)*\.\s+учебный\s+план\s+реализации\s+программы$/iu.test(line)) continue;

    const moduleTitle = findNextModuleTitle(lines, index + 1);
    if (!moduleTitle) continue;

    const plan = parseModuleStudyPlanTable(lines, moduleTitle.index + 1);
    if (plan.planSections.length < 2) continue;

    const contentStartIndex = findModuleContentStartIndex(lines, plan.nextIndex);
    if (contentStartIndex < 0) continue;

    blocks.push({
      moduleTitle: moduleTitle.title,
      planSections: plan.planSections,
      contentStartIndex: contentStartIndex + 1,
      contentEndIndex: findModuleContentEndIndex(lines, contentStartIndex + 1),
    });
  }

  return blocks;
}

function findNextModuleTitle(lines, startIndex) {
  for (let index = startIndex; index < Math.min(lines.length, startIndex + 8); index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line || PAGE_NUMBER_RE.test(line)) continue;
    const match = line.match(/^модуль\s+(.+)$/iu);
    if (match) {
      return {
        title: cleanupModuleStudyPlanText(`Модуль ${match[1]}`),
        index,
      };
    }
  }

  return null;
}

function parseModuleStudyPlanTable(lines, startIndex) {
  const planSections = [];
  let index = startIndex;

  while (index < lines.length) {
    const line = cleanupLine(lines[index]);
    if (!line) {
      index += 1;
      continue;
    }
    if (/^итого(?=$|[:\s])/iu.test(line)) {
      return {
        planSections,
        nextIndex: index + 1,
      };
    }

    const row = parseModuleStudyPlanRowAt(lines, index);
    if (row) {
      planSections.push(row.planSection);
      index = row.nextIndex;
      continue;
    }

    index += 1;
  }

  return {
    planSections,
    nextIndex: index,
  };
}

function parseModuleStudyPlanRowAt(lines, startIndex) {
  const firstLine = cleanupLine(lines[startIndex]);
  if (!/^\d{1,2}\s+/u.test(firstLine)) return null;

  const sameLine = firstLine.match(/^(\d{1,2})\s+(.+?)\s+(\d+(?:[,.]\d+)?)\s+(\d+(?:[,.]\d+)?)\s+(\d+(?:[,.]\d+)?)$/u);
  if (sameLine) {
    return buildModuleStudyPlanRow({
      number: Number(sameLine[1]),
      titleParts: [sameLine[2]],
      hourValues: [sameLine[3], sameLine[4], sameLine[5]],
      sourceLines: [firstLine],
      nextIndex: startIndex + 1,
    });
  }

  const start = firstLine.match(/^(\d{1,2})\s+(.+)$/u);
  if (!start) return null;

  const titleParts = [start[2]];
  const sourceLines = [firstLine];

  for (let index = startIndex + 1; index < Math.min(lines.length, startIndex + 8); index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line) continue;

    const hours = line.match(/^(\d+(?:[,.]\d+)?)\s+(\d+(?:[,.]\d+)?)\s+(\d+(?:[,.]\d+)?)$/u);
    if (hours) {
      return buildModuleStudyPlanRow({
        number: Number(start[1]),
        titleParts,
        hourValues: [hours[1], hours[2], hours[3]],
        sourceLines: [...sourceLines, line],
        nextIndex: index + 1,
      });
    }

    const titleHours = line.match(/^(.+?)\s+(\d+(?:[,.]\d+)?)\s+(\d+(?:[,.]\d+)?)\s+(\d+(?:[,.]\d+)?)$/u);
    if (titleHours) {
      return buildModuleStudyPlanRow({
        number: Number(start[1]),
        titleParts: [...titleParts, titleHours[1]],
        hourValues: [titleHours[2], titleHours[3], titleHours[4]],
        sourceLines: [...sourceLines, line],
        nextIndex: index + 1,
      });
    }

    if (/^итого(?=$|[:\s])/iu.test(line) || /^\d{1,2}\s+/.test(line)) break;

    titleParts.push(line);
    sourceLines.push(line);
  }

  return null;
}

function buildModuleStudyPlanRow({ number, titleParts, hourValues, sourceLines, nextIndex }) {
  const hoursTotal = parseHourCell(hourValues[0]);
  const hoursTheory = parseHourCell(hourValues[1]);
  const hoursPractice = parseHourCell(hourValues[2]);
  if (!isPlausibleHours(hoursTheory, hoursPractice, hoursTotal)) return null;

  return {
    planSection: {
      number,
      title: cleanupModuleStudyPlanText(titleParts.join(" ")),
      hoursTotal,
      hoursTheory,
      hoursPractice,
      sourceLine: sourceLines.join(" / "),
    },
    nextIndex,
  };
}

function findModuleContentStartIndex(lines, startIndex) {
  for (let index = startIndex; index < Math.min(lines.length, startIndex + 8); index += 1) {
    if (/^содержание\s+программы$/iu.test(cleanupLine(lines[index]))) return index;
  }

  return -1;
}

function findModuleContentEndIndex(lines, startIndex) {
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (/^\d+(?:\.\d+)*\.\s+учебный\s+план\s+реализации\s+программы$/iu.test(line)) return index;
    if (/^\d+(?:\.\d+)*\.\s+планируемые\s+результаты/iu.test(line)) return index;
    if (/^2\.\d+\.\s+/u.test(line)) return index;
  }

  return lines.length;
}

function extractModuleContentSections(lines, startIndex, endIndex) {
  const sections = new Map();
  let currentSection = null;

  for (let index = startIndex; index < endIndex; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line || PAGE_NUMBER_RE.test(line)) continue;

    const section = parseModuleContentSectionLine(line);
    if (section) {
      currentSection = {
        number: section.number,
        title: section.title,
        topics: [],
      };
      sections.set(section.number, currentSection);
      continue;
    }

    if (!currentSection) continue;

    const topic = parseModuleContentTopicLine(lines, index, endIndex);
    if (topic) {
      currentSection.topics.push(topic.topicName);
      index = topic.nextIndex - 1;
    }
  }

  return sections;
}

function parseModuleContentSectionLine(line) {
  const sectionMatch = cleanupLine(line).match(/^раздел\s+(\d{1,2})\.\s*(.+)$/iu);
  if (sectionMatch) {
    return {
      number: Number(sectionMatch[1]),
      title: cleanupModuleStudyPlanText(sectionMatch[2]),
    };
  }

  const numberedMatch = cleanupLine(line).match(/^(\d{1,2})\.\s+(.+)$/u);
  if (numberedMatch && !/^тема\b/iu.test(numberedMatch[2])) {
    return {
      number: Number(numberedMatch[1]),
      title: cleanupModuleStudyPlanText(numberedMatch[2]),
    };
  }

  return null;
}

function parseModuleContentTopicLine(lines, startIndex, endIndex) {
  const line = cleanupLine(lines[startIndex]);
  const match = line.match(/^тема\s+(\d+(?:\.\d+)*)\.?\s*(.+)$/iu);
  if (!match) return null;

  const parts = [match[2]];
  let nextIndex = startIndex + 1;

  for (; nextIndex < Math.min(endIndex, startIndex + 4); nextIndex += 1) {
    const next = cleanupLine(lines[nextIndex]);
    if (!next || PAGE_NUMBER_RE.test(next)) continue;
    if (/^(тема\b|раздел\s+\d+\.|\d{1,2}\.\s+|практические\s+занятия|содержание\s+программы)/iu.test(next)) break;

    const shouldContinue =
      /^[а-яё]/u.test(next) ||
      (/^[А-ЯЁ][а-яё-]+\.?$/u.test(next) && parts.join(" ").length < 90) ||
      /(?:\bв|\bи|\bс|\bпо|\bдля|\bкак|\bприменения|\bпозиция\s*-)$/iu.test(cleanupLine(parts.join(" ")));

    if (!shouldContinue) break;
    parts.push(next);
    if (/[.!?]$/u.test(next)) {
      nextIndex += 1;
      break;
    }
  }

  return {
    topicName: cleanupModuleStudyPlanText(parts.join(" ")),
    nextIndex,
  };
}

function allocateModuleSectionHours({ hoursTotal, hoursTheory, hoursPractice, count }) {
  const safeCount = Math.max(1, count);
  return Array.from({ length: safeCount }, (_, index) => ({
    hoursTotal: splitHourValue(hoursTotal, safeCount, index),
    hoursTheory: splitHourValue(hoursTheory, safeCount, index),
    hoursPractice: splitHourValue(hoursPractice, safeCount, index),
  }));
}

function splitHourValue(value, count, index) {
  if (value == null) return null;
  if (count <= 1) return value;
  const base = Math.floor((Number(value) / count) * 100) / 100;
  if (index < count - 1) return roundHour(base);
  return roundHour(Number(value) - base * (count - 1));
}

function cleanupModuleStudyPlanText(value) {
  return String(value || "")
    .replace(/[«»]/g, "\"")
    .replace(/([А-Яа-яЁё])-\s+([А-Яа-яЁё])/gu, "$1-$2")
    .replace(/\s+([.,;:])/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.]\s*$/u, "");
}

function extractAppendixCalendarPlanningRows(lines) {
  const topics = [];
  const headerIndex = findAppendixCalendarPlanningHeaderIndex(lines);
  if (headerIndex < 0) return topics;

  let currentRow = null;
  let expectedNumber = 1;

  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line || isAppendixCalendarHeaderLine(line)) continue;

    const rowStart = parseAppendixCalendarRowStart(line);
    if (rowStart && rowStart.number === expectedNumber) {
      if (currentRow) {
        const topic = parseAppendixCalendarPlanningSegment(currentRow);
        if (topic) topics.push(topic);
      }
      currentRow = {
        rowNumber: rowStart.number,
        lines: [rowStart.remainder],
      };
      expectedNumber += 1;
      continue;
    }

    if (!currentRow) continue;
    if (topics.length > 0 && /^(приложение|список\s+литературы|содержание\s+программы)\b/iu.test(line)) break;
    currentRow.lines.push(line);
  }

  if (currentRow) {
    const topic = parseAppendixCalendarPlanningSegment(currentRow);
    if (topic) topics.push(topic);
  }

  return topics;
}

function findAppendixCalendarPlanningHeaderIndex(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!/календарн[оы]\s*[- ]?\s*тематическ(?:ое|ий)?\s+планирован/iu.test(line)) continue;

    const window = lines
      .slice(index, index + 12)
      .map(cleanupLine)
      .join(" ")
      .toLowerCase();
    if (/тематический\s+блок/iu.test(window) && /тема\s+занятия/iu.test(window) && /вид\s+деятельности/iu.test(window)) {
      return index;
    }
  }

  return -1;
}

function isAppendixCalendarHeaderLine(line) {
  return /^(№|дата|тематический|блок|кол-?во|часов|тема\s+занятия|вид\s+деятельности|обучающихся|электронные\s+ресурсы)$/iu.test(
    cleanupLine(line),
  );
}

function parseAppendixCalendarRowStart(line) {
  const match = cleanupLine(line).match(/^(\d{1,3})[.)]\s*(.+)$/u);
  if (!match) return null;

  const number = Number(match[1]);
  if (!Number.isInteger(number) || number <= 0 || number > 500) return null;

  return {
    number,
    remainder: cleanupLine(match[2]),
  };
}

function parseAppendixCalendarPlanningSegment(row) {
  const lines = row.lines
    .map(cleanupAppendixCalendarLine)
    .filter((line) => line && !PAGE_NUMBER_RE.test(line) && !isAppendixCalendarHeaderLine(line));
  if (!lines.length) return null;

  const hoursSplit = findAppendixCalendarHoursSplit(lines);
  if (!hoursSplit) return null;

  const sectionTitle = normalizeAppendixCalendarSectionTitle(hoursSplit.sectionLines.join(" "));
  const topicAndActivity = splitAppendixCalendarTopicActivity(hoursSplit.topicActivityLines);
  const topicName = cleanupAppendixCalendarTopic(topicAndActivity.topicParts.join(" "));
  if (!isValidScheduleTopic(topicName)) return null;

  const activityText = cleanupAppendixCalendarActivity(topicAndActivity.activityParts.join(" "));

  return {
    section_title: sectionTitle,
    topic_name: topicName,
    hours_theory: null,
    hours_practice: null,
    hours_total: hoursSplit.hoursTotal,
    activity_type: activityText,
    control_form: "",
    source_section: "Календарно-тематическое планирование",
    source_excerpt: [String(row.rowNumber), ...row.lines].join(" / ").slice(0, 1500),
    confidence: 0.86,
    raw_payload: {
      parser: "appendix-calendar-planning",
      row_number: row.rowNumber,
      section_lines: hoursSplit.sectionLines,
      activity_line: activityText,
      source_lines: row.lines,
    },
  };
}

function findAppendixCalendarHoursSplit(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    const leadingHours = line.match(/^(\d+(?:[,.]\d+)?)\s+(.+)$/u);
    if (leadingHours) {
      const hoursTotal = parseHourCell(leadingHours[1]);
      if (isPlausibleAppendixCalendarHours(hoursTotal)) {
        return {
          sectionLines: lines.slice(0, index),
          hoursTotal,
          topicActivityLines: [leadingHours[2], ...lines.slice(index + 1)],
        };
      }
    }

    const embeddedHours = line.match(/^(.+?)\s+(\d+(?:[,.]\d+)?)\s+(.+)$/u);
    if (embeddedHours) {
      const hoursTotal = parseHourCell(embeddedHours[2]);
      if (isPlausibleAppendixCalendarHours(hoursTotal)) {
        return {
          sectionLines: [...lines.slice(0, index), embeddedHours[1]],
          hoursTotal,
          topicActivityLines: [embeddedHours[3], ...lines.slice(index + 1)],
        };
      }
    }
  }

  return null;
}

function isPlausibleAppendixCalendarHours(value) {
  return Number.isFinite(value) && value > 0 && value <= 24;
}

function splitAppendixCalendarTopicActivity(lines) {
  const topicParts = [];
  const activityParts = [];
  let insideActivity = false;

  for (const rawLine of lines) {
    let line = cleanupAppendixCalendarLine(rawLine);
    if (!line || PAGE_NUMBER_RE.test(line)) continue;

    if (insideActivity) {
      line = cleanupAppendixCalendarActivityContinuation(line);
      if (line) activityParts.push(line);
      continue;
    }

    const inline = splitAppendixCalendarInlineActivity(line);
    if (inline) {
      if (inline.topicPart) topicParts.push(inline.topicPart);
      if (inline.activityPart) activityParts.push(inline.activityPart);
      insideActivity = true;
      continue;
    }

    if (isAppendixCalendarActivityLine(line)) {
      activityParts.push(line);
      insideActivity = true;
      continue;
    }

    topicParts.push(line);
  }

  return {
    topicParts,
    activityParts,
  };
}

function splitAppendixCalendarInlineActivity(line) {
  const match = cleanupLine(line).match(
    /(познавательная\s+беседа|туристические\s+активности|экскурсия(?=\s|,|$)|посещение(?=\s|,|$)|региональный\s+этап\s+игры|итоговая\s+беседа|защита\s+проектной\s+работы|просмотр\s+видеофрагментов|выполнение\s+заданий|митинг(?=\s|,|$)|вахта\s+памяти|возложение\s+цветов)/iu,
  );
  if (!match) return null;

  return {
    topicPart: cleanupLine(line.slice(0, match.index)),
    activityPart: cleanupLine(line.slice(match.index)),
  };
}

function isAppendixCalendarActivityLine(line) {
  return /^(познавательная\s+беседа|просмотр\s+видеофрагментов|выполнение\s+заданий|туристические\s+активности|экскурсия(?=\s|,|$)|посещение(?=\s|,|$)|региональный\s+этап\s+игры|итоговая\s+беседа|защита\s+проектной\s+работы|митинг(?=\s|,|$)|вахта\s+памяти|возложение\s+цветов)/iu.test(
    cleanupLine(line),
  );
}

function cleanupAppendixCalendarTopic(value) {
  return String(value || "")
    .replace(/^[•·*-]\s*/u, "")
    .replace(/^\d+(?:[.)]|\.\d+)\s*/u, "")
    .replace(MONTH_RE, "")
    .replace(/([А-Яа-яЁё])-\s+([А-Яа-яЁё])/gu, "$1-$2")
    .replace(/\s+/g, " ")
    .replace(/[«»]/g, '"')
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
}

function cleanupAppendixCalendarLine(line) {
  const cleaned = cleanupLine(line).replace(/\s*https?:\/\/.*$/iu, "").trim();
  if (!cleaned) return "";
  if (/^(?:https?:\/\/|www\.)/iu.test(cleaned)) return "";
  if (/^(?:[a-z0-9_-]+\/)+[a-z0-9_.-]*$/iu.test(cleaned)) return "";
  if (/^[a-z0-9_.-]+\.html$/iu.test(cleaned)) return "";
  return cleaned;
}

function cleanupAppendixCalendarActivityContinuation(line) {
  return cleanupLine(line).replace(/^(?:Мурманской\s+области|культура)\s+/iu, "");
}

function cleanupAppendixCalendarActivity(value) {
  return cleanupLine(value)
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/\s*\/\s*/g, "/")
    .trim();
}

function normalizeAppendixCalendarSectionTitle(value) {
  const text = cleanupLine(value);
  if (/мурманская\s+область\s+в/iu.test(text)) return "Мурманская область в составе России";
  if (/образование,\s*наука/iu.test(text)) return "Образование, наука и культура";
  if (/природа\s+и\s+география/iu.test(text)) return "Природа и география Мурманской области";
  if (/экономика/iu.test(text)) return "Экономика Мурманской области";
  if (/на\s+севере\s*-\s*перспектив/iu.test(text)) return "На Севере - перспективы!";
  if (/итоговое\s+обобщение/iu.test(text)) return "Итоговое обобщение";
  return text;
}

function extractMultilineThematicPlanRows(lines) {
  const topics = [];
  const headerIndexes = findMultilineThematicPlanHeaderIndexes(lines);
  if (!headerIndexes.length) return topics;

  for (const headerIndex of headerIndexes) {
    const hourOrder = detectBasicStudyPlanHourOrder(lines, headerIndex);
    const endIndex = findMultilineThematicPlanEndIndex(lines, headerIndex, headerIndexes);
    let currentYearSection = "";
    let currentSection = "";
    let index = headerIndex + 1;

    while (index < endIndex) {
      const line = cleanupLine(lines[index]);
      if (!line) {
        index += 1;
        continue;
      }
      if (isThematicPlanStopLine(line)) break;

      const yearSection = detectYearSection(line);
      if (yearSection) {
        currentYearSection = cleanupThematicText(yearSection);
        currentSection = currentYearSection;
        index += 1;
        continue;
      }

      const sectionStart = parseThematicSectionStart(line);
      if (sectionStart) {
        const nextIndex = findNextThematicItemIndex(lines, index + 1, endIndex);
        const sectionTitle = cleanupThematicText(
          collectThematicTitleBeforeHours([sectionStart.title, ...lines.slice(index + 1, nextIndex)]),
        );
        currentSection = joinThematicSectionTitle(currentYearSection, sectionTitle);
        index = nextIndex;
        continue;
      }

      const topicStart = parseThematicTopicStart(line);
      if (!topicStart) {
        index += 1;
        continue;
      }

      const nextIndex = findNextThematicItemIndex(lines, index + 1, endIndex);
      const segment = [topicStart.title, ...lines.slice(index + 1, nextIndex).map(cleanupLine).filter(Boolean)];
      const topic = parseMultilineThematicTopicSegment({
        topicNumber: topicStart.number,
        segment,
        currentSection,
        hourOrder,
      });

      if (topic) {
        topics.push(topic);
      }

      index = nextIndex;
    }
  }

  return topics;
}

function extractSectionContentTopicRows(lines) {
  const startIndex = findSectionContentTopicStartIndex(lines);
  if (startIndex < 0) return [];

  const topics = [];
  let currentSection = "";
  let index = startIndex + 1;

  while (index < lines.length) {
    const line = cleanupLine(lines[index]);
    if (!line || PAGE_NUMBER_RE.test(line)) {
      index += 1;
      continue;
    }
    if (isSectionContentTopicStopLine(line)) break;

    const section = parseSectionContentSectionLine(line);
    if (section) {
      currentSection = section;
      index += 1;
      continue;
    }

    if (!isSectionContentTopicStartLine(line)) {
      index += 1;
      continue;
    }

    const nextIndex = findNextSectionContentTopicItemIndex(lines, index + 1);
    const segment = lines.slice(index, nextIndex).map(cleanupLine).filter(Boolean);
    const topic = parseSectionContentTopicSegment({
      segment,
      currentSection,
    });

    if (topic) {
      topics.push(topic);
    }

    index = nextIndex;
  }

  return topics;
}

function findSectionContentTopicStartIndex(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!/^содержание\s+программы:?$/iu.test(line)) continue;

    const window = lines
      .slice(index, index + 20)
      .map(cleanupLine)
      .join(" ");
    if (/раздел\s+\d+\..+?\d+\s+час/iu.test(window) && /тема\s+\d+(?:\.\d+)?\./iu.test(window)) {
      return index;
    }
  }

  return -1;
}

function parseSectionContentSectionLine(line) {
  const match = cleanupLine(line).match(/^(раздел\s+\d+\.\s*.+?)\.?\s+\d+(?:[,.]\d+)?\s+час(?:а|ов)?\.?$/iu);
  if (!match) return "";
  return cleanupLine(match[1]).replace(/\s+/g, " ");
}

function isSectionContentTopicStartLine(line) {
  return /^тема\s+\d+(?:\.\d+)?\./iu.test(cleanupLine(line));
}

function findNextSectionContentTopicItemIndex(lines, startIndex) {
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line) continue;
    if (isSectionContentTopicStopLine(line)) return index;
    if (parseSectionContentSectionLine(line)) return index;
    if (isSectionContentTopicStartLine(line)) return index;
  }

  return lines.length;
}

function parseSectionContentTopicSegment({ segment, currentSection }) {
  const lines = segment
    .map(cleanupLine)
    .filter((line) => line && !PAGE_NUMBER_RE.test(line));
  if (!lines.length) return null;

  const text = lines.join(" ").replace(/\s+/g, " ").trim();
  const titleMatch = text.match(/^тема\s+(\d+(?:\.\d+)?)\.?\s+(.+?)\s+(?:[-–]\s*)?(\d+(?:[,.]\d+)?)\s+час(?:а|ов)?\.?/iu);
  if (!titleMatch) return null;

  const topicNumber = titleMatch[1];
  const topicName = cleanupSectionContentTopicName(titleMatch[2]);
  if (!isValidTopic(topicName)) return null;

  const hoursTotal = parseHourCell(titleMatch[3]);
  let hoursTheory = extractSectionContentPartHours(text, /теори[яи]\.?\s*/iu);
  let hoursPractice = extractSectionContentPartHours(text, /практик[аи]\.?\s*/iu);

  if (hoursTheory == null && hoursPractice == null && /\(\s*практик[аи]\s*\)/iu.test(topicName)) {
    hoursTheory = 0;
    hoursPractice = hoursTotal;
  }

  if (hoursTheory == null && hoursPractice != null && hoursTotal != null) {
    hoursTheory = roundHour(hoursTotal - hoursPractice);
  }
  if (hoursPractice == null && hoursTheory != null && hoursTotal != null) {
    hoursPractice = roundHour(hoursTotal - hoursTheory);
  }

  if (hoursTheory == null) hoursTheory = 0;
  if (hoursPractice == null) hoursPractice = 0;

  if (!isPlausibleHours(hoursTheory, hoursPractice, hoursTotal)) return null;

  const activityType = inferLessonThematicPlanningActivityType({
    hoursTheory,
    hoursPractice,
  });

  return {
    section_title: currentSection,
    topic_name: topicName,
    hours_theory: hoursTheory,
    hours_practice: hoursPractice,
    hours_total: hoursTotal,
    activity_type: activityType,
    control_form: "",
    source_section: "section-content-topic-hours",
    source_excerpt: text.slice(0, 1500),
    confidence: 0.9,
    raw_payload: {
      parser: "section-content-topic-hours",
      topic_number: topicNumber,
      parsed_lines: lines,
    },
  };
}

function extractSectionContentPartHours(text, markerRe) {
  const markerMatch = text.match(markerRe);
  if (!markerMatch) return null;

  const afterMarker = text.slice(markerMatch.index + markerMatch[0].length);
  const hoursMatch = afterMarker.match(/(\d+(?:[,.]\d+)?)\s+час(?:а|ов)?/iu);
  if (!hoursMatch) return null;
  return parseHourCell(hoursMatch[1]);
}

function cleanupSectionContentTopicName(value) {
  return cleanupTopicName(value)
    .replace(/([А-Яа-яЁё])\s+-\s*([А-Яа-яЁё])/gu, "$1-$2")
    .replace(/Кольск\s+ого/giu, "Кольского")
    .trim();
}

function isSectionContentTopicStopLine(line) {
  return /^(методическ|материально|мониторинг|список\s+литературы|календарн[оы]\s*[- ]?\s*учебн)/iu.test(
    cleanupLine(line),
  );
}

function extractTheoryPracticeTotalStudyPlanRows(lines) {
  const startIndex = findTheoryPracticeTotalStudyPlanHeaderIndex(lines);
  if (startIndex < 0) return [];

  const topics = [];
  let segment = null;

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line || (PAGE_NUMBER_RE.test(line) && !segment) || isTheoryPracticeTotalStudyPlanHeaderLine(line)) continue;
    if (isTheoryPracticeTotalStudyPlanStopLine(line)) break;
    if (/^(?:итого|всего)(?:\s|:|$)/iu.test(line)) break;

    const rowStart = parseTheoryPracticeTotalStudyPlanRowStart(line);
    if (rowStart) {
      if (segment) {
        const topic = buildTheoryPracticeTotalStudyPlanRow(segment);
        if (topic) topics.push(topic);
      }
      segment = {
        number: rowStart.number,
        lines: rowStart.title ? [rowStart.title] : [],
        rawLines: [line],
      };
      continue;
    }

    if (!segment) continue;
    segment.lines.push(line);
    segment.rawLines.push(line);
  }

  if (segment) {
    const topic = buildTheoryPracticeTotalStudyPlanRow(segment);
    if (topic) topics.push(topic);
  }

  return topics;
}

function findTheoryPracticeTotalStudyPlanHeaderIndex(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!/учебн[оы]\s*[- ]?\s*тематическ(?:ий|ого)?\s+план|учебн(?:ый|ого)\s+план/iu.test(line)) continue;

    const window = lines
      .slice(index, index + 14)
      .map(cleanupLine)
      .join(" ");
    if (
      /теоретическ(?:ие|их)?\s+занят/iu.test(window) &&
      /практическ(?:ие|их)?\s+занят/iu.test(window) &&
      /всего/iu.test(window) &&
      /(?:содержание\s+программы|№\s*п\/?п|п\/?п)/iu.test(window)
    ) {
      return index;
    }
  }

  return -1;
}

function isTheoryPracticeTotalStudyPlanHeaderLine(line) {
  const cleaned = cleanupLine(line);
  return (
    /^(?:№|п\/?п\.?|содержание\s+программы|теоретические|занятия|практические|всего)$/iu.test(cleaned) ||
    /теоретическ(?:ие|их)?\s+занят/iu.test(cleaned) ||
    /практическ(?:ие|их)?\s+занят/iu.test(cleaned)
  );
}

function isTheoryPracticeTotalStudyPlanStopLine(line) {
  return /^(?:содержание\s+программы|методическ|материально|список\s+литературы|приложение)/iu.test(
    cleanupLine(line),
  );
}

function parseTheoryPracticeTotalStudyPlanRowStart(line) {
  const match = cleanupLine(line).match(/^(\d{1,2})(?:[.)])?\s+(.+)$/u);
  if (!match) return null;

  const number = Number(match[1]);
  if (!Number.isInteger(number) || number <= 0 || number > 80) return null;
  const title = cleanupLine(match[2]);
  if (!title || /^[\d\s,.-]+$/u.test(title) || /^год\s+обучения/iu.test(title)) return null;

  return {
    number,
    title,
  };
}

function buildTheoryPracticeTotalStudyPlanRow(segment) {
  const titleParts = [];
  const numbers = [];
  let hasPlanOnlyHours = false;

  for (const rawLine of segment.lines) {
    const line = cleanupLine(rawLine);
    if (!line) continue;
    if (/по\s+плану\s+работы/iu.test(line)) {
      hasPlanOnlyHours = true;
      continue;
    }

    const withoutTrailingNumbers = line
      .replace(/\s+\d+(?:[,.]\d+)?(?:\s+\d+(?:[,.]\d+)?){0,2}\s*$/u, "")
      .trim();
    if (withoutTrailingNumbers && !/^[\d\s,.-]+$/u.test(withoutTrailingNumbers)) {
      titleParts.push(withoutTrailingNumbers);
    }

    for (const match of line.matchAll(/\d+(?:[,.]\d+)?/gu)) {
      const value = parseHourCell(match[0]);
      if (value != null) numbers.push(value);
    }
  }

  const hours = mapTheoryPracticeTotalHours(numbers);
  const topicName = cleanupBasicStudyPlanTopicName(titleParts.join(" "));
  if (!isValidTopic(topicName)) return null;
  const hasUnspecifiedHours = /консультац/iu.test(topicName);
  if (!hours && !hasPlanOnlyHours && !hasUnspecifiedHours) return null;

  const hoursTheory = hours ? hours.hoursTheory : null;
  const hoursPractice = hours ? hours.hoursPractice : null;
  const hoursTotal = hours ? hours.hoursTotal : null;
  const hoursInconsistent = hours?.hoursInconsistent || null;
  const sourceExcerpt = [
    segment.rawLines.join(" / "),
    hoursInconsistent ? `hours_inconsistent: ${hoursInconsistent.repair}` : "",
  ]
    .filter(Boolean)
    .join(" / ")
    .slice(0, 1500);

  return {
    topic_order: segment.number,
    plan_number: String(segment.number),
    section_title: "Учебно-тематический план",
    topic_name: topicName,
    hours_theory: hoursTheory,
    hours_practice: hoursPractice,
    hours_total: hoursTotal,
    activity_type: inferLessonThematicPlanningActivityType({
      hoursTheory,
      hoursPractice,
    }),
    control_form: hasPlanOnlyHours ? "По плану работы" : "",
    source_section: "theory-practice-total-study-plan",
    source_excerpt: sourceExcerpt,
    confidence: hours ? 0.82 : 0.68,
    raw_payload: {
      parser: "theory-practice-total-study-plan",
      plan_number: String(segment.number),
      parsed_lines: segment.rawLines,
      parsed_hour_cells: numbers,
      ...(hoursInconsistent ? { hours_inconsistent: hoursInconsistent } : {}),
      ...(hasPlanOnlyHours ? { plan_only_hours: true } : {}),
      ...(hasUnspecifiedHours ? { unspecified_hours: true } : {}),
    },
  };
}

function mapTheoryPracticeTotalHours(values) {
  const numbers = values.filter((value) => value != null);
  if (!numbers.length) return null;

  for (let index = 0; index + 2 < numbers.length; index += 1) {
    const first = numbers[index];
    const second = numbers[index + 1];
    const third = numbers[index + 2];
    if (Math.abs(first + second - third) <= 0.01) {
      return {
        hoursTheory: first,
        hoursPractice: second,
        hoursTotal: third,
      };
    }
    if (Math.abs(first + third - second) <= 0.01) {
      return {
        hoursTheory: first,
        hoursPractice: third,
        hoursTotal: second,
      };
    }
  }

  if (numbers.length >= 2) {
    const first = numbers[0];
    const second = numbers[1];
    if (Math.abs(first - second) <= 0.01) {
      return {
        hoursTheory: first,
        hoursPractice: 0,
        hoursTotal: second,
        hoursInconsistent: {
          raw_values: numbers,
          expected_columns: ["theory", "practice", "total"],
          repair: "two equal hour cells in theory/practice/total table; mapped to theory and total, practice set to zero",
        },
      };
    }
    if (second > first) {
      return {
        hoursTheory: first,
        hoursPractice: roundHour(second - first),
        hoursTotal: second,
      };
    }
  }

  return null;
}

function extractSlashHourThematicPlanRows(lines) {
  const startIndex = findSlashHourThematicPlanHeaderIndex(lines);
  if (startIndex < 0) return [];

  const topics = [];
  let currentSection = "";
  let pendingSectionRow = null;
  let segment = [];

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line) continue;
    if (isSlashHourThematicPlanStopLine(line)) break;
    if (isSlashHourThematicPlanHeaderLine(line)) continue;

    segment.push(line);
    const row = parseSlashHourThematicPlanSegment(segment);
    if (!row) {
      if (segment.length > 8) segment.shift();
      continue;
    }

    segment = [];

    if (row.isTotal) break;

    if (row.isSection) {
      if (pendingSectionRow) {
        topics.push(pendingSectionRow);
      }
      currentSection = row.topic_name;
      pendingSectionRow = {
        ...row,
        section_title: "Учебно-тематический план",
      };
      continue;
    }

    pendingSectionRow = null;
    topics.push({
      ...row,
      section_title: currentSection || "Учебно-тематический план",
    });
  }

  if (pendingSectionRow) {
    topics.push(pendingSectionRow);
  }

  return topics;
}

function findSlashHourThematicPlanHeaderIndex(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!/учебн[оы]\s*[- ]?\s*тематическ(?:ий|ого)?\s+план/iu.test(line)) continue;

    const window = lines
      .slice(index, index + 8)
      .map(cleanupLine)
      .join(" ");
    if (/теория\s*\/\s*практика/iu.test(window) && /форма\s+контроля/iu.test(window)) {
      return index;
    }
  }

  return -1;
}

function parseSlashHourThematicPlanSegment(segment) {
  const sourceLines = segment.map(cleanupLine).filter(Boolean);
  const text = sourceLines.join(" ").replace(/\s+/g, " ").trim();
  if (!text) return null;

  const totalMatch = text.match(/^\d+\.\s*итого(?:\s|$)/iu);
  if (totalMatch) return { isTotal: true };

  const match = text.match(
    /^(.+?)\s+(-|\d+(?:[,.]\d+)?)\s+(-|\d+(?:[,.]\d+)?)\s*\/\s*(-|\d+(?:[,.]\d+)?)(?:\s+(.+))?$/u,
  );
  if (!match) return null;

  const rawTitle = cleanupLine(match[1]);
  const isSection = /^\d+\.\s+/u.test(rawTitle);
  const topicName = cleanupTopicName(rawTitle);
  if (!isValidTopic(topicName)) return null;

  const rawTotal = parseHourCell(match[2]);
  const hoursTheory = parseHourCell(match[3]) || 0;
  const hoursPractice = parseHourCell(match[4]) || 0;
  const hoursTotal = rawTotal || roundHour(hoursTheory + hoursPractice);
  if (!isPlausibleHours(hoursTheory, hoursPractice, hoursTotal)) return null;

  const controlForm = cleanupControlForm(match[5] || "");
  const activityType = inferLessonThematicPlanningActivityType({
    hoursTheory,
    hoursPractice,
  });

  return {
    isSection,
    section_title: "",
    topic_name: topicName,
    hours_theory: hoursTheory,
    hours_practice: hoursPractice,
    hours_total: hoursTotal,
    activity_type: activityType,
    control_form: controlForm,
    source_section: "slash-hour-thematic-plan",
    source_excerpt: text.slice(0, 1500),
    confidence: 0.9,
    raw_payload: {
      parser: "slash-hour-thematic-plan",
      parsed_lines: sourceLines,
      raw_total: match[2],
      raw_theory_practice: `${match[3]}/${match[4]}`,
    },
  };
}

function isSlashHourThematicPlanHeaderLine(line) {
  const cleaned = cleanupLine(line);
  return (
    /^(№\s*п\\?\/?п|№|тема|контроля)$/iu.test(cleaned) ||
    /тема\s+количество\s+часов/iu.test(cleaned) ||
    /всего\s+теория\s*\/\s*практика\s+форма/iu.test(cleaned)
  );
}

function isSlashHourThematicPlanStopLine(line) {
  const cleaned = cleanupLine(line);
  if (/^содержание\s+программы/iu.test(cleaned)) return true;
  if (/^\d+\.\s*источники\s+информации/iu.test(cleaned)) return true;
  return false;
}

function extractLessonThematicPlanningRows(lines) {
  const topics = [];
  const startIndex = findLessonThematicPlanningHeaderIndex(lines);
  if (startIndex < 0) return topics;

  let currentSection = null;
  let index = startIndex + 1;

  while (index < lines.length) {
    const line = cleanupLine(lines[index]);
    if (!line) {
      index += 1;
      continue;
    }
    if (isLessonThematicPlanningStopLine(line)) break;
    if (isLessonThematicPlanningHeaderLine(line)) {
      index += 1;
      continue;
    }

    if (/^раздел\s+\d+/iu.test(line)) {
      const section = parseLessonThematicPlanningSection(lines, index);
      if (section) {
        currentSection = section.section;
        index = section.nextIndex;
        continue;
      }
    }

    const topicStart = parseLessonThematicPlanningTopicStart(lines, index);
    if (!topicStart) {
      index += 1;
      continue;
    }

    const nextIndex = findNextLessonThematicPlanningItemIndex(lines, topicStart.nextIndex);
    const segment = [
      topicStart.title,
      ...lines.slice(topicStart.nextIndex, nextIndex).map(cleanupLine).filter(Boolean),
    ];
    const topic = parseLessonThematicPlanningTopicSegment({
      rowRange: topicStart.rowRange,
      segment,
      currentSection,
    });

    if (topic) {
      topics.push(topic);
    }

    index = nextIndex;
  }

  return topics;
}

function findLessonThematicPlanningHeaderIndex(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!/учебн[оы]\s*[- ]?\s*тематическ[а-яё]*\s+планирован/iu.test(line)) continue;

    const window = lines
      .slice(index, index + 8)
      .map(cleanupLine)
      .join(" ");
    if (/занятия\s+наименование\s+темы|теория\s+практика/iu.test(window)) {
      return index;
    }
  }

  return -1;
}

function parseLessonThematicPlanningSection(lines, startIndex) {
  const segment = [];

  for (let index = startIndex; index < Math.min(lines.length, startIndex + 5); index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line || isLessonThematicPlanningHeaderLine(line)) continue;
    if (index > startIndex && parseLessonThematicPlanningTopicStart(lines, index)) break;
    if (index > startIndex && /^раздел\s+\d+/iu.test(line)) break;
    if (isLessonThematicPlanningStopLine(line)) break;

    segment.push(line);
    const parsed = parseLessonThematicPlanningSectionText(segment.join(" "));
    if (parsed) {
      return {
        section: parsed,
        nextIndex: index + 1,
      };
    }
  }

  return null;
}

function parseLessonThematicPlanningSectionText(value) {
  const match = cleanupLine(value).match(/^(.+?)\s+(\d+(?:[,.]\d+)?)\s+(\d+(?:[,.]\d+)?)$/u);
  if (!match || !/^раздел\s+\d+/iu.test(match[1])) return null;

  return {
    title: cleanupLessonThematicPlanningTitle(match[1]),
    hoursTheory: parseHourCell(match[2]),
    hoursPractice: parseHourCell(match[3]),
    usedTheory: 0,
    usedPractice: 0,
  };
}

function parseLessonThematicPlanningTopicStart(lines, index) {
  const line = cleanupLine(lines[index]);
  if (!line) return null;

  let match = line.match(/^(\d{1,3})\s*-\s*(\d{1,3})\s+(.+)$/u);
  if (match) {
    return {
      rowRange: `${match[1]}-${match[2]}`,
      title: cleanupLine(match[3]),
      nextIndex: index + 1,
    };
  }

  match = line.match(/^(\d{1,3})\s*-\s*(\d{1,3})$/u);
  if (match) {
    return {
      rowRange: `${match[1]}-${match[2]}`,
      title: "",
      nextIndex: index + 1,
    };
  }

  match = line.match(/^(\d{1,3})\s*-\s*$/u);
  if (!match) return null;

  const nextLine = cleanupLine(lines[index + 1]);
  const nextMatch = nextLine.match(/^(\d{1,3})(?:\s+(.+))?$/u);
  if (!nextMatch) return null;

  return {
    rowRange: `${match[1]}-${nextMatch[1]}`,
    title: cleanupLine(nextMatch[2] || ""),
    nextIndex: index + 2,
  };
}

function findNextLessonThematicPlanningItemIndex(lines, startIndex) {
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line) continue;
    if (isLessonThematicPlanningStopLine(line)) return index;
    if (isLessonThematicPlanningHeaderLine(line)) return index;
    if (/^раздел\s+\d+/iu.test(line)) return index;
    if (parseLessonThematicPlanningTopicStart(lines, index)) return index;
  }

  return lines.length;
}

function parseLessonThematicPlanningTopicSegment({ rowRange, segment, currentSection }) {
  const meaningfulLines = segment
    .map(cleanupLine)
    .filter((line) => line && !isLessonThematicPlanningHeaderLine(line));
  if (!meaningfulLines.length || !currentSection) return null;

  const joined = meaningfulLines.join(" ").replace(/\s+(?:итого|всего)(?:\s|:|$).*$/iu, "").trim();
  const match = joined.match(/^(.+?)\s+(\d+(?:[,.]\d+)?)(?:\s+(\d+(?:[,.]\d+)?))?$/u);
  if (!match) return null;

  const topicName = cleanupTopicName(match[1]);
  if (!isValidTopic(topicName)) return null;

  const firstHours = parseHourCell(match[2]);
  const secondHours = match[3] == null ? null : parseHourCell(match[3]);
  if (firstHours == null) return null;

  const assigned = assignLessonThematicPlanningHours({
    currentSection,
    firstHours,
    secondHours,
  });
  if (!assigned || !isPlausibleHours(assigned.hoursTheory, assigned.hoursPractice, assigned.hoursTotal)) {
    return null;
  }

  const activityType = inferLessonThematicPlanningActivityType(assigned);

  return {
    section_title: currentSection.title,
    topic_name: topicName,
    hours_theory: assigned.hoursTheory,
    hours_practice: assigned.hoursPractice,
    hours_total: assigned.hoursTotal,
    activity_type: activityType,
    control_form: "",
    source_section: "lesson-thematic-planning",
    source_excerpt: joined.slice(0, 1500),
    confidence: 0.9,
    raw_payload: {
      parser: "lesson-thematic-planning",
      row_range: rowRange,
      section_hours_theory: currentSection.hoursTheory,
      section_hours_practice: currentSection.hoursPractice,
      parsed_lines: meaningfulLines,
    },
  };
}

function assignLessonThematicPlanningHours({ currentSection, firstHours, secondHours }) {
  if (secondHours != null) {
    currentSection.usedTheory += firstHours;
    currentSection.usedPractice += secondHours;
    return {
      hoursTheory: firstHours,
      hoursPractice: secondHours,
      hoursTotal: roundHour(firstHours + secondHours),
    };
  }

  const remainingTheory = Math.max(0, (currentSection.hoursTheory || 0) - currentSection.usedTheory);
  const remainingPractice = Math.max(0, (currentSection.hoursPractice || 0) - currentSection.usedPractice);
  const useTheory = remainingTheory >= firstHours || remainingPractice <= 0;

  if (useTheory) {
    currentSection.usedTheory += firstHours;
    return {
      hoursTheory: firstHours,
      hoursPractice: 0,
      hoursTotal: firstHours,
    };
  }

  currentSection.usedPractice += firstHours;
  return {
    hoursTheory: 0,
    hoursPractice: firstHours,
    hoursTotal: firstHours,
  };
}

function inferLessonThematicPlanningActivityType({ hoursTheory, hoursPractice }) {
  if ((hoursTheory || 0) > 0 && (hoursPractice || 0) > 0) return "теория+практика";
  if ((hoursPractice || 0) > 0) return "практика";
  if ((hoursTheory || 0) > 0) return "теория";
  return "не определено";
}

function cleanupLessonThematicPlanningTitle(value) {
  return cleanupLine(value)
    .replace(/^(раздел\s+\d+)\./iu, "$1. ")
    .replace(/\s+/g, " ")
    .trim();
}

function isLessonThematicPlanningHeaderLine(line) {
  const cleaned = cleanupLine(line);
  return /^(№|теория\s+практика)$/iu.test(cleaned) || /занятия\s+наименование\s+темы\s+кол-?во\s+часов/iu.test(cleaned);
}

function isLessonThematicPlanningStopLine(line) {
  const cleaned = cleanupLine(line);
  if (/^(итого|всего)(?:\s|:|$)/iu.test(cleaned)) return true;
  if (/^\d+\.\s+источники\s+информации/iu.test(cleaned)) return true;
  if (/^источники\s+информации/iu.test(cleaned)) return true;
  return false;
}

function extractAnnualStudyPlanRows(lines) {
  const ranges = findAnnualStudyPlanRanges(lines);
  if (ranges.length < 2) return [];

  const bestRangeRowsByYear = new Map();
  for (const range of ranges) {
    const rows = removeAnnualStudyPlanParentRows(extractAnnualStudyPlanRowsFromRange(lines, range));
    if (!rows.length) continue;

    const current = bestRangeRowsByYear.get(range.year);
    if (!current || rows.length > current.rows.length) {
      bestRangeRowsByYear.set(range.year, { range, rows });
    }
  }

  const cleanedRows = [...bestRangeRowsByYear.values()]
    .sort((left, right) => left.range.startIndex - right.range.startIndex)
    .flatMap((entry) => entry.rows);
  if (cleanedRows.length < 20) return [];
  return cleanedRows;
}

function findAnnualStudyPlanRanges(lines) {
  const ranges = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!isAnnualStudyPlanTitleLine(line)) continue;

    const window = lines
      .slice(index, index + 5)
      .map(cleanupLine)
      .join(" ");
    const year = extractAnnualStudyPlanYear(window);
    if (!year) continue;

    const startIndex = index + 1;
    const endIndex = findAnnualStudyPlanEndIndex(lines, startIndex);
    if (endIndex <= startIndex) continue;

    ranges.push({
      startIndex,
      endIndex,
      year,
      sectionTitle: `Учебный план ${year}-го года обучения`,
    });
  }

  return ranges;
}

function isAnnualStudyPlanTitleLine(line) {
  return /^учебн(?:ый|о\s*-\s*тематическ(?:ий|ого)?|о\s*–\s*тематическ(?:ий|ого)?)\s+план$/iu.test(
    cleanupLine(line),
  );
}

function extractAnnualStudyPlanYear(value) {
  const text = cleanupLine(value).toLowerCase();
  const match = text.match(/\((первый|второй|третий|четвертый|четв[её]ртый|\d+)[^)]*год\s+обучения\)/iu);
  if (!match) return 0;

  const raw = match[1].replace(/ё/gu, "е");
  const wordYears = {
    первый: 1,
    второй: 2,
    третий: 3,
    четвертый: 4,
  };
  if (wordYears[raw]) return wordYears[raw];

  const numeric = Number(raw);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : 0;
}

function findAnnualStudyPlanEndIndex(lines, startIndex) {
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line) continue;
    if (/^(?:итого|итого\s+за\s+учебный\s+год)\s*:/iu.test(line)) return index;
    if (index > startIndex + 20 && /^содержание\s+программы/iu.test(line)) return index;
  }

  return lines.length;
}

function extractAnnualStudyPlanRowsFromRange(lines, range) {
  const rows = [];
  let segment = [];

  const flushSegment = () => {
    if (!segment.length) return;
    const row = parseAnnualStudyPlanSegment(segment, range);
    if (row) rows.push(row);
    segment = [];
  };

  for (let index = range.startIndex; index < range.endIndex; index += 1) {
    const rawLine = String(lines[index] || "").trim();
    const line = cleanupLine(rawLine);
    if (!line || PAGE_NUMBER_RE.test(line) || isAnnualStudyPlanHeaderLine(line)) continue;
    if (/^(?:итого|всего)(?:\s|:|$)/iu.test(line)) break;
    if (/^[•]/u.test(line)) continue;

    if (isAnnualStudyPlanRowStartLine(line)) {
      flushSegment();
      segment = [rawLine];
      continue;
    }

    if (segment.length) segment.push(rawLine);
  }

  flushSegment();
  return rows;
}

function isAnnualStudyPlanHeaderLine(line) {
  const cleaned = cleanupLine(line);
  return (
    /^(?:№|п\.?п\.?|п\/п|тема|наименование\s+тем\s+и\s+разделов|количество\s+часов|всего|в\s+том|числе|теория|практик?а?|ка|а)$/iu.test(
      cleaned,
    ) ||
    /^теория\s+практик?а?$/iu.test(cleaned)
  );
}

function isAnnualStudyPlanRowStartLine(line) {
  const cleaned = cleanupLine(line);
  return /^\d+\.\s+/u.test(cleaned) || /^\d+(?:\.\d+)+(?:\.?(?:\s+|$))/u.test(cleaned);
}

function parseAnnualStudyPlanSegment(segment, range) {
  const row = parseBasicStudyPlanSegment(segment, ["total", "theory", "practice"]);
  if (!row || row.isTotal) return null;

  const topicName = cleanupAnnualStudyPlanTopicName(row.topic_name);
  if (!isValidTopic(topicName) && !isLongBasicStudyPlanTopicName(topicName)) return null;
  const resolvedHours = resolveAnnualStudyPlanTwoNumberHours(segment, row);

  return {
    ...row,
    isSection: false,
    section_title: range.sectionTitle,
    topic_name: topicName,
    hours_theory: resolvedHours.hoursTheory,
    hours_practice: resolvedHours.hoursPractice,
    hours_total: resolvedHours.hoursTotal,
    activity_type: inferLessonThematicPlanningActivityType({
      hoursTheory: resolvedHours.hoursTheory,
      hoursPractice: resolvedHours.hoursPractice,
    }),
    source_section: "annual-study-plan",
    confidence: Math.max(row.confidence || 0, 0.84),
    raw_payload: {
      ...row.raw_payload,
      parser: "annual-study-plan",
      year_section: range.sectionTitle,
      year_number: range.year,
      ...(resolvedHours.spacingRepair ? { spacing_repair: resolvedHours.spacingRepair } : {}),
    },
  };
}

function cleanupAnnualStudyPlanTopicName(value) {
  return cleanupBasicStudyPlanTopicName(value)
    .replace(/^[-\s]+/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveAnnualStudyPlanTwoNumberHours(segment, row) {
  const hoursTotal = normalizeNullableHour(row.hours_total) || 0;
  const hoursTheory = normalizeNullableHour(row.hours_theory) || 0;
  const hoursPractice = normalizeNullableHour(row.hours_practice) || 0;
  const rawText = segment.join(" ").replace(/\s+$/u, "");
  const match = rawText.match(/(-|\d+(?:[,.]\d+)?)(\s+)(-|\d+(?:[,.]\d+)?)$/u);
  if (!match) {
    return { hoursTotal, hoursTheory, hoursPractice };
  }

  const titleTail = cleanupLine(rawText.slice(0, match.index));
  if (/(?:^|\s)\d+(?:[,.]\d+)?$/u.test(titleTail)) {
    return { hoursTotal, hoursTheory, hoursPractice };
  }

  const first = parseHourCell(match[1]);
  const second = parseHourCell(match[3]);
  if (first == null || second == null || Math.abs(first - hoursTotal) > 0.01) {
    return { hoursTotal, hoursTheory, hoursPractice };
  }

  if (match[2].length >= 2) {
    return {
      hoursTotal,
      hoursTheory: 0,
      hoursPractice: second,
      spacingRepair: {
        raw_total: first,
        raw_second: second,
        repair: "two-number annual row uses blank theory column, second value mapped to practice",
      },
    };
  }

  return {
    hoursTotal,
    hoursTheory: second,
    hoursPractice: 0,
    spacingRepair: {
      raw_total: first,
      raw_second: second,
      repair: "two-number annual row uses blank practice column, second value mapped to theory",
    },
  };
}

function removeAnnualStudyPlanParentRows(rows) {
  const parentKeys = new Set();
  for (const row of rows) {
    const year = cleanupLine(row.raw_payload?.year_section || row.section_title || "");
    const number = cleanupLine(row.plan_number || row.raw_payload?.plan_number || "");
    if (!year || !number.includes(".")) continue;

    const parts = number.split(".");
    while (parts.length > 1) {
      parts.pop();
      parentKeys.add(`${year}|${parts.join(".")}`);
    }
  }

  return rows.filter((row) => {
    const year = cleanupLine(row.raw_payload?.year_section || row.section_title || "");
    const number = cleanupLine(row.plan_number || row.raw_payload?.plan_number || "");
    return !parentKeys.has(`${year}|${number}`);
  });
}

function extractSecondYearTableThreeStudyPlanRows(lines) {
  const range = findSecondYearTableThreeStudyPlanRange(lines);
  if (!range) return [];

  const segments = collectSecondYearTableThreeSegments(lines.slice(range.startIndex, range.endIndex));
  const rows = [];
  let currentSection = "Учебный план 2-го года обучения / Таблица 3";

  for (const segment of segments) {
    const sectionTitle = parseSecondYearTableThreeSectionTitle(segment);
    if (sectionTitle) {
      currentSection = sectionTitle;
      continue;
    }

    const row = parseSecondYearTableThreeSegment(segment, currentSection);
    if (row) rows.push(row);
  }

  if (rows.length < 10) return [];

  const parsedTotal = summarizeSecondYearTableThreeRows(rows);
  const planTotalMatchesRows = !range.planTotal || (
    Math.abs(parsedTotal.hoursTotal - range.planTotal.hoursTotal) <= 0.01 &&
    Math.abs(parsedTotal.hoursTheory - range.planTotal.hoursTheory) <= 0.01 &&
    Math.abs(parsedTotal.hoursPractice - range.planTotal.hoursPractice) <= 0.01
  );

  return rows.map((row) => ({
    ...row,
    confidence: planTotalMatchesRows ? row.confidence : Math.min(row.confidence, 0.78),
    raw_payload: {
      ...(row.raw_payload || {}),
      plan_total: range.planTotal,
      parsed_total: parsedTotal,
      plan_total_matches_rows: planTotalMatchesRows,
      ...(planTotalMatchesRows ? {} : {
        plan_total_mismatch: {
          repair: "detailed visible rows preserved; table total is higher than parsed row sum",
        },
      }),
    },
  }));
}

function findSecondYearTableThreeStudyPlanRange(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!/учебн(?:ый|ого)\s+план\s+2[- ]?го\s+года\s+обучения.*таблиц[ау]\s*3/iu.test(line)) continue;

    const window = lines.slice(index, index + 24).map(cleanupLine).join(" ");
    if (!/таблица\s*3/iu.test(window) || !/всего\s+теори[яи]\s+практик/iu.test(window)) continue;

    for (let endIndex = index + 1; endIndex < lines.length; endIndex += 1) {
      const endLine = cleanupLine(lines[endIndex]);
      const planTotal = parseSecondYearTableThreeFinalTotal(endLine);
      if (planTotal) {
        return {
          startIndex: index,
          endIndex: endIndex + 1,
          planTotal,
        };
      }
      if (endIndex > index + 420 || /^1\.6\.\s+содержание\s+изучаемого\s+курса/iu.test(endLine)) break;
    }
  }

  return null;
}

function parseSecondYearTableThreeFinalTotal(line) {
  const match = cleanupLine(line).match(
    /^итого\s+за\s+период\s+обучения:?\s+(\d+(?:[,.]\d+)?)\s+(\d+(?:[,.]\d+)?)\s+(\d+(?:[,.]\d+)?)/iu,
  );
  if (!match) return null;

  const hoursTotal = parseHourCell(match[1]);
  const hoursTheory = parseHourCell(match[2]);
  const hoursPractice = parseHourCell(match[3]);
  if (!isPlausibleHours(hoursTheory, hoursPractice, hoursTotal)) return null;
  return { hoursTotal, hoursTheory, hoursPractice };
}

function collectSecondYearTableThreeSegments(blockLines) {
  const segments = [];
  let segment = [];

  const flush = () => {
    if (!segment.length) return;
    segments.push(segment);
    segment = [];
  };

  for (const rawLine of blockLines) {
    const line = cleanupLine(rawLine);
    if (!line || isSecondYearTableThreeHeaderLine(line) || parseSecondYearTableThreeTotalLine(line)) continue;
    if (/^итого\s+за\s+период\s+обучения/iu.test(line)) break;

    const rowStart = findSecondYearTableThreeRowStart(line);
    if (!rowStart) {
      if (segment.length) segment.push(line);
      continue;
    }

    if (rowStart.index > 0 && segment.length) {
      const prefix = cleanupLine(line.slice(0, rowStart.index));
      if (prefix && !hasSecondYearTableThreeHours(segment)) segment.push(prefix);
    }

    flush();
    segment = [line.slice(rowStart.index).trim()];
  }

  flush();
  return segments;
}

function isSecondYearTableThreeHeaderLine(line) {
  const cleaned = cleanupLine(line);
  return (
    PAGE_NUMBER_RE.test(cleaned) ||
    /^таблица\s*3$/iu.test(cleaned) ||
    /^учебн(?:ый|ого)\s+план\s+2[- ]?го\s+года\s+обучения/iu.test(cleaned) ||
    /^(?:№\s*п\.?\/?п\.?|название\s+темы|количество|часов|формы|организации|занятий|аттестации|\(контроля\)|всего|теори[яи]|практика)$/iu.test(cleaned) ||
    /^№\s*п\.?\/?п\.?\s+название\s+темы\s+количество/iu.test(cleaned)
  );
}

function parseSecondYearTableThreeTotalLine(line) {
  const match = cleanupLine(line).match(/^всего\s+часов:?\s+(\d+(?:[,.]\d+)?)\s+(\d+(?:[,.]\d+)?)\s+(\d+(?:[,.]\d+)?)/iu);
  if (!match) return null;
  const hoursTotal = parseHourCell(match[1]);
  const hoursTheory = parseHourCell(match[2]);
  const hoursPractice = parseHourCell(match[3]);
  if (!isPlausibleHours(hoursTheory, hoursPractice, hoursTotal)) return null;
  return { hoursTotal, hoursTheory, hoursPractice };
}

function findSecondYearTableThreeRowStart(line) {
  const matches = [...cleanupLine(line).matchAll(/(?:^|\s)(\d+(?:\.\d+)+(?:\.)?|\d+\.)(?=\s+[А-ЯЁA-Z])/gu)];
  if (!matches.length) return null;
  const match = matches[matches.length - 1];
  return {
    index: match.index + (match[0].match(/^\s/u) ? 1 : 0),
    number: match[1].replace(/\.$/u, ""),
  };
}

function hasSecondYearTableThreeHours(segment) {
  return /\s(?:-|\d+(?:[,.]\d+)?)\s+(?:-|\d+(?:[,.]\d+)?)\s+(?:-|\d+(?:[,.]\d+)?)(?:\s|$)/u.test(
    cleanupLine(segment.join(" ")),
  );
}

function parseSecondYearTableThreeSectionTitle(segment) {
  const text = cleanupLine(segment.join(" "));
  const match = text.match(/^(\d+)\.\s+(модуль\s+.+)$/iu);
  if (!match) return "";
  return cleanupLine(`${match[1]}. ${match[2]}`);
}

function parseSecondYearTableThreeSegment(segment, currentSection) {
  const text = cleanupLine(segment.join(" "));
  const match = text.match(
    /^(\d+(?:\.\d+)*\.?)\s+(.+?)\s+(-|\d+(?:[,.]\d+)?)\s+(-|\d+(?:[,.]\d+)?)\s+(-|\d+(?:[,.]\d+)?)(?:\s+(.+))?$/u,
  );
  if (!match) return null;

  const planNumber = cleanupLine(match[1]).replace(/\.$/u, "");
  const hoursTotal = parseHourCell(match[3]);
  const hoursTheory = parseHourCell(match[4]);
  const hoursPractice = parseHourCell(match[5]);
  if (!isPlausibleHours(hoursTheory, hoursPractice, hoursTotal)) return null;
  if (hoursTotal == null || hoursTotal <= 0) return null;
  if (Math.abs((hoursTheory || 0) + (hoursPractice || 0) - hoursTotal) > 0.01) return null;

  const topicName = cleanupSecondYearTableThreeTopicName(match[2], match[6] || "");
  if (!isValidTopic(topicName) && !isLongBasicStudyPlanTopicName(topicName)) return null;

  const controlForm = cleanupControlForm(match[6] || "");
  return {
    plan_number: planNumber,
    section_title: currentSection || "Учебный план 2-го года обучения / Таблица 3",
    topic_name: topicName,
    hours_theory: hoursTheory,
    hours_practice: hoursPractice,
    hours_total: hoursTotal,
    activity_type: inferLessonThematicPlanningActivityType({ hoursTheory, hoursPractice }),
    control_form: controlForm,
    source_section: "second-year-table-three-study-plan",
    source_excerpt: text.slice(0, 1500),
    confidence: 0.88,
    raw_payload: {
      parser: "second-year-table-three-study-plan",
      plan_number: planNumber,
      parsed_lines: segment,
      control_form: controlForm,
      study_year: 2,
      table_number: 3,
    },
  };
}

function cleanupSecondYearTableThreeTopicName(title, tail) {
  let topicName = cleanupTopicName(title).replace(/([А-Яа-яЁё])-\s+([А-Яа-яЁё])/gu, "$1-$2");
  const tailText = cleanupLine(tail);
  if (/лыжном$/iu.test(topicName) && /(?:^|\s)походе(?:\s|$)/iu.test(tailText)) {
    topicName = `${topicName} походе`;
  }
  if (/^специальная\s+физическая\s+подготовка$/iu.test(topicName) && /(?:^|\s)юнармейца(?:\s|$)/iu.test(tailText)) {
    topicName = `${topicName} юнармейца`;
  }
  return cleanupTopicName(topicName).replace(/([А-Яа-яЁё])-\s+([А-Яа-яЁё])/gu, "$1-$2");
}

function summarizeSecondYearTableThreeRows(rows) {
  return {
    hoursTotal: roundHour(rows.reduce((sum, row) => sum + Number(row.hours_total || 0), 0)),
    hoursTheory: roundHour(rows.reduce((sum, row) => sum + Number(row.hours_theory || 0), 0)),
    hoursPractice: roundHour(rows.reduce((sum, row) => sum + Number(row.hours_practice || 0), 0)),
  };
}

function extractTerminalYearBasicStudyPlanRows(lines) {
  const blocks = findExplicitBasicStudyPlanYearBlocks(lines);
  if (blocks.length < 2) return [];

  const selectedBlock = [...blocks].sort(
    (left, right) => left.yearNumber - right.yearNumber || left.startIndex - right.startIndex,
  )[blocks.length - 1];
  const blockRows = extractBasicStudyPlanRows(lines.slice(selectedBlock.startIndex, selectedBlock.endIndex));
  if (blockRows.length < 10) return [];

  return blockRows.map((row) => ({
    ...row,
    section_title: cleanupTerminalYearBasicStudyPlanSectionTitle(row.section_title, selectedBlock.yearTitle),
    confidence: Math.max(row.confidence || 0, 0.84),
    raw_payload: {
      ...(row.raw_payload || {}),
      parser: "terminal-year-basic-study-plan",
      original_parser: row.raw_payload?.parser || row.source_section,
      study_year: selectedBlock.yearNumber,
      year_section: selectedBlock.yearTitle,
      selected_explicit_year_plan: true,
    },
  }));
}

function findExplicitBasicStudyPlanYearBlocks(lines) {
  const blocks = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    const yearNumber = parseExplicitBasicStudyPlanYearNumber(line);
    if (!yearNumber) continue;

    const window = lines
      .slice(index, index + 16)
      .map(cleanupLine)
      .join(" ");
    if (!hasTotalHoursHeader(window) || !hasTheoryHeader(window) || !hasPracticeHeader(window)) continue;

    blocks.push({
      startIndex: index,
      yearNumber,
      yearTitle: cleanupLine(line),
    });
  }

  return blocks.map((block, index) => ({
    ...block,
    endIndex: findExplicitBasicStudyPlanYearBlockEnd(lines, block, blocks[index + 1]),
  }));
}

function findExplicitBasicStudyPlanYearBlockEnd(lines, block, nextBlock) {
  const hardEnd = nextBlock ? nextBlock.startIndex : lines.length;
  for (let index = block.startIndex + 1; index < hardEnd; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line) continue;
    if (/^содержание\s+программы(?:\s+\S+)?\s+года\s+обучения/iu.test(line)) return index;
    if (/^календарн[оы]\s*[- ]?\s*(?:тематическ|учебн)/iu.test(line)) return index;
  }
  return hardEnd;
}

function parseExplicitBasicStudyPlanYearNumber(line) {
  const cleaned = cleanupLine(line);
  const numeric = cleaned.match(/учебн(?:ый|ого)\s+план\s+(\d+)[- ]?(?:го|ого)?\s+года\s+обучения/iu);
  if (numeric) return Number(numeric[1]);
  if (/учебн(?:ый|ого)\s+план\s+перв(?:ый|ого)\s+года\s+обучения/iu.test(cleaned)) return 1;
  if (/учебн(?:ый|ого)\s+план\s+втор(?:ой|ого)\s+года\s+обучения/iu.test(cleaned)) return 2;
  if (/учебн(?:ый|ого)\s+план\s+трет(?:ий|ьего)\s+года\s+обучения/iu.test(cleaned)) return 3;
  if (/учебн(?:ый|ого)\s+план\s+четверт(?:ый|ого)\s+года\s+обучения/iu.test(cleaned)) return 4;
  return 0;
}

function cleanupTerminalYearBasicStudyPlanSectionTitle(sectionTitle, yearTitle) {
  const title = cleanupLine(sectionTitle);
  const year = cleanupLine(yearTitle);
  if (!title || /^учебный\s+план$/iu.test(title)) return year;
  if (/^учебный\s+план\s*\//iu.test(title)) return cleanupLine(title.replace(/^учебный\s+план/iu, year));
  return title;
}

function extractNamedStudyPlanRows(lines) {
  const headerIndexes = findNamedStudyPlanHeaderIndexes(lines);
  const rows = [];

  for (const headerIndex of headerIndexes) {
    const range = findNamedStudyPlanRange(lines, headerIndex);
    const rangeRows = extractNamedStudyPlanRowsFromRange(lines, headerIndex, range.endIndex, range.totalHours);
    if (rangeRows.length >= 3) rows.push(...rangeRows);
  }

  return rows;
}

function findNamedStudyPlanHeaderIndexes(lines) {
  const indexes = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!/^учебн(?:ый|ого)\s+план$/iu.test(line)) continue;

    const window = lines
      .slice(index, index + 12)
      .map(cleanupLine)
      .join(" ");
    if (!/название\s+раздела/iu.test(window)) continue;
    if (!/количество\s+часов/iu.test(window)) continue;
    if (!/формы?\s+контроля/iu.test(window)) continue;
    if (!hasTotalHoursHeader(window) || !hasTheoryHeader(window) || !hasPracticeHeader(window)) continue;
    indexes.push(index);
  }
  return indexes;
}

function findNamedStudyPlanRange(lines, headerIndex) {
  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line) continue;

    const totalHours = parseNamedStudyPlanTotalLine(line);
    if (totalHours) {
      return {
        endIndex: index,
        totalHours,
      };
    }
    if (index > headerIndex + 10 && isBasicStudyPlanStopLine(line)) {
      return {
        endIndex: index,
        totalHours: null,
      };
    }
  }

  return {
    endIndex: Math.min(lines.length, headerIndex + 120),
    totalHours: null,
  };
}

function parseNamedStudyPlanTotalLine(line) {
  const match = cleanupLine(line).match(/^итого\s+(\d+(?:[,.]\d+)?)\s+(\d+(?:[,.]\d+)?)\s+(\d+(?:[,.]\d+)?)(?:\s|$)/iu);
  if (!match) return null;

  const hoursTotal = parseHourCell(match[1]);
  const hoursTheory = parseHourCell(match[2]);
  const hoursPractice = parseHourCell(match[3]);
  if (!isPlausibleHours(hoursTheory, hoursPractice, hoursTotal)) return null;
  return {
    hoursTotal,
    hoursTheory,
    hoursPractice,
  };
}

function extractNamedStudyPlanRowsFromRange(lines, headerIndex, endIndex, totalHours) {
  const rows = [];
  const hourOrder = detectBasicStudyPlanHourOrder(lines, headerIndex);
  let segment = [];

  for (let index = headerIndex + 1; index < endIndex; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line || PAGE_NUMBER_RE.test(line) || isNamedStudyPlanHeaderLine(line)) continue;

    segment.push(line);
    const row = parseBasicStudyPlanSegment(segment, hourOrder);
    if (!row || row.isTotal) {
      if (segment.length > 14) segment.shift();
      continue;
    }

    const controlContinuation = collectNamedStudyPlanControlContinuation(lines, index + 1, endIndex);
    const finalRow = normalizeNamedStudyPlanRow(row, controlContinuation, totalHours);
    if (finalRow) rows.push(finalRow);

    segment = [];
    index = Math.max(index, controlContinuation.nextIndex - 1);
  }

  return rows;
}

function isNamedStudyPlanHeaderLine(line) {
  const cleaned = cleanupLine(line);
  return (
    isBasicStudyPlanHeaderLine(cleaned) ||
    /(?:название\s+раздела|количество\s+часов|формы?\s+контроля|всего\s+теория\s+практика)/iu.test(cleaned)
  );
}

function collectNamedStudyPlanControlContinuation(lines, startIndex, endIndex) {
  const controlLines = [];
  let index = startIndex;
  while (index < endIndex) {
    const line = cleanupLine(lines[index]);
    if (!line || PAGE_NUMBER_RE.test(line) || isNamedStudyPlanHeaderLine(line)) {
      index += 1;
      continue;
    }
    if (parseNamedStudyPlanTotalLine(line) || isBasicStudyPlanStopLine(line)) break;
    if (!isNamedStudyPlanControlContinuationLine(line)) break;

    controlLines.push(line);
    index += 1;
  }

  return {
    lines: controlLines,
    nextIndex: index,
  };
}

function isNamedStudyPlanControlContinuationLine(line) {
  return /^(?:опрос|наблюдени[ея]|фронтальн(?:ый|ого)?|тестировани[ея]|зач[её]т|контроль|собеседовани[ея])[\s,.;-]*$/iu.test(
    cleanupLine(line),
  );
}

function normalizeNamedStudyPlanRow(row, controlContinuation, totalHours) {
  const sourceLines = [...(row.raw_payload?.parsed_lines || []), ...controlContinuation.lines];
  let topicName = cleanupBasicStudyPlanTopicName(row.topic_name);
  topicName = restoreNamedStudyPlanLeadingActivityTopic(topicName, sourceLines);
  if (!isValidTopic(topicName) && !isLongBasicStudyPlanTopicName(topicName)) return null;

  const controlForm = cleanupControlForm([row.control_form, ...controlContinuation.lines].filter(Boolean).join(" "));
  const hours = repairNamedStudyPlanHours(row, topicName);

  return {
    ...row,
    isSection: false,
    plan_number: "",
    section_title: "Учебный план",
    topic_name: topicName,
    hours_theory: hours.hoursTheory,
    hours_practice: hours.hoursPractice,
    hours_total: hours.hoursTotal,
    control_form: controlForm,
    source_section: "named-study-plan",
    source_excerpt: sourceLines.join(" / ").slice(0, 1500),
    confidence: 0.84,
    raw_payload: {
      ...row.raw_payload,
      parser: "named-study-plan",
      plan_number: "",
      parsed_lines: sourceLines,
      control_form: controlForm,
      ...(hours.repair ? { named_study_plan_hours_repair: hours.repair } : {}),
      ...(totalHours ? { plan_total: totalHours } : {}),
    },
  };
}

function restoreNamedStudyPlanLeadingActivityTopic(topicName, sourceLines) {
  const firstLine = cleanupLine(sourceLines?.[0] || "");
  if (/^беседа\s+/iu.test(firstLine) && !/^беседа\s+/iu.test(topicName)) {
    return cleanupLine(`Беседа ${topicName}`);
  }
  return topicName;
}

function repairNamedStudyPlanHours(row, topicName) {
  const hoursTotal = normalizeNullableHour(row.hours_total);
  const hoursTheory = normalizeNullableHour(row.hours_theory) || 0;
  const hoursPractice = normalizeNullableHour(row.hours_practice) || 0;

  if (
    hoursTotal != null &&
    hoursTheory === hoursTotal &&
    hoursPractice === 0 &&
    isNamedStudyPlanPracticeOnlyTopic(topicName)
  ) {
    return {
      hoursTheory: 0,
      hoursPractice: hoursTotal,
      hoursTotal,
      repair: "practice-only row inferred from named study plan topic",
    };
  }

  return {
    hoursTheory,
    hoursPractice,
    hoursTotal,
    repair: "",
  };
}

function isNamedStudyPlanPracticeOnlyTopic(topicName) {
  return /^(?:ведение\s+занятий|история\s+родного\s+города|записи\s+историко|беседа\s+с\s+очевидцами)/iu.test(
    cleanupLine(topicName),
  );
}

function extractBasicStudyPlanRows(lines) {
  const rows = [];
  const blocks = findBasicStudyPlanBlocks(lines);
  if (!blocks.length) return rows;

  for (const block of blocks) {
    let currentYearSection = block.yearSection || "Учебный план";
    let currentSection = currentYearSection;
    let segment = [];
    let rowsSinceStart = 0;
    let nonRowAfterRows = 0;
    let skippedStudyPlanPageHeader = false;
    const hourOrder = detectBasicStudyPlanHourOrder(lines, block.headerIndex);
    const segmentOptions = { preserveAmbiguousTwoNumberHourPairs: true };

    for (let index = block.headerIndex + 1; index < block.endIndex; index += 1) {
      const line = cleanupLine(lines[index]);
      if (!line) continue;
      if (PAGE_NUMBER_RE.test(line) && !(segment.length && isStandaloneStudyPlanHourCellLine(line))) {
        skippedStudyPlanPageHeader = rowsSinceStart > 0 || skippedStudyPlanPageHeader;
        continue;
      }

      const yearSection = detectBasicStudyPlanYearSection(line);
      if (yearSection) {
        currentYearSection = yearSection;
        currentSection = yearSection;
        segment = [];
        skippedStudyPlanPageHeader = false;
        continue;
      }

      if (rowsSinceStart > 0 && isBasicStudyPlanStopLine(line)) break;
      if (/^тематическ(?:ая|ой)\s+часть\s+программы:?$/iu.test(line)) {
        currentYearSection = "Тематическая часть программы";
        currentSection = currentYearSection;
        segment = [];
        skippedStudyPlanPageHeader = false;
        continue;
      }
      if (isBasicStudyPlanHeaderLine(line)) {
        skippedStudyPlanPageHeader = rowsSinceStart > 0 || skippedStudyPlanPageHeader;
        continue;
      }

      if (skippedStudyPlanPageHeader && appendBasicStudyPlanTitleContinuation(rows, line)) {
        skippedStudyPlanPageHeader = false;
        continue;
      }
      skippedStudyPlanPageHeader = false;

      if (segment.length && isBasicStudyPlanRowStartLine(line) && !parseBasicStudyPlanSegment(segment, hourOrder, segmentOptions)) {
        segment = [];
      }

      segment.push(line);
      const row = parseBasicStudyPlanSegment(segment, hourOrder, segmentOptions);
      if (!row) {
        if (segment.length > 20) segment.shift();
        nonRowAfterRows += rowsSinceStart > 0 ? 1 : 0;
        if (rowsSinceStart > 0 && nonRowAfterRows > 50) break;
        continue;
      }

      segment = [];
      nonRowAfterRows = 0;
      if (row.isTotal) continue;

      if (row.isSection && !isSpuriousBasicStudyPlanSectionRow(row)) {
        currentSection = [currentYearSection, cleanupExtractedTopicName(row.topic_name)].filter(Boolean).join(" / ");
      }

      const continued = appendBasicStudyPlanTrailingContinuations(row, lines, index + 1);
      const finalRow = continued.row;
      index = Math.max(index, continued.nextIndex - 1);

      rows.push({
        ...finalRow,
        section_title: finalRow.isSection ? currentYearSection : currentSection || currentYearSection || "Учебный план",
        raw_payload: {
          ...finalRow.raw_payload,
          year_section: currentYearSection,
        },
      });
      rowsSinceStart += 1;
    }
  }

  return removeBasicStudyPlanParentRows(removeBasicStudyPlanAggregateSectionRows(rows));
}

function findBasicStudyPlanBlocks(lines) {
  const headerIndexes = findBasicStudyPlanHeaderIndexes(lines);
  return headerIndexes.map((headerIndex, index) => ({
    headerIndex,
    endIndex: findBasicStudyPlanBlockEndIndex(lines, headerIndex, headerIndexes[index + 1]),
    yearSection: detectBasicStudyPlanYearSection(lines[headerIndex]) || detectStudyCourseContentYearSection(lines[headerIndex]) || "Учебный план",
  }));
}

function findBasicStudyPlanBlockEndIndex(lines, headerIndex, nextHeaderIndex) {
  const hardEnd = nextHeaderIndex ?? lines.length;
  for (let index = headerIndex + 1; index < hardEnd; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line) continue;
    if (nextHeaderIndex != null && /^(?:итого|всего)(?:\s|:|$)/iu.test(line) && /\d/u.test(line)) return index + 1;
    if (index > headerIndex + 8 && isBasicStudyPlanStopLine(line)) return index;
  }
  return hardEnd;
}

function extractYearlyBasicStudyPlanRows(lines) {
  const blocks = findYearlyBasicStudyPlanBlocks(lines);
  if (blocks.length < 2) return [];

  const rows = [];
  for (const block of blocks) {
    const blockRows = extractYearlyBasicStudyPlanRowsFromBlock(lines, block);
    if (!blockRows.length) return [];
    rows.push(...blockRows);
  }

  return rows;
}

function findYearlyBasicStudyPlanBlocks(lines) {
  const blocks = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!/^учебн[оы]\s*[- ]?\s*тематическ(?:ий|ого)?\s+план$/iu.test(line)) continue;

    const yearLineIndex = findYearlyBasicStudyPlanYearLineIndex(lines, index + 1);
    if (yearLineIndex < 0) continue;

    const headerWindow = lines
      .slice(index, Math.min(lines.length, yearLineIndex + 10))
      .map(cleanupLine)
      .join(" ");
    if (!hasTotalHoursHeader(headerWindow) || !hasTheoryHeader(headerWindow) || !hasPracticeHeader(headerWindow)) continue;

    blocks.push({
      headerIndex: index,
      yearLineIndex,
      contentStartIndex: yearLineIndex + 1,
      yearTitle: cleanupLine(lines[yearLineIndex]),
      yearNumber: parseYearlyBasicStudyPlanYearNumber(lines[yearLineIndex]),
    });
  }

  return blocks.map((block, index) => ({
    ...block,
    endIndex: findYearlyBasicStudyPlanEndIndex(lines, block, blocks[index + 1]),
  }));
}

function findYearlyBasicStudyPlanYearLineIndex(lines, startIndex) {
  for (let index = startIndex; index < Math.min(lines.length, startIndex + 8); index += 1) {
    if (parseYearlyBasicStudyPlanYearNumber(lines[index])) return index;
  }
  return -1;
}

function parseYearlyBasicStudyPlanYearNumber(line) {
  const cleaned = cleanupLine(line);
  const numeric = cleaned.match(/^(\d+)\s+год\s+обучения$/iu);
  if (numeric) return Number(numeric[1]);

  if (/^перв(?:ый|ого)\s+год\s+обучения$/iu.test(cleaned)) return 1;
  if (/^втор(?:ой|ого)\s+год\s+обучения$/iu.test(cleaned)) return 2;
  if (/^трет(?:ий|ьего)\s+год\s+обучения$/iu.test(cleaned)) return 3;
  if (/^четверт(?:ый|ого)\s+год\s+обучения$/iu.test(cleaned)) return 4;
  return 0;
}

function findYearlyBasicStudyPlanEndIndex(lines, block, nextBlock) {
  const hardEnd = nextBlock ? nextBlock.headerIndex : lines.length;
  for (let index = block.contentStartIndex; index < hardEnd; index += 1) {
    const line = cleanupLine(lines[index]);
    if (/^содержание\s+программы$/iu.test(line)) return index;
    if (/^итого:?\s+/iu.test(line)) return index + 1;
  }
  return hardEnd;
}

function extractYearlyBasicStudyPlanRowsFromBlock(lines, block) {
  const hourOrder = detectBasicStudyPlanHourOrder(lines, block.headerIndex);
  const rows = [];
  let currentSection = block.yearTitle;
  let segment = null;
  let totalHours = null;

  const flushSegment = () => {
    if (!segment) return;
    const row = buildYearlyBasicStudyPlanRow(segment, block, currentSection, hourOrder);
    segment = null;
    if (!row) return;

    if (row.isSection && !isSpuriousBasicStudyPlanSectionRow(row)) {
      currentSection = [block.yearTitle, cleanupExtractedTopicName(row.topic_name)].filter(Boolean).join(" / ");
    }

    rows.push({
      ...row,
      section_title: row.isSection ? block.yearTitle : currentSection,
    });
  };

  for (let index = block.contentStartIndex; index < block.endIndex; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line || isBasicStudyPlanHeaderLine(line)) continue;
    if (PAGE_NUMBER_RE.test(line)) continue;

    const total = parseYearlyBasicStudyPlanTotalLine(line);
    if (total) {
      flushSegment();
      totalHours = total;
      break;
    }

    const sectionTitle = parseYearlyBasicStudyPlanSectionTitle(line);
    if (sectionTitle) {
      flushSegment();
      currentSection = [block.yearTitle, sectionTitle].join(" / ");
      continue;
    }

    const rowStart = parseYearlyBasicStudyPlanRowStart(line);
    if (rowStart) {
      flushSegment();
      segment = {
        planNumber: rowStart.planNumber,
        lines: [rowStart.line],
      };
      continue;
    }

    if (!segment || isYearlyBasicStudyPlanOcrNoiseLine(line)) continue;
    segment.lines.push(line);
  }

  flushSegment();
  return reconcileYearlyBasicStudyPlanRows(rows, totalHours, block);
}

function parseYearlyBasicStudyPlanTotalLine(line) {
  const match = cleanupLine(line).match(/^итого:?\s+(\d+(?:[,.]\d+)?)\s+(\d+(?:[,.]\d+)?)\s+(\d+(?:[,.]\d+)?)/iu);
  if (!match) return null;

  const hoursTotal = parseHourCell(match[1]);
  const hoursTheory = parseHourCell(match[2]);
  const hoursPractice = parseHourCell(match[3]);
  if (!isPlausibleHours(hoursTheory, hoursPractice, hoursTotal)) return null;
  return {
    hoursTotal,
    hoursTheory,
    hoursPractice,
  };
}

function parseYearlyBasicStudyPlanSectionTitle(line) {
  const cleaned = cleanupLine(line);
  const match = cleaned.match(/^раздел\s+(\d+)\.?\s*(.+)$/iu);
  if (!match) return "";
  return cleanupLine(`Раздел ${match[1]}. ${match[2]}`);
}

function parseYearlyBasicStudyPlanRowStart(line) {
  const cleaned = cleanupLine(line);
  const brokenDotted = cleaned.match(/^(\d{1,2})\.\s+(\d{1,2})\D*\.?$/u);
  if (brokenDotted) {
    const planNumber = `${Number(brokenDotted[1])}.${Number(brokenDotted[2])}`;
    return {
      planNumber,
      line: `${planNumber}.`,
    };
  }

  const dotted = cleaned.match(/^(\d{1,2}\.\d{1,2})(?:[.)])?(?:\s+(.+))?$/u);
  if (dotted) {
    return {
      planNumber: dotted[1],
      line: cleanupLine(`${dotted[1]}. ${dotted[2] || ""}`),
    };
  }

  const sectionRow = cleaned.match(/^(\d{1,2})\s+(раздел\s+\d+\.?\s*.+)$/iu);
  if (sectionRow) {
    return {
      planNumber: sectionRow[1],
      line: `${sectionRow[1]} ${cleanupLine(sectionRow[2])}`,
    };
  }

  return null;
}

function isYearlyBasicStudyPlanOcrNoiseLine(line) {
  return /^[содер]$/iu.test(cleanupLine(line));
}

function buildYearlyBasicStudyPlanRow(segment, block, currentSection, hourOrder) {
  const row = parseBasicStudyPlanSegment(segment.lines, hourOrder);
  if (!row || row.isTotal) return null;

  return {
    ...row,
    section_title: currentSection,
    source_section: "yearly-basic-study-plan",
    confidence: Math.max(row.confidence || 0, 0.86),
    raw_payload: {
      ...(row.raw_payload || {}),
      parser: "yearly-basic-study-plan",
      original_parser: row.raw_payload?.parser,
      plan_number: cleanupLine(row.plan_number || segment.planNumber),
      study_year: block.yearNumber,
      year_section: block.yearTitle,
      parsed_lines: segment.lines,
    },
  };
}

function reconcileYearlyBasicStudyPlanRows(rows, totalHours, block) {
  if (!rows.length || !totalHours) return [];

  const repairedRows = repairYearlyBasicStudyPlanInconsistentRows(rows, totalHours);
  const summary = summarizeYearlyBasicStudyPlanRows(repairedRows);
  const totalsMatch =
    Math.abs(summary.hoursTotal - totalHours.hoursTotal) <= 0.01 &&
    Math.abs(summary.hoursTheory - totalHours.hoursTheory) <= 0.01 &&
    Math.abs(summary.hoursPractice - totalHours.hoursPractice) <= 0.01;

  return repairedRows.map((row) => ({
    ...row,
    confidence: totalsMatch ? row.confidence : Math.min(row.confidence || 0.7, 0.68),
    raw_payload: {
      ...(row.raw_payload || {}),
      plan_total: totalHours,
      parsed_total: summary,
      plan_total_matches_rows: totalsMatch,
      study_year: block.yearNumber,
      year_section: block.yearTitle,
    },
  }));
}

function repairYearlyBasicStudyPlanInconsistentRows(rows, totalHours) {
  const current = summarizeYearlyBasicStudyPlanRows(rows);
  if (
    Math.abs(current.hoursTotal - totalHours.hoursTotal) > 0.01 ||
    Math.abs(current.hoursTheory - totalHours.hoursTheory) <= 0.01 ||
    current.hoursTheory > totalHours.hoursTheory
  ) {
    return rows;
  }

  let remainingTheoryDelta = roundHour(totalHours.hoursTheory - current.hoursTheory);
  let remainingPracticeDelta = roundHour(totalHours.hoursPractice - current.hoursPractice);
  if (remainingTheoryDelta <= 0 || remainingPracticeDelta >= 0) return rows;

  return rows.map((row) => {
    if (remainingTheoryDelta <= 0 || remainingPracticeDelta >= 0) return row;

    const inconsistent = row.raw_payload?.hours_inconsistent;
    const rawTotal = normalizeNullableHour(inconsistent?.raw_total);
    const rawTheory = normalizeNullableHour(inconsistent?.raw_theory);
    const rawPractice = normalizeNullableHour(inconsistent?.raw_practice);
    if (rawTotal == null || rawTheory == null || rawPractice == null) return row;
    if (rawTheory <= 0 || Math.abs(rawPractice - rawTotal) > 0.01) return row;

    const repairedPractice = roundHour(rawTotal - rawTheory);
    const theoryDelta = roundHour(rawTheory - Number(row.hours_theory || 0));
    const practiceDelta = roundHour(repairedPractice - Number(row.hours_practice || 0));
    if (theoryDelta <= 0 || practiceDelta >= 0) return row;
    if (theoryDelta > remainingTheoryDelta + 0.01 || practiceDelta < remainingPracticeDelta - 0.01) return row;

    remainingTheoryDelta = roundHour(remainingTheoryDelta - theoryDelta);
    remainingPracticeDelta = roundHour(remainingPracticeDelta - practiceDelta);

    return {
      ...row,
      hours_theory: rawTheory,
      hours_practice: repairedPractice,
      raw_payload: {
        ...(row.raw_payload || {}),
        yearly_hours_repair: {
          raw_total: rawTotal,
          raw_theory: rawTheory,
          raw_practice: rawPractice,
          repair: "practice adjusted to total minus theory to match yearly total",
        },
      },
    };
  });
}

function summarizeYearlyBasicStudyPlanRows(rows) {
  return {
    hoursTotal: roundHour(rows.reduce((sum, row) => sum + Number(row.hours_total || 0), 0)),
    hoursTheory: roundHour(rows.reduce((sum, row) => sum + Number(row.hours_theory || 0), 0)),
    hoursPractice: roundHour(rows.reduce((sum, row) => sum + Number(row.hours_practice || 0), 0)),
  };
}

function extractCourseYearStudyPlanRows(lines) {
  const blocks = findCourseYearStudyPlanBlocks(lines);
  if (!blocks.length) return [];

  const rows = [];
  for (const block of blocks) {
    const blockRows = extractCourseYearStudyPlanRowsFromBlock(lines, block);
    rows.push(...blockRows);
  }

  return removeCourseYearStudyPlanParentRows(rows);
}

function removeCourseYearStudyPlanParentRows(rows) {
  const parentKeys = new Set();
  for (const row of rows) {
    const scope = cleanupLine(row.raw_payload?.year_section || row.section_title || "");
    const number = cleanupLine(row.plan_number || row.raw_payload?.plan_number || "");
    const match = number.match(/^(\d+)\.\d+/u);
    if (scope && match) parentKeys.add(`${scope}|${match[1]}`);
  }

  return rows.filter((row) => {
    const scope = cleanupLine(row.raw_payload?.year_section || row.section_title || "");
    const number = cleanupLine(row.plan_number || row.raw_payload?.plan_number || "");
    if (!scope || !number || /\./u.test(number)) return true;
    if (isStandaloneEventStudyPlanTopic(row)) return true;
    return !parentKeys.has(`${scope}|${number}`);
  });
}

function findCourseYearStudyPlanBlocks(lines) {
  const blocks = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!/^учебн(?:ый|ого)\s+план$/iu.test(line)) continue;

    const courseLineIndex = findNextNonEmptyLineIndex(lines, index + 1, index + 5);
    if (courseLineIndex < 0) continue;
    const courseTitle = parseQuotedCourseTitle(lines[courseLineIndex]);
    if (!courseTitle) continue;

    const yearLineIndex = findNextNonEmptyLineIndex(lines, courseLineIndex + 1, courseLineIndex + 5);
    if (yearLineIndex < 0) continue;
    const year = parseCourseYearStudyPlanYear(lines[yearLineIndex]);
    if (!year) continue;

    const endIndex = findCourseYearStudyPlanEndIndex(lines, yearLineIndex + 1);
    blocks.push({
      startIndex: index,
      contentStartIndex: yearLineIndex + 1,
      endIndex,
      courseTitle,
      year,
    });
  }

  return blocks;
}

function findNextNonEmptyLineIndex(lines, startIndex, endIndex) {
  for (let index = startIndex; index < Math.min(lines.length, endIndex); index += 1) {
    if (cleanupLine(lines[index])) return index;
  }
  return -1;
}

function parseQuotedCourseTitle(line) {
  const match = cleanupLine(line).match(/^[«"](.+?)[»"]$/u);
  if (!match) return "";
  const title = cleanupTopicName(match[1]);
  return isValidTopic(title) ? title : "";
}

function parseCourseYearStudyPlanYear(line) {
  const match = cleanupLine(line).match(/^(\d+)\s+год\s+обучения$/iu);
  return match ? Number(match[1]) : 0;
}

function findCourseYearStudyPlanEndIndex(lines, startIndex) {
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (/^итого(?:\s|\(|:|$)/iu.test(line)) return index + 1;
    if (index > startIndex + 8 && isBasicStudyPlanStopLine(line)) return index;
  }
  return lines.length;
}

function extractCourseYearStudyPlanRowsFromBlock(lines, block) {
  const rows = [];
  let currentSection = courseYearStudyPlanSectionTitle(block);
  let segment = [];
  const hourOrder = detectBasicStudyPlanHourOrder(lines, block.startIndex);

  for (let index = block.contentStartIndex; index < block.endIndex; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line) continue;
    if (PAGE_NUMBER_RE.test(line) && !(segment.length && isStandaloneStudyPlanHourCellLine(line))) continue;
    if (isCourseYearStudyPlanHeaderLine(line)) continue;
    if (/^итого(?:\s|\(|:|$)/iu.test(line)) break;

    if (segment.length && isBasicStudyPlanRowStartLine(line) && !parseBasicStudyPlanSegment(segment, hourOrder)) {
      segment = [];
    }

    segment.push(line);
    const row = parseBasicStudyPlanSegment(segment, hourOrder);
    if (!row) {
      if (segment.length > 20) segment.shift();
      continue;
    }

    segment = [];
    if (row.isTotal) continue;

    if (row.isSection) {
      currentSection = courseYearStudyPlanSectionTitle(block, row.topic_name);
    }

    const continued = appendCourseYearStudyPlanTrailingContinuations(row, lines, index + 1);
    const finalRow = continued.row;
    index = Math.max(index, continued.nextIndex - 1);

    rows.push({
      ...finalRow,
      section_title: finalRow.isSection
        ? courseYearStudyPlanSectionTitle(block)
        : currentSection,
      source_section: "course-year-study-plan",
      confidence: Math.max(finalRow.confidence || 0, 0.84),
      raw_payload: {
        ...(finalRow.raw_payload || {}),
        parser: "course-year-study-plan",
        course_title: block.courseTitle,
        study_year: block.year,
        year_section: courseYearStudyPlanSectionTitle(block),
      },
    });
  }

  return rows;
}

function courseYearStudyPlanSectionTitle(block, section = "") {
  return [block.courseTitle, `${block.year} год обучения`, section].filter(Boolean).join(" / ");
}

function appendCourseYearStudyPlanTrailingContinuations(row, lines, startIndex) {
  const titleParts = [];
  const consumedLines = [];
  let index = startIndex;

  for (; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line || PAGE_NUMBER_RE.test(line) || isCourseYearStudyPlanHeaderLine(line)) continue;
    if (/^итого(?:\s|\(|:|$)/iu.test(line) || isBasicStudyPlanStopLine(line) || isBasicStudyPlanRowStartLine(line)) break;
    if (parseBasicStudyPlanSegment([line])) break;

    if (!isCourseYearStudyPlanTopicContinuationLine(line, row, titleParts)) break;

    titleParts.push(line);
    consumedLines.push(line);
  }

  if (!consumedLines.length) return { row, nextIndex: startIndex };

  const topicName = cleanupBasicStudyPlanTopicName([row.topic_name, ...titleParts].filter(Boolean).join(" "));
  const hasValidTopic = isValidTopic(topicName) || isLongBasicStudyPlanTopicName(topicName);

  return {
    row: {
      ...row,
      topic_name: hasValidTopic ? topicName : row.topic_name,
      source_excerpt: cleanupLine([row.source_excerpt, ...consumedLines].filter(Boolean).join(" ")).slice(0, 1500),
      raw_payload: {
        ...(row.raw_payload || {}),
        parsed_lines: [...(row.raw_payload?.parsed_lines || []), ...consumedLines],
        title_continuation_after_hours: titleParts,
      },
    },
    nextIndex: index,
  };
}

function isCourseYearStudyPlanTopicContinuationLine(line, row, titleParts = []) {
  const cleaned = cleanupLine(line);
  if (!cleaned || cleaned.length > 120 || isTotalTopicName(cleaned)) return false;
  if (/^(?:-|практикум|лекция|рассказ|беседа|опрос|зач[её]т|соревнования?|показательные?|выступлени[ея]|палатки|костра)$/iu.test(cleaned)) {
    return false;
  }
  if (isBasicStudyPlanControlFragmentLine(cleaned)) return false;
  if (/\d+(?:[,.]\d+)?\s+(?:-|\d+(?:[,.]\d+)?)(?:\s+(?:-|\d+(?:[,.]\d+)?))?/u.test(cleaned)) return false;

  const previousTopic = cleanupLine([row.topic_name, ...titleParts].filter(Boolean).join(" "));
  if (!previousTopic) return false;

  if (titleParts.length && /^[а-яё]/u.test(cleaned)) return true;
  if (/[,;:]$/u.test(previousTopic) && /^[а-яё]/u.test(cleaned)) return true;
  if (/(?:^|\s)(?:и|с|со|по|в|во|на|для|при|от|до|из|к|ко)$/iu.test(previousTopic) && /^[а-яё]/u.test(cleaned)) {
    return true;
  }

  return false;
}

function isCourseYearStudyPlanHeaderLine(line) {
  const cleaned = cleanupLine(line);
  return (
    isBasicStudyPlanHeaderLine(cleaned) ||
    /^[«"].+[»"]$/u.test(cleaned) ||
    /^\d+\s+год\s+обучения$/iu.test(cleaned) ||
    /^№$/iu.test(cleaned) ||
    /^(?:темы|п\/?п|проведения|занятий|подведения|итогов)$/iu.test(cleaned)
  );
}

function detectBasicStudyPlanYearSection(line) {
  const explicitYearNumber = parseExplicitBasicStudyPlanYearNumber(line);
  if (explicitYearNumber > 0) return `Учебный план ${explicitYearNumber}-го года обучения`;

  const match = cleanupLine(line).match(/учебн(?:ый|ого)\s+план\s+(\d+)[- ]?(?:го|ого)\s+года\s+обучения/iu);
  return match ? `Учебный план ${match[1]}-го года обучения` : "";
}

function isBasicStudyPlanModuleSectionTitle(value) {
  return /(?:^|\s)(?:модуль|раздел)\s+/iu.test(cleanupLine(value));
}

function appendBasicStudyPlanTrailingContinuations(row, lines, startIndex) {
  const controlParts = [];
  const titleParts = [];
  const consumedLines = [];
  let index = startIndex;

  for (; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line || PAGE_NUMBER_RE.test(line) || isBasicStudyPlanHeaderLine(line)) continue;
    if (isBasicStudyPlanStopLine(line) || isBasicStudyPlanRowStartLine(line)) break;
    if (parseBasicStudyPlanSegment([line])) break;

    const embeddedRowStart = splitBasicStudyPlanEmbeddedRowStart(line);
    if (
      embeddedRowStart &&
      isBasicStudyPlanControlContinuationLine(embeddedRowStart.prefix, row, controlParts)
    ) {
      controlParts.push(embeddedRowStart.prefix);
      consumedLines.push(embeddedRowStart.prefix);
      break;
    }

    if (isBasicStudyPlanControlContinuationLine(line, row, controlParts)) {
      controlParts.push(line);
      consumedLines.push(line);
      continue;
    }

    if (isBasicStudyPlanTopicContinuationLine(line, row, titleParts)) {
      titleParts.push(line);
      consumedLines.push(line);
      continue;
    }

    break;
  }

  if (!consumedLines.length) return { row, nextIndex: startIndex };

  const controlForm = joinBasicStudyPlanControlParts([row.control_form, ...controlParts].filter(Boolean));
  const topicName = cleanupBasicStudyPlanTopicName([row.topic_name, ...titleParts].filter(Boolean).join(" "));
  const hasValidTopic = isValidTopic(topicName) || isLongBasicStudyPlanTopicName(topicName);

  return {
    row: {
      ...row,
      topic_name: hasValidTopic ? topicName : row.topic_name,
      control_form: controlForm,
      source_excerpt: cleanupLine([row.source_excerpt, ...consumedLines].filter(Boolean).join(" ")).slice(0, 1500),
      raw_payload: {
        ...(row.raw_payload || {}),
        parsed_lines: [...(row.raw_payload?.parsed_lines || []), ...consumedLines],
        ...(titleParts.length ? { title_continuation_after_hours: titleParts } : {}),
        ...(controlParts.length ? { control_continuation_after_hours: controlParts } : {}),
      },
    },
    nextIndex: index,
  };
}

function splitBasicStudyPlanEmbeddedRowStart(line) {
  const cleaned = cleanupLine(line);
  const match = cleaned.match(/^(.{2,90}?)\s+(\d{1,2}\.\d+(?:\.\d+)*\.?\s+[А-ЯЁA-Z].*)$/u);
  if (!match) return null;

  const prefix = cleanupLine(match[1]);
  const rowStart = cleanupLine(match[2]);
  if (!prefix || !rowStart) return null;
  if (/\d/u.test(prefix) || isBasicStudyPlanRowStartLine(prefix) || isBasicStudyPlanDateContinuationLine(cleaned)) {
    return null;
  }

  return { prefix, rowStart };
}

function joinBasicStudyPlanControlParts(parts) {
  const text = parts.reduce((result, part) => {
    const cleaned = cleanupLine(part);
    if (!cleaned) return result;
    if (!result) return cleaned;
    if (result.endsWith("-")) return `${result}${cleaned}`;
    if (/(?:заче|зач[её])$/iu.test(result) && /^тн/iu.test(cleaned)) return `${result}${cleaned}`;
    return `${result} ${cleaned}`;
  }, "");
  return cleanupControlForm(text);
}

function isBasicStudyPlanControlContinuationLine(line, row, controlParts = []) {
  const previousControl = joinBasicStudyPlanControlParts([row.control_form, ...controlParts].filter(Boolean));
  const cleaned = cleanupLine(line);
  if (!cleaned || cleaned.length > 80 || /[.!?]/u.test(cleaned)) return false;

  if (isBasicStudyPlanControlFragmentLine(cleaned)) return true;
  if (!previousControl) return false;
  if (isBasicStudyPlanControlObjectContinuationLine(cleaned, previousControl)) return true;

  if (previousControl.endsWith("-")) {
    return /^(?:соревнование|соревнования|игра|отч[её]т|работа|зач[её]т|тест|норматив(?:ы|ов)?|тныхнормативов)$/iu.test(
      cleaned,
    );
  }

  return (
    /^(?:отч[её]т|работа|соревнование|соревнования|норматив(?:ы|ов)?|тныхнормативов|наблюдени[ея]|беседа)$/iu.test(
      cleaned,
    ) &&
    /(?:творческ|игра|соревн|выполнен|заче|тестирован|наблюдени|бесед)/iu.test(previousControl)
  );
}

function isBasicStudyPlanControlObjectContinuationLine(line, previousControl) {
  const cleaned = cleanupLine(line)
    .replace(/[«»]/g, '"')
    .replace(/[.,;:]+$/u, "")
    .trim();
  const control = cleanupControlForm(previousControl || "");
  if (!cleaned || !control || cleaned.length > 80) return false;
  if (/\d/u.test(cleaned) || isTotalTopicName(cleaned) || isBasicStudyPlanRowStartLine(cleaned)) return false;
  if (!/^[А-ЯЁа-яёA-Za-z"'\s-]+$/u.test(cleaned)) return false;

  if (hasUnclosedStudyPlanQuote(control)) {
    return /^[А-ЯЁа-яёA-Za-z0-9\s.,-]+[»"]?$/u.test(cleaned);
  }

  if (control.endsWith("-")) {
    return /^[а-яё][а-яё\s-]+$/u.test(cleaned);
  }

  if (!/^(?:оформление|создание|практическ(?:ая|ое|ие)?|деловая\s+игра|мини-?проект|проект|презентаци[яи]|педагогическ(?:ое|ая)?)(?:\s|$|["-])/iu.test(control)) {
    return false;
  }

  return /^[а-яё][а-яё\s-]+[»"]?$/u.test(cleaned) && cleaned.split(/\s+/u).length <= 5;
}

function isBasicStudyPlanControlFragmentLine(line) {
  const cleaned = cleanupLine(line)
    .replace(/[.,;:]+$/u, "")
    .trim();
  if (!cleaned || cleaned.length > 80) return false;

  const token = "(?:анкетирование|тесты?|устный|устный\\s+опрос|опросы?|наблюдени[ея]|беседа|практические?|задани[ея]|практические\\s+задани[ея]|контроль|зач[её]т|соревнования?|отч[её]т|работа|норматив(?:ы|ов)?)";
  return new RegExp(`^${token}(?:\\s*,\\s*${token})*$`, "iu").test(cleaned);
}

function isBasicStudyPlanTopicContinuationLine(line, row, titleParts = []) {
  const cleaned = cleanupLine(line);
  if (!cleaned || cleaned.length > 120 || isTotalTopicName(cleaned)) return false;
  if (isBasicStudyPlanControlFragmentLine(cleaned)) return false;
  if (/^(?:отч[её]т|работа|соревнование|соревнования|норматив(?:ы|ов)?|тныхнормативов|наблюдени[ея]|беседа)$/iu.test(cleaned)) {
    return false;
  }

  const previousTopic = cleanupLine([row.topic_name, ...titleParts].filter(Boolean).join(" "));
  if (isBasicStudyPlanQuotedTitleContinuation(cleaned, previousTopic)) return true;
  if (/^[«"]/u.test(cleaned)) {
    return Boolean(titleParts.length || /(?:игра|подвижная|развития)$/iu.test(previousTopic));
  }
  if (/^[а-яё]/u.test(cleaned)) return true;
  return false;
}

function isBasicStudyPlanQuotedTitleContinuation(line, previousTopic) {
  const cleaned = cleanupLine(line);
  const previous = cleanupLine(previousTopic);
  if (!cleaned || !previous || cleaned.length > 120) return false;
  if (!/[»"]\s*$/u.test(cleaned)) return false;

  if (!hasUnclosedStudyPlanQuote(previous)) return false;

  return /^\(?[А-ЯЁа-яёA-Za-z0-9\s.,-]+\)?[»"]$/u.test(cleaned);
}

function hasUnclosedStudyPlanQuote(value) {
  const text = cleanupLine(value);
  const russianQuoteBalance = (text.match(/«/gu) || []).length - (text.match(/»/gu) || []).length;
  if (russianQuoteBalance > 0) return true;
  return ((text.match(/"/gu) || []).length % 2) === 1;
}

function appendBasicStudyPlanTitleContinuation(rows, line) {
  if (!rows.length) return false;
  const previous = rows[rows.length - 1];
  const fragment = extractBasicStudyPlanTitleContinuationFragment(line, previous.topic_name);
  if (!fragment) return false;

  const topicName = cleanupBasicStudyPlanTopicName(`${previous.topic_name} ${fragment}`);
  if (!isValidTopic(topicName) && !isLongBasicStudyPlanTopicName(topicName)) return false;

  rows[rows.length - 1] = {
    ...previous,
    topic_name: topicName,
    source_excerpt: cleanupLine(`${previous.source_excerpt || ""} ${line}`).slice(0, 1500),
    raw_payload: {
      ...(previous.raw_payload || {}),
      parsed_lines: [...(previous.raw_payload?.parsed_lines || []), line],
      title_continuation_after_page_header: fragment,
    },
  };
  return true;
}

function extractBasicStudyPlanTitleContinuationFragment(line, previousTopicName) {
  const cleaned = cleanupLine(line);
  const previous = cleanupLine(previousTopicName);
  if (!cleaned || !previous) return "";
  if (isBasicStudyPlanRowStartLine(cleaned) || isTotalTopicName(cleaned)) return "";
  if (/\d+(?:[,.]\d+)?\s+(?:-|\d+(?:[,.]\d+)?)(?:\s+(?:-|\d+(?:[,.]\d+)?))?/u.test(cleaned)) return "";

  const fragment = stripBasicStudyPlanActivityTail(cleaned);
  if (!fragment) return "";

  if (/(?:^|\s)и\s+как$/iu.test(previous) && /^[а-яё]/u.test(fragment)) return fragment;
  if (/(?:^|\s)лыжном$/iu.test(previous) && /^походе(?:\s|$)/iu.test(fragment)) return "походе";
  if (/специальная\s+физическая\s+подготовка$/iu.test(previous) && /^юнармейца(?:\s|$)/iu.test(fragment)) {
    return "юнармейца";
  }

  return "";
}

function stripBasicStudyPlanActivityTail(line) {
  return cleanupLine(line)
    .replace(
      /\s+(?:практикум|практическ(?:ая|ое|ие|их)?|работа|соревнование|наблюдение|разбор|зач[её]т|фронтальн(?:ый|ая)|опрос|тестирование)(?:\s|,|\.|$).*$/iu,
      "",
    )
    .trim();
}

function extractCellWiseStudyPlanRows(lines) {
  const ranges = [];
  const headerIndexes = findCellWiseStudyPlanHeaderIndexes(lines);

  for (const startIndex of headerIndexes) {
    const endIndex = findCellWiseStudyPlanEndIndex(lines, startIndex, headerIndexes);
    const rows = extractCellWiseStudyPlanRowsFromRange(lines, startIndex, endIndex);
    if (rows.length) ranges.push(rows);
  }

  return removeBasicStudyPlanParentRows(selectCellWiseStudyPlanRanges(ranges));
}

function selectCellWiseStudyPlanRanges(ranges) {
  if (!ranges.length) return [];
  if (ranges.length === 1) return ranges[0];

  const groups = [];
  for (const range of ranges) {
    const group = groups.find((candidate) =>
      candidate.some((existingRange) => areAlternativeStudyPlanRanges(existingRange, range)),
    );
    if (group) {
      group.push(range);
    } else {
      groups.push([range]);
    }
  }

  return groups.flatMap(selectBestAlternativeStudyPlanRange);
}

function areAlternativeStudyPlanRanges(left, right) {
  if (!left.length || !right.length) return false;
  if (Math.abs(left.length - right.length) > Math.max(2, Math.ceil(Math.max(left.length, right.length) * 0.25))) {
    return false;
  }

  const comparable = Math.min(left.length, right.length);
  let sameNames = 0;
  let sameTotals = 0;
  for (let index = 0; index < comparable; index += 1) {
    if (normalizeTopicComparisonKey(left[index].topic_name) === normalizeTopicComparisonKey(right[index].topic_name)) {
      sameNames += 1;
    }
    if (Number(left[index].hours_total) === Number(right[index].hours_total)) {
      sameTotals += 1;
    }
  }

  return sameNames >= Math.ceil(comparable * 0.5) || (sameTotals === comparable && sameNames >= Math.ceil(comparable * 0.35));
}

function selectBestAlternativeStudyPlanRange(ranges) {
  if (ranges.length === 1) return ranges[0];
  const selected = ranges
    .map((range, index) => ({ range, index, score: scoreStudyPlanRange(range) }))
    .sort((left, right) => right.score - left.score || right.index - left.index)[0].range;

  return selected.map((row, rowIndex) => {
    if (row.hours_theory != null && row.hours_practice != null) return row;

    const richerRow = ranges
      .map((range) => range[rowIndex])
      .find(
        (candidate) =>
          candidate &&
          Number(candidate.hours_total) === Number(row.hours_total) &&
          candidate.hours_theory != null &&
          candidate.hours_practice != null,
      );
    if (!richerRow) return row;

    return {
      ...row,
      hours_theory: richerRow.hours_theory,
      hours_practice: richerRow.hours_practice,
      raw_payload: {
        ...(row.raw_payload || {}),
        borrowed_hours_from_parser: richerRow.raw_payload?.parser || richerRow.source_section || "",
      },
    };
  });
}

function scoreStudyPlanRange(rows) {
  return rows.reduce((score, row) => score + scoreTopicSpecificity(row.topic_name), rows.length * 20);
}

function scoreTopicSpecificity(value) {
  const topic = cleanupLine(value);
  let score = Math.min(40, topic.length / 4);
  if (/(подготовк|составлен|маршрут|поход|ориентирован|снаряжен|туристск|краевед)/iu.test(topic)) score += 6;
  if (/^(выполнение\s+комплекса\s+упражнений|практическое\s+занятие|упражнения)$/iu.test(topic)) score -= 12;
  return score;
}

function extractCellWiseStudyPlanRowsFromRange(lines, startIndex, endIndex) {
  const rows = [];
  let currentSection = detectCellWiseStudyPlanSection(lines, startIndex);
  const hourOrder = detectBasicStudyPlanHourOrder(lines, startIndex);

  for (let index = startIndex + 1; index < endIndex; index += 1) {
    const line = cleanupLine(lines[index]);
    const bareNumberStart = PAGE_NUMBER_RE.test(line)
      ? parseCellWiseStudyPlanBareNumberStart(lines, index, endIndex)
      : null;
    if (!line || isCellWiseStudyPlanHeaderLine(line) || (PAGE_NUMBER_RE.test(line) && !bareNumberStart)) continue;
    if (rows.length > 0 && isBasicStudyPlanStopLine(line)) break;

    const yearSection = detectYearSection(line);
    if (yearSection) {
      currentSection = yearSection;
      continue;
    }

    const start =
      parseCellWiseStudyPlanStart(line) ||
      bareNumberStart;
    if (!start) continue;

    let nextIndex = index + 1;
    const titleParts = [];
    if (start.title) titleParts.push(start.title);

    while (nextIndex < endIndex) {
      const nextLine = cleanupLine(lines[nextIndex]);
      if (!nextLine || isCellWiseStudyPlanHeaderLine(nextLine)) {
        nextIndex += 1;
        continue;
      }
      if (isBasicStudyPlanStopLine(nextLine) || parseCellWiseStudyPlanStart(nextLine)) break;
      if (isCellWiseHourCell(nextLine)) break;
      titleParts.push(nextLine);
      nextIndex += 1;
    }

    const hourCells = [];
    const hourLines = [];
    while (nextIndex < endIndex && hourCells.length < 3) {
      const nextLine = cleanupLine(lines[nextIndex]);
      if (!nextLine || isCellWiseStudyPlanHeaderLine(nextLine)) {
        nextIndex += 1;
        continue;
      }
      if (parseCellWiseStudyPlanStart(nextLine) && hourCells.length > 0) break;
      if (!isCellWiseHourCell(nextLine)) break;
      hourCells.push(parseHourCell(nextLine));
      hourLines.push(nextLine);
      nextIndex += 1;
    }

    const hours = mapCellWiseStudyPlanHours(hourCells, hourOrder);
    if (!hours) continue;

    const title = cleanupBasicStudyPlanTopicName(titleParts.join(" "));
    if (!isValidTopic(title)) continue;
    if (start.isSection) {
      currentSection = title;
      index = Math.max(index, nextIndex - 1);
      continue;
    }

    rows.push({
      plan_number: start.number,
      section_title: currentSection || "Учебный план",
      topic_name: title,
      hours_theory: hours.hoursTheory,
      hours_practice: hours.hoursPractice,
      hours_total: hours.hoursTotal,
      activity_type: inferLessonThematicPlanningActivityType({
        hoursTheory: hours.hoursTheory,
        hoursPractice: hours.hoursPractice,
      }),
      control_form: "",
      source_section: "cell-wise-study-plan",
      source_excerpt: [line, ...titleParts, ...hourLines].join(" / ").slice(0, 1500),
      confidence: hourCells.length >= 3 ? 0.86 : 0.74,
      raw_payload: {
        parser: "cell-wise-study-plan",
        plan_number: start.number,
        parsed_hour_cells: hourLines,
      },
    });

    index = Math.max(index, nextIndex - 1);
  }

  return rows;
}

function findCellWiseStudyPlanHeaderIndexes(lines) {
  const indexes = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!/учебн[оы]\s*[- ]?\s*тематическ(?:ий|ого)?\s+план|учебн(?:ый|ого)\s+план/iu.test(line)) continue;

    const windowLines = lines.slice(index, index + 24).map(cleanupLine);
    const window = windowLines.join(" ");
    if (!/название\s+темы|наименование\s+(?:раздела|темы|разделов\s+и\s+тем)|содержание\s+программы|тема/iu.test(window)) continue;
    if (!/всего/iu.test(window) || !/теори[яи]/iu.test(window) || !/практ/iu.test(window)) continue;
    if (windowLines.filter(isCellWiseHourCell).length >= 3) indexes.push(index);
  }

  return indexes;
}

function findCellWiseStudyPlanEndIndex(lines, startIndex, headerIndexes) {
  const nextHeader = headerIndexes.find((headerIndex) => headerIndex > startIndex);
  let endIndex = nextHeader || lines.length;

  for (let index = startIndex + 1; index < endIndex; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line) continue;
    if (index < startIndex + 12 && isCellWiseStudyPlanHeaderLine(line)) continue;
    if (isBasicStudyPlanStopLine(line)) return index;
  }

  return endIndex;
}

function detectCellWiseStudyPlanSection(lines, startIndex) {
  for (let index = startIndex + 1; index < Math.min(lines.length, startIndex + 5); index += 1) {
    const line = cleanupLine(lines[index]);
    const yearSection = detectYearSection(line);
    if (yearSection) return yearSection;
    const parenthesizedYear = line.match(/^\(?\s*((?:\d+|первый|второй|третий|четвертый)\s+год\s+обучения)\s*\)?$/iu);
    if (parenthesizedYear) return parenthesizedYear[1];
  }

  return "Учебный план";
}

function mapCellWiseStudyPlanHours(hourCells, hourOrder = ["total", "theory", "practice"]) {
  if (!hourCells.length || hourCells.some((value) => value == null)) return null;
  const [first, second, third] = hourCells;

  if (hourCells.length >= 3) {
    const mapped = mapBasicStudyPlanHours([first, second, third], hourOrder);
    if (!isPlausibleHours(mapped.theory || 0, mapped.practice || 0, mapped.total)) return null;
    return {
      hoursTotal: mapped.total,
      hoursTheory: mapped.theory || 0,
      hoursPractice: mapped.practice || 0,
    };
  }

  if (hourCells.length === 2) {
    if (first <= 0 || second < 0 || first > 1000 || second > 1000) return null;
    if (hourOrder[0] === "theory") {
      return {
        hoursTotal: Math.max(first, second),
        hoursTheory: null,
        hoursPractice: null,
      };
    }
    if (second > first + 0.01) return null;
    return {
      hoursTotal: first,
      hoursTheory: null,
      hoursPractice: null,
    };
  }

  if (first <= 0 || first > 1000) return null;
  return {
    hoursTotal: first,
    hoursTheory: null,
    hoursPractice: null,
  };
}

function extractVerticalStudyPlanRows(lines) {
  const startIndex = findVerticalStudyPlanHeaderIndex(lines);
  if (startIndex < 0) return [];

  const rows = [];
  let index = startIndex + 1;

  while (index < lines.length) {
    const line = cleanupLine(lines[index]);
    if (!line || isVerticalStudyPlanHeaderLine(line)) {
      index += 1;
      continue;
    }
    if (rows.length > 0 && (TOTAL_RE.test(line) || HARD_STOP_RE.test(line))) break;

    const parsed = parseVerticalStudyPlanRow(lines, index);
    if (!parsed) {
      index += 1;
      continue;
    }

    rows.push(parsed.row);
    index = parsed.nextIndex;
  }

  return removeBasicStudyPlanParentRows(rows);
}

function findVerticalStudyPlanHeaderIndex(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!/^учебн(?:ый|ого)\s+план$/iu.test(line)) continue;

    const window = lines
      .slice(index, index + 18)
      .map(cleanupLine)
      .join(" ");
    if (
      /наименование\s+разделов/iu.test(window) &&
      /часов\s+всего/iu.test(window) &&
      /часов\s+теории/iu.test(window) &&
      /часов\s+практики/iu.test(window)
    ) {
      return index;
    }
  }

  return -1;
}

function parseVerticalStudyPlanRow(lines, startIndex) {
  const numberMatch = cleanupLine(lines[startIndex]).match(/^(\d{1,3})\.$/u);
  if (!numberMatch) return null;

  const titleParts = [];
  let cursor = startIndex + 1;
  while (cursor < lines.length) {
    const line = cleanupLine(lines[cursor]);
    if (!line || isVerticalStudyPlanHeaderLine(line)) {
      cursor += 1;
      continue;
    }
    if (TOTAL_RE.test(line) || HARD_STOP_RE.test(line) || line.match(/^\d{1,3}\.$/u)) return null;
    if (isCellWiseHourCell(line)) break;
    titleParts.push(line);
    cursor += 1;
  }

  const title = cleanupBasicStudyPlanTopicName(titleParts.join(" "));
  if (!isValidTopic(title)) return null;

  const totalLine = cleanupLine(lines[cursor]);
  const theoryLine = cleanupLine(lines[cursor + 1]);
  const practiceLine = cleanupLine(lines[cursor + 2]);
  const hoursTotal = parseHourCell(totalLine);
  const hoursTheory = parseHourCell(theoryLine);
  let hoursPractice = parseHourCell(practiceLine);
  let practiceSourceLine = practiceLine;
  let nextIndex = cursor + 3;

  if (hoursTotal == null || hoursTheory == null) return null;
  if (hoursPractice == null) {
    hoursPractice = 0;
    practiceSourceLine = "0";
    nextIndex = cursor + 2;
  }
  if (!isPlausibleHours(hoursTheory, hoursPractice, hoursTotal)) return null;

  const controlParts = [];
  while (nextIndex < lines.length) {
    const line = cleanupLine(lines[nextIndex]);
    if (!line || isVerticalStudyPlanHeaderLine(line)) {
      nextIndex += 1;
      continue;
    }
    if (TOTAL_RE.test(line) || HARD_STOP_RE.test(line) || line.match(/^\d{1,3}\.$/u)) break;
    controlParts.push(line);
    nextIndex += 1;
  }

  return {
    nextIndex,
    row: {
      plan_number: numberMatch[1],
      section_title: "Учебный план",
      topic_name: title,
      hours_theory: hoursTheory,
      hours_practice: hoursPractice,
      hours_total: hoursTotal,
      activity_type: inferLessonThematicPlanningActivityType({
        hoursTheory,
        hoursPractice,
      }),
      control_form: cleanupControlForm(controlParts.join(" ")),
      source_section: "vertical-study-plan",
      source_excerpt: [lines[startIndex], ...titleParts, totalLine, theoryLine, practiceSourceLine, ...controlParts]
        .filter(Boolean)
        .join(" / ")
        .slice(0, 1500),
      confidence: 0.88,
      raw_payload: {
        parser: "vertical-study-plan",
        plan_number: numberMatch[1],
      },
    },
  };
}

function isVerticalStudyPlanHeaderLine(line) {
  return /^(?:№|п\\?\/?п|наименование\s+разделов|часов|всего|теории|практики|форма\s+контроля)$/iu.test(
    cleanupLine(line),
  );
}

function parseCellWiseStudyPlanStart(line) {
  const cleaned = cleanupLine(line);
  if (isCommaDecimalHourLine(cleaned)) return null;

  const topicMatch = cleaned.match(/^тема\s+(\d+(?:\.\d+)*)\.?\s*(.*)$/iu);
  if (topicMatch) {
    return {
      number: topicMatch[1],
      title: cleanupLine(topicMatch[2]),
    };
  }

  const sectionMatch = cleaned.match(/^раздел\s+(\d+(?:\.\d+)*)\.?\s*(.*)$/iu);
  if (sectionMatch) {
    return {
      number: sectionMatch[1],
      title: cleanupLine(sectionMatch[2]),
      isSection: true,
    };
  }

  const standaloneNumberMatch = cleaned.match(/^(\d{1,3})\.$/u);
  if (standaloneNumberMatch) {
    return {
      number: standaloneNumberMatch[1],
      title: "",
    };
  }

  const match = cleaned.match(/^(\d+(?:\.\d+)*)(?:[.)])?\s*(.*)$/u);
  if (!match) return null;
  if (!match[2] && !/\./u.test(match[1])) return null;
  return {
    number: match[1],
    title: cleanupLine(match[2]),
  };
}

function parseCellWiseStudyPlanBareNumberStart(lines, index, endIndex) {
  const line = cleanupLine(lines[index]);
  const numberMatch = line.match(/^(\d{1,3})$/u);
  if (!numberMatch) return null;

  let nextIndex = index + 1;
  let sawTitleLine = false;

  while (nextIndex < endIndex) {
    const nextLine = cleanupLine(lines[nextIndex]);
    if (!nextLine || isCellWiseStudyPlanHeaderLine(nextLine) || PAGE_NUMBER_RE.test(nextLine)) {
      nextIndex += 1;
      continue;
    }
    if (isBasicStudyPlanStopLine(nextLine) || parseCellWiseStudyPlanStart(nextLine)) return null;
    if (isCellWiseHourCell(nextLine)) return null;

    sawTitleLine = isValidTopic(cleanupBasicStudyPlanTopicName(nextLine));
    break;
  }

  if (!sawTitleLine) return null;

  let hourCells = 0;
  for (let lookahead = nextIndex + 1; lookahead < endIndex && lookahead < nextIndex + 12; lookahead += 1) {
    const nextLine = cleanupLine(lines[lookahead]);
    if (!nextLine || isCellWiseStudyPlanHeaderLine(nextLine)) continue;
    if (parseCellWiseStudyPlanStart(nextLine)) break;
    if (isCellWiseHourCell(nextLine)) {
      hourCells += 1;
      if (hourCells >= 1) {
        return {
          number: numberMatch[1],
          title: "",
        };
      }
      continue;
    }
    if (hourCells > 0) break;
  }

  return null;
}

function isCellWiseHourCell(line) {
  return /^(?:-|\d+(?:[,.]\d+)?)$/u.test(cleanupLine(line));
}

function isStandaloneStudyPlanHourCellLine(line) {
  return /^(?:-|\d+(?:[,.]\d+)?)$/u.test(cleanupLine(line));
}

function isCommaDecimalHourLine(line) {
  return /^\d{1,3},\d{1,2}(?:\s|$)/u.test(cleanupLine(line));
}

function isCellWiseStudyPlanHeaderLine(line) {
  const cleaned = cleanupLine(line);
  return /^(?:№|название\s+темы|наименование\s+(?:раздела|темы)|содержание\s+программы|количество\s+часов|всего|теория|прак(?:тика|-)?|тика)$/iu.test(
    cleaned,
  );
}

function extractCoursePlanningSummaryRows(lines) {
  const startIndex = findCoursePlanningSummaryHeaderIndex(lines);
  if (startIndex < 0) return [];

  const rows = [];
  let explicitTotal = null;

  for (let index = startIndex + 1; index < lines.length;) {
    const line = cleanupLine(lines[index]);
    if (!line || isCoursePlanningSummaryHeaderLine(line)) {
      index += 1;
      continue;
    }

    const total = parseCoursePlanningSummaryTotalLine(line);
    if (total) {
      explicitTotal = total;
      break;
    }
    if (rows.length > 0 && isCoursePlanningSummaryStopLine(line)) break;

    const start = parseCoursePlanningSummaryTopLevelStart(line);
    if (!start) {
      index += 1;
      continue;
    }

    const nextIndex = findNextCoursePlanningSummaryRowIndex(lines, index + 1);
    const row = buildCoursePlanningSummaryRow(lines.slice(index, nextIndex), start);
    if (row) rows.push(row);
    index = nextIndex;
  }

  if (rows.length < 3 || !explicitTotal) return [];
  return reconcileCoursePlanningSummaryRows(rows, explicitTotal);
}

function findCoursePlanningSummaryHeaderIndex(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!/^планирование\s+курса$/iu.test(line)) continue;

    const window = lines
      .slice(index, index + 18)
      .map(cleanupLine)
      .join(" ");
    if (
      /наименование\s+разделов\s+и\s+тем/iu.test(window) &&
      /количество\s+часов/iu.test(window) &&
      hasTotalHoursHeader(window) &&
      hasTheoryHeader(window) &&
      hasPracticeHeader(window)
    ) {
      return index;
    }
  }

  return -1;
}

function findNextCoursePlanningSummaryRowIndex(lines, startIndex) {
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line || isCoursePlanningSummaryHeaderLine(line)) continue;
    if (parseCoursePlanningSummaryTotalLine(line) || isCoursePlanningSummaryStopLine(line)) return index;
    if (parseCoursePlanningSummaryTopLevelStart(line)) return index;
  }
  return lines.length;
}

function parseCoursePlanningSummaryTopLevelStart(line) {
  const match = cleanupLine(line).match(/^(\d{1,2})\.(?:\s+|$)(.*)$/u);
  if (!match) return null;
  return {
    number: match[1],
    title: cleanupLine(match[2] || ""),
  };
}

function buildCoursePlanningSummaryRow(segment, start) {
  const lines = segment.map(cleanupLine).filter(Boolean);
  if (!lines.length) return null;

  const titleParts = [];
  const hourTokens = [];
  const hourLines = [];

  if (start.title) {
    const split = splitCoursePlanningSummaryLineHours(start.title);
    if (split.title) titleParts.push(split.title);
    if (split.hours.length) {
      hourTokens.push(...split.hours);
      hourLines.push(start.title);
    }
  }

  for (const rawLine of lines.slice(1)) {
    const line = cleanupLine(rawLine);
    if (!line || isCoursePlanningSummaryHeaderLine(line)) continue;
    if (isCoursePlanningNestedRowStart(line) || parseCoursePlanningSummaryTotalLine(line)) break;

    const split = splitCoursePlanningSummaryLineHours(line);
    if (split.title) titleParts.push(split.title);
    if (split.hours.length) {
      hourTokens.push(...split.hours);
      hourLines.push(line);
    }
  }

  const title = cleanupBasicStudyPlanTopicName(titleParts.join(" "));
  if (!isValidTopic(title)) return null;

  const hours = mapCoursePlanningSummaryHours(hourTokens, title);
  if (!hours) return null;

  return {
    plan_number: start.number,
    section_title: "Планирование курса",
    topic_name: title,
    hours_theory: hours.hoursTheory,
    hours_practice: hours.hoursPractice,
    hours_total: hours.hoursTotal,
    activity_type: inferLessonThematicPlanningActivityType({
      hoursTheory: hours.hoursTheory,
      hoursPractice: hours.hoursPractice,
    }),
    control_form: "",
    source_section: "course-planning-summary",
    source_excerpt: [lines[0], ...titleParts, ...hourLines].join(" / ").slice(0, 1500),
    confidence: 0.88,
    raw_payload: {
      parser: "course-planning-summary",
      plan_number: start.number,
      parsed_lines: lines,
    },
  };
}

function splitCoursePlanningSummaryLineHours(line) {
  const cleaned = cleanupLine(line);
  const numberPattern = "(?:-|\\d+(?:[,.]\\d+)?)";
  const onlyHours = cleaned.match(new RegExp(`^(${numberPattern}(?:\\s+${numberPattern}){0,2})$`, "u"));
  if (onlyHours) {
    return {
      title: "",
      hours: onlyHours[1].split(/\s+/u),
    };
  }

  const tail = cleaned.match(new RegExp(`^(.+?)\\s+(${numberPattern}(?:\\s+${numberPattern}){0,2})$`, "u"));
  if (!tail) {
    return {
      title: cleaned,
      hours: [],
    };
  }

  return {
    title: cleanupLine(tail[1]),
    hours: tail[2].split(/\s+/u),
  };
}

function mapCoursePlanningSummaryHours(tokens, title) {
  const values = tokens.map(parseHourCell).filter((value) => value != null);
  if (values.length >= 3) {
    const [hoursTotal, hoursTheory, hoursPractice] = values.slice(-3);
    if (!isPlausibleHours(hoursTheory, hoursPractice, hoursTotal)) return null;
    return {
      hoursTotal,
      hoursTheory,
      hoursPractice,
    };
  }

  if (values.length === 2) {
    const [first, second] = values;
    if (isLikelyPracticalOnlyTwoCellStudyPlanRow(title, first, second, "")) {
      return {
        hoursTotal: second,
        hoursTheory: 0,
        hoursPractice: first,
      };
    }
    if (second <= first) {
      return {
        hoursTotal: first,
        hoursTheory: second,
        hoursPractice: roundHour(Math.max(0, first - second)),
      };
    }
  }

  return null;
}

function reconcileCoursePlanningSummaryRows(rows, explicitTotal) {
  const repaired = rows.map((row) => ({ ...row }));
  const sumTotal = sumTopicHoursTotal(repaired);
  const expectedTotal = normalizeNullableHour(explicitTotal.hoursTotal);
  if (expectedTotal == null || Math.abs(sumTotal - expectedTotal) <= 0.01) return repaired;

  const candidates = repaired.filter((row) => {
    const hoursTotal = normalizeNullableHour(row.hours_total);
    const hoursTheory = normalizeNullableHour(row.hours_theory);
    const hoursPractice = normalizeNullableHour(row.hours_practice);
    if (hoursTotal == null || hoursTheory == null || hoursPractice == null) return false;
    return hoursTotal > roundHour(hoursTheory + hoursPractice);
  });
  const removableExcess = roundHour(
    candidates.reduce((sum, row) => sum + (Number(row.hours_total) - roundHour(Number(row.hours_theory) + Number(row.hours_practice))), 0),
  );
  const excess = roundHour(sumTotal - expectedTotal);
  if (excess <= 0 || Math.abs(removableExcess - excess) > 0.01) return repaired;

  return repaired.map((row) => {
    const hoursTotal = normalizeNullableHour(row.hours_total);
    const hoursTheory = normalizeNullableHour(row.hours_theory);
    const hoursPractice = normalizeNullableHour(row.hours_practice);
    if (hoursTotal == null || hoursTheory == null || hoursPractice == null) return row;
    const calculatedTotal = roundHour(hoursTheory + hoursPractice);
    if (hoursTotal <= calculatedTotal) return row;
    return {
      ...row,
      hours_total: calculatedTotal,
      source_excerpt: cleanupLine(`${row.source_excerpt || ""} / ${explicitTotal.source}`).slice(0, 1500),
      raw_payload: {
        ...(row.raw_payload || {}),
        repaired_total_from_explicit_summary: explicitTotal.source,
        original_hours_total: hoursTotal,
      },
    };
  });
}

function parseCoursePlanningSummaryTotalLine(line) {
  const match = cleanupLine(line).match(/^итого\s+часов\s*:\s*(\d+(?:[,.]\d+)?)\s+(\d+(?:[,.]\d+)?)\s+(\d+(?:[,.]\d+)?)$/iu);
  if (!match) return null;
  return {
    hoursTotal: parseHourCell(match[1]),
    hoursTheory: parseHourCell(match[2]),
    hoursPractice: parseHourCell(match[3]),
    source: cleanupLine(line),
  };
}

function isCoursePlanningNestedRowStart(line) {
  return /^\d{1,2}\.\d+(?:\.\s*|\s+)/u.test(cleanupLine(line));
}

function isCoursePlanningSummaryHeaderLine(line) {
  const cleaned = cleanupLine(line);
  return /^(?:№|п\/?п|наименование\s+разделов\s+и\s+тем|количество\s+часов|всего|теория|практика)$/iu.test(cleaned);
}

function isCoursePlanningSummaryStopLine(line) {
  return /^(?:содержание\s+учебного\s+плана|содержание\s+программы|методическ|материально|список\s+литературы|литература|приложение)/iu.test(
    cleanupLine(line),
  );
}

function extractCompactStudyPlanRows(lines) {
  const startIndex = findCompactStudyPlanHeaderIndex(lines);
  if (startIndex < 0) return [];

  const rows = [];
  let segment = null;

  const flushSegment = () => {
    if (!segment) return;
    const row = buildCompactStudyPlanRow(segment);
    segment = null;
    if (row) rows.push(row);
  };

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line) continue;
    if (/^содержание\s+учебного\s+плана:?$/iu.test(line) || /^методическ/iu.test(line)) {
      flushSegment();
      break;
    }
    if (/^всего(?:\s|$)/iu.test(line)) {
      flushSegment();
      break;
    }
    if (isCompactStudyPlanHeaderLine(line)) continue;

    const rowStart = parseCompactStudyPlanRowStart(line);
    if (rowStart) {
      flushSegment();
      segment = {
        number: rowStart.number,
        lines: rowStart.title ? [rowStart.title] : [],
        rawLines: [line],
      };
      continue;
    }

    if (PAGE_NUMBER_RE.test(line)) continue;
    if (!segment) continue;
    segment.lines.push(line);
    segment.rawLines.push(line);
  }

  flushSegment();
  return rows.length >= 3 ? rows : [];
}

function findCompactStudyPlanHeaderIndex(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!/^учебный\s+план$/iu.test(line)) continue;

    const window = lines
      .slice(index, index + 18)
      .map(cleanupLine)
      .join(" ");
    if (
      /№\s+тема/iu.test(window) &&
      /количество\s+часов/iu.test(window) &&
      /форм[аы]\s+контрол/iu.test(window) &&
      hasTheoryHeader(window) &&
      hasPracticeHeader(window) &&
      /комбинированн(?:ое|ый)?\s+заняти[ея]/iu.test(window)
    ) {
      return index;
    }
  }

  return -1;
}

function isCompactStudyPlanHeaderLine(line) {
  const cleaned = cleanupLine(line);
  return /^(?:№|тема|количество\s+часов|форм[аы]\s+контрол[яь]?|теория\s+практика|комбинированное|занятие)$/iu.test(
    cleaned,
  );
}

function parseCompactStudyPlanRowStart(line) {
  const match = cleanupLine(line).match(/^(\d{1,2})(?:[.)])?(?:\s+(.+))?$/u);
  if (!match) return null;

  const number = Number(match[1]);
  if (!Number.isInteger(number) || number <= 0 || number > 40) return null;

  const title = cleanupLine(match[2] || "");
  if (title && !/[^\d\s,.-]/u.test(title)) return null;
  return {
    number,
    title,
  };
}

function buildCompactStudyPlanRow(segment) {
  const hourLineIndex = segment.lines.findIndex((line) => parseCompactStudyPlanHoursLine(line));
  if (hourLineIndex < 0) return null;

  const parsed = parseCompactStudyPlanHoursLine(segment.lines[hourLineIndex]);
  if (!parsed) return null;

  const titleParts = [
    ...segment.lines.slice(0, hourLineIndex),
    parsed.title,
  ].filter(Boolean);
  const topicName = cleanupTopicName(titleParts.join(" "));
  if (!isValidTopic(topicName)) return null;

  const controlForm = cleanupControlForm(
    [parsed.controlForm, ...segment.lines.slice(hourLineIndex + 1)].filter(Boolean).join(" "),
  );
  const hoursTheory = parsed.hoursTheory || 0;
  const hoursPractice = roundHour((parsed.hoursPractice || 0) + (parsed.hoursCombined || 0));
  const hoursTotal = roundHour(hoursTheory + hoursPractice);
  if (!isPlausibleHours(hoursTheory, hoursPractice, hoursTotal)) return null;

  return {
    plan_number: String(segment.number),
    section_title: "Учебный план",
    topic_name: topicName,
    hours_theory: hoursTheory,
    hours_practice: hoursPractice,
    hours_total: hoursTotal,
    activity_type: inferLessonThematicPlanningActivityType({
      hoursTheory,
      hoursPractice,
    }),
    control_form: controlForm,
    source_section: "compact-study-plan",
    source_excerpt: segment.rawLines.join(" / ").slice(0, 1500),
    confidence: 0.86,
    raw_payload: {
      parser: "compact-study-plan",
      plan_number: String(segment.number),
      parsed_lines: segment.rawLines,
      hours_combined: parsed.hoursCombined || 0,
      control_form: controlForm,
    },
  };
}

function parseCompactStudyPlanHoursLine(line) {
  const numberPattern = "(-|\\d+(?:[,.]\\d+)?)";
  const match = cleanupLine(line).match(
    new RegExp(`^(?:(.*?)\\s+)?${numberPattern}\\s+${numberPattern}\\s+${numberPattern}(?:\\s+(.+))?$`, "u"),
  );
  if (!match) return null;

  const hoursTheory = parseHourCell(match[2]);
  const hoursPractice = parseHourCell(match[3]);
  const hoursCombined = parseHourCell(match[4]);
  if ([hoursTheory, hoursPractice, hoursCombined].some((value) => value == null)) return null;
  if (hoursTheory + hoursPractice + hoursCombined <= 0) return null;

  return {
    title: cleanupLine(match[1] || ""),
    hoursTheory,
    hoursPractice,
    hoursCombined,
    controlForm: cleanupLine(match[5] || ""),
  };
}

function extractRomanContentStudyPlanRows(lines) {
  const startIndex = lines.findIndex((line) => /^содержание\s+учебного\s+плана:?$/iu.test(cleanupLine(line)));
  if (startIndex < 0) return [];

  const rows = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line || PAGE_NUMBER_RE.test(line)) continue;
    if (rows.length > 0 && /^(?:методическ|материально|список\s+литературы|литература|приложение)/iu.test(line)) break;

    const section = parseRomanContentStudyPlanSection(line);
    if (!section) continue;

    const nextIndex = findNextRomanContentStudyPlanSectionIndex(lines, index + 1);
    const segment = lines.slice(index, nextIndex).map(cleanupLine).filter(Boolean);
    const hours = parseRomanContentStudyPlanHours(segment);
    if (hours.hoursTotal == null || hours.hoursTotal <= 0) {
      index = nextIndex - 1;
      continue;
    }

    rows.push({
      plan_number: section.number,
      section_title: "Содержание учебного плана",
      topic_name: section.title,
      hours_theory: hours.hoursTheory,
      hours_practice: hours.hoursPractice,
      hours_total: hours.hoursTotal,
      activity_type: inferLessonThematicPlanningActivityType({
        hoursTheory: hours.hoursTheory,
        hoursPractice: hours.hoursPractice,
      }),
      control_form: "",
      source_section: "roman-content-study-plan",
      source_excerpt: segment.join(" / ").slice(0, 1500),
      confidence: 0.82,
      raw_payload: {
        parser: "roman-content-study-plan",
        roman_number: section.number,
        parsed_lines: segment,
      },
    });
    index = nextIndex - 1;
  }

  return rows;
}

function parseRomanContentStudyPlanSection(line) {
  const match = cleanupLine(line).match(/^([IVXLCDM]+)\.\s+(.+?)\.?$/iu);
  if (!match) return null;
  const title = cleanupTopicName(match[2]);
  if (!isValidTopic(title)) return null;
  return {
    number: match[1].toUpperCase(),
    title,
  };
}

function findNextRomanContentStudyPlanSectionIndex(lines, startIndex) {
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (parseRomanContentStudyPlanSection(line)) return index;
    if (/^(?:методическ|материально|список\s+литературы|литература|приложение)/iu.test(line)) return index;
  }
  return lines.length;
}

function parseRomanContentStudyPlanHours(segment) {
  let hoursTheory = 0;
  let hoursPractice = 0;
  for (const line of segment) {
    const match = cleanupLine(line).match(
      /^(?:\d+\.\s*)?(теория|практика|комбинированное\s+занятие),?\s*(\d+(?:[,.]\d+)?)\s*час/iu,
    );
    if (!match) continue;
    const hours = parseHourCell(match[2]);
    if (hours == null) continue;
    if (/теория/iu.test(match[1])) hoursTheory = roundHour(hoursTheory + hours);
    else hoursPractice = roundHour(hoursPractice + hours);
  }
  return {
    hoursTheory,
    hoursPractice,
    hoursTotal: roundHour(hoursTheory + hoursPractice),
  };
}

function extractGenericNumberedStudyPlanRows(lines) {
  const headerIndexes = findGenericNumberedStudyPlanHeaderIndexes(lines);
  const rows = [];

  for (const startIndex of headerIndexes) {
    const endIndex = findGenericNumberedStudyPlanEndIndex(lines, startIndex, headerIndexes);
    rows.push(...extractGenericNumberedStudyPlanRowsFromRange(lines, startIndex, endIndex));
  }

  return removeBasicStudyPlanParentRows(rows);
}

function extractAlphabeticTourismStudyPlanRows(lines) {
  const startIndex = findAlphabeticTourismStudyPlanStartIndex(lines);
  if (startIndex < 0) return [];

  const segments = [];
  let current = null;

  for (let index = startIndex; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line || isAlphabeticTourismStudyPlanHeaderLine(line)) continue;
    if (/^итого(?::|\s|$)/iu.test(line)) break;
    if (current && /^содержание\s+программы/iu.test(line)) break;

    const rowStart = parseAlphabeticTourismStudyPlanRowStart(line);
    if (rowStart) {
      if (current) segments.push(current);
      current = {
        number: rowStart.number,
        lines: rowStart.rest ? [rowStart.rest] : [],
        rawLines: [line],
      };
      continue;
    }

    if (PAGE_NUMBER_RE.test(line)) continue;
    if (!current) continue;
    current.lines.push(line);
    current.rawLines.push(line);
  }

  if (current) segments.push(current);

  const rows = segments.map(buildAlphabeticTourismStudyPlanRow).filter(Boolean);
  if (rows.length < 12) return [];
  const markerRows = rows.filter((row) => /^[А-ЯЁ](?:\s*,\s*[А-ЯЁ])?\s+/u.test(row.topic_name)).length;
  if (markerRows < Math.ceil(rows.length * 0.65)) return [];
  return rows;
}

function findAlphabeticTourismStudyPlanStartIndex(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!/учебн(?:ый|ого)\s+план\s+реализации\s+программы/iu.test(line)) continue;

    const window = lines
      .slice(index, index + 80)
      .map(cleanupLine)
      .join(" ");
    if (!/вид\s+туризма/iu.test(window) || !/1\s+год\s+обучения/iu.test(window)) continue;

    const hoursHeaderIndex = lines
      .slice(index, index + 30)
      .findIndex((candidate) => /всего\s+теори[яи]\s+практик[аи]?/iu.test(cleanupLine(candidate)));
    return hoursHeaderIndex >= 0 ? index + hoursHeaderIndex + 1 : index + 1;
  }

  return -1;
}

function parseAlphabeticTourismStudyPlanRowStart(line) {
  const match = cleanupLine(line).match(/^(\d{1,2})(?:\s+(.+))?$/u);
  if (!match) return null;

  const number = Number(match[1]);
  if (!Number.isInteger(number) || number <= 0 || number > 40) return null;
  const rest = cleanupLine(match[2] || "");
  if (/год\s+обучения|час/iu.test(rest)) return null;

  return {
    number,
    rest,
  };
}

function buildAlphabeticTourismStudyPlanRow(segment) {
  const hours = extractAlphabeticTourismStudyPlanHours(segment.lines);
  if (!hours) return null;

  const topicLines = extractAlphabeticTourismStudyPlanTopicLines(segment.lines);
  const rawTopicName = cleanupAlphabeticTourismStudyPlanTopicName(topicLines);
  const topicName = isAlphabeticTourismAssessmentTopic(rawTopicName)
    ? cleanupAlphabeticTourismAssessmentTopicName(topicLines)
    : rawTopicName;
  if (!topicName) return null;
  if (!isValidTopic(topicName)) return null;

  return {
    plan_number: String(segment.number),
    section_title: "Учебный план",
    topic_name: topicName,
    hours_theory: hours.hoursTheory,
    hours_practice: hours.hoursPractice,
    hours_total: hours.hoursTotal,
    activity_type: inferLessonThematicPlanningActivityType({
      hoursTheory: hours.hoursTheory,
      hoursPractice: hours.hoursPractice,
    }),
    control_form: extractAlphabeticTourismStudyPlanControlForm(segment.lines),
    source_section: "basic-study-plan",
    source_excerpt: [String(segment.number), ...segment.rawLines].join(" / ").slice(0, 1500),
    confidence: 0.86,
    raw_payload: {
      parser: "alphabetic-tourism-study-plan",
      plan_number: String(segment.number),
      parsed_lines: segment.rawLines,
    },
  };
}

function extractAlphabeticTourismStudyPlanHours(lines) {
  for (const line of [...lines].reverse()) {
    const match = cleanupLine(line).match(/(\d+(?:[,.]\d+)?)\s+(\d+(?:[,.]\d+)?)\s+(\d+(?:[,.]\d+)?)\s*$/u);
    if (!match) continue;

    const hoursTotal = parseHourCell(match[1]);
    const hoursTheory = parseHourCell(match[2]);
    const hoursPractice = parseHourCell(match[3]);
    if (!isPlausibleHours(hoursTheory, hoursPractice, hoursTotal)) continue;
    return {
      hoursTotal,
      hoursTheory,
      hoursPractice,
    };
  }

  return null;
}

function extractAlphabeticTourismStudyPlanTopicLines(lines) {
  const result = [];
  for (const line of lines) {
    const cleaned = cleanupLine(line).replace(/\s+\d+(?:[,.]\d+)?\s+\d+(?:[,.]\d+)?\s+\d+(?:[,.]\d+)?\s*$/u, "");
    if (!cleaned || isAlphabeticTourismStudyPlanHeaderLine(cleaned) || isAlphabeticTourismNonTopicLine(cleaned)) {
      continue;
    }
    result.push(cleaned);
  }
  return result;
}

function cleanupAlphabeticTourismStudyPlanTopicName(lines) {
  return cleanupTopicName(lines.join(" "))
    .replace(/\s+([,.;:])/gu, "$1")
    .replace(/([А-ЯЁа-яё])-\s+([А-ЯЁа-яё])/gu, "$1-$2")
    .replace(/([а-яё])\s*[—]\s*([А-ЯЁ])/gu, "$1 — $2")
    .replace(/(туризм)-(?=Оборудование)/giu, "$1 — ")
    .replace(/\s+—\s*/gu, " — ")
    .replace(/([А-ЯЁ])\s*,\s*([А-ЯЁ])(?=\s)/gu, "$1,$2")
    .replace(/\b(Вид\s+туризма|Оборудование|Инвентарь)\s*:\s*/giu, "$1: ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s+([)])$/u, "$1");
}

function cleanupAlphabeticTourismAssessmentTopicName(lines) {
  const topicParts = [];
  for (const line of lines) {
    const cleaned = cleanupLine(line).replace(/\s+\d+(?:[,.]\d+)?\s+\d+(?:[,.]\d+)?\s+\d+(?:[,.]\d+)?\s*$/u, "");
    if (!cleaned || isAlphabeticTourismStudyPlanHeaderLine(cleaned) || isAlphabeticTourismNonTopicLine(cleaned)) continue;
    if (/^что\s+делают\s+дети\??/iu.test(cleaned) || /^[‒–—-]\s*/u.test(cleaned)) break;
    if (/соревновани[ея]\s+итогов(?:ая|ый)\s+контроль/iu.test(cleaned)) break;
    topicParts.push(cleaned);
  }

  const topicName = cleanupAlphabeticTourismStudyPlanTopicName(topicParts)
    .replace(/^цель\s*:\s*/iu, "")
    .replace(/\s+что\s+делают\s+дети\??.*$/iu, "")
    .replace(/\s+соревновани[ея]\s+итогов(?:ая|ый)?(?:\s+контроль)?\s*$/iu, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!topicName) return "";
  return topicName.charAt(0).toUpperCase() + topicName.slice(1);
}

function extractAlphabeticTourismStudyPlanControlForm(lines) {
  const text = lines.map(cleanupLine).join(" ");
  const match = text.match(/((?:входящая|текущая|промежуточная|итоговая)?\s*(?:диагностика|контроль))\s+\d+(?:[,.]\d+)?\s+\d+(?:[,.]\d+)?\s+\d+(?:[,.]\d+)?/iu);
  return match ? cleanupControlForm(match[1]) : "";
}

function isAlphabeticTourismStudyPlanHeaderLine(line) {
  return /^(?:№|тема\s+занятия|форма|работы|контроля|1\s+год\s+обучения.*|всего\s+теори[яи]\s+практик[аи]?)$/iu.test(
    cleanupLine(line),
  );
}

function isAlphabeticTourismNonTopicLine(line) {
  const cleaned = cleanupLine(line);
  return (
    /^(?:лекция,?|лекция,\s*игра-?|игра-?викторина|викторина|практическая|работа)$/iu.test(cleaned) ||
    /^(?:входящ(?:ая|ий)|текущ(?:ая|ий)|промежуточн(?:ая|ый)|итогов(?:ая|ый)|соревнование)?\s*(?:диагностика|контроль)?$/iu.test(cleaned)
  );
}

function isAlphabeticTourismAssessmentTopic(topicName) {
  return /^(?:цель:\s*)?проверка\s+практических\s+навыков|^что\s+делают\s+дети|итогов(?:ая|ый)\s+(?:диагностика|контроль)/iu.test(
    cleanupLine(topicName),
  );
}

function extractModuleBasicStudyPlanRows(lines) {
  const headerIndex = findModuleBasicStudyPlanHeaderIndex(lines);
  if (headerIndex < 0) return [];

  const endIndex = findModuleBasicStudyPlanEndIndex(lines, headerIndex);
  const modules = extractModuleBasicStudyPlanSegments(lines, headerIndex + 1, endIndex);
  if (modules.length < 2) return [];

  const rows = [];
  for (const module of modules) {
    const moduleRows = module.segments.map((segment) => buildModuleBasicStudyPlanRow(segment, module.title)).filter(Boolean);
    if (!isValidModuleBasicStudyPlanRows(moduleRows, module.total)) return [];
    rows.push(...moduleRows);
  }

  return rows.length >= 10 ? rows : [];
}

function findModuleBasicStudyPlanHeaderIndex(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!/^(?:[IVX]+\.\s*)?учебный\s+план$/iu.test(line)) continue;

    const window = lines
      .slice(index, index + 35)
      .map(cleanupLine)
      .join(" ");
    if (/(?:^|\s)[IVXІ]+(?:\s+|$)модуль/iu.test(window) && /кол-?во\s+часов/iu.test(window)) {
      return index;
    }
  }

  return -1;
}

function findModuleBasicStudyPlanEndIndex(lines, headerIndex) {
  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (index > headerIndex + 12 && /^XI\.\s+содержание\s+программы$/iu.test(line)) return index;
    if (index > headerIndex + 12 && /^содержание\s+программы$/iu.test(line)) return index;
    if (index > headerIndex + 100) return index;
  }
  return lines.length;
}

function extractModuleBasicStudyPlanSegments(lines, startIndex, endIndex) {
  const modules = [];
  let currentModule = null;
  let currentSegment = null;

  for (let index = startIndex; index < endIndex; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line || PAGE_NUMBER_RE.test(line) || isModuleBasicStudyPlanHeaderLine(line)) continue;

    const moduleTitle = parseModuleBasicStudyPlanModuleTitle(line);
    if (moduleTitle) {
      if (currentSegment && currentModule) currentModule.segments.push(currentSegment);
      if (currentModule) modules.push(currentModule);
      currentModule = { title: moduleTitle, total: null, segments: [] };
      currentSegment = null;
      continue;
    }

    if (!currentModule) continue;

    const total = parseModuleBasicStudyPlanTotalLine(line);
    if (total) {
      if (currentSegment) {
        currentModule.segments.push(currentSegment);
        currentSegment = null;
      }
      currentModule.total = total;
      continue;
    }

    const rowStart = parseModuleBasicStudyPlanRowStart(line);
    if (rowStart) {
      if (currentSegment) currentModule.segments.push(currentSegment);
      currentSegment = {
        number: rowStart.number,
        lines: [line],
      };
      continue;
    }

    if (currentSegment) currentSegment.lines.push(line);
  }

  if (currentSegment && currentModule) currentModule.segments.push(currentSegment);
  if (currentModule) modules.push(currentModule);

  return modules.filter((module) => module.segments.length);
}

function parseModuleBasicStudyPlanModuleTitle(line) {
  const cleaned = cleanupLine(line).replace(/^І/iu, "I");
  const match = cleaned.match(/^([IVX]+)\s+модуль$/iu);
  return match ? `${match[1].toUpperCase()} модуль` : "";
}

function isModuleBasicStudyPlanHeaderLine(line) {
  return /^(?:№|раздел|кол-?во\s+часов|формы|аттестации\/?|контроль|всего|теория|практика)$/iu.test(cleanupLine(line));
}

function parseModuleBasicStudyPlanRowStart(line) {
  const match = cleanupLine(line).match(/^(\d{1,2})[.)]\s+(.+)$/u);
  if (!match) return null;
  const number = Number(match[1]);
  if (!Number.isInteger(number) || number <= 0 || number > 30) return null;
  return {
    number,
    title: cleanupLine(match[2]),
  };
}

function parseModuleBasicStudyPlanTotalLine(line) {
  const match = cleanupLine(line).match(/^итого:?\s+(\d+(?:[,.]\d+)?)\s+(\d+(?:[,.]\d+)?)\s+(\d+(?:[,.]\d+)?)$/iu);
  if (!match) return null;
  const hoursTotal = parseHourCell(match[1]);
  const hoursTheory = parseHourCell(match[2]);
  const hoursPractice = parseHourCell(match[3]);
  if (!isPlausibleHours(hoursTheory, hoursPractice, hoursTotal)) return null;
  return {
    hoursTotal,
    hoursTheory,
    hoursPractice,
  };
}

function buildModuleBasicStudyPlanRow(segment, moduleTitle) {
  const row = parseBasicStudyPlanSegment(segment.lines, ["total", "theory", "practice"]);
  if (!row || row.isTotal) return null;

  const planNumber = cleanupLine(row.plan_number || String(segment.number));
  const allowGenericTopic = isModuleBasicStudyPlanServiceTopic(row.topic_name);
  return {
    ...row,
    plan_number: `${moduleTitle}.${planNumber}`,
    section_title: moduleTitle,
    source_section: "module-basic-study-plan",
    confidence: Math.max(row.confidence || 0, 0.86),
    raw_payload: {
      ...row.raw_payload,
      parser: "module-basic-study-plan",
      plan_number: `${moduleTitle}.${planNumber}`,
      module_title: moduleTitle,
      original_plan_number: planNumber,
      parsed_lines: segment.lines,
      ...(allowGenericTopic ? { allow_generic_topic: true } : {}),
    },
  };
}

function isModuleBasicStudyPlanServiceTopic(topicName) {
  return /^самостоятельная\s+работа\.?$/iu.test(cleanupLine(topicName));
}

function isValidModuleBasicStudyPlanRows(rows, total) {
  if (!Array.isArray(rows) || rows.length < 5) return false;
  if (!total) return false;

  const sums = {
    hoursTotal: roundHour(rows.reduce((sum, row) => sum + Number(row.hours_total || 0), 0)),
    hoursTheory: roundHour(rows.reduce((sum, row) => sum + Number(row.hours_theory || 0), 0)),
    hoursPractice: roundHour(rows.reduce((sum, row) => sum + Number(row.hours_practice || 0), 0)),
  };
  if (Math.abs(sums.hoursTotal - total.hoursTotal) > 0.01) return false;
  if (Math.abs(sums.hoursTheory - total.hoursTheory) > 0.01) return false;
  if (Math.abs(sums.hoursPractice - total.hoursPractice) > 0.01) return false;
  return rows.every((row) => row.hours_total != null && row.hours_total > 0);
}

function extractTouristCampOcrStudyPlanRows(lines) {
  const headerIndexes = findTouristCampOcrStudyPlanHeaderIndexes(lines);
  const rows = [];

  for (const headerIndex of headerIndexes) {
    const startIndex = findTouristCampOcrStudyPlanRowsStartIndex(lines, headerIndex);
    if (startIndex < 0) continue;
    const endIndex = findTouristCampOcrStudyPlanEndIndex(lines, startIndex);
    const candidateRows = extractTouristCampOcrStudyPlanRowsFromRange(lines, startIndex, endIndex);
    if (isTouristCampOcrStudyPlanCandidate(candidateRows)) {
      rows.push(...candidateRows);
    }
  }

  return rows;
}

function findTouristCampOcrStudyPlanHeaderIndexes(lines) {
  const indexes = [];
  for (let index = 0; index < lines.length; index += 1) {
    const window = lines
      .slice(index, index + 12)
      .map(cleanupLine)
      .join(" ");
    if (!/тема\s+р\S*делов/iu.test(window)) continue;
    if (!/количество\s+час/iu.test(window)) continue;
    if (!/всего\s+теори[яи]\s+практик[аи]?/iu.test(window)) continue;
    if (!/аттестаци[ия]\s+и\s+контрол/iu.test(window)) continue;
    if (indexes.length && index - indexes[indexes.length - 1] < 12) continue;
    indexes.push(index);
  }
  return indexes;
}

function findTouristCampOcrStudyPlanRowsStartIndex(lines, headerIndex) {
  for (let index = headerIndex; index < Math.min(lines.length, headerIndex + 12); index += 1) {
    const line = cleanupLine(lines[index]);
    if (/всего\s+теори[яи]\s+практик[аи]?/iu.test(line)) return index + 1;
  }
  return -1;
}

function findTouristCampOcrStudyPlanEndIndex(lines, startIndex) {
  for (let index = startIndex; index < Math.min(lines.length, startIndex + 120); index += 1) {
    const line = cleanupLine(lines[index]);
    if (/^(?:итого|всего)(?:\s|:|$)/iu.test(line)) return index + 1;
    if (index > startIndex + 18 && /^содержание\s+учебного\s+курса/iu.test(line)) return index;
  }
  return Math.min(lines.length, startIndex + 120);
}

function extractTouristCampOcrStudyPlanRowsFromRange(lines, startIndex, endIndex) {
  const rows = [];
  let expectedNumber = 1;
  let segment = null;
  let totalHours = null;

  for (let index = startIndex; index < endIndex; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line) continue;

    if (/^(?:итого|всего)(?:\s|:|$)/iu.test(line)) {
      if (segment) {
        const row = buildTouristCampOcrStudyPlanRow(segment);
        if (row) rows.push(row);
        segment = null;
      }
      totalHours = extractTouristCampOcrTotalHours(line);
      break;
    }

    const rowStart = parseTouristCampOcrStudyPlanRowStart(line, expectedNumber);
    if (rowStart) {
      if (segment) {
        const row = buildTouristCampOcrStudyPlanRow(segment);
        if (row) rows.push(row);
      }
      segment = {
        number: rowStart.number,
        lines: rowStart.title ? [rowStart.title] : [],
        rawLines: [line],
      };
      expectedNumber += 1;
      continue;
    }

    if (PAGE_NUMBER_RE.test(line)) continue;
    if (!segment) continue;
    segment.lines.push(line);
    segment.rawLines.push(line);
  }

  if (segment) {
    const row = buildTouristCampOcrStudyPlanRow(segment);
    if (row) rows.push(row);
  }

  return attachTouristCampOcrTotalValidation(rows, totalHours);
}

function parseTouristCampOcrStudyPlanRowStart(line, expectedNumber) {
  const cleaned = cleanupLine(line);
  const pipeFourMatch = cleaned.match(/^\|4(?:[.)])?(?:\s+(.+))?$/u);
  if (pipeFourMatch && expectedNumber === 14) {
    return {
      number: 14,
      title: cleanupLine(pipeFourMatch[1] || ""),
    };
  }

  const match = cleaned.match(/^(\d{1,2})(?:[.)])?(?:\s+(.+))?$/u);
  if (!match) return null;
  const number = Number(match[1]);
  if (number !== expectedNumber) return null;
  return {
    number,
    title: cleanupLine(match[2] || ""),
  };
}

function buildTouristCampOcrStudyPlanRow(segment) {
  const topicName = cleanupTouristCampOcrStudyPlanTopicName(segment.lines);
  if (!isValidTopic(topicName)) return null;

  const hours = extractTouristCampOcrStudyPlanHours(segment.lines, topicName);
  if (!hours || !isPlausibleHours(hours.hoursTheory, hours.hoursPractice, hours.hoursTotal)) return null;

  const controlForm = cleanupControlForm(
    segment.lines
      .map(cleanupLine)
      .filter(isTouristCampOcrControlLine)
      .join(" "),
  );

  return {
    plan_number: String(segment.number),
    section_title: "Учебно-тематический план",
    topic_name: topicName,
    hours_theory: hours.hoursTheory,
    hours_practice: hours.hoursPractice,
    hours_total: hours.hoursTotal,
    activity_type: inferLessonThematicPlanningActivityType({
      hoursTheory: hours.hoursTheory,
      hoursPractice: hours.hoursPractice,
    }),
    control_form: controlForm,
    source_section: "tourist-camp-ocr-study-plan",
    source_excerpt: segment.rawLines.join(" / ").slice(0, 1500),
    confidence: 0.82,
    raw_payload: {
      parser: "tourist-camp-ocr-study-plan",
      plan_number: String(segment.number),
      parsed_lines: segment.rawLines,
      parsed_hour_cells: hours.values,
    },
  };
}

function extractTouristCampOcrStudyPlanHours(lines, topicName) {
  const values = extractTouristCampOcrHourValues(lines.join(" "));
  if (values.length >= 3) {
    const [hoursTotal, hoursTheory, hoursPractice] = values.slice(-3);
    return {
      hoursTotal,
      hoursTheory,
      hoursPractice,
      values,
    };
  }

  if (values.length >= 2) {
    const [hoursTotal, second] = values.slice(-2);
    if (hoursTotal <= 0 || second < 0 || second > hoursTotal + 0.01) return null;

    if (Math.abs(hoursTotal - second) <= 0.01) {
      const theoryOnly = isTouristCampOcrTheoryOnlyTwoHourRow(topicName);
      return {
        hoursTotal,
        hoursTheory: theoryOnly ? second : 0,
        hoursPractice: theoryOnly ? 0 : second,
        values,
      };
    }

    const hoursPractice = second;
    return {
      hoursTotal,
      hoursTheory: roundHour(hoursTotal - hoursPractice),
      hoursPractice,
      values,
    };
  }

  return null;
}

function extractTouristCampOcrTotalHours(line) {
  const values = extractTouristCampOcrHourValues(line);
  if (values.length < 3) return null;
  const [hoursTotal, hoursTheory, hoursPractice] = values.slice(-3);
  return {
    hoursTotal,
    hoursTheory,
    hoursPractice,
  };
}

function extractTouristCampOcrHourValues(value) {
  const normalized = normalizeTouristCampOcrHourText(value);
  return [...normalized.matchAll(/(?:^|\s)(-|\d+(?:[,.]\d+)?)(?=\s|$)/gu)]
    .map((match) => parseHourCell(match[1]))
    .filter((cell) => cell != null);
}

function normalizeTouristCampOcrHourText(value) {
  return cleanupLine(value)
    .replace(/(\d)\s+\)\s*5(?=\s|$)/gu, "$1,5")
    .replace(/(^|\s)\)\s*5(?=\s|$)/gu, "$12,5")
    .replace(/[Jj]/g, "3")
    .replace(/[Зз]/g, "3")
    .replace(/[lIІі]/g, "1");
}

function cleanupTouristCampOcrStudyPlanTopicName(lines) {
  const title = lines
    .map(cleanupLine)
    .filter((line) => line && !isTouristCampOcrControlLine(line))
    .map(stripTouristCampOcrHourTail)
    .filter((line) => line && !/^[\d\s,.;:)-]+$/u.test(line))
    .join(" ");

  return cleanupBasicStudyPlanTopicName(title)
    .replace(/заЕятие/giu, "занятие")
    .replace(/цруппы/giu, "группы")
    .replace(/доврачебнм/giu, "доврачебная")
    .replace(/медицинскzrя/giu, "медицинская")
    .replace(/<<?\s*Азбука\s+туристa?\)?\)?\s+юного/iu, "Азбука юного туриста")
    .replace(/Школа\s+выживания[).]*/iu, "Школа выживания")
    .replace(/Ориентирование\s+местности\s+на/iu, "Ориентирование на местности")
    .replace(/Подведение\s+похода\s+итогов/iu, "Подведение итогов похода")
    .replace(/\. комплектование/iu, ". Комплектование")
    .replace(/\. обеспечение/iu, ". Обеспечение")
    .replace(/^итоги/iu, "Итоги")
    .replace(/\s+([,.;:])/gu, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTouristCampOcrHourTail(line) {
  const cleaned = cleanupLine(line);
  const matches = [...cleaned.matchAll(/(?:^|\s)(-|[Jj]|[lIІі]|[Зз](?:[,.]\d+)?|\)?\s*5|\d+(?:[,.]\d+)?)(?=\s|$)/gu)].map(
    (match) => ({
      index: match.index + (match[0].match(/^\s*/u)?.[0]?.length || 0),
      value: match[1],
    }),
  );
  if (!matches.length) return cleaned;
  if (!/[А-ЯЁа-яё]/u.test(cleaned.replace(/[JjЗзlIІі]/g, ""))) return "";
  if (matches.length < 2) return cleaned;

  const tailStart = matches[Math.max(0, matches.length - 3)].index;
  return cleaned.slice(0, tailStart).trim();
}

function isTouristCampOcrControlLine(line) {
  return /^(?:беседа,?|опрос|наблюдение,?|наблтодение,?|выполнение)$/iu.test(cleanupLine(line));
}

function isTouristCampOcrTheoryOnlyTwoHourRow(topicName) {
  return /^(?:вводное|инструктаж|техника\s+безопасности)/iu.test(cleanupLine(topicName));
}

function attachTouristCampOcrTotalValidation(rows, totalHours) {
  if (!rows.length) return rows;
  const sums = {
    hoursTotal: roundHour(rows.reduce((sum, row) => sum + Number(row.hours_total || 0), 0)),
    hoursTheory: roundHour(rows.reduce((sum, row) => sum + Number(row.hours_theory || 0), 0)),
    hoursPractice: roundHour(rows.reduce((sum, row) => sum + Number(row.hours_practice || 0), 0)),
  };
  const totalsMatch = totalHours
    ? Math.abs(sums.hoursTotal - totalHours.hoursTotal) <= 0.01 &&
      Math.abs(sums.hoursTheory - totalHours.hoursTheory) <= 0.01 &&
      Math.abs(sums.hoursPractice - totalHours.hoursPractice) <= 0.01
    : null;

  return rows.map((row) => ({
    ...row,
    raw_payload: {
      ...row.raw_payload,
      plan_total: totalHours,
      parsed_total: sums,
      ...(totalHours ? { plan_total_matches_rows: totalsMatch } : {}),
    },
    confidence: totalsMatch === false ? Math.min(row.confidence, 0.68) : row.confidence,
  }));
}

function isTouristCampOcrStudyPlanCandidate(rows) {
  if (!Array.isArray(rows) || rows.length < 10) return false;
  const planNumbers = rows.map((row) => Number(row.plan_number || row.raw_payload?.plan_number));
  if (!planNumbers.every((number, index) => number === index + 1)) return false;

  const total = roundHour(rows.reduce((sum, row) => sum + Number(row.hours_total || 0), 0));
  const theory = roundHour(rows.reduce((sum, row) => sum + Number(row.hours_theory || 0), 0));
  const practice = roundHour(rows.reduce((sum, row) => sum + Number(row.hours_practice || 0), 0));
  if (!isPlausibleHours(theory, practice, total)) return false;

  const totalMatches = rows[0]?.raw_payload?.plan_total_matches_rows;
  return totalMatches !== false;
}

function findGenericNumberedStudyPlanHeaderIndexes(lines) {
  const indexes = [];
  for (let index = 0; index < lines.length; index += 1) {
    const windowLines = lines.slice(index, index + 14).map(cleanupLine);
    const window = windowLines.join(" ");
    if (!/(?:№|п\/?п|тема\s+р.вделов)/iu.test(window)) continue;
    if (!/(?:наименование|название|тема).{0,60}(?:раздел|тем)|тема\s+р.вделов|№\s+тема/iu.test(window)) continue;
    if (!/(?:всего|комбинированн)/iu.test(window) || !/теори[яи]/iu.test(window) || !hasPracticeHeader(window)) continue;

    const hasRows = lines
      .slice(index + 1, index + 45)
      .map(cleanupLine)
      .some((line) => /^(\d{1,3})(?:[.)])?(?:\s+|$)/u.test(line));
    if (hasRows) indexes.push(index);
  }

  return indexes;
}

function findGenericNumberedStudyPlanEndIndex(lines, startIndex, headerIndexes) {
  const nextHeader = headerIndexes.find((index) => index > startIndex);
  const hardEnd = nextHeader || lines.length;
  for (let index = startIndex + 1; index < hardEnd; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line) continue;
    if (/^(?:итого|всего|всего\s+за\s+год)\b/iu.test(line)) continue;
    if (index > startIndex + 20 && isBasicStudyPlanStopLine(line)) return index;
  }
  return hardEnd;
}

function extractGenericNumberedStudyPlanRowsFromRange(lines, startIndex, endIndex) {
  const rows = [];
  let currentSection = "Учебный план";
  const hourOrder = detectGenericNumberedStudyPlanHourOrder(lines, startIndex);

  for (let index = startIndex + 1; index < endIndex; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line || PAGE_NUMBER_RE.test(line) || isGenericNumberedStudyPlanHeaderLine(line)) continue;
    if (/^(?:итого|всего|всего\s+за\s+год)\b/iu.test(line)) continue;

    const start = parseGenericNumberedStudyPlanStart(line);
    if (!start) continue;

    const segment = [line];
    let nextIndex = index + 1;
    let foundHours = /\s(?:-|\d+(?:[,.]\d+)?)(?:\s+(?:-|\d+(?:[,.]\d+)?)){1,3}(?:\s|$)/u.test(line);

    while (nextIndex < endIndex) {
      const nextLine = cleanupLine(lines[nextIndex]);
      if (!nextLine || PAGE_NUMBER_RE.test(nextLine) || isGenericNumberedStudyPlanHeaderLine(nextLine)) {
        nextIndex += 1;
        continue;
      }
      if (/^(?:итого|всего|всего\s+за\s+год)\b/iu.test(nextLine)) {
        nextIndex += 1;
        break;
      }
      if (foundHours && parseGenericNumberedStudyPlanStart(nextLine)) break;

      segment.push(nextLine);
      if (/\s?(?:-|\d+(?:[,.]\d+)?)(?:\s+(?:-|\d+(?:[,.]\d+)?)){1,3}(?:\s|$)/u.test(nextLine)) {
        foundHours = true;
      }
      if (foundHours && segment.length >= 2 && isLikelyControlFormOrActivityTail(nextLine)) {
        nextIndex += 1;
        break;
      }
      if (segment.length > 9) break;
      nextIndex += 1;
    }

    const row = parseBasicStudyPlanSegment(segment, hourOrder);
    if (row?.isTotal) {
      index = Math.max(index, nextIndex - 1);
      continue;
    }
    if (row) {
      if (row.isSection) currentSection = row.topic_name;
      rows.push({
        ...row,
        section_title: currentSection,
        source_section: "generic-numbered-study-plan",
        confidence: Math.max(row.confidence || 0, 0.78),
        raw_payload: {
          ...row.raw_payload,
          parser: "generic-numbered-study-plan",
        },
      });
    }

    index = Math.max(index, nextIndex - 1);
  }

  return rows;
}

function parseGenericNumberedStudyPlanStart(line) {
  const cleaned = cleanupLine(line);
  const match = cleaned.match(/^(\d{1,3})(?:[.)])?(?:\s+(.+))?$/u);
  if (!match) return null;
  const number = Number(match[1]);
  if (!Number.isInteger(number) || number <= 0 || number > 300) return null;
  if (!match[2] && number > 80) return null;
  return {
    number,
    title: cleanupLine(match[2] || ""),
  };
}

function isGenericNumberedStudyPlanHeaderLine(line) {
  const cleaned = cleanupLine(line);
  return /^(?:№|п\/?п|тема|темы|наименование\s+раздела,?|наименование\s+разделов\s+и\s+тем|название|количество\s+часов|форма|формы|аттестации|контроля|всего|теория|прак(?:тика|-)?|тика|ка)$/iu.test(
    cleaned,
  );
}

function isLikelyControlFormOrActivityTail(line) {
  return /(беседа|опрос|тест|диалог|наблюдение|задани|презентац|проект|грамот|диплом|контроль|зач[её]т)/iu.test(cleanupLine(line));
}

function detectGenericNumberedStudyPlanHourOrder(lines, startIndex) {
  const window = lines
    .slice(startIndex, startIndex + 14)
    .map(cleanupLine)
    .join(" ");
  if (/комбинированн/iu.test(window) && !/всего/iu.test(window)) {
    return ["theory", "practice", "combined"];
  }
  return detectBasicStudyPlanHourOrder(lines, startIndex);
}

function findBasicStudyPlanHeaderIndex(lines) {
  const indexes = findBasicStudyPlanHeaderIndexes(lines);
  return indexes[0] ?? -1;
}

function findBasicStudyPlanHeaderIndexes(lines) {
  const indexes = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (
      !/учебн[оы]\s*[- ]?\s*тематическ(?:ий|ого)?\s+план|учебн(?:ый|ого)\s+план/iu.test(line) &&
      !isStudyCourseContentPlanHeader(lines, index)
    ) {
      continue;
    }

    const window = lines
      .slice(index, index + 16)
      .map(cleanupLine)
      .join(" ");
    if (isMultiYearSummaryStudyPlanHeader(window)) continue;
    if (hasTotalHoursHeader(window) && hasTheoryHeader(window) && hasPracticeHeader(window)) {
      indexes.push(index);
    }
  }

  return indexes;
}

function isStudyCourseContentPlanHeader(lines, index) {
  const line = cleanupLine(lines[index]);
  if (!/^содержание\s+изучаемого\s+курса\s+\d+[- ]?(?:го|ого)?\s+года\s+обучения/iu.test(line)) return false;
  const window = lines
    .slice(index, index + 14)
    .map(cleanupLine)
    .join(" ");
  return /п\/п/iu.test(window) && /наименование\s+тем\s+и\s+разделов/iu.test(window);
}

function detectStudyCourseContentYearSection(line) {
  const match = cleanupLine(line).match(/^содержание\s+изучаемого\s+курса\s+(\d+)[- ]?(?:го|ого)?\s+года\s+обучения/iu);
  return match ? `Учебный план ${match[1]}-го года обучения` : "";
}

function isMultiYearSummaryStudyPlanHeader(value) {
  const text = cleanupLine(value);
  return /перв(?:ый|ого)\s+год\s+обучени[яе].{0,80}втор(?:ой|ого)\s+год\s+обучени[яе]/iu.test(text);
}

function parseBasicStudyPlanSegment(segment, hourOrder = ["total", "theory", "practice"], options = {}) {
  const lines = normalizeBasicStudyPlanSegmentLines(segment).map(cleanupLine).filter(Boolean);
  const originalText = repairOcrGluedHourInStudyPlanText(lines.join(" ").replace(/\s+/g, " ").trim());
  const text = stripTrailingStudyPlanTotalSummary(originalText);
  if (!text) return null;
  if (/^(?:итого|всего|всего\s+за\s+год|всего\s+за\s+\d+)/iu.test(text)) {
    return { isTotal: true };
  }

  const parsed = parseBasicStudyPlanHoursTail(text, hourOrder, options);
  if (!parsed) return null;

  const rawTitle = isolateBasicStudyPlanTitle(cleanupLine(parsed.title));
  if (isBasicStudyPlanNoiseTitle(rawTitle)) return null;

  const topicName = cleanupBasicStudyPlanTopicName(rawTitle);
  if (
    !isValidTopic(topicName) &&
    !isLongBasicStudyPlanTopicName(topicName) &&
    !isBasicStudyPlanLiteratureActivityTopic(topicName, rawTitle)
  ) {
    return null;
  }
  if (isTotalTopicName(topicName) || /(?:^|\s)(?:итого|всего)$/iu.test(topicName)) {
    return { isTotal: true };
  }

  const { hoursTotal, hoursTheory, hoursPractice, combinedHours } = parsed;
  if (hoursTotal == null || hoursTotal <= 0) return null;
  if (!isPlausibleHours(hoursTheory, hoursPractice, hoursTotal)) return null;
  if (!parsed.hoursInconsistent && hoursTheory + hoursPractice > hoursTotal + 0.01) return null;

  const controlForm = cleanupControlForm(parsed.controlForm || "");
  const sourceExcerpt = [
    text,
    parsed.hoursInconsistent ? `hours_inconsistent: ${parsed.hoursInconsistent.repair}` : "",
  ].filter(Boolean).join(" / ").slice(0, 1500);
  return {
    isSection: isBasicStudyPlanSectionTitle(rawTitle),
    plan_number: extractBasicStudyPlanNumber(rawTitle),
    section_title: "",
    topic_name: topicName,
    hours_theory: hoursTheory,
    hours_practice: hoursPractice,
    hours_total: hoursTotal,
    activity_type: inferLessonThematicPlanningActivityType({
      hoursTheory,
      hoursPractice,
    }),
    control_form: controlForm,
    source_section: "basic-study-plan",
    source_excerpt: sourceExcerpt,
    confidence: 0.82,
    raw_payload: {
      parser: "basic-study-plan",
      plan_number: extractBasicStudyPlanNumber(rawTitle),
      parsed_lines: lines,
      control_form: controlForm,
      combined_hours: combinedHours,
      ...(parsed.hoursInconsistent ? { hours_inconsistent: parsed.hoursInconsistent } : {}),
      ...(parsed.singleHourParentTopic ? { single_hour_parent_topic: true } : {}),
      ...(text !== originalText ? { original_text: originalText } : {}),
    },
  };
}

function parseBasicStudyPlanHoursTail(text, hourOrder, options = {}) {
  const numberPattern = "(-|\\d+(?:[,.]\\d+)?)";
  const fourNumberMatch = text.match(
    new RegExp(`^(.+)\\s+${numberPattern}\\s+${numberPattern}\\s+${numberPattern}\\s+${numberPattern}(?:\\s+(.+))?$`, "u"),
  );
  if (fourNumberMatch) {
    const values = [fourNumberMatch[2], fourNumberMatch[3], fourNumberMatch[4], fourNumberMatch[5]].map(parseHourCell);
    const mapped = mapBasicStudyPlanHours(values, ["total", "theory", "practice", "combined"]);
    return {
      title: fourNumberMatch[1],
      hoursTotal: mapped.total,
      hoursTheory: mapped.theory,
      hoursPractice: roundHour((mapped.practice || 0) + (mapped.combined || 0)),
      combinedHours: mapped.combined || 0,
      controlForm: fourNumberMatch[6] || "",
    };
  }

  const threeNumberMatch = text.match(
    new RegExp(`^(.+)\\s+${numberPattern}\\s+${numberPattern}\\s+${numberPattern}(?:\\s+(.+))?$`, "u"),
  );
  if (threeNumberMatch) {
    const values = [threeNumberMatch[2], threeNumberMatch[3], threeNumberMatch[4]].map(parseHourCell);
    const mapped = mapBasicStudyPlanHours(values, hourOrder);
    if (mapped.total == null && mapped.combined != null) {
      const hoursTheory = mapped.theory || 0;
      const hoursPractice = roundHour((mapped.practice || 0) + (mapped.combined || 0));
      return {
        title: threeNumberMatch[1],
        hoursTotal: roundHour(hoursTheory + hoursPractice),
        hoursTheory,
        hoursPractice,
        combinedHours: mapped.combined || 0,
        controlForm: threeNumberMatch[5] || "",
      };
    }
    let hoursTotal = mapped.total;
    let hoursTheory = mapped.theory || 0;
    let hoursPractice = mapped.practice || 0;
    let hoursInconsistent = null;
    if (
      hourOrder[0] === "total" &&
      values[0] === 0 &&
      values[1] === 0 &&
      values[2] > 0
    ) {
      hoursTotal = values[2];
      hoursTheory = 0;
      hoursPractice = values[2];
    }
    if (hoursTotal != null && hoursTheory + hoursPractice > hoursTotal + 0.01 && hoursTheory <= hoursTotal) {
      hoursInconsistent = {
        raw_total: mapped.total,
        raw_theory: hoursTheory,
        raw_practice: hoursPractice,
        repair: Math.abs(hoursPractice - hoursTotal) <= 0.01
          ? "theory adjusted to zero because practice equals total"
          : "practice adjusted to total minus theory",
      };
      if (Math.abs(hoursPractice - hoursTotal) <= 0.01) {
        hoursTheory = 0;
      } else {
        hoursPractice = roundHour(Math.max(0, hoursTotal - hoursTheory));
      }
    }

    return {
      title: threeNumberMatch[1],
      hoursTotal,
      hoursTheory,
      hoursPractice,
      combinedHours: 0,
      controlForm: threeNumberMatch[5] || "",
      hoursInconsistent,
    };
  }

  const twoNumberMatch = text.match(new RegExp(`^(.+)\\s+${numberPattern}\\s+${numberPattern}(?:\\s+(.+))?$`, "u"));
  if (!twoNumberMatch) {
    const singleNumberMatch = text.match(new RegExp(`^(.+)\\s+${numberPattern}(?:\\s+(.+))$`, "u"));
    if (!singleNumberMatch) return null;

    const hoursTotal = parseHourCell(singleNumberMatch[2]);
    if (hoursTotal == null || hoursTotal <= 0) return null;
    if (!isStandaloneSingleHourStudyPlanTopic(singleNumberMatch[1], singleNumberMatch[3])) return null;

    return {
      title: singleNumberMatch[1],
      hoursTotal,
      hoursTheory: 0,
      hoursPractice: 0,
      combinedHours: 0,
      controlForm: singleNumberMatch[3] || "",
      singleHourParentTopic: true,
    };
  }

  const first = parseHourCell(twoNumberMatch[2]);
  const second = parseHourCell(twoNumberMatch[3]);
  if (first == null || second == null) return null;

  if (isLikelyTotalPracticePair(twoNumberMatch[1], first, second, twoNumberMatch[4], hourOrder)) {
    if (options.preserveAmbiguousTwoNumberHourPairs) {
      return {
        title: twoNumberMatch[1],
        hoursTotal: first,
        hoursTheory: null,
        hoursPractice: null,
        combinedHours: 0,
        controlForm: twoNumberMatch[4] || "",
        hoursInconsistent: {
          raw_total: first,
          raw_second_hour: second,
          repair: "ambiguous two-number hour cells; theory/practice split left unknown",
        },
      };
    }

    return {
      title: twoNumberMatch[1],
      hoursTotal: first,
      hoursTheory: 0,
      hoursPractice: second,
      combinedHours: 0,
      controlForm: twoNumberMatch[4] || "",
    };
  }

  if (
    hourOrder[0] === "theory" &&
    hourOrder[2] === "total" &&
    isLikelyPracticalOnlyTwoCellStudyPlanRow(twoNumberMatch[1], first, second, twoNumberMatch[4])
  ) {
    return {
      title: twoNumberMatch[1],
      hoursTotal: second,
      hoursTheory: 0,
      hoursPractice: first,
      combinedHours: 0,
      controlForm: twoNumberMatch[4] || "",
    };
  }

  if (hourOrder[0] === "theory") {
    return {
      title: twoNumberMatch[1],
      hoursTotal: roundHour(first + second),
      hoursTheory: first,
      hoursPractice: second,
      combinedHours: 0,
      controlForm: twoNumberMatch[4] || "",
    };
  }

  return {
    title: twoNumberMatch[1],
    hoursTotal: first,
    hoursTheory: second,
    hoursPractice: Math.max(0, roundHour(first - second)),
    combinedHours: 0,
    controlForm: twoNumberMatch[4] || "",
  };
}

function repairOcrGluedHourInStudyPlanText(value) {
  return cleanupLine(value).replace(/([А-ЯЁа-яё])(\d+(?:[,.]\d+)?)(?=\s+(?:-|\d+(?:[,.]\d+)?))/gu, "$1 $2");
}

function isStandaloneSingleHourStudyPlanTopic(title, controlForm) {
  const topicName = cleanupBasicStudyPlanTopicName(title);
  if (!/^(?:вводное|итоговое|заключительное)\s+занятие|^подведение\s+итогов/iu.test(topicName)) {
    return false;
  }
  return Boolean(cleanupControlForm(controlForm || ""));
}

function isLikelyTotalPracticePair(title, first, second, controlForm, hourOrder) {
  if (hourOrder[0] !== "total") return false;
  if (first <= 0 || second <= 0 || Math.abs(first - second) > 0.01) return false;

  const activityText = cleanupLine(`${title || ""} ${controlForm || ""}`);
  return /(игра|соревн|отч[её]т|выполнен|норматив|практи|зач[её]т|творческ|поход|однодневн|двухдневн|тр[её]хдневн)/iu.test(
    activityText,
  );
}

function isLikelyPracticalOnlyTwoCellStudyPlanRow(title, first, second, controlForm) {
  if (first <= 0 || second <= 0 || Math.abs(first - second) > 0.01) return false;

  const activityText = cleanupLine(`${title || ""} ${controlForm || ""}`);
  return /(?:итогов|заключительн|контрольн|практическ|викторин|соревн|зач[её]т|игра|экскурс|поход)/iu.test(
    activityText,
  );
}

function mapBasicStudyPlanHours(values, hourOrder) {
  const mapped = {
    total: null,
    theory: 0,
    practice: 0,
    combined: 0,
  };
  for (let index = 0; index < Math.min(values.length, hourOrder.length); index += 1) {
    const key = hourOrder[index];
    mapped[key] = values[index] == null ? 0 : values[index];
  }
  if (mapped.total == null) {
    mapped.total = roundHour((mapped.theory || 0) + (mapped.practice || 0) + (mapped.combined || 0));
  }
  return mapped;
}

function cleanupBasicStudyPlanTopicName(value) {
  return cleanupTopicName(value)
    .replace(/^\.+(?=\d)/u, "")
    .replace(/^\d+(?:\.\d+)*(?:[.)]\s*|\s+)/u, "")
    .replace(/^[.\s]+/u, "")
    .replace(/\b(общеразвивающую\s+программу)\s+е$/iu, "$1")
    .replace(/туСриз\s*ма/giu, "туризма")
    .replace(
      /^(?:беседа|опрос|практические\s+занятия[^,\n]*(?:,\s*викторины)?|тематические\s+игры,\s*беседа,\s*практическое\s+задание|беседа,\s*практическое\s+задание|опрос,\s*практическое\s+задание)\s+/iu,
      "",
    )
    .replace(/([А-Яа-яЁё])\s+-\s*([А-Яа-яЁё])/gu, "$1-$2")
    .replace(/([А-Яа-яЁё])-\s+([А-Яа-яЁё])/gu, "$1-$2")
    .replace(/\s+/g, " ")
    .trim();
}

function isolateBasicStudyPlanTitle(value) {
  const cleaned = cleanupLine(value);
  const matches = [...cleaned.matchAll(/(?:^|\s)(\d+(?:\.\d+)*[.)]?\s+[А-ЯЁA-Z])/gu)];
  if (!matches.length) return cleaned;

  const lastMatch = matches[matches.length - 1];
  if (matches.length === 1 && lastMatch.index === 0) return cleaned;
  return cleaned.slice(lastMatch.index).trim();
}

function isBasicStudyPlanSectionTitle(value) {
  const cleaned = cleanupLine(value);
  if (/^\d+\s+(?:наблюдени[ея]|опрос|зач[её]т|тестирование|соревновани[ея])(?=\s|\.|$)/iu.test(cleaned)) return false;
  return (
    /^(?:\d+\.\s*)?раздел\s+\d+/iu.test(cleaned) ||
    /^\d+\.?\s+[А-ЯЁA-Z].{0,160}$/u.test(cleaned)
  );
}

function isSpuriousBasicStudyPlanSectionRow(row) {
  const firstParsedLine = cleanupLine(row?.raw_payload?.parsed_lines?.[0] || row?.source_excerpt || "");
  return /^\d+\s+(?:наблюдени[ея]|опрос|зач[её]т|тестирование|соревновани[ея])(?=\s|\.|$)/iu.test(firstParsedLine);
}

function extractBasicStudyPlanNumber(value) {
  const cleaned = cleanupLine(value).replace(/^\.+(?=\d)/u, "");
  const sectionMatch = cleaned.match(/^(?:раздел\s+)?(\d+(?:\.\d+)*)(?:[.)]|\s)/iu);
  if (sectionMatch) return sectionMatch[1];
  const prefixedSectionMatch = cleaned.match(/^\d+\.\s*раздел\s+(\d+)/iu);
  return prefixedSectionMatch ? prefixedSectionMatch[1] : "";
}

function removeBasicStudyPlanParentRows(rows) {
  const parentNumbers = new Set();
  const parentRows = new Map();
  for (const row of rows) {
    const number = row.plan_number || (row.raw_payload && row.raw_payload.plan_number) || "";
    const match = number.match(/^(\d+)\.\d+/u);
    if (match) parentNumbers.add(match[1]);
    if (number && !/\./u.test(number)) parentRows.set(number, row);
  }

  return rows.map((row) => enrichStudyPlanChildWithStandaloneParent(row, parentRows)).filter((row) => {
    const number = row.plan_number || (row.raw_payload && row.raw_payload.plan_number) || "";
    if (!number || /\./u.test(number)) return true;
    if (isStandaloneEventStudyPlanTopic(row)) return true;
    return !parentNumbers.has(number);
  });
}

function removeBasicStudyPlanAggregateSectionRows(rows) {
  return rows.filter((row, index) => {
    if (!row?.isSection) return true;
    if (!isExplicitBasicStudyPlanSectionRow(row)) return true;

    const children = [];
    for (let childIndex = index + 1; childIndex < rows.length; childIndex += 1) {
      const child = rows[childIndex];
      if (child?.isSection && isExplicitBasicStudyPlanSectionRow(child)) break;
      children.push(child);
    }
    if (!children.length) return true;

    const rowTotal = normalizeNullableHour(row.hours_total);
    if (rowTotal == null) return true;

    const childrenTotal = roundHour(children.reduce((sum, child) => sum + Number(child.hours_total || 0), 0));
    if (Math.abs(childrenTotal - rowTotal) > 0.01) return true;

    const rowTheory = normalizeNullableHour(row.hours_theory);
    const rowPractice = normalizeNullableHour(row.hours_practice);
    if (rowTheory == null || rowPractice == null) return false;

    const childrenTheory = roundHour(children.reduce((sum, child) => sum + Number(child.hours_theory || 0), 0));
    const childrenPractice = roundHour(children.reduce((sum, child) => sum + Number(child.hours_practice || 0), 0));
    return Math.abs(childrenTheory - rowTheory) > 0.01 || Math.abs(childrenPractice - rowPractice) > 0.01;
  });
}

function isExplicitBasicStudyPlanSectionRow(row) {
  const parsedLines = Array.isArray(row?.raw_payload?.parsed_lines) ? row.raw_payload.parsed_lines : [];
  const firstParsedLine = cleanupLine(parsedLines[0] || row?.source_excerpt || "");
  return /^(?:\d+\.\s*)?раздел\s+\d{1,2}(?:[.)]|\s|$)/iu.test(firstParsedLine);
}

function isStandaloneEventStudyPlanTopic(row) {
  const topicName = cleanupLine(row.topic_name || "");
  if (!/(?:^|\s)(?:одно|двух|много)?дневн(?:ый|ого|ые)\s+поход|поход\s+с\s+ночевк/iu.test(topicName)) {
    return false;
  }

  const hoursTotal = normalizeNullableHour(row.hours_total);
  return hoursTotal != null && hoursTotal >= 4;
}

function enrichStudyPlanChildWithStandaloneParent(row, parentRows) {
  const number = row.plan_number || (row.raw_payload && row.raw_payload.plan_number) || "";
  const match = number.match(/^(\d+)\.\d+/u);
  if (!match) return row;

  const parentRow = parentRows.get(match[1]);
  if (!parentRow || !isStandaloneSingleHourParentRow(parentRow)) return row;

  const parentName = cleanupLine(parentRow.topic_name || "");
  const topicName = cleanupLine(row.topic_name || "");
  if (!parentName || !topicName || topicName.toLocaleLowerCase("ru").startsWith(parentName.toLocaleLowerCase("ru"))) {
    return row;
  }

  return {
    ...row,
    topic_name: `${parentName}. ${topicName}`,
    section_title: parentName,
    source_excerpt: row.source_excerpt,
    raw_payload: {
      ...row.raw_payload,
      parent_topic_name: parentName,
    },
  };
}

function isStandaloneSingleHourParentRow(row) {
  if (!row.raw_payload?.single_hour_parent_topic) return false;
  const topicName = cleanupLine(row.topic_name || "");
  return /^(?:вводное|итоговое|заключительное)\s+занятие|^подведение\s+итогов/iu.test(topicName);
}

function isBasicStudyPlanNoiseTitle(value) {
  return /^(?:№|п\/п|наименование|название|тема|количество|форма|контроля|всего|теория|прак(?:тика|-)?|тика)$/iu.test(
    cleanupLine(value),
  );
}

function isBasicStudyPlanLiteratureActivityTopic(topicName, source) {
  const cleaned = cleanupLine(topicName);
  if (!cleaned || cleaned.length > 180) return false;
  if (!getBasicStudyPlanLiteratureActivityPlanNumber(source)) return false;
  return /работ[аы]\s+с\s+литератур/iu.test(cleaned) && /[А-ЯЁа-яё]/u.test(cleaned);
}

function getBasicStudyPlanLiteratureActivityPlanNumber(source) {
  if (source && typeof source === "object") {
    return cleanupLine(source.plan_number || source.raw_payload?.plan_number || "");
  }
  return extractBasicStudyPlanNumber(source);
}

function isBasicStudyPlanHeaderLine(line) {
  const cleaned = cleanupLine(line);
  return (
    /^(?:№|п\/п|тема|раздел|заняти[ея]|количество\s+часов|всего|все|теор|ия|рия|теория|прак(?:тика|-)?|практ\.?|пра|тика|форма\s+контроля)$/iu.test(cleaned) ||
    /^теория\s+практика$/iu.test(cleaned) ||
    /^\(?\d+(?:[,.]\d+)?\s+час(?:а|ов)?(?:[,)]|\s|$)/iu.test(cleaned) ||
    /наименование\s+(?:разделов|раздела|тем|темы)/iu.test(cleaned) ||
    /кол-?во\s+часов/iu.test(cleaned) ||
    (/всего/iu.test(cleaned) && hasTheoryHeader(cleaned) && hasPracticeHeader(cleaned))
  );
}

function isBasicStudyPlanRowStartLine(line) {
  const cleaned = cleanupLine(line);
  if (isBasicStudyPlanDateContinuationLine(cleaned)) return false;
  return /^\d+(?:\.\d+)*\.?\s+[^\d\s-]/u.test(cleaned);
}

function isBasicStudyPlanDateContinuationLine(line) {
  const cleaned = cleanupLine(line);
  if (/^\d{4}\s+(?:год|года|годов|гг?\.?|[а-яё])/iu.test(cleaned)) return true;
  return BASIC_STUDY_PLAN_DATE_MONTH_RE.test(cleaned);
}

function detectBasicStudyPlanHourOrder(lines, startIndex) {
  const window = lines
    .slice(startIndex, startIndex + 16)
    .map(cleanupLine)
    .join(" ")
    .toLowerCase();
  let theoryIndex = window.search(/теори[яи]/u);
  let practiceIndex = findPracticeHeaderIndex(window);
  const totalIndex = findTotalHoursHeaderIndex(window);
  if (/комбинир/iu.test(window)) {
    return ["total", "theory", "practice", "combined"];
  }
  if (
    totalIndex >= 0 &&
    theoryIndex >= 0 &&
    theoryIndex < totalIndex &&
    hasNonHourTheoryHeaderBeforeTotal(window, theoryIndex, totalIndex)
  ) {
    const laterTheoryIndex = window.slice(totalIndex).search(/теори[яи]/u);
    if (laterTheoryIndex >= 0) theoryIndex = totalIndex + laterTheoryIndex;
  }
  if (
    totalIndex >= 0 &&
    practiceIndex >= 0 &&
    practiceIndex < totalIndex &&
    hasNonHourPracticeHeaderBeforeTotal(window, practiceIndex, totalIndex)
  ) {
    const laterPracticeIndex = findPracticeHeaderIndex(window.slice(totalIndex));
    if (laterPracticeIndex >= 0) practiceIndex = totalIndex + laterPracticeIndex;
  }
  if (theoryIndex >= 0 && practiceIndex >= 0 && totalIndex >= 0) {
    return [
      { key: "total", index: totalIndex },
      { key: "theory", index: theoryIndex },
      { key: "practice", index: practiceIndex },
    ]
      .sort((left, right) => left.index - right.index)
      .map((item) => item.key);
  }
  return ["total", "theory", "practice"];
}

function hasNonHourTheoryHeaderBeforeTotal(window, theoryIndex, totalIndex) {
  const beforeTotal = window.slice(Math.max(0, theoryIndex - 20), totalIndex);
  return /теоретическ[а-яё]*\s+(?:занят|работ)/iu.test(beforeTotal);
}

function hasNonHourPracticeHeaderBeforeTotal(window, practiceIndex, totalIndex) {
  const beforeTotal = window.slice(Math.max(0, practiceIndex - 20), totalIndex);
  return /практическ[а-яё]*\s+работ/iu.test(beforeTotal);
}

function hasPracticeHeader(value) {
  return findPracticeHeaderIndex(value) >= 0;
}

function hasTheoryHeader(value) {
  return String(value || "").toLowerCase().search(/теори[яи]|теор\s*ия|теор(?:\s|$)|(?:^|\s)тео(?:\s|$)/u) >= 0;
}

function hasTotalHoursHeader(value) {
  return findTotalHoursHeaderIndex(value) >= 0;
}

function findTotalHoursHeaderIndex(value) {
  return String(value || "").toLowerCase().search(/всего|(?:^|\s)все(?:\s|$)/u);
}

function findPracticeHeaderIndex(value) {
  return String(value || "").toLowerCase().search(/прак\s*-?\s*тика|пра\s*ктика|практ|пра\b/u);
}

function isBasicStudyPlanStopLine(line) {
  return /^(?:планирование\s+курса|содержание\s+(?:учебного\s+плана|программы|изучаемого\s+курса)|календарн[оы]\s*[- ]?\s*(?:тематическ|учебн)|методическ|материально|список\s+литературы|приложение)/iu.test(
    cleanupLine(line),
  );
}

function extractProgramSubjectVolumeRows(lines) {
  const rows = [];
  const seen = new Set();

  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line || !hasProgramSubjectVolumeContext(lines, index)) continue;

    const parsed = parseProgramSubjectVolumeLine(line);
    if (!parsed) continue;

    for (const year of parsed.years) {
      const key = `${normalizeTopicComparisonKey(parsed.title)}|${year.year}|${year.hoursTotal}`;
      if (seen.has(key)) continue;
      seen.add(key);

      rows.push({
        plan_number: `${rows.length + 1}`,
        section_title: `Учебный план предметов. ${year.year} год обучения`,
        topic_name: parsed.title,
        hours_theory: null,
        hours_practice: null,
        hours_total: year.hoursTotal,
        activity_type: "не определено",
        control_form: "",
        source_section: "program-subject-volume-plan",
        source_excerpt: line.slice(0, 1500),
        confidence: 0.88,
        raw_payload: {
          parser: "program-subject-volume-plan",
          subject_year: year.year,
          weekly_hours: year.weeklyHours,
        },
      });
    }
  }

  return rows.length >= 2 ? rows : [];
}

function hasProgramSubjectVolumeContext(lines, index) {
  const before = lines
    .slice(Math.max(0, index - 10), index)
    .map(cleanupLine)
    .join(" ");
  return /программа\s+включает\s+следующие\s+предметы/iu.test(before) && /наименование\s+(?:курса|предмета)\s+количество\s+часов\s+по\s+предметам/iu.test(before);
}

function parseProgramSubjectVolumeLine(line) {
  const match = cleanupLine(line).match(/^[\-•]?\s*[«"]([^»"]{3,160})[»"]\s+(.+)$/u);
  if (!match) return null;

  const title = cleanupTopicName(match[1]);
  if (!isValidTopic(title)) return null;

  const rest = match[2];
  const annualHours = [...rest.matchAll(/(\d+(?:[,.]\d+)?)\s*час(?:а|ов)?/giu)]
    .map((hourMatch) => parseHourCell(hourMatch[1]))
    .filter((hours) => hours != null && hours > 0 && hours <= 600);
  if (annualHours.length < 2) return null;

  const weeklyHours = [...rest.matchAll(/(\d+(?:[,.]\d+)?)\s*ч\s*\/\s*недел/giu)]
    .map((hourMatch) => parseHourCell(hourMatch[1]))
    .filter((hours) => hours != null && hours > 0 && hours <= 40);

  return {
    title,
    years: annualHours.slice(0, 2).map((hoursTotal, yearIndex) => ({
      year: yearIndex + 1,
      hoursTotal,
      weeklyHours: weeklyHours[yearIndex] ?? null,
    })),
  };
}

function extractContentProgramVolumeRows(lines) {
  const startIndex = findContentProgramVolumeHeaderIndex(lines);
  if (startIndex < 0) return [];

  const topics = [];
  let currentSection = "Содержание программы";
  let pending = null;

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line || (PAGE_NUMBER_RE.test(line) && !pending) || isContentProgramVolumeHeaderLine(line)) continue;
    if (isContentProgramVolumeStopLine(line)) break;
    if (/^(?:итого|всего)(?:\s|:|$)/iu.test(line)) break;

    const section = parseContentProgramVolumeSection(lines, index);
    if (section) {
      if (pending) {
        const topic = buildContentProgramVolumeRow(pending, currentSection);
        if (topic) topics.push(topic);
        pending = null;
      }
      currentSection = section.title;
      index = section.nextIndex - 1;
      continue;
    }

    if (pending && isContentProgramVolumePracticalSegment(pending) && /^[-•]\s*/u.test(line)) {
      pending.titleParts.push(line.replace(/^[-•]\s*/u, ""));
      pending.rawLines.push(line);
      continue;
    }

    const start = parseContentProgramVolumeRowStart(line);
    if (start) {
      if (pending) {
        const topic = buildContentProgramVolumeRow(pending, currentSection);
        if (topic) topics.push(topic);
      }
      pending = {
        titleParts: [start.title],
        rawLines: [line],
        hoursTotal: start.hoursTotal,
      };
      if (start.hoursTotal != null) {
        const topic = buildContentProgramVolumeRow(pending, currentSection);
        if (topic) topics.push(topic);
        pending = null;
      }
      continue;
    }

    if (!pending) continue;
    const hours = parseStandaloneContentProgramVolumeHours(line);
    pending.rawLines.push(line);
    if (hours != null) {
      pending.hoursTotal = hours;
      const topic = buildContentProgramVolumeRow(pending, currentSection);
      if (topic) topics.push(topic);
      pending = null;
      continue;
    }
    pending.titleParts.push(line);
  }

  if (pending) {
    const topic = buildContentProgramVolumeRow(pending, currentSection);
    if (topic) topics.push(topic);
  }

  return topics;
}

function isContentProgramVolumePracticalSegment(segment) {
  return /^практические\s+занятия$/iu.test(cleanupContentProgramVolumeTopicName(segment.titleParts.join(" ")));
}

function findContentProgramVolumeHeaderIndex(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!/^содержание\s+программы$/iu.test(line)) continue;
    const window = lines
      .slice(index, index + 10)
      .map(cleanupLine)
      .join(" ");
    if (/наименование\s+разделов\s+и\s+тем/iu.test(window) && /об(?:ъе|ье)м\s+час/iu.test(window)) {
      return index;
    }
  }

  return -1;
}

function isContentProgramVolumeHeaderLine(line) {
  const cleaned = cleanupLine(line);
  return /^(?:наименование|разделов\s+и\s+тем|содержание\s+учебного\s+материала,\s*практические|занятия|об(?:ъе|ье)м|часов)$/iu.test(
    cleaned,
  );
}

function isContentProgramVolumeStopLine(line) {
  return /^(?:оценочные\s+материалы|методическ|учебно-?методическ|список\s+литературы|литература|приложение)/iu.test(
    cleanupLine(line),
  );
}

function parseContentProgramVolumeSection(lines, startIndex) {
  const first = cleanupLine(lines[startIndex]);
  if (!/^раздел\s+[IVXLCDM]+\.?/iu.test(first)) return null;

  const parts = [first];
  for (let index = startIndex + 1; index < Math.min(lines.length, startIndex + 8); index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line) continue;
    const hours = parseStandaloneContentProgramVolumeHours(line);
    if (hours != null) {
      return {
        title: cleanupContentProgramVolumeTopicName(parts.join(" ")),
        nextIndex: index + 1,
      };
    }
    if (parseContentProgramVolumeRowStart(line) || /^раздел\s+[IVXLCDM]+\.?/iu.test(line)) break;
    parts.push(line);
  }

  return null;
}

function parseContentProgramVolumeRowStart(line) {
  const cleaned = cleanupLine(line);
  const marked = cleaned.match(/^[-•]\s*(.+)$/u);
  if (marked) {
    const split = splitContentProgramVolumeHoursTail(marked[1]);
    return {
      title: split.title,
      hoursTotal: split.hoursTotal,
    };
  }

  if (/^практические\s+занятия:?$/iu.test(cleaned)) {
    return {
      title: "Практические занятия",
      hoursTotal: null,
    };
  }

  if (/^(?:консультац|констультац|итоговое\s+занятие)/iu.test(cleaned)) {
    const split = splitContentProgramVolumeHoursTail(cleaned);
    return split.hoursTotal != null ? split : null;
  }

  return null;
}

function splitContentProgramVolumeHoursTail(line) {
  const cleaned = cleanupLine(line);
  const match = cleaned.match(/^(.+?)\s+(\d+(?:[,.]\d+)?)$/u);
  if (!match) {
    return {
      title: cleaned,
      hoursTotal: null,
    };
  }

  return {
    title: cleanupLine(match[1]),
    hoursTotal: parseHourCell(match[2]),
  };
}

function parseStandaloneContentProgramVolumeHours(line) {
  const cleaned = cleanupLine(line);
  if (!/^\d+(?:[,.]\d+)?$/u.test(cleaned)) return null;
  return parseHourCell(cleaned);
}

function buildContentProgramVolumeRow(segment, currentSection) {
  if (segment.hoursTotal == null) return null;

  const topicName = cleanupContentProgramVolumeTopicName(segment.titleParts.join(" "));
  if (!isValidTopic(topicName)) return null;
  const hoursTotal = normalizeNullableHour(segment.hoursTotal);
  if (hoursTotal == null || hoursTotal <= 0 || hoursTotal > 500) return null;

  return {
    section_title: currentSection || "Содержание программы",
    topic_name: topicName,
    hours_theory: null,
    hours_practice: null,
    hours_total: hoursTotal,
    activity_type: "не определено",
    control_form: "",
    source_section: "content-program-volume-plan",
    source_excerpt: segment.rawLines.join(" / ").slice(0, 1500),
    confidence: 0.78,
    raw_payload: {
      parser: "content-program-volume-plan",
      parsed_lines: segment.rawLines,
    },
  };
}

function cleanupContentProgramVolumeTopicName(value) {
  return cleanupTopicName(value)
    .replace(/^практические\s+занятия\s+/iu, "Практические занятия: ")
    .replace(/([а-яё])-\s+([А-ЯЁа-яё])/giu, "$1 $2")
    .replace(/\s+([:;,.])/gu, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function extractCourseContentTopicHourRows(lines) {
  const startIndex = findCourseContentTopicHourStartIndex(lines);
  if (startIndex < 0) return [];

  const rows = [];
  let currentSection = "Содержание курса обучения";
  let pendingTopic = null;

  const flushPendingTopic = () => {
    if (!pendingTopic) return;
    const topic = buildCourseContentTopicHourRow(pendingTopic);
    pendingTopic = null;
    if (topic) rows.push(topic);
  };

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line || PAGE_NUMBER_RE.test(line)) continue;
    if (rows.length > 0 && isCourseContentTopicHourStopLine(line)) break;

    const sectionTitle = parseCourseContentTopicHourSection(line);
    if (sectionTitle) {
      flushPendingTopic();
      currentSection = sectionTitle;
      continue;
    }

    const topicStart = parseCourseContentTopicHourStart(line);
    if (topicStart) {
      flushPendingTopic();
      pendingTopic = {
        ...topicStart,
        sectionTitle: currentSection || "Содержание курса обучения",
        parsedLines: [line],
      };
      continue;
    }

    if (pendingTopic && shouldKeepCourseContentTopicDetailLine(line)) {
      pendingTopic.parsedLines.push(line);
    }
  }

  flushPendingTopic();
  if (!isCourseContentTopicHourCandidate(rows)) return [];
  return rows;
}

function findCourseContentTopicHourStartIndex(lines) {
  let seenStudyPlan = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (/учебн(?:ый|ого)\s+план/iu.test(line)) {
      seenStudyPlan = true;
      continue;
    }

    if (!seenStudyPlan) continue;
    if (!/^(?:\d+\s+)?содержание\s+(?:курса\s+обучения|изучаемого\s+курса)(?:$|\s)/iu.test(line)) continue;

    const window = lines
      .slice(index + 1, index + 45)
      .map(cleanupLine)
      .join(" ");
    if (/(?:^|\s)Тема\s+\d{1,2}\.\d{1,2}/iu.test(window) && /\s[–-]\s*\d+(?:[,.]\d+)?\s*час/iu.test(window)) {
      return index;
    }
  }

  return -1;
}

function isCourseContentTopicHourStopLine(line) {
  const cleaned = cleanupLine(line);
  return /^(?:\d+\s+)?(?:комплекс\s+организационно|материально\s*[- ]?\s*техническ|методическ[а-яё\s-]*обеспечение|список\s+литературы|литература|приложение)(?:$|\s)/iu.test(
    cleaned,
  );
}

function parseCourseContentTopicHourSection(line) {
  const cleaned = cleanupLine(line);
  const match = cleaned.match(/^Раздел\s+(\d{1,2})\.?\s+(.+)$/iu);
  if (!match) return "";

  const title = stripCourseContentTrailingHours(match[2]).title;
  const topicName = cleanupCourseContentTopicName(title);
  if (!topicName || topicName.length < 3) return "";
  return `Раздел ${Number(match[1])}. ${topicName}`;
}

function parseCourseContentTopicHourStart(line) {
  const cleaned = cleanupLine(line);
  if (/^(?:теори[яи]|практическ(?:ие|ая)\s+заняти[ея]|форма\s+контроля|итого)\b/iu.test(cleaned)) return null;

  const numbered = cleaned.match(/^Тема\s+(\d{1,2}\.\d{1,2})\.?\s+(.+)$/iu);
  if (numbered) {
    return buildCourseContentTopicStart({
      planNumber: numbered[1],
      rawTitle: numbered[2],
    });
  }

  const final = cleaned.match(/^Итоговое\s+занятие\.?\s*[–-]\s*(\d+(?:[,.]\d+)?)\s*час(?:а|ов)?\.?$/iu);
  if (final) {
    return {
      planNumber: "Итоговое занятие",
      topicName: "Итоговое занятие",
      hoursTotal: parseHourCell(final[1]),
    };
  }

  const intro = cleaned.match(/^(Вводное\s+занятие|Техника\s+безопасности)\s*[–-]\s*(\d+(?:[,.]\d+)?)\s*час(?:а|ов)?\.?$/iu);
  if (intro) {
    return {
      planNumber: "",
      topicName: cleanupCourseContentTopicName(intro[1]),
      hoursTotal: parseHourCell(intro[2]),
    };
  }

  return null;
}

function buildCourseContentTopicStart({ planNumber, rawTitle }) {
  const trailing = stripCourseContentTrailingHours(rawTitle);
  const topicName = cleanupCourseContentTopicName(trailing.title);
  if (!topicName) return null;

  return {
    planNumber,
    topicName,
    hoursTotal: trailing.hoursTotal,
  };
}

function stripCourseContentTrailingHours(value) {
  const text = cleanupLine(value);
  const match = text.match(/^(.+?)\s*[–-]\s*(\d+(?:[,.]\d+)?)\s*час(?:а|ов)?\.?$/iu);
  if (!match) {
    return {
      title: text,
      hoursTotal: null,
    };
  }

  return {
    title: cleanupLine(match[1]),
    hoursTotal: parseHourCell(match[2]),
  };
}

function cleanupCourseContentTopicName(value) {
  return cleanupTopicName(value)
    .replace(/^Тема\s+\d{1,2}\.\d{1,2}\.?\s*/iu, "")
    .replace(/\s*\.\s*$/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function shouldKeepCourseContentTopicDetailLine(line) {
  const cleaned = cleanupLine(line);
  if (!cleaned || PAGE_NUMBER_RE.test(cleaned)) return false;
  if (/^(?:Тема\s+\d{1,2}\.\d{1,2}|Раздел\s+\d{1,2}\.?|Итоговое\s+занятие)/iu.test(cleaned)) return false;
  if (isCourseContentTopicHourStopLine(cleaned)) return false;
  return true;
}

function buildCourseContentTopicHourRow(topic) {
  const topicName = cleanupCourseContentTopicName(topic.topicName);
  if (!isValidTopic(topicName)) return null;

  const detailHours = collectCourseContentTopicDetailHours(topic.parsedLines);
  const rawTotal = topic.hoursTotal ?? detailHours.totalFromDetails;
  const hoursTotal = normalizeNullableHour(rawTotal);
  if (hoursTotal == null || hoursTotal <= 0 || hoursTotal > 150) return null;

  const reconciled = reconcileCourseContentTopicHours({
    hoursTotal,
    hoursTheory: detailHours.hoursTheory,
    hoursPractice: detailHours.hoursPractice,
  });
  const finalHours =
    reconciled.hoursTheory == null &&
    reconciled.hoursPractice == null &&
    /^итоговое\s+занятие$/iu.test(topicName)
      ? {
          ...reconciled,
          hoursTheory: 0,
          hoursPractice: hoursTotal,
          warning: reconciled.warning || "Derived final lesson practice hours from total",
        }
      : reconciled;

  return {
    section_title: topic.sectionTitle || "Содержание курса обучения",
    topic_name: topicName,
    plan_number: cleanupLine(topic.planNumber || ""),
    hours_theory: finalHours.hoursTheory,
    hours_practice: finalHours.hoursPractice,
    hours_total: hoursTotal,
    activity_type: "не определено",
    control_form: "",
    source_section: "course-content-topic-hour-plan",
    source_excerpt: topic.parsedLines.join(" ").slice(0, 1500),
    confidence: finalHours.warning ? 0.82 : 0.87,
    raw_payload: {
      parser: "course-content-topic-hour-plan",
      plan_number: cleanupLine(topic.planNumber || ""),
      parsed_lines: topic.parsedLines,
      ...(finalHours.warning ? { hour_reconciliation_warning: finalHours.warning } : {}),
    },
  };
}

function collectCourseContentTopicDetailHours(lines) {
  let hoursTheory = null;
  let hoursPractice = null;

  for (const line of lines || []) {
    const cleaned = cleanupLine(line);
    const theory = cleaned.match(/^Теори[яи]\s*[–-]\s*(\d+(?:[,.]\d+)?)\s*час/iu);
    if (theory) {
      hoursTheory = roundHour((hoursTheory || 0) + parseHourCell(theory[1]));
      continue;
    }

    const practice = cleaned.match(/^Практическ(?:ие|ая)\s+заняти[ея]\s*[–-]\s*(\d+(?:[,.]\d+)?)\s*час/iu);
    if (practice) {
      hoursPractice = roundHour((hoursPractice || 0) + parseHourCell(practice[1]));
    }
  }

  const totalFromDetails =
    hoursTheory != null || hoursPractice != null ? roundHour((hoursTheory || 0) + (hoursPractice || 0)) : null;
  return {
    hoursTheory,
    hoursPractice,
    totalFromDetails,
  };
}

function reconcileCourseContentTopicHours({ hoursTotal, hoursTheory, hoursPractice }) {
  const theory = normalizeNullableHour(hoursTheory);
  const practice = normalizeNullableHour(hoursPractice);
  const total = normalizeNullableHour(hoursTotal);
  if (total == null) {
    return {
      hoursTheory: theory,
      hoursPractice: practice,
      warning: "",
    };
  }

  if (theory != null && practice != null) {
    if (Math.abs(theory + practice - total) <= 0.01) {
      return { hoursTheory: theory, hoursPractice: practice, warning: "" };
    }
    if (total > 1 && Math.abs(theory - total) <= 0.01 && Math.abs(practice - total) <= 0.01) {
      return {
        hoursTheory: roundHour(total / 2),
        hoursPractice: roundHour(total / 2),
        warning: `Split duplicated detail hours theory(${theory}) and practice(${practice}) by total(${total})`,
      };
    }
    if (Math.abs(theory - total) <= 0.01) {
      return {
        hoursTheory: total,
        hoursPractice: 0,
        warning: `Ignored inconsistent practice(${practice}) for total(${total})`,
      };
    }
    if (Math.abs(practice - total) <= 0.01) {
      return {
        hoursTheory: 0,
        hoursPractice: total,
        warning: `Ignored inconsistent theory(${theory}) for total(${total})`,
      };
    }
    return {
      hoursTheory: null,
      hoursPractice: null,
      warning: `Dropped inconsistent detail hours: theory(${theory}) + practice(${practice}) != total(${total})`,
    };
  }

  if (theory != null) {
    if (theory <= total) {
      return {
        hoursTheory: theory,
        hoursPractice: roundHour(total - theory),
        warning: "",
      };
    }
    return {
      hoursTheory: total,
      hoursPractice: 0,
      warning: `Capped theory(${theory}) by total(${total})`,
    };
  }

  if (practice != null) {
    return {
      hoursTheory: 0,
      hoursPractice: total,
      warning: Math.abs(practice - total) > 0.01 ? `Expanded practice(${practice}) to total(${total})` : "",
    };
  }

  return {
    hoursTheory: null,
    hoursPractice: null,
    warning: "",
  };
}

function isCourseContentTopicHourCandidate(rows) {
  if (!rows || rows.length < 8) return false;
  const total = sumTopicHoursTotal(rows);
  if (total < 20 || total > 500) return false;

  const numberedRows = rows.filter((row) => /^\d{1,2}\.\d{1,2}$/u.test(cleanupLine(row.plan_number || ""))).length;
  const rowsWithSplitHours = rows.filter((row) => row.hours_theory != null && row.hours_practice != null).length;
  return numberedRows >= Math.max(4, Math.floor(rows.length * 0.5)) && rowsWithSplitHours >= Math.floor(rows.length * 0.5);
}

function extractTotalOnlyStudyPlanRows(lines) {
  const startIndex = findTotalOnlyStudyPlanHeaderIndex(lines);
  if (startIndex < 0) return [];

  const topics = [];
  let segment = [];
  let rowsSinceStart = 0;

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line) continue;
    if (PAGE_NUMBER_RE.test(line) && !segment.length) continue;
    if (rowsSinceStart > 0 && isTotalOnlyStudyPlanStopLine(line)) break;
    if (isTotalOnlyStudyPlanHeaderLine(line)) continue;

    segment.push(line);
    const row = parseTotalOnlyStudyPlanSegment(segment);
    if (!row) {
      if (segment.length > 8) segment.shift();
      continue;
    }

    segment = [];
    if (row.isTotal) break;
    topics.push(row);
    rowsSinceStart += 1;
  }

  return topics;
}

function findTotalOnlyStudyPlanHeaderIndex(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!/учебн[оы]\s*[- ]?\s*тематическ(?:ий|ого)?\s+план|учебн(?:ый|ого)\s+план|содержание\s+программы/iu.test(line)) {
      continue;
    }

    const window = lines
      .slice(index, index + 12)
      .map(cleanupLine)
      .join(" ");
    if (/кол(?:ичеств[оа]?|[- ]?во)\s+час|объем\s+час/iu.test(window) && !/теори[яи].{0,30}практ/iu.test(window)) {
      return index;
    }
  }

  return -1;
}

function parseTotalOnlyStudyPlanSegment(segment) {
  const lines = segment.map(cleanupLine).filter(Boolean);
  const originalText = lines.join(" ").replace(/\s+/g, " ").trim();
  const text = stripTrailingStudyPlanTotalSummary(originalText);
  if (!text) return null;
  if (/^(?:итого|всего|всего\s+за\s+год)\b/iu.test(text)) return { isTotal: true };

  const match = text.match(/^(.+?)\s+(\d+(?:[,.]\d+)?)(?:\s+(.+))?$/u);
  if (!match) return null;
  if (/^(?:(?:[иi]тог(?:о|и)?)|всего)(?:$|\s|[.:])/iu.test(cleanupLine(match[1]))) return { isTotal: true };
  if (
    match[3] &&
    /^[а-яёa-z]/iu.test(match[3]) &&
    !/^(?:форма|лекция|беседа|квест|викторина|инструктаж|практик|мастер|экскурс|фестиваль)/iu.test(match[3])
  ) {
    return null;
  }

  const rawTitle = isolateBasicStudyPlanTitle(cleanupLine(match[1]));
  const topicName = cleanupTotalOnlyStudyPlanTopicName(rawTitle);
  if (/^(?:(?:[иi]тог(?:о|и)?)|всего)(?:$|\s|[.:])/iu.test(topicName)) return { isTotal: true };
  if (!isValidTopic(topicName)) return null;

  const hoursTotal = parseHourCell(match[2]);
  if (hoursTotal == null || hoursTotal <= 0 || hoursTotal > 500) return null;

  return {
    section_title: "Учебный план",
    topic_name: topicName,
    hours_theory: null,
    hours_practice: null,
    hours_total: hoursTotal,
    activity_type: "не определено",
    control_form: cleanupControlForm(match[3] || ""),
    source_section: "total-only-study-plan",
    source_excerpt: text.slice(0, 1500),
    confidence: 0.78,
    raw_payload: {
      parser: "total-only-study-plan",
      parsed_lines: lines,
      ...(text !== originalText ? { original_text: originalText } : {}),
    },
  };
}

function cleanupTotalOnlyStudyPlanTopicName(value) {
  const cleaned = cleanupBasicStudyPlanTopicName(value)
    .replace(/^наименование\s+тем\s+программы\s+/iu, "")
    .replace(/^тема\s+занятия\s+/iu, "")
    .replace(/край-Мурманская/giu, "край - Мурманская")
    .trim();
  return balanceSingleMissingClosingParenthesis(cleaned);
}

function balanceSingleMissingClosingParenthesis(value) {
  const text = cleanupLine(value);
  const openCount = (text.match(/\(/gu) || []).length;
  const closeCount = (text.match(/\)/gu) || []).length;
  if (openCount === closeCount + 1) return `${text})`;
  return text;
}

function isTotalOnlyStudyPlanHeaderLine(line) {
  const cleaned = cleanupLine(line);
  return (
    /^(?:№|п\/п|п\\п|наименование|тема|тема\s+занятия|количество|кол-?во|часов)$/iu.test(cleaned) ||
    /наименование\s+тем/iu.test(cleaned) ||
    /кол(?:ичеств[оа]?|[- ]?во)\s+час/iu.test(cleaned)
  );
}

function stripTrailingStudyPlanTotalSummary(value) {
  const text = cleanupLine(value);
  if (!text) return "";

  const stripped = text
    .replace(
      /(?:^|\s)(?:[иi]того(?![а-яёa-z])|всего(?:\s+час(?:ов|а)?)?)(?:\s*:?\s*.*)?$/iu,
      "",
    )
    .trim();

  return stripped || text;
}

function truncateStudyPlanLinesAtTotalSummary(lines) {
  const result = [];
  for (const line of lines) {
    const cleaned = cleanupLine(line);
    if (!cleaned) continue;

    const stripped = stripTrailingStudyPlanTotalSummary(cleaned);
    if (stripped !== cleaned) {
      if (stripped) result.push(stripped);
      break;
    }

    if (/^(?:[иi]того(?![а-яёa-z])|всего(?:\s+час(?:ов|а)?)?)(?:\s|:|$)/iu.test(cleaned)) break;
    result.push(cleaned);
  }

  return result;
}

function isTotalOnlyStudyPlanStopLine(line) {
  return /^(?:(?:\d+(?:\.\d+)*\.?)\s*)?(?:содержание\s+(?:учебного\s+плана|программы)|календарн[оы]\s*[- ]?\s*(?:тематическ|учебн)|методическ|материально|список\s+литературы|приложение)/iu.test(
    cleanupLine(line),
  );
}

function extractContentLessonHourRows(lines) {
  const startIndex = findContentLessonHourHeaderIndex(lines);
  if (startIndex < 0) return [];

  const rows = [];
  let index = startIndex + 1;

  while (index < lines.length) {
    const line = cleanupLine(lines[index]);
    if (!line || isContentLessonHourHeaderLine(line) || PAGE_NUMBER_RE.test(line)) {
      index += 1;
      continue;
    }
    if (rows.length > 0 && isContentLessonHourStopLine(line)) break;

    const start = parseContentLessonHourStart(line);
    if (!start) {
      index += 1;
      continue;
    }

    const segment = [line];
    let nextIndex = index + 1;
    while (nextIndex < lines.length) {
      const nextLine = cleanupLine(lines[nextIndex]);
      if (!nextLine) {
        nextIndex += 1;
        continue;
      }
      if (parseContentLessonHourStart(nextLine) || isContentLessonHourStopLine(nextLine)) break;
      segment.push(nextLine);
      nextIndex += 1;
    }

    const row = parseContentLessonHourSegment(start, segment);
    if (row) rows.push(row);
    index = nextIndex;
  }

  return rows;
}

function findContentLessonHourHeaderIndex(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!/содержание\s+программы/iu.test(line)) continue;

    const window = lines
      .slice(index, index + 12)
      .map(cleanupLine)
      .join(" ");
    if (/тема\s+занятия/iu.test(window) && /кол-?во\s+час|количество\s+час/iu.test(window)) {
      return index;
    }
  }

  return -1;
}

function parseContentLessonHourStart(line) {
  const match = cleanupLine(line).match(/^(\d{1,3})\.\s+(.+)$/u);
  if (!match) return null;
  const number = Number(match[1]);
  if (!Number.isInteger(number) || number <= 0 || number > 300) return null;
  return {
    number: String(number),
    titleStart: cleanupLine(match[2]),
  };
}

function parseContentLessonHourSegment(start, segment) {
  const lines = segment.map(cleanupLine).filter(Boolean);
  const hourIndex = findContentLessonHourIndex(lines);
  if (hourIndex < 0) return null;

  const hoursTotal = parseHourCell(lines[hourIndex]);
  if (hoursTotal == null || hoursTotal <= 0 || hoursTotal > 100) return null;

  const titleParts = [start.titleStart];
  for (let index = 1; index < hourIndex; index += 1) {
    const line = lines[index];
    if (isContentLessonDetailLine(line)) break;
    titleParts.push(line);
  }

  const topicName = cleanupContentLessonTopicName(titleParts.join(" "));
  if (!isValidTopic(topicName)) return null;

  const form = extractContentLessonForm(lines);
  return {
    plan_number: start.number,
    section_title: "Содержание программы",
    topic_name: topicName,
    hours_theory: null,
    hours_practice: null,
    hours_total: hoursTotal,
    activity_type: form || "не определено",
    control_form: "",
    source_section: "content-lesson-hour-plan",
    source_excerpt: lines.join(" / ").slice(0, 1500),
    confidence: form ? 0.82 : 0.74,
    raw_payload: {
      parser: "content-lesson-hour-plan",
      plan_number: start.number,
      form,
      parsed_lines: lines,
    },
  };
}

function findContentLessonHourIndex(lines) {
  for (let index = lines.length - 1; index >= 1; index -= 1) {
    const line = cleanupLine(lines[index]);
    if (!/^\d+(?:[,.]\d+)?$/u.test(line)) continue;
    const value = parseHourCell(line);
    if (value != null && value > 0 && value <= 100) return index;
  }

  return -1;
}

function extractContentLessonForm(lines) {
  const formIndex = lines.findIndex((line) => /^форма\s*:/iu.test(line));
  if (formIndex >= 0) {
    const parts = [lines[formIndex].replace(/^форма\s*:\s*/iu, "")];
    for (let index = formIndex + 1; index < lines.length; index += 1) {
      const line = cleanupLine(lines[index]);
      if (!line || /^\d+(?:[,.]\d+)?$/u.test(line) || isContentLessonDetailLine(line)) break;
      parts.push(line);
    }
    return cleanupControlForm(parts.join(" "));
  }

  if (lines.some((line) => /^практическая\s+работа\s*:/iu.test(line) || /^[•-]\s*/u.test(line))) {
    return "практическая работа";
  }

  return "";
}

function cleanupContentLessonTopicName(value) {
  return cleanupTopicName(value)
    .replace(/\s+/g, " ")
    .trim();
}

function isContentLessonDetailLine(line) {
  return /^(?:форма|практическая\s+работа|темы\s+на\s+выбор)\s*:|^[•-]\s*/iu.test(cleanupLine(line));
}

function isContentLessonHourHeaderLine(line) {
  const cleaned = cleanupLine(line);
  return /^(?:№|п\\п|п\/п|тема\s+занятия|кол-?во|часов)$/iu.test(cleaned) || /тема\s+занятия\s+кол-?во/iu.test(cleaned);
}

function isContentLessonHourStopLine(line) {
  return /^(?:всего|итого)\s*:?\s*\d+|^\d+(?:\.\d+)*\.\s+планируемые\s+результаты|^планируемые\s+результаты|^методическ/iu.test(
    cleanupLine(line),
  );
}

function extractAppendixLearningScheduleRows(lines) {
  const appendixIndex = lines.findIndex((line) => /^приложение\s*№?\s*1$/iu.test(cleanupLine(line)));
  if (appendixIndex < 0) return [];

  const rows = [];
  let mode = "";
  let currentSection = "";

  for (let index = appendixIndex + 1; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line || PAGE_NUMBER_RE.test(line)) continue;
    if (/^приложение\s*№?\s*2$/iu.test(line)) break;

    const modeMatch = line.match(/^календарн[ыйого]+\s+учебн[ыйого]+\s+график\s*\(([^)]+)\)/iu);
    if (modeMatch) {
      mode = cleanupLine(modeMatch[1]);
      currentSection = "";
      continue;
    }
    if (!mode) continue;

    if (isAppendixLearningScheduleHeaderLine(line)) continue;
    if (/^всего\s+\d+/iu.test(line)) {
      mode = "";
      currentSection = "";
      continue;
    }

    const section = parseAppendixLearningScheduleSection(line);
    if (section) {
      currentSection = section;
      continue;
    }

    if (!isAppendixLearningScheduleRowStart(line)) continue;

    const segment = [line];
    let nextIndex = index + 1;
    while (nextIndex < lines.length) {
      const nextLine = cleanupLine(lines[nextIndex]);
      if (!nextLine || PAGE_NUMBER_RE.test(nextLine)) {
        nextIndex += 1;
        continue;
      }
      if (
        /^приложение\s*№?\s*2$/iu.test(nextLine) ||
        /^календарн[ыйого]+\s+учебн[ыйого]+\s+график\s*\(/iu.test(nextLine) ||
        /^всего\s+\d+/iu.test(nextLine) ||
        parseAppendixLearningScheduleSection(nextLine) ||
        isAppendixLearningScheduleRowStart(nextLine)
      ) {
        break;
      }
      segment.push(nextLine);
      nextIndex += 1;
    }

    const row = parseAppendixLearningScheduleRow({ segment, mode, currentSection });
    if (row) rows.push(row);
    index = nextIndex - 1;
  }

  return rows.length >= 20 ? rows : [];
}

function parseAppendixLearningScheduleSection(line) {
  const match = cleanupLine(line).match(/^(.+?)\s*\((\d+(?:[,.]\d+)?)\s*час(?:а|ов)?\)$/iu);
  if (!match) return "";
  const title = cleanupTopicName(match[1]);
  if (!isValidTopic(title)) return "";
  return title;
}

function isAppendixLearningScheduleRowStart(line) {
  return /^\d{1,3}\.\s+/u.test(cleanupLine(line));
}

function parseAppendixLearningScheduleRow({ segment, mode, currentSection }) {
  const text = segment.map(cleanupLine).filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  const start = text.match(/^(\d{1,3})\.\s+(.+)$/u);
  if (!start) return null;

  const form = findAppendixLearningScheduleForm(start[2]);
  if (!form) return null;

  const afterForm = cleanupLine(start[2].slice(form.index + form.text.length));
  const hourMatch = afterForm.match(/^(\d+(?:[,.]\d+)?)\s+(.+)$/u);
  const hoursTotal = hourMatch ? parseHourCell(hourMatch[1]) : 1;
  const rawTopic = hourMatch ? hourMatch[2] : afterForm;
  if (hoursTotal == null || hoursTotal <= 0 || hoursTotal > 24) return null;

  const topicName = cleanupAppendixLearningScheduleTopicName(rawTopic, mode);
  if (!isValidTopic(topicName)) return null;

  const isTheory = /лекци/iu.test(form.text);
  return {
    plan_number: start[1],
    section_title: [mode, currentSection].filter(Boolean).join(": ") || "Приложение 1",
    topic_name: topicName,
    hours_theory: isTheory ? hoursTotal : 0,
    hours_practice: isTheory ? 0 : hoursTotal,
    hours_total: hoursTotal,
    activity_type: form.text,
    control_form: extractAppendixLearningScheduleControlForm(rawTopic),
    source_section: "appendix-learning-schedule",
    source_excerpt: text.slice(0, 1500),
    confidence: 0.82,
    raw_payload: {
      parser: "appendix-learning-schedule",
      mode,
      section: currentSection,
      plan_number: start[1],
      form: form.text,
      parsed_lines: segment.map(cleanupLine).filter(Boolean),
    },
  };
}

function findAppendixLearningScheduleForm(value) {
  const forms = [
    "практикум с элементами тренинга",
    "дистанционная лекция",
    "конференция",
    "практикум",
    "экскурсия",
    "тренинг",
    "лекция",
  ];

  const matches = forms
    .map((text) => {
      const match = cleanupLine(value).match(new RegExp(`\\b${escapeRegExp(text)}\\b`, "iu"));
      return match ? { text: match[0].toLowerCase(), index: match.index } : null;
    })
    .filter(Boolean);

  if (!matches.length) return null;
  matches.sort((left, right) => left.index - right.index || right.text.length - left.text.length);
  return matches[0];
}

function cleanupAppendixLearningScheduleTopicName(value, mode) {
  let topic = cleanupTopicName(value)
    .replace(/\bзаочно\s*-\s*дистанционное\s+занятие\b.*$/iu, "")
    .replace(/\bзаочно-дистанционное\s+занятие\b.*$/iu, "")
    .replace(/\b(?:входная\s+диагностика|тестирование|презентация|сообщения?|анкетирование)\b.*$/iu, "")
    .replace(/\s+/g, " ")
    .trim();

  if (/очное/iu.test(mode)) {
    topic = topic
      .replace(/\s+(?:Турбаза|Музей|Мурманский\s+областной|Пешеходная\s+экскурсия|Автобусная\s+экскурсия|Троллейбусная\s+экскурсия|Арктический\s+выставочный\s+центр|Мемориальная|Музейно-выставочный\s+центр|г\.|пос\.).*$/iu, "")
      .trim();
  }

  return topic;
}

function extractAppendixLearningScheduleControlForm(value) {
  const text = cleanupLine(value);
  const match = text.match(/\b(входная\s+диагностика|тестирование|презентация(?:,\s*сообщение)?|сообщения?|анкетирование)\b/iu);
  return match ? cleanupControlForm(match[1]) : "";
}

function isAppendixLearningScheduleHeaderLine(line) {
  return /^(?:№|п\/п|месяц|число|время|проведения|занятия|форма|кол-?|во|часов|тема|место|контроля)$/iu.test(
    cleanupLine(line),
  );
}

function extractContentSectionTheoryPracticeRows(lines) {
  const startIndex = findContentSectionTheoryPracticeStartIndex(lines);
  if (startIndex < 0) return [];

  const rows = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line || PAGE_NUMBER_RE.test(line)) continue;
    if (rows.length > 0 && isContentSectionTheoryPracticeStopLine(line)) break;

    const standaloneSection = parseContentStandaloneSectionTheoryPracticeStart(line);
    if (standaloneSection && !hasContentThemeBeforeNextStandaloneSection(lines, index + 1)) {
      const endIndex = findNextContentSectionTheoryPracticeIndex(lines, index + 1);
      const segment = lines.slice(index, endIndex).map(cleanupLine).filter(Boolean);
      const hours = parseContentSectionTheoryPracticeHours(segment, standaloneSection.hoursTotal);
      rows.push({
        plan_number: standaloneSection.number,
        section_title: "Содержание изучаемого курса",
        topic_name: standaloneSection.title,
        hours_theory: hours.hoursTheory,
        hours_practice: hours.hoursPractice,
        hours_total: standaloneSection.hoursTotal,
        activity_type: inferLessonThematicPlanningActivityType({
          hoursTheory: hours.hoursTheory,
          hoursPractice: hours.hoursPractice,
        }),
        control_form: "",
        source_section: "content-section-theory-practice",
        source_excerpt: segment.join(" / ").slice(0, 1500),
        confidence: 0.82,
        raw_payload: {
          parser: "content-section-theory-practice",
          plan_number: standaloneSection.number,
          section_row: true,
          parsed_lines: segment,
        },
      });
      index = endIndex - 1;
      continue;
    }

    const section = parseContentSectionTheoryPracticeStart(line);
    if (!section) continue;

    const endIndex = findNextContentSectionTheoryPracticeIndex(lines, index + 1);
    const segment = lines.slice(index, endIndex).map(cleanupLine).filter(Boolean);
    const hours = parseContentSectionTheoryPracticeHours(segment, section.hoursTotal);

    rows.push({
      plan_number: section.number,
      section_title: "Содержание изучаемого курса",
      topic_name: section.title,
      hours_theory: hours.hoursTheory,
      hours_practice: hours.hoursPractice,
      hours_total: section.hoursTotal,
      activity_type: inferLessonThematicPlanningActivityType({
        hoursTheory: hours.hoursTheory,
        hoursPractice: hours.hoursPractice,
      }),
      control_form: "",
      source_section: "content-section-theory-practice",
      source_excerpt: segment.join(" / ").slice(0, 1500),
      confidence: 0.84,
      raw_payload: {
        parser: "content-section-theory-practice",
        plan_number: section.number,
        parsed_lines: segment,
      },
    });

    index = endIndex - 1;
  }

  return rows;
}

function findContentSectionTheoryPracticeStartIndex(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    if (/^(?:\d+(?:\.\d+)*\s*)?содержание\s+(?:изучаемого\s+курса|учебного\s+плана)$/iu.test(cleanupLine(lines[index]))) {
      return index;
    }
  }

  return -1;
}

function parseContentSectionTheoryPracticeStart(line) {
  const cleaned = cleanupLine(line);
  const match =
    cleaned.match(/^(\d{1,2})\.\s+(.+?)\s*\((\d+(?:[,.]\d+)?)\s*час(?:а|ов)?\)$/iu) ||
    cleaned.match(/^тема\s+(\d{1,3})\.\s+(.+?)(?:[—-]|\.)?\s+(\d+(?:[,.]\d+)?)\s*час(?:а|ов)?(?:\b|[:.])/iu);
  if (!match) return null;

  const title = cleanupTopicName(match[2]);
  const hoursTotal = parseHourCell(match[3]);
  if (!isValidTopic(title) || hoursTotal == null || hoursTotal <= 0 || hoursTotal > 500) return null;

  return {
    number: match[1],
    title,
    hoursTotal,
  };
}

function parseContentStandaloneSectionTheoryPracticeStart(line) {
  const match = cleanupLine(line).match(
    /^раздел\s+(\d{1,3})\.\s+(.+?)\.\s*(\d+(?:[,.]\d+)?)\s*час(?:а|ов)?(?:\b|[:.])/iu,
  );
  if (!match) return null;

  const title = cleanupTopicName(match[2]);
  const hoursTotal = parseHourCell(match[3]);
  if (!isValidTopic(title) || hoursTotal == null || hoursTotal <= 0 || hoursTotal > 500) return null;

  return {
    number: match[1],
    title,
    hoursTotal,
  };
}

function hasContentThemeBeforeNextStandaloneSection(lines, startIndex) {
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line || PAGE_NUMBER_RE.test(line)) continue;
    if (parseContentSectionTheoryPracticeStart(line)) return true;
    if (parseContentStandaloneSectionTheoryPracticeStart(line) || isContentSectionTheoryPracticeStopLine(line)) return false;
  }
  return false;
}

function findNextContentSectionTheoryPracticeIndex(lines, startIndex) {
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (
      parseContentSectionTheoryPracticeStart(line) ||
      parseContentStandaloneSectionTheoryPracticeStart(line) ||
      isContentSectionTheoryPracticeStopLine(line)
    ) {
      return index;
    }
  }

  return lines.length;
}

function parseContentSectionTheoryPracticeHours(segment, hoursTotal) {
  let hoursTheory = null;
  let hoursPractice = null;
  const text = segment.map(cleanupLine).join(" ");

  const inlineTheoryMatch = text.match(/теори[яи]\s*[—-]?\s*(\d+(?:[,.]\d+)?)\s*час/iu);
  if (inlineTheoryMatch) {
    hoursTheory = parseHourCell(inlineTheoryMatch[1]);
  }

  const inlinePracticeMatch = text.match(/практик[аи]\s*[—-]?\s*(\d+(?:[,.]\d+)?)\s*час/iu);
  if (inlinePracticeMatch) {
    hoursPractice = parseHourCell(inlinePracticeMatch[1]);
  }

  const inlineTheoryAfterMatch = text.match(/(\d+(?:[,.]\d+)?)\s*час(?:а|ов)?\s+теори[яи]/iu);
  if (hoursTheory == null && inlineTheoryAfterMatch) {
    hoursTheory = parseHourCell(inlineTheoryAfterMatch[1]);
  }

  const inlinePracticeAfterMatch = text.match(/(\d+(?:[,.]\d+)?)\s*час(?:а|ов)?\s+практик[аи]/iu);
  if (hoursPractice == null && inlinePracticeAfterMatch) {
    hoursPractice = parseHourCell(inlinePracticeAfterMatch[1]);
  }

  for (const line of segment) {
    const theoryMatch = line.match(/^теоретические\s+занятия\s*\((\d+(?:[,.]\d+)?)\s*час(?:а|ов)?\)$/iu);
    if (theoryMatch) {
      hoursTheory = parseHourCell(theoryMatch[1]);
      continue;
    }

    const practiceMatch = line.match(/^практические\s+занятия\s*\((\d+(?:[,.]\d+)?)\s*час(?:а|ов)?\)$/iu);
    if (practiceMatch) {
      hoursPractice = parseHourCell(practiceMatch[1]);
    }
  }

  if (hoursTheory == null && hoursPractice != null) {
    hoursTheory = Math.max(0, roundHour(hoursTotal - hoursPractice));
  }
  if (hoursPractice == null && hoursTheory != null) {
    hoursPractice = Math.max(0, roundHour(hoursTotal - hoursTheory));
  }

  return {
    hoursTheory: hoursTheory ?? null,
    hoursPractice: hoursPractice ?? null,
  };
}

function isContentSectionTheoryPracticeStopLine(line) {
  return /^(?:формы\s+аттестации|оценочн|методическ|материально|список\s+литературы|литература|приложение)/iu.test(
    cleanupLine(line),
  );
}

function extractSectionedTheoryPracticeStudyPlanRows(lines) {
  const startIndex = findSectionedTheoryPracticeStudyPlanHeaderIndex(lines);
  if (startIndex < 0) return [];

  const rows = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line || PAGE_NUMBER_RE.test(line) || isSectionedTheoryPracticeStudyPlanHeaderLine(line)) continue;
    if (rows.length > 0 && isSectionedTheoryPracticeStudyPlanStopLine(line)) break;

    const start = parseSectionedTheoryPracticeSectionStart(line);
    if (!start) continue;

    const segment = collectSectionedTheoryPracticeSegment(lines, index);
    const row = parseSectionedTheoryPracticeSegment(segment.lines);
    if (row) rows.push(row);
    index = Math.max(index, segment.nextIndex - 1);
  }

  return rows.length >= 3 ? rows : [];
}

function findSectionedTheoryPracticeStudyPlanHeaderIndex(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!/учебн[оы]\s*[- ]?\s*тематическ(?:ий|ого)?\s+план/iu.test(line)) continue;

    const window = lines
      .slice(index, index + 24)
      .map(cleanupLine)
      .join(" ");
    if (!/содержание\s+программы/iu.test(window)) continue;
    if (!/количество\s+часов/iu.test(window) || !/теори[яи]/iu.test(window) || !/практик[аи]/iu.test(window)) continue;
    if (/раздел\s*\d+\.?.{0,120}\d+(?:[,.]\d+)?\s*ч/iu.test(window)) return index;
  }

  return -1;
}

function collectSectionedTheoryPracticeSegment(lines, startIndex) {
  const segment = [cleanupLine(lines[startIndex])];
  let hasTotalHours = /(?:^|\s)\d+(?:[,.]\d+)?\s*ч(?:ас(?:а|ов)?)?(?=\s|\.|$)/iu.test(segment[0]);
  let hasTheoryPractice = hasSectionedTheoryPracticeHourCells(segment[0]);
  let index = startIndex + 1;

  for (; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line || PAGE_NUMBER_RE.test(line) || isSectionedTheoryPracticeStudyPlanHeaderLine(line)) continue;
    if (parseSectionedTheoryPracticeSectionStart(line) || isSectionedTheoryPracticeStudyPlanStopLine(line)) break;
    if (hasTotalHours && isSectionedTheoryPracticeDetailRowStart(line)) break;

    segment.push(line);
    if (/(?:^|\s)\d+(?:[,.]\d+)?\s*ч(?:ас(?:а|ов)?)?(?=\s|\.|$)/iu.test(line)) hasTotalHours = true;
    if (hasSectionedTheoryPracticeHourCells(line)) hasTheoryPractice = true;
    if (hasTotalHours && hasTheoryPractice) {
      index += 1;
      break;
    }
    if (segment.length >= 5) break;
  }

  return {
    lines: segment,
    nextIndex: index,
  };
}

function parseSectionedTheoryPracticeSegment(segment) {
  const lines = segment.map(cleanupLine).filter(Boolean);
  if (!lines.length) return null;

  const firstLine = lines[0];
  const section = parseSectionedTheoryPracticeSectionStart(firstLine);
  if (!section) return null;

  const restLines = [section.rest, ...lines.slice(1)].map(cleanupLine).filter(Boolean);
  const text = restLines.join(" ").replace(/\s+/g, " ").trim();
  const hoursMatch = text.match(/(\d+(?:[,.]\d+)?)\s*ч(?:ас(?:а|ов)?)?(?=\s|\.|$)/iu);
  if (!hoursMatch) return null;

  const hoursTotal = parseHourCell(hoursMatch[1]);
  if (hoursTotal == null || hoursTotal <= 0 || hoursTotal > 300) return null;

  const titleBeforeHours = text.slice(0, hoursMatch.index);
  const afterHours = text.slice(hoursMatch.index + hoursMatch[0].length);
  const afterParts = splitSectionedTheoryPracticeAfterHours(afterHours);
  const topicName = cleanupSectionedTheoryPracticeTopicName([titleBeforeHours, afterParts.title].filter(Boolean).join(" "));
  if (!isValidTopic(topicName)) return null;

  const hoursTheory = afterParts.hoursTheory ?? null;
  const hoursPractice = afterParts.hoursPractice ?? (
    hoursTheory != null ? roundHour(Math.max(0, hoursTotal - hoursTheory)) : null
  );
  if (!isPlausibleHours(hoursTheory, hoursPractice, hoursTotal)) return null;

  return {
    plan_number: section.number,
    section_title: "Учебно-тематический план",
    topic_name: topicName,
    hours_theory: hoursTheory,
    hours_practice: hoursPractice,
    hours_total: hoursTotal,
    activity_type: inferLessonThematicPlanningActivityType({
      hoursTheory,
      hoursPractice,
    }),
    control_form: cleanupControlForm(afterParts.controlForm),
    source_section: "sectioned-theory-practice-study-plan",
    source_excerpt: lines.join(" / ").slice(0, 1500),
    confidence: 0.86,
    raw_payload: {
      parser: "sectioned-theory-practice-study-plan",
      plan_number: section.number,
      parsed_lines: lines,
    },
  };
}

function parseSectionedTheoryPracticeSectionStart(line) {
  const match = cleanupLine(line).match(/^раздел\s*(\d{1,3})\.?\s*(.*)$/iu);
  if (!match) return null;
  return {
    number: match[1],
    rest: cleanupLine(match[2] || ""),
  };
}

function splitSectionedTheoryPracticeAfterHours(value) {
  const text = cleanupLine(value);
  const matches = [...text.matchAll(/(?:^|\s)(\d+(?:[,.]\d+)?)(?=\s|$)/gu)];
  if (!matches.length) {
    return {
      title: text,
      hoursTheory: null,
      hoursPractice: null,
      controlForm: "",
    };
  }

  const hourMatches = matches.slice(-2);
  const firstMatch = hourMatches[0];
  const title = cleanupLine(text.slice(0, firstMatch.index));
  const lastMatch = hourMatches[hourMatches.length - 1];
  const controlForm = cleanupLine(text.slice(lastMatch.index + lastMatch[0].length));
  const values = hourMatches.map((match) => parseHourCell(match[1]));

  if (values.length >= 2) {
    return {
      title,
      hoursTheory: values[0],
      hoursPractice: values[1],
      controlForm,
    };
  }

  return {
    title,
    hoursTheory: values[0],
    hoursPractice: null,
    controlForm,
  };
}

function hasSectionedTheoryPracticeHourCells(line) {
  const cleaned = cleanupLine(line);
  if (/^\d+(?:[,.]\d+)?(?:\s+\d+(?:[,.]\d+)?)(?:\s+\S.*)?$/u.test(cleaned)) return true;
  if (/\d+(?:[,.]\d+)?\s*ч(?:ас(?:а|ов)?)?(?=\s|\.|$)\s+\d+(?:[,.]\d+)?(?:\s+\d+(?:[,.]\d+)?)?(?:\s|$)/iu.test(cleaned)) {
    return true;
  }
  return false;
}

function isSectionedTheoryPracticeDetailRowStart(line) {
  return /^\d{1,3}\.\s+/u.test(cleanupLine(line));
}

function isSectionedTheoryPracticeStudyPlanHeaderLine(line) {
  const cleaned = cleanupLine(line);
  return /^(?:№|п\/?п|содержание\s+программы.*|количество\s+часов|формы?\s+контроля|теори[яи]|практик[аи])$/iu.test(
    cleaned,
  );
}

function isSectionedTheoryPracticeStudyPlanStopLine(line) {
  return /^(?:всего\s+за\s+год|содержание\s+учебного\s+плана|содержание\s+программы|календарн[оы]\s*[- ]?\s*(?:тематическ|учебн)|методическ|материально|список\s+литературы|приложение)/iu.test(
    cleanupLine(line),
  );
}

function cleanupSectionedTheoryPracticeTopicName(value) {
  return cleanupTopicName(value)
    .replace(/\s+/g, " ")
    .replace(/[.]+$/u, "")
    .trim();
}

function extractSingleRowThematicPlanRows(lines) {
  const startIndex = findSingleRowThematicPlanHeaderIndex(lines);
  if (startIndex < 0) return [];

  const rows = [];
  let currentSection = "";

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line || isSingleRowThematicPlanHeaderLine(line)) continue;
    if (rows.length > 0 && isSingleRowThematicPlanStopLine(line)) break;

    const themeStart = parseSingleRowThematicPlanThemeStart(line);
    if (themeStart) {
      const theme = collectSingleRowThematicPlanTheme(lines, index);
      currentSection = cleanupSingleRowThematicPlanSectionTitle(theme.title || themeStart.title);
      if (theme.row) {
        rows.push(theme.row);
        index = Math.max(index, theme.nextIndex - 1);
      }
      continue;
    }

    const row = parseSingleRowThematicPlanLine(line, currentSection);
    if (row) rows.push(...row);
  }

  return rows.length >= 20 ? rows : [];
}

function findSingleRowThematicPlanHeaderIndex(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    if (/^тематическое\s+планирование\s+курса/iu.test(cleanupLine(lines[index]))) {
      return index;
    }
  }

  return -1;
}

function parseSingleRowThematicPlanThemeStart(line) {
  const match = cleanupLine(line).match(/^тема\s*(\d+)\.?\s*(.+)$/iu);
  if (!match) return null;
  return {
    number: match[1],
    title: cleanupLine(match[2]),
  };
}

function collectSingleRowThematicPlanTheme(lines, index) {
  const startLine = cleanupLine(lines[index]);
  const start = parseSingleRowThematicPlanThemeStart(startLine);
  const titleParts = [start ? start.title : ""].filter(Boolean);
  let nextIndex = index + 1;
  let hasNumberedRows = false;

  while (nextIndex < lines.length) {
    const nextLine = cleanupLine(lines[nextIndex]);
    if (!nextLine || isSingleRowThematicPlanHeaderLine(nextLine)) {
      nextIndex += 1;
      continue;
    }
    if (isSingleRowThematicPlanStopLine(nextLine) || parseSingleRowThematicPlanThemeStart(nextLine)) break;
    if (parseSingleRowThematicPlanLine(nextLine, "")) {
      hasNumberedRows = true;
      break;
    }
    titleParts.push(nextLine);
    nextIndex += 1;
  }

  const title = cleanupSingleRowThematicPlanTopicName(titleParts.join(" "));
  if (hasNumberedRows || !isValidTopic(title)) {
    return {
      title,
      row: null,
      nextIndex: index + 1,
    };
  }

  const planNumber = start.number;
  return {
    title,
    row: {
      plan_number: planNumber,
      section_title: "Тематическое планирование курса",
      topic_name: title,
      hours_theory: null,
      hours_practice: null,
      hours_total: 1,
      activity_type: "не определено",
      control_form: "",
      source_section: "single-row-thematic-plan",
      source_excerpt: [startLine, ...titleParts.slice(1)].join(" / ").slice(0, 1500),
      confidence: 0.78,
      raw_payload: {
        parser: "single-row-thematic-plan",
        plan_number: planNumber,
      },
    },
    nextIndex,
  };
}

function parseSingleRowThematicPlanLine(line, currentSection) {
  const match = cleanupLine(line).match(/^(\d{1,3})(?:\s*-\s*(\d{1,3}))?\.\s*(.+)$/u);
  if (!match) return null;

  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : start;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end > 200) {
    return null;
  }

  const topicName = cleanupSingleRowThematicPlanTopicName(match[3]);
  if (!isValidTopic(topicName)) return null;

  const planNumber = start === end ? String(start) : `${start}-${end}`;
  return [
    {
      plan_number: planNumber,
      section_title: currentSection || "Тематическое планирование курса",
      topic_name: topicName,
      hours_theory: null,
      hours_practice: null,
      hours_total: end - start + 1,
      activity_type: "не определено",
      control_form: "",
      source_section: "single-row-thematic-plan",
      source_excerpt: cleanupLine(line).slice(0, 1500),
      confidence: 0.78,
      raw_payload: {
        parser: "single-row-thematic-plan",
        plan_number: planNumber,
        source_range: planNumber,
      },
    },
  ];
}

function cleanupSingleRowThematicPlanTopicName(value) {
  return cleanupTopicName(value)
    .replace(/([а-яё])([А-ЯЁ])/gu, "$1 $2")
    .replace(/детскийфольклор/iu, "Детский фольклор")
    .replace(/\s+([.,;:!?])/gu, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanupSingleRowThematicPlanSectionTitle(value) {
  return cleanupSingleRowThematicPlanTopicName(value).replace(/[.]+$/u, "");
}

function isSingleRowThematicPlanHeaderLine(line) {
  return /^(?:название\s+разделов|количество|часов|количество\s+часов)$/iu.test(cleanupLine(line));
}

function isSingleRowThematicPlanStopLine(line) {
  const cleaned = cleanupLine(line);
  if (/^\d+(?:[,.]\d+)?\s*час(?:а|ов)?$/iu.test(cleaned)) return true;
  return /^(?:структура\s+курса|результатами\s+изучения|методическ|материально|список\s+литературы|литература|приложение)/iu.test(
    cleaned,
  );
}

function extractCourseStructureRows(lines) {
  const startIndex = findCourseStructureHeaderIndex(lines);
  if (startIndex < 0) return [];

  const rows = [];

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line || PAGE_NUMBER_RE.test(line)) continue;
    if (rows.length > 0 && isCourseStructureStopLine(line)) break;

    const row = parseCourseStructureLine(line);
    if (!row) continue;
    rows.push(row);
  }

  return rows;
}

function findCourseStructureHeaderIndex(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (/^структура\s+курса$/iu.test(line)) return index;
  }

  return -1;
}

function parseCourseStructureLine(line) {
  const cleaned = cleanupLine(line);
  const match = cleaned.match(
    /^(?:(введение|подведение\s+итогов)|(?:тема|раздел)\s+([ivxlcdm\d]+)\.?\s*)[.:]?\s*(.+?)\s*\((\d+(?:[,.]\d+)?)\s*ч(?:ас(?:а|ов)?)?\.?\)\.?$/iu,
  );
  if (!match) return null;

  const prefix = cleanupLine(match[1] || `Тема ${match[2]}`);
  const title = cleanupCourseStructureTopicName(`${prefix}. ${match[3]}`);
  if (!isValidTopic(title)) return null;

  const hoursTotal = parseHourCell(match[4]);
  if (hoursTotal == null || hoursTotal <= 0 || hoursTotal > 200) return null;

  return {
    plan_number: match[2] || "",
    section_title: "Структура курса",
    topic_name: title,
    hours_theory: null,
    hours_practice: null,
    hours_total: hoursTotal,
    activity_type: "не определено",
    control_form: "",
    source_section: "course-structure",
    source_excerpt: cleaned.slice(0, 1500),
    confidence: 0.78,
    raw_payload: {
      parser: "course-structure",
      plan_number: match[2] || "",
    },
  };
}

function cleanupCourseStructureTopicName(value) {
  return cleanupTopicName(value)
    .replace(/\s+/g, " ")
    .trim();
}

function isCourseStructureStopLine(line) {
  return /^(?:методическ|материально|список\s+литературы|литература|приложение|итого|всего)/iu.test(cleanupLine(line));
}

function extractSimpleTopicHourPlanRows(lines) {
  const startIndex = findSimpleTopicHourPlanHeaderIndex(lines);
  if (startIndex < 0) return [];

  const rows = [];
  let expectedTotal = null;
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line || isSimpleTopicHourPlanHeaderLine(line) || PAGE_NUMBER_RE.test(line)) continue;

    const total = parseSimpleTopicHourPlanTotalLine(line);
    if (total != null) {
      expectedTotal = total;
      break;
    }
    if (rows.length > 0 && isSimpleTopicHourPlanStopLine(line)) break;

    const parsed = parseSimpleTopicHourPlanRow(line);
    if (!parsed) continue;
    rows.push(parsed);
  }

  if (rows.length < 3 || expectedTotal == null) return [];
  if (Math.abs(sumTopicHoursTotal(rows) - expectedTotal) > 0.01) return [];

  return rows;
}

function findSimpleTopicHourPlanHeaderIndex(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!/^\d+\.\s*учебн[оы]\s*[- ]?\s*тематическ(?:ий|ого)?\s+план$/iu.test(line)) continue;

    const window = lines
      .slice(index, index + 10)
      .map(cleanupLine)
      .join(" ");
    if (/наименование\s+тем[ыы]/iu.test(window) && /количество\s+часов/iu.test(window)) return index;
  }

  return -1;
}

function parseSimpleTopicHourPlanRow(line) {
  const match = cleanupLine(line).match(/^(\d{1,3})\s+(.+?)\s+(\d+(?:[,.]\d+)?)$/u);
  if (!match) return null;

  const planNumber = Number(match[1]);
  const hoursTotal = parseHourCell(match[3]);
  if (!Number.isInteger(planNumber) || planNumber <= 0 || planNumber > 100) return null;
  if (hoursTotal == null || hoursTotal <= 0 || hoursTotal > 200) return null;

  const topicName = cleanupTopicName(match[2]);
  if (!isValidTopic(topicName)) return null;

  return {
    plan_number: String(planNumber),
    section_title: "Учебно-тематический план",
    topic_name: topicName,
    hours_theory: null,
    hours_practice: null,
    hours_total: hoursTotal,
    activity_type: inferActivityType({
      topicName,
      controlForm: "",
      hoursTheory: null,
      hoursPractice: null,
    }),
    control_form: "",
    source_section: "simple-topic-hour-plan",
    source_excerpt: line.slice(0, 1500),
    confidence: 0.86,
    raw_payload: {
      parser: "simple-topic-hour-plan",
      plan_number: String(planNumber),
      parsed_lines: [line],
    },
  };
}

function parseSimpleTopicHourPlanTotalLine(line) {
  const match = cleanupLine(line).match(/^итого\s+(\d+(?:[,.]\d+)?)$/iu);
  return match ? parseHourCell(match[1]) : null;
}

function isSimpleTopicHourPlanHeaderLine(line) {
  return /^(?:№|п\/?п|наименование\s+тем[ыы]|количество\s+часов)$/iu.test(cleanupLine(line));
}

function isSimpleTopicHourPlanStopLine(line) {
  return /^(?:содержание\s+программы|условия\s+реализации|календарн[оы]\s*[- ]?\s*тематическ|методическ|материально|список\s+литературы|литература|приложение)/iu.test(
    cleanupLine(line),
  );
}

function extractAcademicCalendarScheduleRows(lines) {
  const headerIndex = findAcademicCalendarScheduleHeaderIndex(lines);
  if (headerIndex < 0) return [];

  const rows = [];
  let expectedNumber = 1;
  let index = headerIndex + 1;

  while (index < lines.length) {
    const line = cleanupLine(lines[index]);
    if (!line || PAGE_NUMBER_RE.test(line) || isAcademicCalendarScheduleHeaderLine(line)) {
      index += 1;
      continue;
    }
    if (rows.length > 0 && isAcademicCalendarScheduleStopLine(line)) break;

    const start = readAcademicCalendarScheduleRowStart(line, expectedNumber);
    if (!start) {
      index += 1;
      continue;
    }

    const nextIndex = findNextAcademicCalendarScheduleRowIndex(lines, index + 1, expectedNumber + 1);
    const segment = [line];
    for (let rowIndex = index + 1; rowIndex < nextIndex; rowIndex += 1) {
      const segmentLine = cleanupLine(lines[rowIndex]);
      if (!segmentLine || PAGE_NUMBER_RE.test(segmentLine)) continue;
      segment.push(segmentLine);
    }

    const row = parseAcademicCalendarScheduleSegment({ start, segment });
    if (row) rows.push(row);

    expectedNumber += 1;
    index = nextIndex;
  }

  const total = sumTopicHoursTotal(rows);
  return rows.length >= 20 && total > 0 ? rows : [];
}

function findAcademicCalendarScheduleHeaderIndex(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!/^учебн[оы]\s*[- ]?\s*календарн(?:ый|ого)\s+график$/iu.test(line)) continue;

    const window = lines
      .slice(index, index + 18)
      .map(cleanupLine)
      .join(" ");
    if (/тема\s+занят/iu.test(window) && /кол\s*-?\s*во\s+час|кол-?во\s+час/iu.test(window)) return index;
  }

  return -1;
}

function readAcademicCalendarScheduleRowStart(line, expectedNumber) {
  const match = cleanupLine(line).match(/^(\d{1,3})\s+(.+)$/u);
  if (!match || Number(match[1]) !== expectedNumber) return null;

  return {
    rowNumber: expectedNumber,
    topicStart: cleanupLine(match[2]),
  };
}

function findNextAcademicCalendarScheduleRowIndex(lines, startIndex, nextNumber) {
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line) continue;
    if (isAcademicCalendarScheduleStopLine(line)) return index;
    if (readAcademicCalendarScheduleRowStart(line, nextNumber)) return index;
  }

  return lines.length;
}

function parseAcademicCalendarScheduleSegment({ start, segment }) {
  const sourceLines = segment.map(cleanupLine).filter(Boolean);
  const topicParts = [];
  let hoursTotal = null;
  let sawHours = false;

  const firstLine = cleanupLine(start.topicStart);
  const firstSplit = splitAcademicCalendarScheduleHourLine(firstLine);
  if (firstSplit) {
    if (firstSplit.topicPart) topicParts.push(firstSplit.topicPart);
    hoursTotal = firstSplit.hoursTotal;
    sawHours = true;
  } else if (firstLine) {
    topicParts.push(firstLine);
  }

  for (const rawLine of sourceLines.slice(1)) {
    const line = cleanupLine(rawLine);
    if (!line || PAGE_NUMBER_RE.test(line) || isAcademicCalendarScheduleHeaderLine(line)) continue;

    if (!sawHours) {
      const split = splitAcademicCalendarScheduleHourLine(line);
      if (split) {
        if (split.topicPart) topicParts.push(split.topicPart);
        hoursTotal = split.hoursTotal;
        sawHours = true;
      } else {
        topicParts.push(line);
      }
    }
  }

  if (hoursTotal == null || hoursTotal <= 0) return null;

  const topicName = cleanupCalendarStudyScheduleTopic(topicParts.join(" "));
  if (!isValidScheduleTopic(topicName) && !isAllowedModularCalendarStudyScheduleTopic(topicName)) return null;

  return {
    plan_number: String(start.rowNumber),
    section_title: "Учебно-календарный график",
    topic_name: topicName,
    hours_theory: null,
    hours_practice: null,
    hours_total: hoursTotal,
    activity_type: inferActivityType({
      topicName,
      controlForm: "",
      hoursTheory: null,
      hoursPractice: null,
    }),
    control_form: "",
    source_section: "academic-calendar-schedule",
    source_excerpt: sourceLines.join(" / ").slice(0, 1500),
    confidence: 0.86,
    raw_payload: {
      parser: "academic-calendar-schedule",
      row_number: start.rowNumber,
      plan_number: String(start.rowNumber),
      parsed_lines: sourceLines,
    },
  };
}

function splitAcademicCalendarScheduleHourLine(line) {
  const text = cleanupLine(line);
  const match = text.match(
    /^(?:(.+?)\s+)?(\d+(?:[,.]\d+)?)(?:\s+(?=МБОУ|им\.|лесн|стадион|Анализ|Наблюдение|Опрос|Мониторинг|контроль|Подведение|Осмотр|опрос|наблюдение|анализ|результатов|контроль|техники).*)?$/iu,
  );
  if (!match) return null;

  const hoursTotal = parseHourCell(match[2]);
  if (hoursTotal == null || hoursTotal <= 0 || hoursTotal > 12) return null;

  return {
    topicPart: cleanupLine(match[1] || ""),
    hoursTotal,
  };
}

function isAcademicCalendarScheduleHeaderLine(line) {
  return /^(?:№|п\/?п|месяц|число|время|проведения|тема\s+занятия|кол-?|во|часов|место|форма|контроля)$/iu.test(
    cleanupLine(line),
  );
}

function isAcademicCalendarScheduleStopLine(line) {
  return /^(?:приложение|контрольные\s+нормативы|итого|список\s+литературы|литература|методическ|материально)/iu.test(
    cleanupLine(line),
  );
}

function extractSectionTopicHourPlanRows(lines) {
  const startIndex = findSectionTopicHourPlanHeaderIndex(lines);
  if (startIndex < 0) return [];

  const rows = [];
  let explicitTotal = null;
  let index = startIndex + 1;

  while (index < lines.length) {
    const line = cleanupLine(lines[index]);
    if (!line || isSectionTopicHourPlanHeaderLine(line)) {
      index += 1;
      continue;
    }

    const total = parseSectionTopicHourPlanTotalLine(lines, index);
    if (total) {
      explicitTotal = total;
      break;
    }
    if (rows.length > 0 && isSectionTopicHourPlanStopLine(line)) break;

    const parsed = parseSectionTopicHourPlanRowAt(lines, index);
    if (!parsed) {
      index += 1;
      continue;
    }

    rows.push(parsed.row);
    index = parsed.nextIndex;
  }

  return selectValidatedSectionTopicHourRows(rows, explicitTotal);
}

function findSectionTopicHourPlanHeaderIndex(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!/наименование\s+раздела\s*,?\s*темы/iu.test(line)) continue;

    const window = lines
      .slice(index, index + 14)
      .map(cleanupLine)
      .join(" ");
    if (!/кол\s*[–-]\s*во\s+часов|кол-?во\s+часов/iu.test(window)) continue;
    if (
      !hasTotalHoursHeader(window) ||
      !hasSectionTopicHourPlanTheoryHeader(window) ||
      !hasSectionTopicHourPlanPracticeHeader(window)
    ) {
      continue;
    }

    const hasRows = lines
      .slice(index + 1, index + 80)
      .some((line) => parseSectionTopicHourPlanThreeCellSegment([cleanupLine(line)]));
    if (hasRows) return index;
  }

  return -1;
}

function parseSectionTopicHourPlanRowAt(lines, startIndex) {
  const firstLine = cleanupLine(lines[startIndex]);
  if (!firstLine || isSectionTopicHourPlanHeaderLine(firstLine)) return null;

  const finalRow = parseSectionTopicHourPlanFinalRow(firstLine);
  if (finalRow) {
    return {
      nextIndex: startIndex + 1,
      row: finalRow,
    };
  }

  const segment = [];
  for (let index = startIndex; index < Math.min(lines.length, startIndex + 8); index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line || isSectionTopicHourPlanHeaderLine(line)) continue;
    if (parseSectionTopicHourPlanTotalLine(lines, index) || isSectionTopicHourPlanStopLine(line)) break;
    if (index > startIndex && shouldStopSectionTopicHourPlanSegment(line)) break;

    segment.push(line);
    const row = parseSectionTopicHourPlanThreeCellSegment(segment);
    if (row) {
      return {
        nextIndex: index + 1,
        row,
      };
    }
  }

  return null;
}

function parseSectionTopicHourPlanThreeCellSegment(segment) {
  const text = cleanupLine(segment.join(" "));
  const match = text.match(/^(.+?)\s+(\d+(?:[,.]\d+)?)\s+(\d+(?:[,.]\d+)?)\s+(\d+(?:[,.]\d+)?)(?:\s+(.+))?$/u);
  if (!match) return null;

  const rawTitle = cleanupSectionTopicHourPlanTitle(match[1]);
  if (!rawTitle || /^\d+(?:\s|-|$)/u.test(rawTitle)) return null;
  if (/\d/u.test(rawTitle)) return null;

  const topicName = cleanupSectionTopicHourPlanTopicName(rawTitle);
  const allowGenericTopic = isAllowedSectionTopicHourPlanTopic(topicName);
  if (!isValidTopic(topicName) && !allowGenericTopic) return null;

  const hoursTotal = parseHourCell(match[2]);
  const hoursTheory = parseHourCell(match[3]);
  const hoursPractice = parseHourCell(match[4]);
  if (!isPlausibleHours(hoursTheory, hoursPractice, hoursTotal)) return null;
  if (Math.abs(hoursTheory + hoursPractice - hoursTotal) > 0.01) return null;

  return buildSectionTopicHourPlanRow({
    topicName,
    hoursTotal,
    hoursTheory,
    hoursPractice,
    controlForm: match[5] || "",
    parsedLines: segment,
    allowGenericTopic,
  });
}

function parseSectionTopicHourPlanFinalRow(line) {
  const match = cleanupLine(line).match(/^\d{1,3}\s+(итоговое\s+занятие)\s+(\d+(?:[,.]\d+)?)\s+(\d+(?:[,.]\d+)?)(?:\s+(.+))?$/iu);
  if (!match) return null;

  const hoursTotal = parseHourCell(match[2]);
  const hoursTheory = parseHourCell(match[3]);
  if (hoursTotal == null || hoursTheory == null || hoursTheory > hoursTotal) return null;

  return buildSectionTopicHourPlanRow({
    topicName: cleanupSectionTopicHourPlanTopicName(match[1]),
    hoursTotal,
    hoursTheory,
    hoursPractice: roundHour(hoursTotal - hoursTheory),
    controlForm: match[4] || "",
    parsedLines: [line],
  });
}

function buildSectionTopicHourPlanRow({ topicName, hoursTotal, hoursTheory, hoursPractice, controlForm, parsedLines, allowGenericTopic = false }) {
  return {
    section_title: "Учебный план",
    topic_name: topicName,
    hours_theory: hoursTheory,
    hours_practice: hoursPractice,
    hours_total: hoursTotal,
    activity_type: inferLessonThematicPlanningActivityType({
      hoursTheory,
      hoursPractice,
    }),
    control_form: cleanupControlForm(controlForm || ""),
    source_section: "section-topic-hour-plan",
    source_excerpt: parsedLines.join(" / ").slice(0, 1500),
    confidence: 0.88,
    raw_payload: {
      parser: "section-topic-hour-plan",
      parsed_lines: parsedLines,
      ...(allowGenericTopic ? { allow_generic_topic: true } : {}),
    },
  };
}

function selectValidatedSectionTopicHourRows(rows, explicitTotal) {
  if (!explicitTotal || rows.length < 8) return [];

  const total = sumTopicHoursTotal(rows);
  const theory = rows.reduce((sum, row) => sum + Number(row.hours_theory || 0), 0);
  const practice = rows.reduce((sum, row) => sum + Number(row.hours_practice || 0), 0);
  if (
    Math.abs(total - explicitTotal.hoursTotal) > 0.01 ||
    Math.abs(theory - explicitTotal.hoursTheory) > 0.01 ||
    Math.abs(practice - explicitTotal.hoursPractice) > 0.01
  ) {
    return [];
  }

  return rows.map((row, index) => ({
    ...row,
    plan_number: String(index + 1),
    raw_payload: {
      ...(row.raw_payload || {}),
      plan_number: String(index + 1),
      validated_total_line: explicitTotal.source,
    },
  }));
}

function extractNestedSectionTopicHourPlanRows(lines) {
  const startIndex = findSectionTopicHourPlanHeaderIndex(lines);
  if (startIndex < 0) return [];

  const groups = [];
  const standaloneChildren = [];
  let currentGroup = null;
  let explicitTotal = null;
  let index = startIndex + 1;

  while (index < lines.length) {
    const line = cleanupLine(lines[index]);
    if (!line || isSectionTopicHourPlanHeaderLine(line)) {
      index += 1;
      continue;
    }

    const total = parseSectionTopicHourPlanTotalLine(lines, index);
    if (total) {
      explicitTotal = total;
      break;
    }

    if ((groups.length > 0 || currentGroup?.children.length > 0) && isSectionTopicHourPlanStopLine(line)) break;

    const childStart = parseNestedSectionTopicHourPlanChildStart(lines, index);
    const parent = !childStart ? parseSectionTopicHourPlanRowAt(lines, index) : null;
    if (parent) {
      if (currentGroup) groups.push(currentGroup);
      currentGroup = {
        parent: parent.row,
        children: [],
      };
      index = parent.nextIndex;
      continue;
    }

    const child = parseNestedSectionTopicHourPlanChildAt(lines, index);
    if (child) {
      if (currentGroup && isNestedSectionTopicParentFilled(currentGroup)) {
        groups.push(currentGroup);
        currentGroup = null;
      }

      if (currentGroup) {
        currentGroup.children.push(child);
      } else {
        standaloneChildren.push(child);
      }
      index = child.nextIndex;
      continue;
    }

    index += 1;
  }

  if (currentGroup) groups.push(currentGroup);

  const rows = [];
  for (const group of groups) {
    rows.push(...finalizeNestedSectionTopicHourPlanGroup(group));
  }
  for (const child of standaloneChildren) {
    const row = buildStandaloneNestedSectionTopicHourPlanRow(child);
    if (row) rows.push(row);
  }

  if (rows.length < 20) return [];
  if (explicitTotal && !matchesSectionTopicExplicitTotal(rows, explicitTotal)) return [];

  return rows.map((row, rowIndex) => ({
    ...row,
    topic_order: rowIndex + 1,
  }));
}

function parseNestedSectionTopicHourPlanChildAt(lines, startIndex) {
  const start = parseNestedSectionTopicHourPlanChildStart(lines, startIndex);
  if (!start) return null;

  const parts = start.title ? [start.title] : [];
  const rawLines = [...start.rawLines];
  let index = start.nextIndex;

  while (index < lines.length) {
    const line = cleanupLine(lines[index]);
    if (!line || isSectionTopicHourPlanHeaderLine(line)) {
      index += 1;
      continue;
    }
    if (parseSectionTopicHourPlanTotalLine(lines, index) || isSectionTopicHourPlanStopLine(line)) break;
    const nextChildStart = parseNestedSectionTopicHourPlanChildStart(lines, index);
    if (nextChildStart && nextChildStart.startNumber > start.endNumber) break;
    if (parseSectionTopicHourPlanRowAt(lines, index)) break;

    parts.push(line);
    rawLines.push(line);
    index += 1;
    if (parts.length > 10) break;
  }

  const parsed = parseNestedSectionTopicHourPlanChildSegment({
    ...start,
    parts,
    rawLines,
  });
  if (!parsed) return null;

  return {
    ...parsed,
    nextIndex: index,
  };
}

function parseNestedSectionTopicHourPlanChildStart(lines, index) {
  const line = cleanupLine(lines[index]);
  if (!line || PAGE_NUMBER_RE.test(line) || isSectionTopicHourPlanHeaderLine(line)) return null;

  const direct = line.match(/^(\d{1,3})(?:\s*(-)\s*(\d{1,3})?)?\s*(.*)$/u);
  if (direct) {
    return buildNestedSectionTopicHourPlanChildStart({
      lines,
      index,
      rawLine: line,
      startNumber: direct[1],
      hasDash: Boolean(direct[2]),
      endNumber: direct[3],
      title: direct[4] || "",
      prefixed: false,
    });
  }

  const trailingRange = line.match(/^.+?\s+(\d{1,3})\s*-\s*$/u);
  if (trailingRange) {
    return buildNestedSectionTopicHourPlanChildStart({
      lines,
      index,
      rawLine: `${trailingRange[1]}-`,
      startNumber: trailingRange[1],
      hasDash: true,
      endNumber: null,
      title: "",
      prefixed: true,
    });
  }

  const prefixed = line.match(
    /^(?:(?:наблюдение|опрос|беседа|контроль|анкета|тестировани[ея]|демонстраци[яи]|презентаци[яи]|результаты|творческ(?:ий|ая|ое)|отч[её]т|викторина)[^0-9]{0,120})\s+(\d{1,3})(?:\s*(-)\s*(\d{1,3})?)?\s+(.+)$/iu,
  );
  if (!prefixed) return null;

  return buildNestedSectionTopicHourPlanChildStart({
    lines,
    index,
    rawLine: line,
    startNumber: prefixed[1],
    hasDash: Boolean(prefixed[2]),
    endNumber: prefixed[3],
    title: prefixed[4] || "",
    prefixed: true,
  });
}

function buildNestedSectionTopicHourPlanChildStart({
  lines,
  index,
  rawLine,
  startNumber,
  hasDash,
  endNumber,
  title,
  prefixed,
}) {
  const start = Number(startNumber);
  if (!Number.isInteger(start) || start <= 0 || start > 200) return null;

  let end = endNumber ? Number(endNumber) : start;
  let nextIndex = index + 1;
  const titleParts = [cleanupLine(title)].filter(Boolean);
  const rawLines = [rawLine];

  if (hasDash && !endNumber) {
    const nextLine = cleanupLine(lines[nextIndex] || "");
    const nextMatch = nextLine.match(/^(\d{1,3})(?:\s+(.+))?$/u);
    if (!nextMatch) return null;

    end = Number(nextMatch[1]);
    if (nextMatch[2]) titleParts.push(nextMatch[2]);
    rawLines.push(nextLine);
    nextIndex += 1;
  }

  if (!Number.isInteger(end) || end < start || end > 200 || end - start > 30) return null;
  if (!hasDash && !/[A-ZА-ЯЁа-яё]/u.test(cleanupLine(titleParts.join(" ")))) return null;

  return {
    startNumber: start,
    endNumber: end,
    planNumber: start === end ? String(start) : `${start}-${end}`,
    title: cleanupLine(titleParts.join(" ")),
    rawLines,
    nextIndex,
    prefixed,
  };
}

function parseNestedSectionTopicHourPlanChildSegment(child) {
  const text = cleanupLine((child.parts || []).join(" "));
  if (!text) return null;

  const numberPattern = "(\\d+(?:[,.]\\d+)?)";
  const match = text.match(new RegExp(`^(.+?)\\s+${numberPattern}(?:\\s+${numberPattern})?(?:\\s+${numberPattern})?(?:\\s+(.+))?$`, "u"));
  if (!match) return null;

  const rawValues = [match[2], match[3], match[4]]
    .filter((value) => value != null)
    .map(parseHourCell)
    .filter((value) => value != null);
  if (!rawValues.length || rawValues.some((value) => value < 0 || value > 200)) return null;

  const topicName = cleanupSectionTopicHourPlanTopicName(match[1]);
  if (!isValidTopic(topicName) && !isAllowedSectionTopicHourPlanTopic(topicName)) return null;
  if (isTotalTopicName(topicName) || isServiceOnlyTopicName(topicName)) return null;

  return {
    startNumber: child.startNumber,
    endNumber: child.endNumber,
    planNumber: child.planNumber,
    topicName,
    rawHourValues: rawValues,
    controlForm: cleanupControlForm(match[5] || ""),
    rawLines: child.rawLines,
    sourceExcerpt: child.rawLines.join(" / ").slice(0, 1500),
  };
}

function isNestedSectionTopicParentFilled(group) {
  if (!group?.parent || !group.children?.length) return false;
  const expected = normalizeNullableHour(group.parent.hours_total);
  if (expected == null) return false;
  return sumNestedSectionTopicRawTotals(group.children) >= expected - 0.01;
}

function sumNestedSectionTopicRawTotals(children) {
  return children.reduce((sum, child) => {
    if (!child.rawHourValues?.length) return sum;
    if (child.rawHourValues.length === 1) return sum + child.rawHourValues[0];
    if (isFinalNestedSectionTopicChild(child)) return sum + child.rawHourValues[0];
    return sum + child.rawHourValues.reduce((childSum, value) => childSum + value, 0);
  }, 0);
}

function finalizeNestedSectionTopicHourPlanGroup(group) {
  const parent = group.parent;
  const children = group.children || [];
  if (!parent || children.length < 1) return [];

  const parentTotal = normalizeNullableHour(parent.hours_total);
  const parentTheory = normalizeNullableHour(parent.hours_theory) || 0;
  const parentPractice = normalizeNullableHour(parent.hours_practice) || 0;
  if (parentTotal == null || Math.abs(sumNestedSectionTopicRawTotals(children) - parentTotal) > 0.01) return [];

  let remainingTheory = parentTheory;
  let remainingPractice = parentPractice;
  const rows = [];

  children.forEach((child, childIndex) => {
    const values = child.rawHourValues || [];
    let hoursTheory = 0;
    let hoursPractice = 0;
    let hoursTotal = 0;
    let allocation = "";

    if (values.length >= 2) {
      hoursTheory = values[0];
      hoursPractice = values[1];
      hoursTotal = roundHour(hoursTheory + hoursPractice);
      allocation = "split theory/practice cells";
    } else {
      hoursTotal = values[0];
      const futurePairs = sumNestedSectionTopicFuturePairHours(children.slice(childIndex + 1));
      const theoryCapacity = Math.max(0, roundHour(remainingTheory - futurePairs.theory));
      if (theoryCapacity >= hoursTotal - 0.01) {
        hoursTheory = hoursTotal;
        allocation = "single hour cell assigned to theory";
      } else {
        hoursPractice = hoursTotal;
        allocation = "single hour cell assigned to practice";
      }
    }

    remainingTheory = roundHour(remainingTheory - hoursTheory);
    remainingPractice = roundHour(remainingPractice - hoursPractice);

    rows.push(
      buildNestedSectionTopicHourPlanRow({
        child,
        parent,
        hoursTotal,
        hoursTheory,
        hoursPractice,
        allocation,
      }),
    );
  });

  if (!matchesSectionTopicExplicitTotal(rows, {
    hoursTotal: parentTotal,
    hoursTheory: parentTheory,
    hoursPractice: parentPractice,
  })) {
    return [];
  }

  return rows;
}

function sumNestedSectionTopicFuturePairHours(children) {
  return children.reduce(
    (sum, child) => {
      const values = child.rawHourValues || [];
      if (values.length >= 2 && !isFinalNestedSectionTopicChild(child)) {
        sum.theory += values[0];
        sum.practice += values[1];
      }
      return sum;
    },
    { theory: 0, practice: 0 },
  );
}

function buildStandaloneNestedSectionTopicHourPlanRow(child) {
  const values = child.rawHourValues || [];
  if (!values.length) return null;

  let hoursTotal = values[0];
  let hoursTheory = 0;
  let hoursPractice = 0;
  let allocation = "standalone total cell";

  if (values.length >= 3) {
    hoursTotal = values[0];
    hoursTheory = values[1];
    hoursPractice = values[2];
    allocation = "standalone total/theory/practice cells";
  } else if (values.length >= 2 && isFinalNestedSectionTopicChild(child)) {
    hoursTotal = values[0];
    hoursTheory = values[1];
    hoursPractice = Math.max(0, roundHour(hoursTotal - hoursTheory));
    allocation = "standalone final total/theory cells";
  } else if (values.length >= 2) {
    hoursTheory = values[0];
    hoursPractice = values[1];
    hoursTotal = roundHour(hoursTheory + hoursPractice);
    allocation = "standalone theory/practice cells";
  }

  return buildNestedSectionTopicHourPlanRow({
    child,
    parent: null,
    hoursTotal,
    hoursTheory,
    hoursPractice,
    allocation,
  });
}

function buildNestedSectionTopicHourPlanRow({ child, parent, hoursTotal, hoursTheory, hoursPractice, allocation }) {
  return {
    plan_number: child.planNumber,
    section_title: parent?.topic_name || "Учебный план",
    topic_name: child.topicName,
    hours_theory: hoursTheory,
    hours_practice: hoursPractice,
    hours_total: hoursTotal,
    activity_type: inferLessonThematicPlanningActivityType({
      hoursTheory,
      hoursPractice,
    }),
    control_form: child.controlForm,
    source_section: "section-topic-nested-hour-plan",
    source_excerpt: child.sourceExcerpt,
    confidence: 0.9,
    raw_payload: {
      parser: "section-topic-nested-hour-plan",
      plan_number: child.planNumber,
      raw_hour_values: child.rawHourValues,
      parsed_lines: child.rawLines,
      allocation,
      ...(parent
        ? {
            parent_topic_name: parent.topic_name,
            parent_hours_total: parent.hours_total,
            parent_hours_theory: parent.hours_theory,
            parent_hours_practice: parent.hours_practice,
          }
        : {}),
      ...(isAllowedSectionTopicHourPlanTopic(child.topicName) ? { allow_generic_topic: true } : {}),
    },
  };
}

function matchesSectionTopicExplicitTotal(rows, expected) {
  const total = sumTopicHoursTotal(rows);
  const theory = rows.reduce((sum, row) => sum + Number(row.hours_theory || 0), 0);
  const practice = rows.reduce((sum, row) => sum + Number(row.hours_practice || 0), 0);
  return (
    Math.abs(total - expected.hoursTotal) <= 0.01 &&
    Math.abs(theory - expected.hoursTheory) <= 0.01 &&
    Math.abs(practice - expected.hoursPractice) <= 0.01
  );
}

function isFinalNestedSectionTopicChild(child) {
  return /^итоговое\s+занятие$/iu.test(cleanupLine(child?.topicName || ""));
}

function parseSectionTopicHourPlanTotalLine(lines, startIndex) {
  const line = cleanupLine(lines[startIndex]);
  const next = cleanupLine(lines[startIndex + 1] || "");
  const afterNext = cleanupLine(lines[startIndex + 2] || "");
  const text = cleanupLine([line, next, afterNext].join(" "));
  if (!/итогов(?:ый|ого)\s+контроль/iu.test(text) && !/^итого(?:\s|:|$)/iu.test(text)) return null;

  const match = text.match(/(\d+(?:[,.]\d+)?)\s+(\d+(?:[,.]\d+)?)\s+(\d+(?:[,.]\d+)?)(?:\s*)$/u);
  if (!match) return null;

  return {
    hoursTotal: parseHourCell(match[1]),
    hoursTheory: parseHourCell(match[2]),
    hoursPractice: parseHourCell(match[3]),
    source: text,
  };
}

function cleanupSectionTopicHourPlanTitle(value) {
  return cleanupLine(value)
    .replace(/([А-ЯЁа-яё])-+\s+([А-ЯЁа-яё])/gu, "$1$2")
    .replace(/^[а-яё,\s-]{3,80}\s+(?=[А-ЯЁ])/u, "")
    .trim();
}

function cleanupSectionTopicHourPlanTopicName(value) {
  return cleanupTopicName(value)
    .replace(/([А-ЯЁа-яё])-+\s+([А-ЯЁа-яё])/gu, "$1$2")
    .replace(/([Пп])оисковособирательск/gu, "$1оисково-собирательск")
    .replace(/\s+/g, " ")
    .trim();
}

function isAllowedSectionTopicHourPlanTopic(topicName) {
  return /^литературные\s+источники\s+по\s+краеведению\s+и\s+музееведению$/iu.test(cleanupLine(topicName));
}

function shouldStopSectionTopicHourPlanSegment(line) {
  const cleaned = cleanupLine(line);
  if (/^\d+(?:[,.]\d+)?\s+\d+(?:[,.]\d+)?\s+\d+(?:[,.]\d+)?(?:\s+.*)?$/u.test(cleaned)) return false;
  return (
    isLikelySectionTopicHourPlanChildLine(cleaned) ||
    /^(?:Беседа|Наблюдение|Опрос|Демонстрация|Презентация|Результаты|Творческий|контроль|тестирование)\b/iu.test(cleaned)
  );
}

function isLikelySectionTopicHourPlanChildStart(lines, index) {
  const line = cleanupLine(lines[index]);
  if (isLikelySectionTopicHourPlanChildLine(line)) return true;
  if (/^.+?\s+\d+(?:[,.]\d+)?(?:\s+\d+(?:[,.]\d+)?)?(?:\s+.+)?$/u.test(line) && !/\s+\d+(?:[,.]\d+)?\s+\d+(?:[,.]\d+)?\s+\d+(?:[,.]\d+)?/u.test(line)) {
    return true;
  }

  const previous = cleanupLine(lines[index - 1] || "");
  const previousPair = cleanupLine(`${lines[index - 2] || ""} ${lines[index - 1] || ""}`);
  return /^\d{1,3}-?$/u.test(previous) || /^\d{1,3}-\s*\d{1,3}$/u.test(previousPair);
}

function isLikelySectionTopicHourPlanChildLine(line) {
  const cleaned = cleanupLine(line);
  if (/^\d+(?:[,.]\d+)?\s+\d+(?:[,.]\d+)?\s+\d+(?:[,.]\d+)?(?:\s+.*)?$/u.test(cleaned)) return false;
  return /^(?:\d{1,3}(?:-\d{1,3})?|\d{1,3}-)\s+/u.test(cleaned);
}

function hasSectionTopicHourPlanTheoryHeader(value) {
  return /тео\s*-?\s*рия|(?:^|\s)тео(?:\s|-|$)|теор/iu.test(String(value || ""));
}

function hasSectionTopicHourPlanPracticeHeader(value) {
  return /пра\s*к\s*тик\s*а|прак\s*-?\s*тика|практ|(?:^|\s)пра(?:\s|$)/iu.test(String(value || ""));
}

function isSectionTopicHourPlanHeaderLine(line) {
  const cleaned = cleanupLine(line);
  return /^(?:№|п\/?п|наименование\s+раздела\s*,?\s*темы|кол\s*[–-]\s*во\s+часов|формы?\s+аттеста|ции\/контроля|все|го|из\s+них|тео-?|рия|пра|к|тик|а)$/iu.test(
    cleaned,
  );
}

function isSectionTopicHourPlanStopLine(line) {
  return /^(?:содержание\s+учебного\s+плана|содержание\s+программы|условия\s+реализации|методическ|материально|список\s+литературы|литература|приложение)/iu.test(
    cleanupLine(line),
  );
}

function extractTopicHeadingHourRows(lines) {
  const rows = [];
  const startIndex = findTopicHeadingHourStartIndex(lines);
  if (startIndex < 0) return rows;

  let currentSection = "";

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line || PAGE_NUMBER_RE.test(line)) continue;
    if (rows.length > 0 && isTopicHeadingHourStopLine(line)) break;

    const row = parseTopicHeadingHourLine(line);
    if (!row) continue;

    if (/^раздел\s+\d+/iu.test(row.rawPrefix)) {
      currentSection = row.topic_name;
    }

    rows.push({
      ...row,
      section_title: currentSection || row.section_title,
    });
  }

  return rows;
}

function extractContentHeadingHourRows(lines) {
  const rows = [];
  let started = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line) continue;

    if (!started && parseContentHeadingHourLine(line)) {
      started = true;
    }
    if (!started) continue;
    if (rows.length > 0 && isTopicHeadingHourStopLine(line)) break;

    const row = parseContentHeadingHourLine(line);
    if (row) {
      const nextLine = cleanupLine(lines[index + 1] || "");
      if (/^практическ(?:ие|ое|ая)\s+занят/iu.test(nextLine)) {
        row.hours_theory = 0;
        row.hours_practice = row.hours_total;
        row.activity_type = "практика";
      }
      rows.push(row);
    }
  }

  return rows.length >= 3 ? rows : [];
}

function parseContentHeadingHourLine(line) {
  const cleaned = cleanupLine(line);
  const match = cleaned.match(/^(.{3,180}?)\s*\(\s*(\d+(?:[,.]\d+)?)\s*час(?:а|ов)?\.?\s*\)\.?$/iu);
  if (!match) return null;
  if (/^(?:итого|всего|общее|количество|форма|теория|практика|структур)/iu.test(match[1])) return null;

  const topicName = cleanupTopicName(match[1]);
  if (!isValidTopic(topicName)) return null;
  const hoursTotal = parseHourCell(match[2]);
  if (hoursTotal == null || hoursTotal <= 0 || hoursTotal > 300) return null;

  return {
    section_title: "Содержание программы",
    topic_name: topicName,
    hours_theory: null,
    hours_practice: null,
    hours_total: hoursTotal,
    activity_type: "не определено",
    control_form: "",
    source_section: "content-heading-hours",
    source_excerpt: cleaned.slice(0, 1500),
    confidence: 0.7,
    raw_payload: {
      parser: "content-heading-hours",
    },
  };
}

function findTopicHeadingHourStartIndex(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!/^содержание\s+(?:учебного\s+плана|программы|курса|учебного\s+курса)\.?$/iu.test(line)) continue;

    const window = lines
      .slice(index + 1, index + 30)
      .map(cleanupLine)
      .join(" ");
    if (/(?:тема|раздел)\s*\d+\s*[.:].+?\(\s*\d+(?:[,.]\d+)?\s*ч/iu.test(window)) {
      return index;
    }
  }

  return -1;
}

function parseTopicHeadingHourLine(line) {
  const cleaned = cleanupLine(line);
  const match = cleaned.match(
    /^((?:тема|раздел)\s*\d+(?:\.\d+)?\s*[.:]?)\s*(.+?)\s*\(\s*(\d+(?:[,.]\d+)?)\s*ч(?:ас(?:а|ов)?)?\.?\s*\)\.?$/iu,
  );
  if (!match) return null;

  const topicName = cleanupTopicName(`${match[1]} ${match[2]}`);
  if (!isValidTopic(topicName)) return null;

  const hoursTotal = parseHourCell(match[3]);
  if (hoursTotal == null || hoursTotal <= 0 || hoursTotal > 300) return null;

  return {
    rawPrefix: cleanupLine(match[1]),
    section_title: "Содержание программы",
    topic_name: topicName,
    hours_theory: null,
    hours_practice: null,
    hours_total: hoursTotal,
    activity_type: "не определено",
    control_form: "",
    source_section: "topic-heading-hours",
    source_excerpt: cleaned.slice(0, 1500),
    confidence: 0.82,
    raw_payload: {
      parser: "topic-heading-hours",
      prefix: cleanupLine(match[1]),
    },
  };
}

function isTopicHeadingHourStopLine(line) {
  return /^(?:планируемые\s+результаты|методическ|материально|список\s+литературы|литература|приложение|формы\s+организации)/iu.test(
    cleanupLine(line),
  );
}

function extractTitleFirstCellWiseStudyPlanRows(lines) {
  const startIndex = findTitleFirstCellWiseStudyPlanHeaderIndex(lines);
  if (startIndex < 0) return [];

  const rows = [];
  let index = startIndex + 1;

  while (index < lines.length) {
    const line = cleanupLine(lines[index]);
    if (!line || PAGE_NUMBER_RE.test(line) || isTitleFirstCellWiseHeaderLine(line)) {
      index += 1;
      continue;
    }
    if (rows.length > 0 && isBasicStudyPlanStopLine(line)) break;
    if (/^всего/iu.test(line)) break;
    if (TOTAL_RE.test(line)) {
      index = skipTitleFirstCellWiseTotalBlock(lines, index + 1);
      continue;
    }

    const parsed = parseTitleFirstCellWiseRow(lines, index);
    if (!parsed) {
      index += 1;
      continue;
    }

    rows.push(parsed.row);
    index = parsed.nextIndex;
  }

  return removeBasicStudyPlanParentRows(rows);
}

function skipTitleFirstCellWiseTotalBlock(lines, startIndex) {
  let index = startIndex;
  while (index < lines.length) {
    const line = cleanupLine(lines[index]);
    if (!line || isTitleFirstCellWiseHeaderLine(line) || isCellWiseHourCell(line)) {
      index += 1;
      continue;
    }
    break;
  }
  return index;
}

function findTitleFirstCellWiseStudyPlanHeaderIndex(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!/учебн(?:ый|ого)\s+план|учебн[оы]\s*[- ]?\s*тематическ(?:ий|ого)?\s+план/iu.test(line)) continue;

    const windowLines = lines.slice(index, index + 20).map(cleanupLine);
    const window = windowLines.join(" ");
    if (!/наименование\s+разделов\s+и\s+тем|наименование\s+раздела|название\s+раздела/iu.test(window)) continue;
    if (!/всего/iu.test(window) || !/теори[яи]/iu.test(window) || !/практ/iu.test(window)) continue;

    const afterHeader = lines.slice(index + 1, index + 45).map(cleanupLine);
    const titleBeforeHours = afterHeader.some(
      (candidate, candidateIndex) =>
        isValidTopic(cleanupTopicName(candidate)) &&
        afterHeader.slice(candidateIndex + 1, candidateIndex + 4).filter(isCellWiseHourCell).length >= 3,
    );
    if (titleBeforeHours) return index;
  }

  return -1;
}

function parseTitleFirstCellWiseRow(lines, startIndex) {
  const firstTitleLine = cleanupLine(lines[startIndex]);
  if (
    !firstTitleLine ||
    isTitleFirstCellWiseHeaderLine(firstTitleLine) ||
    isTitleFirstCellWisePlanMarker(firstTitleLine) ||
    (
      hasPreviousTitleFirstIntegerMarker(lines, startIndex) &&
      isLikelyTitleFirstSectionHeading(firstTitleLine)
    )
  ) {
    return null;
  }

  const titleLines = [firstTitleLine];
  const hourCells = [];
  const hourLines = [];
  let cursor = startIndex + 1;

  while (cursor < lines.length) {
    const line = cleanupLine(lines[cursor]);
    if (!line || isTitleFirstCellWiseHeaderLine(line)) return null;
    if (isCellWiseHourCell(line)) break;
    if (
      TOTAL_RE.test(line) ||
      isTitleFirstCellWisePlanMarker(line) ||
      isBasicStudyPlanStopLine(line)
    ) {
      return null;
    }
    titleLines.push(line);
    cursor += 1;
  }

  const title = cleanupBasicStudyPlanTopicName(titleLines.join(" "));
  if (!isValidTopic(title)) return null;

  while (cursor < lines.length && hourCells.length < 3) {
    const line = cleanupLine(lines[cursor]);
    if (!line || isTitleFirstCellWiseHeaderLine(line)) {
      cursor += 1;
      continue;
    }
    if (!isCellWiseHourCell(line)) return null;
    hourCells.push(parseHourCell(line));
    hourLines.push(line);
    cursor += 1;
  }

  const hours = mapCellWiseStudyPlanHours(hourCells);
  if (!hours) return null;

  let planNumber = "";
  if (isTitleFirstCellWiseRowNumber(cleanupLine(lines[cursor]))) {
    planNumber = cleanupLine(lines[cursor]);
    cursor += 1;
  }

  return {
    nextIndex: cursor,
    row: {
      plan_number: planNumber,
      section_title: "Учебный план",
      topic_name: title,
      hours_theory: hours.hoursTheory,
      hours_practice: hours.hoursPractice,
      hours_total: hours.hoursTotal,
      activity_type: inferLessonThematicPlanningActivityType({
        hoursTheory: hours.hoursTheory,
        hoursPractice: hours.hoursPractice,
      }),
      control_form: "",
      source_section: "title-first-cell-wise-study-plan",
      source_excerpt: [...titleLines, ...hourLines, planNumber].filter(Boolean).join(" / ").slice(0, 1500),
      confidence: 0.8,
      raw_payload: {
        parser: "title-first-cell-wise-study-plan",
        plan_number: planNumber,
        parsed_hour_cells: hourLines,
      },
    },
  };
}

function isTitleFirstCellWisePlanMarker(line) {
  const cleaned = cleanupLine(line);
  return /^\d+(?:\.\d+)*\.?$/u.test(cleaned);
}

function hasPreviousTitleFirstIntegerMarker(lines, startIndex) {
  for (let cursor = startIndex - 1; cursor >= 0 && startIndex - cursor <= 8; cursor -= 1) {
    const line = cleanupLine(lines[cursor]);
    if (!line || isTitleFirstCellWiseHeaderLine(line)) continue;
    return /^\d+\.?$/u.test(line);
  }
  return false;
}

function isLikelyTitleFirstSectionHeading(line) {
  const cleaned = cleanupLine(line);
  return cleaned.length <= 80 && !/[.:;!?«»()]/u.test(cleaned);
}

function isTitleFirstCellWiseHeaderLine(line) {
  const cleaned = cleanupLine(line);
  return /^(?:№\s*п\/?п|№|наименование\s+разделов\s+и\s+тем|наименование\s+раздела|название\s+раздела|всего|кол-?во|часов|теория|практика|практ\.?|форма\s+аттестации.*)$/iu.test(
    cleaned,
  );
}

function isTitleFirstCellWiseRowNumber(line) {
  const number = Number(cleanupLine(line));
  return Number.isInteger(number) && number > 0 && number < 300;
}

function extractSimpleThematicPlanningRows(lines) {
  const startIndex = findSimpleThematicPlanningHeaderIndex(lines);
  if (startIndex < 0) return [];

  const rows = [];
  let index = startIndex + 1;

  while (index < lines.length) {
    const line = cleanupLine(lines[index]);
    if (!line || PAGE_NUMBER_RE.test(line) || isSimpleThematicPlanningHeaderLine(line)) {
      index += 1;
      continue;
    }
    if (rows.length > 0 && isSimpleThematicPlanningStopLine(line)) break;

    const parsed = parseSimpleThematicPlanningRow(lines, index);
    if (!parsed) {
      index += 1;
      continue;
    }

    rows.push(parsed.row);
    index = parsed.nextIndex;
  }

  return rows;
}

function findSimpleThematicPlanningHeaderIndex(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!/^тематическое\s+планирование$/iu.test(line)) continue;

    const window = lines
      .slice(index, index + 12)
      .map(cleanupLine)
      .join(" ");
    if (/тема\/раздел|академическ.+час/iu.test(window)) return index;
  }

  return -1;
}

function parseSimpleThematicPlanningRow(lines, startIndex) {
  const numberLine = cleanupLine(lines[startIndex]);
  const numberMatch = numberLine.match(/^(\d{1,3})(?:[.)])?(?:\s+(.+))?$/u);
  if (!numberMatch) return null;

  const titleParts = [];
  if (numberMatch[2]) titleParts.push(numberMatch[2]);
  let cursor = startIndex + 1;
  let hoursTotal = null;
  let hourLine = "";

  while (cursor < lines.length) {
    const line = cleanupLine(lines[cursor]);
    if (!line || PAGE_NUMBER_RE.test(line) || isSimpleThematicPlanningHeaderLine(line)) {
      cursor += 1;
      continue;
    }
    const leadingHours = line.match(/^(\d+(?:[,.]\d+)?)\s+(.+)$/u);
    if (leadingHours && titleParts.length > 0) {
      hoursTotal = parseHourCell(leadingHours[1]);
      hourLine = line;
      break;
    }
    if (parseSimpleThematicPlanningRowStart(line) && titleParts.length > 0) return null;
    if (isSingleHourLine(line)) {
      hoursTotal = parseHourCell(line);
      hourLine = line;
      break;
    }
    if (isSimpleThematicPlanningStopLine(line)) return null;
    titleParts.push(line);
    cursor += 1;
    if (titleParts.length > 4) break;
  }

  const topicName = cleanupTopicName(titleParts.join(" "));
  if (!isValidTopic(topicName) || hoursTotal == null || hoursTotal <= 0 || hoursTotal > 300) return null;

  return {
    nextIndex: cursor + 1,
    row: {
      plan_number: numberMatch[1],
      section_title: "Тематическое планирование",
      topic_name: topicName,
      hours_theory: null,
      hours_practice: null,
      hours_total: hoursTotal,
      activity_type: "не определено",
      control_form: "",
      source_section: "simple-thematic-planning",
      source_excerpt: [numberLine, ...titleParts, hourLine].join(" / ").slice(0, 1500),
      confidence: 0.78,
      raw_payload: {
        parser: "simple-thematic-planning",
        plan_number: numberMatch[1],
      },
    },
  };
}

function parseSimpleThematicPlanningRowStart(line) {
  return cleanupLine(line).match(/^(\d{1,3})(?:[.)])?(?:\s+.+)?$/u);
}

function isSimpleThematicPlanningHeaderLine(line) {
  return /^(?:№|п\/?п|тема\/раздел|количество|академических|часов|на\s+освоение\s+темы|деятельность\s+учителя.*)$/iu.test(
    cleanupLine(line),
  );
}

function isSimpleThematicPlanningStopLine(line) {
  return /^(?:всего|планируемые\s+результаты|учебно-методическое|методическ|материально|список\s+литературы|литература|приложение)/iu.test(
    cleanupLine(line),
  );
}

function extractMonthlySectionThematicPlanRows(lines) {
  const headerIndex = findMonthlySectionThematicPlanHeaderIndex(lines);
  if (headerIndex < 0) return [];

  const startIndex = findMonthlySectionThematicPlanStartIndex(lines, headerIndex);
  if (startIndex < 0) return [];

  const endIndex = findMonthlySectionThematicPlanEndIndex(lines, startIndex);
  const planTotal = extractMonthlySectionThematicPlanTotal(lines, startIndex, endIndex);
  const monthTotals = extractMonthlySectionThematicPlanMonthTotals(lines, startIndex, endIndex);
  const sections = extractMonthlySectionThematicPlanSections(lines, startIndex, endIndex);
  const rows = [];

  for (const section of sections) {
    const topics = splitMonthlySectionThematicPlanTopicLines(section.topicLines);
    topics.forEach((topicLines, topicIndex) => {
      const topicName = cleanupMonthlySectionThematicPlanTopicName(topicLines);
      if (!isValidTopic(topicName)) return;

      rows.push({
        plan_number: `${section.number}.${topicIndex + 1}`,
        section_title: section.title,
        topic_name: topicName,
        hours_theory: null,
        hours_practice: null,
        hours_total: 1,
        activity_type: inferActivityType({ topicName, controlForm: "", hoursTheory: null, hoursPractice: null }),
        control_form: "",
        source_section: "monthly-section-thematic-plan",
        source_excerpt: [section.title, ...topicLines].join(" / ").slice(0, 1500),
        confidence: 0.84,
        raw_payload: {
          parser: "monthly-section-thematic-plan",
          plan_number: `${section.number}.${topicIndex + 1}`,
          section_number: String(section.number),
          topic_index: topicIndex + 1,
          month_totals: monthTotals,
          plan_total: planTotal,
          parsed_lines: topicLines,
        },
      });
    });
  }

  if (rows.length < 6) return [];
  const expectedTotal = planTotal ?? (monthTotals.length ? roundHour(monthTotals.reduce((sum, value) => sum + value, 0)) : null);
  if (expectedTotal != null && Math.abs(rows.length - expectedTotal) > 0.01) return [];

  return rows;
}

function findMonthlySectionThematicPlanHeaderIndex(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!/^учебно[-\s]*тематический\s+план$/iu.test(line)) continue;

    const window = lines
      .slice(index, index + 12)
      .map(cleanupLine)
      .join(" ");
    if (/месяц/iu.test(window) && /раздел/iu.test(window) && /июнь.*июль.*август/iu.test(window)) {
      return index;
    }
  }

  return -1;
}

function findMonthlySectionThematicPlanStartIndex(lines, headerIndex) {
  for (let index = headerIndex + 1; index < Math.min(lines.length, headerIndex + 24); index += 1) {
    const line = cleanupLine(lines[index]);
    if (/^\d{1,2}\.\s+[«"]/u.test(line)) return index;
  }
  return -1;
}

function findMonthlySectionThematicPlanEndIndex(lines, startIndex) {
  for (let index = startIndex; index < Math.min(lines.length, startIndex + 220); index += 1) {
    const line = cleanupLine(lines[index]);
    if (/^итого(?:\s|:|$)/iu.test(line)) return index + 1;
    if (index > startIndex + 20 && /^информационно[-\s]*методическое\s+обеспечение/iu.test(line)) return index;
  }
  return Math.min(lines.length, startIndex + 220);
}

function extractMonthlySectionThematicPlanTotal(lines, startIndex, endIndex) {
  for (let index = startIndex; index < endIndex; index += 1) {
    const match = cleanupLine(lines[index]).match(/^итого\s+(\d+(?:[,.]\d+)?)$/iu);
    if (!match) continue;
    return parseHourCell(match[1]);
  }
  return null;
}

function extractMonthlySectionThematicPlanMonthTotals(lines, startIndex, endIndex) {
  for (let index = startIndex; index < endIndex; index += 1) {
    const line = cleanupLine(lines[index]);
    const match = line.match(/^(\d+(?:[,.]\d+)?)\s+(\d+(?:[,.]\d+)?)\s+(\d+(?:[,.]\d+)?)$/u);
    if (!match) continue;
    const previous = lines
      .slice(Math.max(startIndex, index - 3), index)
      .map(cleanupLine)
      .join(" ");
    if (!/всего\s+часов\s+в\s+месяц/iu.test(previous)) continue;
    return [parseHourCell(match[1]), parseHourCell(match[2]), parseHourCell(match[3])].filter((value) => value != null);
  }
  return [];
}

function extractMonthlySectionThematicPlanSections(lines, startIndex, endIndex) {
  const sections = [];
  let current = null;

  for (let index = startIndex; index < endIndex; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line || PAGE_NUMBER_RE.test(line)) continue;
    if (/^(?:всего\s+часов|месяц|итого)(?:\s|$)/iu.test(line)) break;

    const sectionStart = parseMonthlySectionThematicPlanSectionStart(line);
    if (sectionStart) {
      if (current) sections.push(finalizeMonthlySectionThematicPlanSection(current));
      current = {
        number: sectionStart.number,
        titleLines: [sectionStart.title],
        topicLines: [],
        titleComplete: isCompleteMonthlySectionThematicPlanSectionTitle(sectionStart.title),
      };
      continue;
    }

    if (!current) continue;
    if (!current.titleComplete) {
      current.titleLines.push(line);
      current.titleComplete = isCompleteMonthlySectionThematicPlanSectionTitle(current.titleLines.join(" "));
      continue;
    }

    current.topicLines.push(line);
  }

  if (current) sections.push(finalizeMonthlySectionThematicPlanSection(current));
  return sections.filter((section) => section.title && section.topicLines.length);
}

function parseMonthlySectionThematicPlanSectionStart(line) {
  const match = cleanupLine(line).match(/^(\d{1,2})\.\s+(.+)$/u);
  if (!match || !/[«"]/u.test(match[2])) return null;
  const number = Number(match[1]);
  if (!Number.isInteger(number) || number <= 0 || number > 20) return null;
  return {
    number,
    title: cleanupLine(match[2]),
  };
}

function isCompleteMonthlySectionThematicPlanSectionTitle(value) {
  return /[»"]\.?$/u.test(cleanupLine(value));
}

function finalizeMonthlySectionThematicPlanSection(section) {
  return {
    number: section.number,
    title: cleanupMonthlySectionThematicPlanTitle(section.titleLines.join(" ")),
    topicLines: section.topicLines,
  };
}

function splitMonthlySectionThematicPlanTopicLines(lines) {
  const topics = [];
  let current = [];

  for (const rawLine of lines) {
    const line = cleanupLine(rawLine);
    if (!line || PAGE_NUMBER_RE.test(line)) continue;
    if (/^(?:всего\s+часов|месяц|итого)(?:\s|$)/iu.test(line)) break;

    if (isMonthlySectionThematicPlanTopicStart(line, current)) {
      if (current.length) topics.push(current);
      current = [line];
      continue;
    }

    current.push(line);
  }

  if (current.length) topics.push(current);
  return topics;
}

function isMonthlySectionThematicPlanTopicStart(line, currentLines) {
  const cleaned = cleanupLine(line);
  if (!currentLines.length) return true;
  if (/^(?:экскурсия|квест\s*[-–]|геокешинг\s*[-–]|прогулка\s*[-–]|терренкур-?поход)/iu.test(cleaned)) return true;
  if (!/^[«"]/u.test(cleaned)) return false;
  if (hasUnclosedMonthlySectionThematicPlanParenthesis(currentLines)) return false;
  return isCompleteMonthlySectionThematicPlanTopic(currentLines);
}

function hasUnclosedMonthlySectionThematicPlanParenthesis(lines) {
  const text = cleanupLine(lines.join(" "));
  const open = (text.match(/[(]/gu) || []).length;
  const close = (text.match(/[)]/gu) || []).length;
  return open > close;
}

function isCompleteMonthlySectionThematicPlanTopic(lines) {
  const text = cleanupLine(lines.join(" "));
  if (lines.length >= 4 && /[»"]\.?$/u.test(text)) return true;
  return (
    lines.length >= 3 &&
    /(?:занятие|деятельност|экскурси|бесед|презентаци|геокешинг|терренкур|квест|сказок|музей|родителей|человеком|городу|доу|края)/iu.test(
      text,
    )
  );
}

function cleanupMonthlySectionThematicPlanTitle(value) {
  return cleanupTopicName(value)
    .replace(/^["]+/u, "")
    .replace(/[".]+$/u, "")
    .trim();
}

function cleanupMonthlySectionThematicPlanTopicName(lines) {
  return cleanupBasicStudyPlanTopicName(lines.join(" "))
    .replace(/экспериментировании\s+я/giu, "экспериментирования")
    .replace(/познавательно-\s+исследовательской/giu, "познавательно-исследовательской")
    .replace(/\s+([,.;:!?])/gu, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function extractLessonRangeCalendarRows(lines) {
  const startIndex = findLessonRangeCalendarHeaderIndex(lines);
  if (startIndex < 0) return [];

  const rows = [];
  let index = startIndex + 1;

  while (index < lines.length) {
    const line = cleanupLine(lines[index]);
    if (!line || isLessonRangeCalendarHeaderLine(line)) {
      index += 1;
      continue;
    }
    if (rows.length > 0 && isLessonRangeCalendarStopLine(line)) break;

    const start = parseLessonRangeStart(line);
    if (!start) {
      index += 1;
      continue;
    }

    let topicIndex = index + 1;
    let planNumber = start.range;
    let hoursTotal = start.hoursTotal;
    const nextStart = parseLessonRangeStart(lines[topicIndex]);
    if (
      nextStart &&
      start.from === start.to &&
      nextStart.from === nextStart.to &&
      nextStart.from === start.to + 1
    ) {
      const nextTopicLine = cleanupLine(lines[topicIndex + 1]);
      if (nextTopicLine && !isLessonRangeCalendarStopLine(nextTopicLine) && !parseLessonRangeStart(nextTopicLine)) {
        planNumber = `${start.from}-${nextStart.to}`;
        hoursTotal = nextStart.to - start.from + 1;
        topicIndex += 1;
      }
    }

    const topicLine = cleanupLine(lines[topicIndex]);
    if (!topicLine || isLessonRangeCalendarStopLine(topicLine) || parseLessonRangeStart(topicLine)) {
      index += 1;
      continue;
    }

    const topicParts = [topicLine];
    let topicEndIndex = topicIndex;
    while (topicEndIndex + 1 < lines.length) {
      const continuationLine = cleanupLine(lines[topicEndIndex + 1]);
      if (!isLessonRangeTopicContinuationLine(continuationLine)) break;
      topicParts.push(continuationLine);
      topicEndIndex += 1;
    }

    const topicName = cleanupTopicName(topicParts.join(" "));
    if (!isValidTopic(topicName)) {
      index += 1;
      continue;
    }

    rows.push({
      plan_number: planNumber,
      section_title: "Календарно-тематическое планирование",
      topic_name: topicName,
      hours_theory: null,
      hours_practice: null,
      hours_total: hoursTotal,
      activity_type: "не определено",
      control_form: "",
      source_section: "lesson-range-calendar",
      source_excerpt: [line, ...topicParts].join(" / ").slice(0, 1500),
      confidence: hoursTotal == null ? 0.58 : 0.72,
      raw_payload: {
        parser: "lesson-range-calendar",
        lesson_range: planNumber,
      },
    });

    index = topicEndIndex + 1;
  }

  return rows;
}

function findLessonRangeCalendarHeaderIndex(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!/календарн[оы]\s*[- ]?\s*тематическ(?:ое)?\s+планирован/iu.test(line)) continue;

    const window = lines
      .slice(index, index + 10)
      .map(cleanupLine)
      .join(" ");
    if (/№\s*урока|тема\s+урока|элементы\s+содержания/iu.test(window)) return index;
  }

  return -1;
}

function parseLessonRangeStart(line) {
  const match = cleanupLine(line).match(/^(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?$/u);
  if (!match) return null;
  const from = Number(match[1]);
  const to = match[2] ? Number(match[2]) : from;
  if (!Number.isInteger(from) || !Number.isInteger(to) || to < from || to > 300) return null;
  return {
    range: match[2] ? `${from}-${to}` : String(from),
    from,
    to,
    hoursTotal: to - from + 1,
  };
}

function isLessonRangeCalendarHeaderLine(line) {
  return /^(?:№\s*урока|тема\s+урока|элементы\s+содержания|характеристика\s+деятельности.*)$/iu.test(cleanupLine(line));
}

function isLessonRangeTopicContinuationLine(line) {
  const cleaned = cleanupLine(line);
  if (!cleaned || parseLessonRangeStart(cleaned) || isLessonRangeCalendarStopLine(cleaned)) return false;
  return /^[«"][^»"]{2,120}[»"]\.?$/u.test(cleaned);
}

function isLessonRangeCalendarStopLine(line) {
  return /^(?:список\s+литературы|литература|приложение|методическ|материально|раздел\s+[ivxlcdm]+\.|итого|всего)/iu.test(
    cleanupLine(line),
  );
}

function extractPerspectivePlanningRows(lines) {
  const rows = [];
  const headerIndexes = findPerspectivePlanningHeaderIndexes(lines);

  for (const headerIndex of headerIndexes) {
    const endIndex = findPerspectivePlanningEndIndex(lines, headerIndex, headerIndexes);
    rows.push(...extractPerspectivePlanningRowsFromRange(lines, headerIndex, endIndex));
  }

  return rows;
}

function findPerspectivePlanningHeaderIndexes(lines) {
  const indexes = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!/перспективное\s+планирование/iu.test(line)) continue;

    const window = lines
      .slice(index, index + 8)
      .map(cleanupLine)
      .join(" ");
    if (/сроки\s+тема\s+программные/iu.test(window)) indexes.push(index);
  }
  return indexes;
}

function findPerspectivePlanningEndIndex(lines, headerIndex, headerIndexes) {
  const nextHeader = headerIndexes.find((index) => index > headerIndex);
  const hardEnd = nextHeader || lines.length;
  for (let index = headerIndex + 1; index < hardEnd; index += 1) {
    const line = cleanupLine(lines[index]);
    if (/^(?:список\s+литературы|литература|методическое\s+обеспечение)/iu.test(line)) return index;
  }
  return hardEnd;
}

function extractPerspectivePlanningRowsFromRange(lines, startIndex, endIndex) {
  const rows = [];
  for (let index = startIndex + 1; index < endIndex; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line || PAGE_NUMBER_RE.test(line) || isPerspectivePlanningHeaderLine(line)) continue;

    const start = parsePerspectivePlanningTopicStart(lines, index, endIndex);
    if (!start) continue;

    rows.push({
      plan_number: start.period,
      section_title: cleanupLine(lines[startIndex]),
      topic_name: start.topicName,
      hours_theory: null,
      hours_practice: null,
      hours_total: null,
      activity_type: "не определено",
      control_form: "",
      source_section: "perspective-planning",
      source_excerpt: start.sourceExcerpt,
      confidence: 0.56,
      raw_payload: {
        parser: "perspective-planning",
        period: start.period,
      },
    });
  }

  return rows;
}

function parsePerspectivePlanningTopicStart(lines, index, endIndex) {
  const line = cleanupLine(lines[index]);
  const inline = line.match(/^([А-ЯЁа-яё]+)\s+«([^»]{3,120})»/u);
  if (inline && isPerspectivePlanningPeriod(inline[1])) {
    return {
      period: normalizePerspectivePlanningPeriod(inline[1]),
      topicName: cleanupTopicName(inline[2]),
      sourceExcerpt: line.slice(0, 1500),
    };
  }

  const inlinePlain = line.match(/^([А-ЯЁа-яё]+)\s+(.{3,120})$/u);
  if (inlinePlain && isPerspectivePlanningPeriod(inlinePlain[1])) {
    const rawTopicParts = [inlinePlain[2]];
    if (/«/.test(inlinePlain[2]) && !/»/.test(inlinePlain[2])) {
      for (let cursor = index + 1; cursor < Math.min(endIndex, index + 4); cursor += 1) {
        const nextLine = cleanupLine(lines[cursor]);
        if (!nextLine || PAGE_NUMBER_RE.test(nextLine) || isPerspectivePlanningHeaderLine(nextLine)) continue;
        rawTopicParts.push(nextLine);
        if (/»/.test(nextLine)) break;
      }
    } else if (/^[А-ЯЁа-яё-]+$/u.test(inlinePlain[2])) {
      const nextLine = cleanupLine(lines[index + 1]);
      if (nextLine && /^[А-ЯЁа-яё-]+$/u.test(nextLine) && !isPerspectivePlanningPeriod(nextLine)) {
        rawTopicParts.push(nextLine);
      }
    }
    const topicName = cleanupTopicName(rawTopicParts.join(" ").replace(/[«»"]/g, " "));
    if (isValidTopic(topicName)) {
      return {
        period: normalizePerspectivePlanningPeriod(inlinePlain[1]),
        topicName,
        sourceExcerpt: [line, ...rawTopicParts.slice(1)].join(" / ").slice(0, 1500),
      };
    }
  }

  if (!isPerspectivePlanningPeriod(line)) return null;

  const topicParts = [];
  for (let cursor = index + 1; cursor < Math.min(endIndex, index + 5); cursor += 1) {
    const nextLine = cleanupLine(lines[cursor]);
    if (!nextLine || PAGE_NUMBER_RE.test(nextLine) || isPerspectivePlanningHeaderLine(nextLine)) continue;
    if (/^\d+[.)]\s+/u.test(nextLine)) break;
    topicParts.push(nextLine);
    if (/[»"]$/u.test(nextLine) || topicParts.join(" ").length > 120) break;
  }

  const topicName = cleanupTopicName(topicParts.join(" ").replace(/[«»"]/g, " "));
  if (!isValidTopic(topicName)) return null;

  return {
    period: normalizePerspectivePlanningPeriod(line),
    topicName,
    sourceExcerpt: [line, ...topicParts].join(" / ").slice(0, 1500),
  };
}

function isPerspectivePlanningHeaderLine(line) {
  return /^(?:сроки|тема|программные|задачи|формы\s+работы|с\s+детьми)$/iu.test(cleanupLine(line));
}

function isPerspectivePlanningPeriod(line) {
  return /^(?:сентябрь|октябрь|ноябрь|декабрь|январь|февраль|март|апрель|май)$/iu.test(cleanupLine(line));
}

function normalizePerspectivePlanningPeriod(line) {
  return cleanupLine(line).toLowerCase();
}

function findMultilineThematicPlanHeaderIndex(lines) {
  const indexes = findMultilineThematicPlanHeaderIndexes(lines);
  return indexes[0] ?? -1;
}

function findMultilineThematicPlanHeaderIndexes(lines) {
  const indexes = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!/учебн[оы]\s*[- ]?\s*тематическ(?:ий|ого)?\s+план/iu.test(line)) continue;

    const window = lines
      .slice(index, index + 12)
      .map(cleanupLine)
      .join(" ")
      .toLowerCase();
    if (/наименование\s+разделов|количество\s+час|всего\s+теория/iu.test(window)) {
      indexes.push(index);
    }
  }

  return indexes;
}

function findMultilineThematicPlanEndIndex(lines, headerIndex, headerIndexes) {
  const nextHeaderIndex = headerIndexes.find((index) => index > headerIndex) ?? lines.length;
  for (let index = headerIndex + 1; index < nextHeaderIndex; index += 1) {
    const line = cleanupLine(lines[index]);
    if (/^содержание\s+программы\b/iu.test(line)) return index;
    if (/^(?:учебно[- ]?методическ|методическ|материально|список\s+литературы|приложение)\b/iu.test(line)) {
      return index;
    }
  }

  return nextHeaderIndex;
}

function parseThematicSectionStart(line) {
  const cleaned = cleanupLine(line);
  const match = cleaned.match(/^\d+\.\s*(раздел\s+\d+\.?\s*.+)$/iu);
  if (match) {
    return {
      title: match[1],
    };
  }

  const sectionMatch = cleaned.match(/^\d{1,2}\.\s+(.+)$/u);
  if (!sectionMatch) return null;
  if (splitThematicTopicHoursLine(sectionMatch[1])) return null;
  if (/\s\d+(?:[,.]\d+)?(?:\s+\S+)?$/u.test(sectionMatch[1])) return null;
  const title = cleanupThematicText(sectionMatch[1]);
  if (!isValidScheduleTopic(title)) return null;

  return {
    title,
  };
}

function parseThematicTopicStart(line) {
  const match = cleanupLine(line).match(/^(\d+(?:\.\d+)+)\.?\s+(.+)$/u);
  if (!match) return null;
  return {
    number: match[1],
    title: match[2],
  };
}

function findNextThematicItemIndex(lines, startIndex, endIndex = lines.length) {
  for (let index = startIndex; index < endIndex; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line) continue;
    if (isThematicPlanStopLine(line)) return index;
    if (parseThematicSectionStart(line) || parseThematicTopicStart(line)) return index;
  }

  return endIndex;
}

function collectThematicTitleBeforeHours(segment, hourOrder = ["total", "theory", "practice"]) {
  const titleParts = [];
  for (const rawLine of segment) {
    const line = cleanupLine(rawLine);
    if (!line || isThematicPlanNoiseLine(line)) continue;

    const hours = parseThematicHoursLine(line, hourOrder);
    if (hours) break;

    const split = splitThematicTopicHoursLine(line, hourOrder);
    if (split) {
      if (split.topicPart) titleParts.push(split.topicPart);
      break;
    }

    titleParts.push(line);
  }

  return titleParts.join(" ");
}

function joinThematicSectionTitle(yearSection, sectionTitle) {
  const parts = [yearSection, sectionTitle].map(cleanupThematicText).filter(Boolean);
  return [...new Set(parts)].join(" / ");
}

function parseMultilineThematicTopicSegment({ topicNumber, segment, currentSection, hourOrder = ["total", "theory", "practice"] }) {
  const lines = truncateStudyPlanLinesAtTotalSummary(normalizeThematicSegmentLines(segment));
  const topicParts = [];
  const controlParts = [];
  let hours = null;
  let sourceHoursLine = "";

  for (const rawLine of lines) {
    const line = cleanupLine(rawLine);
    if (!line || isThematicPlanNoiseLine(line)) continue;

    if (!hours) {
      const parsedHours = parseThematicHoursLine(line, hourOrder);
      if (parsedHours) {
        hours = parsedHours.hours;
        sourceHoursLine = line;
        if (parsedHours.tail) controlParts.push(parsedHours.tail);
        continue;
      }

      const split = splitThematicTopicHoursLine(line, hourOrder);
      if (split) {
        if (split.topicPart) topicParts.push(split.topicPart);
        hours = split.hours;
        sourceHoursLine = line;
        if (split.tail) controlParts.push(split.tail);
        continue;
      }

      topicParts.push(line);
      continue;
    }

    if (isThematicTitleContinuationAfterHours(line, topicParts)) {
      topicParts.push(line);
      continue;
    }

    controlParts.push(line);
  }

  if (!hours) return null;
  const topicName = cleanupThematicText(topicParts.join(" "));
  if (!isValidScheduleTopic(topicName)) return null;

  const controlForm = cleanupControlForm(cleanupThematicText(controlParts.join(" ")));
  const activityType = inferActivityTypeFromHours(hours.hoursTheory, hours.hoursPractice);

  return {
    section_title: currentSection,
    topic_name: topicName,
    hours_theory: hours.hoursTheory,
    hours_practice: hours.hoursPractice,
    hours_total: hours.hoursTotal,
    activity_type: activityType,
    control_form: controlForm,
    source_section: currentSection || "multiline-thematic-plan",
    source_excerpt: [topicNumber, ...segment].join(" / ").slice(0, 1500),
    confidence: 0.88,
    raw_payload: {
      parser: "multiline-thematic-plan",
      topic_number: topicNumber,
      hour_order: hourOrder,
      hours_line: sourceHoursLine,
      source_lines: segment,
    },
  };
}

function normalizeThematicSegmentLines(segment) {
  const lines = segment.map(cleanupLine).filter(Boolean);
  const normalized = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const next = lines[index + 1] || "";
    if (/^\d+(?:[,.]\d+)?$/u.test(line) && /^(-|\d+(?:[,.]\d+)?)\s+(-|\d+(?:[,.]\d+)?)(?:\s+.*)?$/u.test(next)) {
      normalized.push(`${line} ${next}`);
      index += 1;
      continue;
    }
    normalized.push(line);
  }

  return normalized;
}

function splitThematicTopicHoursLine(line, hourOrder = ["total", "theory", "practice"]) {
  const normalized = cleanupLine(line);
  if (/^(?:-|\d+(?:[,.]\d+)?)(?:\s+(?:-|\d+(?:[,.]\d+)?)){1,3}$/u.test(normalized)) return null;

  const match = normalized.match(/^(.+?)\s+(-|\d+(?:[,.]\d+)?)\s+(-|\d+(?:[,.]\d+)?)\s+(-|\d+(?:[,.]\d+)?)(?:\s+(.+))?$/u);
  if (!match) {
    const twoNumberMatch = normalized.match(/^(.+?)\s+(-|\d+(?:[,.]\d+)?)\s+(-|\d+(?:[,.]\d+)?)(?:\s+(.+))?$/u);
    if (!twoNumberMatch) return null;

    const hours = buildThematicTwoNumberHours(twoNumberMatch[2], twoNumberMatch[3], hourOrder);
    if (!hours) return null;

    return {
      topicPart: twoNumberMatch[1],
      hours,
      tail: cleanupLine(twoNumberMatch[4] || ""),
    };
  }

  const hours = buildThematicHours(match[2], match[3], match[4], hourOrder);
  if (!hours) return null;

  return {
    topicPart: match[1],
    hours,
    tail: cleanupLine(match[5] || ""),
  };
}

function parseThematicHoursLine(line, hourOrder = ["total", "theory", "practice"]) {
  const normalized = cleanupLine(line);
  const match = normalized.match(/^(-|\d+(?:[,.]\d+)?)\s+(-|\d+(?:[,.]\d+)?)\s+(-|\d+(?:[,.]\d+)?)(?:\s+(.+))?$/u);
  if (!match) {
    const twoNumberMatch = normalized.match(/^(-|\d+(?:[,.]\d+)?)\s+(-|\d+(?:[,.]\d+)?)(?:\s+(.+))?$/u);
    if (!twoNumberMatch) return null;
    if (cleanupLine(twoNumberMatch[3] || "")) return null;

    const hours = buildThematicTwoNumberHours(twoNumberMatch[1], twoNumberMatch[2], hourOrder);
    if (!hours) return null;

    return {
      hours,
      tail: cleanupLine(twoNumberMatch[3] || ""),
    };
  }

  const hours = buildThematicHours(match[1], match[2], match[3], hourOrder);
  if (!hours) return null;

  return {
    hours,
    tail: cleanupLine(match[4] || ""),
  };
}

function buildThematicHours(totalValue, theoryValue, practiceValue, hourOrder = ["total", "theory", "practice"]) {
  const mapped = mapBasicStudyPlanHours([totalValue, theoryValue, practiceValue].map(parseHourCell), hourOrder);
  const hoursTotal = mapped.total;
  const hoursTheory = mapped.theory || 0;
  const hoursPractice = roundHour((mapped.practice || 0) + (mapped.combined || 0));
  if (!isPlausibleHours(hoursTheory, hoursPractice, hoursTotal)) return null;
  return {
    hoursTheory,
    hoursPractice,
    hoursTotal,
  };
}

function buildThematicTwoNumberHours(totalValue, practiceValue, hourOrder = ["total", "theory", "practice"]) {
  const hoursTotal = parseHourCell(totalValue);
  const hoursPractice = parseHourCell(practiceValue);
  if (hoursTotal == null || hoursPractice == null) return null;
  if (hoursTotal <= 0 || hoursTotal > 300) return null;
  if (hoursPractice < 0 || hoursPractice > hoursTotal + 0.01) return null;

  return {
    hoursTheory: roundHour(Math.max(0, hoursTotal - hoursPractice)),
    hoursPractice,
    hoursTotal,
  };
}

function isThematicTitleContinuationAfterHours(line, topicParts) {
  const cleaned = cleanupLine(line);
  if (!cleaned || cleaned.length > 120) return false;
  if (!/[»"]\s*$/u.test(cleaned)) return false;

  const textBeforeHours = topicParts.join(" ");
  if (!hasUnclosedStudyPlanQuote(textBeforeHours)) return false;

  return /^\(?[А-ЯЁа-яёA-Za-z0-9\s.,-]+\)?[»"]$/u.test(cleaned);
}

function inferActivityTypeFromHours(hoursTheory, hoursPractice) {
  const theory = Number(hoursTheory || 0);
  const practice = Number(hoursPractice || 0);
  if (theory > 0 && practice > 0) return "теория+практика";
  if (practice > 0) return "практика";
  if (theory > 0) return "теория";
  return "не определено";
}

function isThematicPlanNoiseLine(line) {
  if (PAGE_NUMBER_RE.test(line)) return true;
  if (/^(№|п\/п|наименование\s+разделов|тем|количество\s+час|формы\s+аттестации|контроля|всего|теория|прак|тика)$/iu.test(line)) {
    return true;
  }
  if (detectYearSection(line)) return true;
  return false;
}

function isThematicPlanStopLine(line) {
  return /^(итого|общее\s+количество)\b/iu.test(cleanupLine(line)) || /^содержание\s+программы$/iu.test(cleanupLine(line));
}

function cleanupThematicText(value) {
  return String(value || "")
    .replace(/[«»]/g, '"')
    .replace(/([А-Яа-яЁё])-\s+([А-Яа-яЁё])/gu, "$1$2")
    .replace(/([А-Яа-яЁё]{2,})\s+([А-Яа-яЁё])(?=[А-Яа-яЁё]{2,}\b)/gu, "$1$2")
    .replace(/тур\s+истов/giu, "туристов")
    .replace(/\s+([.,;:])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function findNumberedScheduleHeaderIndex(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!/календарн(?:ый|ого)\s+учебн(?:ый|ого)\s+график/iu.test(line)) continue;

    const window = lines
      .slice(index, index + 12)
      .map(cleanupLine)
      .join(" ")
      .toLowerCase();

    if (/форма\s+занят/iu.test(window) && /кол-?во\s+час/iu.test(window) && /тема\s+занят/iu.test(window)) {
      return index;
    }
  }

  return -1;
}

function readExpectedScheduleRowStart(lines, index, expectedNumber) {
  const line = cleanupLine(lines[index]);
  const prefixMatch = line.match(/^(\d{1,3})\s+(.+)$/u);
  if (prefixMatch && Number(prefixMatch[1]) === expectedNumber) {
    return {
      remainder: prefixMatch[2],
      nextIndex: index + 1,
    };
  }

  if (line === String(expectedNumber)) {
    return {
      remainder: "",
      nextIndex: index + 1,
    };
  }

  return null;
}

function findNextScheduleRowIndex(lines, startIndex, nextNumber) {
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line) continue;
    if (TOTAL_RE.test(line)) return index;
    if (readExpectedScheduleRowStart(lines, index, nextNumber)) return index;
  }

  return lines.length;
}

function parseNumberedScheduleSegment({ rowNumber, segment, currentSection }) {
  const lines = segment.map(cleanupLine).filter(Boolean);
  while (lines.length && (PAGE_NUMBER_RE.test(lines[0]) || isMonthLine(lines[0]))) {
    lines.shift();
  }
  if (!lines.length) return null;

  const activityParts = [];
  let hoursTotal = null;
  const topicParts = [];
  let sourceHoursLine = "";

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    let split = splitScheduleActivityHours(line);
    if (!split && activityParts.length) {
      split = splitScheduleActivityHours([...activityParts, line].join(" "));
    }

    if (split) {
      activityParts.length = 0;
      if (split.activityPart) activityParts.push(split.activityPart);
      hoursTotal = split.hoursTotal;
      sourceHoursLine = line;
      if (split.topicPart) topicParts.push(split.topicPart);

      for (let topicIndex = index + 1; topicIndex < lines.length; topicIndex += 1) {
        const topicLine = lines[topicIndex];
        const controlTail = splitScheduleTopicControlTail(topicLine);
        if (controlTail.topicPart && controlTail.controlPart) {
          topicParts.push(controlTail.topicPart);
          break;
        }
        if (isScheduleMetadataLine(topicLine)) break;
        topicParts.push(topicLine);
      }
      break;
    }

    activityParts.push(line);
  }

  if (hoursTotal == null) return null;

  const activityLine = cleanupLine(activityParts.join(" "));
  const activityType = normalizeScheduleActivityType(activityLine);
  const topicName = cleanupScheduleTopicName(topicParts.join(" "));
  if (!activityType || !isValidScheduleTopic(topicName)) return null;

  const allocation = allocateScheduleHours(activityType, hoursTotal);

  return {
    plan_number: String(rowNumber),
    section_title: currentSection || "Календарный учебный график",
    topic_name: topicName,
    hours_theory: allocation.hoursTheory,
    hours_practice: allocation.hoursPractice,
    hours_total: hoursTotal,
    activity_type: activityType,
    control_form: "",
    source_section: currentSection || "numbered-calendar-schedule",
    source_excerpt: [String(rowNumber), ...lines].join(" / ").slice(0, 1500),
    confidence: 0.9,
    raw_payload: {
      parser: "numbered-calendar-schedule",
      row_number: rowNumber,
      plan_number: String(rowNumber),
      activity_line: activityLine,
      hours_line: sourceHoursLine,
      source_lines: lines,
    },
  };
}

function splitScheduleActivityHours(line) {
  const normalized = cleanupLine(line);
  const match = normalized.match(/^(.+?)\s+(\d+(?:[,.]\d+)?)(?:\s+(.+))?$/u);
  if (!match) return null;

  const activityPart = cleanupLine(match[1]);
  if (!looksLikeScheduleActivity(activityPart)) return null;

  const hoursTotal = parseHourCell(match[2]);
  if (!Number.isFinite(hoursTotal) || hoursTotal <= 0 || hoursTotal > 1000) return null;

  return {
    activityPart,
    hoursTotal,
    topicPart: cleanupLine(match[3] || ""),
  };
}

function looksLikeScheduleActivity(value) {
  const normalized = cleanupLine(value).toLowerCase();
  return /аудиторн|теоретическ|практическ|занятие\s+на\s+местности|проект|соревнован|экскурси/iu.test(
    normalized,
  );
}

function normalizeScheduleActivityType(value) {
  const normalized = cleanupLine(value).toLowerCase();
  const hasTheory = /теор|аудиторн/.test(normalized);
  const hasPractice = /практик|практическ|местности|проект|соревнован|экскурси/.test(normalized);

  if (hasTheory && hasPractice) return "теория+практика";
  if (hasTheory) return "теория";
  if (hasPractice) return "практика";
  return "";
}

function allocateScheduleHours(activityType, hoursTotal) {
  if (activityType === "теория") {
    return {
      hoursTheory: hoursTotal,
      hoursPractice: 0,
    };
  }
  if (activityType === "практика") {
    return {
      hoursTheory: 0,
      hoursPractice: hoursTotal,
    };
  }
  return {
    hoursTheory: null,
    hoursPractice: null,
  };
}

function isScheduleMetadataLine(line) {
  const cleaned = cleanupLine(line);
  if (!cleaned || PAGE_NUMBER_RE.test(cleaned) || isMonthLine(cleaned)) return true;
  if (isLikelyPlace(cleaned) || isLikelyScheduleControlForm(cleaned)) return true;
  return false;
}

function splitScheduleTopicControlTail(line) {
  const cleaned = cleanupLine(line);
  if (isLikelyScheduleControlForm(cleaned)) {
    return {
      topicPart: "",
      controlPart: "",
    };
  }

  const match = cleaned.match(
    /^(.+?)\s+(выполнение(?:\s+нормативов,?\s*опрос)?|нормативов,?\s*опрос|опрос(?:,\s*наблюдение)?|наблюдение(?:,\s*опрос)?)\.?$/iu,
  );
  if (!match) {
    return {
      topicPart: "",
      controlPart: "",
    };
  }
  return {
    topicPart: cleanupLine(match[1]),
    controlPart: cleanupLine(match[2]),
  };
}

function isLikelyScheduleControlForm(line) {
  return /^(входящая\s+аттестация|итоговая\s+диагностика|тестирование|сдача\s+нормативов|тестирование,\s*сдача|наблюдение(?:,\s*опрос)?|опрос(?:,\s*наблюдение)?|нормативов,?\s*опрос|выполнение(?:\s+нормативов,?\s*опрос)?|соревновани[ея]|упражнения,?\s*опрос|эстафеты,?\s*соревнование|эстафеты|практический\s+экзамен)[,.\s]*$/iu.test(
    cleanupLine(line),
  );
}

function cleanupScheduleTopicName(value) {
  let topic = cleanupTopicName(value);
  topic = topic
    .replace(/([А-Яа-яЁё])-\s+([А-Яа-яЁё])/gu, "$1-$2")
    .replace(/^(.{12,180}?)\s+(?:Теория|Практика)\.\s+.+$/iu, "$1")
    .replace(/\bпрохождение\s+занятие\s+на\s+местности\s+/iu, "прохождение ")
    .replace(
      /\s+(?:Входящая\s+аттестация|Итоговая\s+диагностика|Тестирование(?:,\s*сдача\s+нормативов)?|Сдача\s+нормативов|Наблюдение(?:,\s*опрос)?|Опрос(?:,\s*наблюдение)?|Выполнение(?:\s+нормативов,?\s*опрос)?|Нормативов,?\s*опрос|Соревновани[ея]|Упражнения,?\s*опрос|Эстафеты,?\s*соревнование|Эстафеты|Практический\s+экзамен)[,.\s]*$/iu,
      "",
    )
    .trim();
  return topic;
}

function isValidScheduleTopic(topic) {
  if (!topic) return false;
  if (topic.length < 3 || topic.length > 260) return false;
  if (/^[\d\s.,:-]+$/u.test(topic)) return false;
  if (/^(месяц|тема|раздел|занятие|количество|форма|контроль|теория|практика|всего)$/iu.test(topic)) return false;
  if (/федеральн|постановление|приказ|санпин|литератур|нормативно|концепци|распоряжение|www\.|http/iu.test(topic)) {
    return false;
  }
  return true;
}

function extractTextutilDelimitedStudyPlanRows(text) {
  if (!text || !text.includes("\u0007")) return [];

  const rows = [];
  const normalizedText = String(text || "").replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  let searchOffset = 0;

  while (searchOffset < normalizedText.length) {
    const startIndex = normalizedText.indexOf("№ п/п", searchOffset);
    if (startIndex < 0) break;

    const headerWindow = normalizedText.slice(startIndex, startIndex + 1000);
    if (
      !headerWindow.includes("\u0007") ||
      !/наименование\s+разделов\s+и\s+тем/iu.test(headerWindow) ||
      !/всего/iu.test(headerWindow) ||
      !/теори[яи]/iu.test(headerWindow) ||
      !/практ/iu.test(headerWindow)
    ) {
      searchOffset = startIndex + 5;
      continue;
    }

    const totalIndex = findTextIndex(normalizedText, /всего\s*:/iu, startIndex + 1);
    const contentIndex = findTextIndex(normalizedText, /содержание\s+программы/iu, startIndex + 1);
    const endCandidates = [totalIndex, contentIndex].filter((index) => index > startIndex);
    const endIndex = endCandidates.length ? Math.min(...endCandidates) : Math.min(normalizedText.length, startIndex + 60000);
    const sectionTitle = detectTextutilDelimitedSectionTitle(normalizedText, startIndex);
    const segment = normalizedText.slice(startIndex, Math.min(normalizedText.length, endIndex + 1000));
    const cells = segment.split("\u0007").map((cell) => cleanupLine(cell));
    const parsedRows = parseTextutilDelimitedStudyPlanCells(cells, sectionTitle);

    if (parsedRows.length >= 3) {
      rows.push(...parsedRows);
      break;
    }

    searchOffset = startIndex + 5;
  }

  return removeBasicStudyPlanParentRows(rows);
}

function findTextIndex(text, pattern, fromIndex) {
  const sliced = text.slice(fromIndex);
  const match = sliced.match(pattern);
  return match && typeof match.index === "number" ? fromIndex + match.index : -1;
}

function detectTextutilDelimitedSectionTitle(text, startIndex) {
  const before = text.slice(Math.max(0, startIndex - 500), startIndex);
  const matches = [...before.matchAll(/учебн(?:ый|ого)\s+план|учебн[оы]\s*[- ]?\s*тематическ(?:ий|ого)?\s+план/giu)];
  if (!matches.length) return "Учебный план";
  return cleanupLine(matches[matches.length - 1][0]) || "Учебный план";
}

function parseTextutilDelimitedStudyPlanCells(cells, sectionTitle) {
  const rows = [];
  const controlHeaderIndex = cells.findIndex((cell) => /форма\s+аттестации|форма\s+контрол/iu.test(cell));
  let index = controlHeaderIndex >= 0 ? controlHeaderIndex + 1 : 0;

  while (index < cells.length) {
    const cell = cleanupLine(cells[index]);
    if (!cell) {
      index += 1;
      continue;
    }
    if (TOTAL_RE.test(cell) || /содержание\s+программы/iu.test(cell)) break;

    const numberedRow = isTextutilStudyPlanRowNumber(cell) ? parseTextutilDelimitedStudyPlanRow(cells, index, sectionTitle, true) : null;
    const titleRow = numberedRow ? null : parseTextutilDelimitedStudyPlanRow(cells, index, sectionTitle, false);
    const parsed = numberedRow || titleRow;

    if (!parsed) {
      index += 1;
      continue;
    }

    rows.push(parsed.row);
    index = parsed.nextIndex;
  }

  return rows;
}

function parseTextutilDelimitedStudyPlanRow(cells, startIndex, sectionTitle, hasNumber) {
  const number = hasNumber ? cleanupLine(cells[startIndex]) : "";
  const titleIndex = hasNumber ? startIndex + 1 : startIndex;
  const title = cleanupBasicStudyPlanTopicName(cleanupLine(cells[titleIndex]));
  if (!isValidTopic(title) || isTitleFirstCellWiseHeaderLine(title)) return null;

  const totalIndex = titleIndex + 1;
  const theoryIndex = titleIndex + 2;
  const practiceIndex = titleIndex + 3;
  const total = parseHourCell(cells[totalIndex]);
  if (total == null || total <= 0 || total > 1000) return null;

  const theory = parseTextutilDelimitedHourCell(cells[theoryIndex]);
  const practice = parseTextutilDelimitedHourCell(cells[practiceIndex]);
  const mapped = normalizeTextutilDelimitedHours(total, theory, practice);
  if (!mapped || !isPlausibleHours(mapped.hoursTheory, mapped.hoursPractice, mapped.hoursTotal)) return null;

  const controlForm = cleanupControlForm(cells[titleIndex + 4] || "");

  return {
    nextIndex: titleIndex + 5,
    row: {
      plan_number: number,
      section_title: sectionTitle || "Учебный план",
      topic_name: title,
      hours_theory: mapped.hoursTheory,
      hours_practice: mapped.hoursPractice,
      hours_total: mapped.hoursTotal,
      activity_type: inferLessonThematicPlanningActivityType({
        hoursTheory: mapped.hoursTheory,
        hoursPractice: mapped.hoursPractice,
      }),
      control_form: controlForm,
      source_section: "textutil-delimited-study-plan",
      source_excerpt: cells.slice(startIndex, titleIndex + 5).map(cleanupLine).join(" / ").slice(0, 1500),
      confidence: 0.9,
      raw_payload: {
        parser: "textutil-delimited-study-plan",
        plan_number: number,
        cells: cells.slice(startIndex, titleIndex + 5).map(cleanupLine),
      },
    },
  };
}

function parseTextutilDelimitedHourCell(value) {
  const cleaned = cleanupLine(value);
  if (!cleaned) return 0;
  return parseHourCell(cleaned);
}

function normalizeTextutilDelimitedHours(total, theory, practice) {
  if (theory == null || practice == null) return null;
  if (theory === 0 && practice === 0) {
    return {
      hoursTheory: null,
      hoursPractice: null,
      hoursTotal: total,
    };
  }

  return {
    hoursTheory: theory,
    hoursPractice: practice,
    hoursTotal: total,
  };
}

function isTextutilStudyPlanRowNumber(value) {
  const number = Number(cleanupLine(value));
  return Number.isInteger(number) && number > 0 && number < 300;
}

function extractDelimitedTableRows(lines) {
  const topics = [];
  let currentSection = "";
  let currentTableSection = "";
  let tableNumber = "";
  let headerCells = null;
  let hourOrder = null;
  let insideRelevantTable = false;
  let rowsSinceHeader = 0;

  for (const rawLine of lines) {
    const line = cleanupLine(rawLine);
    if (!line) continue;

    const tableStart = line.match(/^STRUCTURED_DOCX_TABLE_BEGIN\s+(\d+)/iu);
    if (tableStart) {
      tableNumber = tableStart[1];
      headerCells = null;
      hourOrder = null;
      insideRelevantTable = false;
      currentTableSection = currentSection;
      rowsSinceHeader = 0;
      continue;
    }

    if (/^STRUCTURED_DOCX_TABLE_END/iu.test(line)) {
      headerCells = null;
      hourOrder = null;
      insideRelevantTable = false;
      currentTableSection = "";
      rowsSinceHeader = 0;
      continue;
    }

    if (!line.startsWith("TABLE_ROW")) {
      if (SECTION_RE.test(line)) {
        currentSection = line.slice(0, 180);
        insideRelevantTable = true;
      }
      continue;
    }

    const cells = splitDelimitedTableCells(line);
    if (cells.length < 3) continue;

    const rowText = cells.join(" ");
    if (headerCells && isDelimitedHourSubheaderRow(cells)) {
      headerCells = expandDelimitedGroupedHourHeader(headerCells, cells);
      hourOrder = detectDelimitedHourOrder(cells);
      continue;
    }

    if (isDelimitedHeaderRow(cells)) {
      headerCells = cells.map((cell) => cleanupLine(cell).toLowerCase());
      hourOrder = null;
      insideRelevantTable = true;
      rowsSinceHeader = 0;
      if (isDelimitedStudyPlanHeader(cells)) {
        currentTableSection = "Учебно-тематический план";
      }
      if (!currentTableSection && SECTION_RE.test(rowText)) {
        currentTableSection = rowText.slice(0, 180);
      }
      continue;
    }

    if (!headerCells || (!insideRelevantTable && !looksLikeDelimitedTopicRow(cells))) {
      continue;
    }

    const sectionTitle = parseDelimitedSectionTitle(cells, headerCells);
    const row = parseDelimitedTableRow({
      cells,
      headerCells,
      hourOrder,
      currentSection: currentTableSection || `DOCX table ${tableNumber}`,
      tableNumber,
    });

    if (row) {
      if (sectionTitle && isBlankNumberedDelimitedSectionRow(cells, headerCells)) {
        currentTableSection = sectionTitle;
        insideRelevantTable = true;
        continue;
      }
      if (isDelimitedSectionSummaryTopic(row.topic_name)) {
        row.section_title = row.topic_name;
        row.source_section = row.topic_name;
      }
      topics.push(row);
      if (sectionTitle || isDelimitedSectionSummaryTopic(row.topic_name)) {
        currentTableSection = sectionTitle || row.topic_name;
        insideRelevantTable = true;
      }
      rowsSinceHeader += 1;
      continue;
    }

    if (sectionTitle) {
      currentTableSection = sectionTitle;
      insideRelevantTable = true;
      continue;
    }

    if (rowsSinceHeader > 0 && HARD_STOP_RE.test(rowText)) {
      insideRelevantTable = false;
      headerCells = null;
      hourOrder = null;
    }
  }

  return topics;
}

function extractFragmentedDocxCalendarRows(lines) {
  const topics = [];
  let tableNumber = "";
  let activeCalendar = false;
  let currentRow = null;
  let calendarIndex = 0;
  let headerCells = null;

  const pushCurrentRow = () => {
    if (!currentRow) return;
    const row = buildFragmentedDocxCalendarRow(currentRow);
    if (row) topics.push(row);
    currentRow = null;
  };

  for (const rawLine of lines) {
    const line = cleanupLine(rawLine);
    if (!line) continue;

    const tableStart = line.match(/^STRUCTURED_DOCX_TABLE_BEGIN\s+(\d+)/iu);
    if (tableStart) {
      tableNumber = tableStart[1];
      continue;
    }

    if (/^STRUCTURED_DOCX_TABLE_END/iu.test(line)) {
      continue;
    }

    if (!line.startsWith("TABLE_ROW")) continue;

    const cells = splitDelimitedTableCells(line);
    if (cells.length < 7) continue;

    if (isFragmentedDocxCalendarHeaderRow(cells)) {
      pushCurrentRow();
      activeCalendar = true;
      calendarIndex += 1;
      headerCells = cells.map((cell) => cleanupLine(cell).toLowerCase());
      continue;
    }

    if (!activeCalendar) continue;

    if (isFragmentedDocxCalendarDataRow(cells)) {
      pushCurrentRow();
      currentRow = {
        cells,
        tableNumber,
        calendarIndex,
        headerCells: headerCells || [],
      };
      continue;
    }

    if (currentRow && isFragmentedDocxCalendarContinuationRow(cells)) {
      mergeFragmentedDocxCalendarContinuation(currentRow.cells, cells);
    }
  }

  pushCurrentRow();

  return topics.length >= 8 ? topics : [];
}

function isFragmentedDocxCalendarHeaderRow(cells) {
  const text = cells.join(" ").toLowerCase();
  return (
    /^(?:№|n)(?:\s|$)/iu.test(cleanupLine(cells[0] || "")) &&
    /месяц/iu.test(text) &&
    /форма\s+занят/iu.test(text) &&
    /кол-?\s*во\s+час|количество\s+час/iu.test(text) &&
    /тема\s+занят/iu.test(text)
  );
}

function isFragmentedDocxCalendarDataRow(cells) {
  const rowNumber = parseFragmentedCalendarRowNumber(cells[0]);
  if (rowNumber == null) return false;
  const month = cleanupLine(cells[1] || "");
  const topic = cleanupFragmentedDocxCalendarTopic(cells[6] || "");
  return (!month || isMonthLine(month)) && isValidFragmentedDocxCalendarTopic(topic);
}

function parseFragmentedCalendarRowNumber(value) {
  const cleaned = cleanupLine(value).replace(/[.)]+$/u, "");
  if (!/^\d{1,3}$/u.test(cleaned)) return null;
  const number = Number(cleaned);
  return Number.isInteger(number) && number > 0 && number <= 300 ? number : null;
}

function isFragmentedDocxCalendarContinuationRow(cells) {
  if (cleanupLine(cells[0] || "")) return false;
  return [4, 5, 6, 8].some((index) => cleanupLine(cells[index] || ""));
}

function mergeFragmentedDocxCalendarContinuation(targetCells, continuationCells) {
  for (const index of [4, 6, 8]) {
    const value = cleanupLine(continuationCells[index] || "");
    if (!value) continue;
    targetCells[index] = cleanupLine([targetCells[index], value].filter(Boolean).join(" "));
  }

  const continuationHours = cleanupLine(continuationCells[5] || "");
  if (continuationHours && !cleanupLine(targetCells[5] || "")) {
    targetCells[5] = continuationHours;
  }
}

function normalizeBasicStudyPlanSegmentLines(segment) {
  const lines = segment.map(cleanupLine).filter(Boolean);
  const normalized = [];

  for (let index = 0; index < lines.length; index += 1) {
    let line = lines[index].replace(/^\.(?=\d+\.\d+\s)/u, "");
    const next = cleanupLine(lines[index + 1] || "");
    const afterNext = cleanupLine(lines[index + 2] || "");

    const splitSubNumber = line.match(/^(\d+(?:\.\d+)*)\.?$/u);
    if (splitSubNumber && /\./u.test(splitSubNumber[1]) && /^(\d+)\.?$/u.test(next) && afterNext && !PAGE_NUMBER_RE.test(afterNext)) {
      normalized.push(`${splitSubNumber[1]}.${next.replace(/\.$/u, "")}. ${afterNext}`);
      index += 2;
      continue;
    }

    if (splitSubNumber && /\./u.test(splitSubNumber[1]) && next === "." && afterNext && !PAGE_NUMBER_RE.test(afterNext)) {
      normalized.push(`${splitSubNumber[1]}. ${afterNext}`);
      index += 2;
      continue;
    }

    normalized.push(line);
  }

  return normalized;
}

function buildFragmentedDocxCalendarRow(row) {
  const cells = row.cells;
  const topicName = cleanupFragmentedDocxCalendarTopic(cells[6] || "");
  if (!isValidFragmentedDocxCalendarTopic(topicName)) return null;

  const parsedHours = parseHourCell(cells[5]);
  const hoursTotal = parsedHours == null ? 2 : parsedHours;
  if (hoursTotal <= 0 || hoursTotal > 12) return null;

  const controlForm = cleanupControlForm(cells[8] || "");
  const activityLine = cleanupLine(cells[4] || "");

  return {
    topic_order: parseFragmentedCalendarRowNumber(cells[0]),
    section_title: `Календарный учебный график, год обучения ${row.calendarIndex}`,
    topic_name: topicName,
    hours_theory: null,
    hours_practice: null,
    hours_total: hoursTotal,
    activity_type:
      normalizeExplicitActivityType(activityLine) ||
      inferActivityType({
        topicName,
        controlForm,
        hoursTheory: null,
        hoursPractice: null,
      }),
    control_form: controlForm,
    source_section: "Тема занятия",
    source_excerpt: cells.join(" / ").slice(0, 1500),
    confidence: parsedHours == null ? 0.76 : 0.86,
    raw_payload: {
      parser: "fragmented-docx-calendar",
      table_number: row.tableNumber,
      calendar_index: row.calendarIndex,
      cells,
      header_cells: row.headerCells || [],
      row_number: parseFragmentedCalendarRowNumber(cells[0]),
      ...(parsedHours == null ? { inferred_hours_total: hoursTotal } : {}),
    },
  };
}

function cleanupFragmentedDocxCalendarTopic(value) {
  return cleanupCompactScheduleTopicName(value)
    .replace(/([А-Яа-яЁё])-\s+([А-Яа-яЁё])/gu, "$1-$2")
    .replace(/\s+/g, " ")
    .trim();
}

function isValidFragmentedDocxCalendarTopic(topicName) {
  if (isValidTopic(topicName) || isValidCompactScheduleTopic(topicName)) return true;

  const cleaned = cleanupLine(topicName);
  if (cleaned.length < 12 || cleaned.length > 360) return false;
  if (/^[\d\s.,:-]+$/u.test(cleaned)) return false;
  if (/^(месяц|тема|раздел|занятие|количество|форма|контроль|теория|практика|всего|час|часа|часов)$/iu.test(cleaned)) {
    return false;
  }
  if (/(?:https?:\/\/|www\.|федеральн|постановление|приказ|санпин)/iu.test(cleaned)) return false;

  return /\p{L}/u.test(cleaned);
}

function shouldPreferFragmentedDocxCalendarRows(calendarRows, delimitedRows) {
  if (!Array.isArray(calendarRows) || calendarRows.length < 8) return false;
  if (!Array.isArray(delimitedRows) || !delimitedRows.length) return true;
  if (!hasMultipleStructuredStudyPlanTableGroups(delimitedRows)) return false;
  if (calendarRows.length < Math.ceil(delimitedRows.length * 1.5)) return false;

  const calendarTotal = sumTopicHoursTotal(calendarRows);
  const delimitedTotal = sumTopicHoursTotal(delimitedRows);
  if (!Number.isFinite(calendarTotal) || !Number.isFinite(delimitedTotal)) return false;
  if (calendarTotal <= 0 || delimitedTotal <= 0) return false;

  return Math.abs(calendarTotal - delimitedTotal) <= Math.max(1, delimitedTotal * 0.02);
}

function hasMultipleStructuredStudyPlanTableGroups(rows) {
  const tableGroups = new Map();
  for (const row of rows || []) {
    const tableNumber = cleanupLine(row.raw_payload?.table_number || "");
    if (!tableNumber) continue;
    if (!tableGroups.has(tableNumber)) tableGroups.set(tableNumber, []);
    tableGroups.get(tableNumber).push(row);
  }

  const studyPlanGroups = [...tableGroups.values()].filter((group) => {
    const header = group[0]?.raw_payload?.header_cells || [];
    const headerText = header.join(" ");
    return (
      group.length >= 3 &&
      /^docx-structured-table$/iu.test(cleanupLine(group[0]?.raw_payload?.parser || "")) &&
      !/дата|месяц|форма\s+занят|тема\s+занят/iu.test(headerText) &&
      /(наименование|название|тема).{0,60}(?:тем|раздел)|наименование\s+тем/iu.test(headerText) &&
      /(всего|теори[яи]|практик[аи]?)/iu.test(headerText)
    );
  });

  return studyPlanGroups.length >= 2;
}

function selectPreferredDelimitedTableRows(rows) {
  if (!Array.isArray(rows) || rows.length < 3) return rows || [];

  const groups = new Map();
  for (const row of rows) {
    const tableNumber = row.raw_payload?.table_number || "";
    if (!groups.has(tableNumber)) groups.set(tableNumber, []);
    groups.get(tableNumber).push(row);
  }

  const groupedRows = [...groups.values()];
  const studyPlanGroups = groupedRows.filter(isStructuredStudyPlanRowSet);
  const sectionSummaries = groupedRows.flat().filter(isDelimitedSectionSummaryRow);
  const calendarGroups = groupedRows
    .filter((group) => isDetailedScheduleRowSet(group) || isCalendarScheduleRowSet(group))
    .sort((left, right) => right.length - left.length);

  if (studyPlanGroups.length) {
    const overviewStudyPlanGroup = selectOverviewStructuredStudyPlanGroup(studyPlanGroups);
    if (overviewStudyPlanGroup) return overviewStudyPlanGroup;
    if (
      studyPlanGroups.length === 1 &&
      calendarGroups.length &&
      calendarGroups[0].length > studyPlanGroups[0].length + 5
    ) {
      return applySectionSummariesToScheduleRows(calendarGroups[0], sectionSummaries);
    }
    const selectedAlternativeGroups = selectAlternativeStructuredStudyPlanGroups(studyPlanGroups);
    if (selectedAlternativeGroups.length < studyPlanGroups.length) {
      return selectedAlternativeGroups.flat();
    }
    return studyPlanGroups.flat();
  }

  if (calendarGroups.length) {
    return applySectionSummariesToScheduleRows(calendarGroups[0], sectionSummaries);
  }

  return rows;
}

function shouldPreferMoreCompleteDelimitedScheduleRows(delimitedRows, fallbackRows) {
  if (!Array.isArray(delimitedRows) || !Array.isArray(fallbackRows)) return false;
  if (!delimitedRows.length || !fallbackRows.length) return false;
  if (!(isDetailedScheduleRowSet(delimitedRows) || isCalendarScheduleRowSet(delimitedRows))) return false;

  const delimitedTotal = sumTopicHoursTotal(delimitedRows);
  const fallbackTotal = sumTopicHoursTotal(fallbackRows);
  if (!Number.isFinite(delimitedTotal) || !Number.isFinite(fallbackTotal)) return false;
  if (delimitedTotal <= 0 || fallbackTotal <= 0) return false;

  const totalGain = delimitedTotal - fallbackTotal;
  if (totalGain < Math.max(4, delimitedTotal * 0.1)) return false;
  if (fallbackTotal >= delimitedTotal * 0.9) return false;
  return delimitedRows.length >= Math.ceil(fallbackRows.length * 1.4);
}

function sumTopicHoursTotal(rows) {
  return roundHour(
    rows.reduce((sum, row) => {
      const value = Number(row.hours_total ?? row.hoursTotal);
      return Number.isFinite(value) ? sum + value : sum;
    }, 0),
  );
}

function shouldPreferStructuredStudyPlanOverDuplicatedFocusedRows(delimitedRows, fallbackRows) {
  if (!Array.isArray(delimitedRows) || !Array.isArray(fallbackRows)) return false;
  if (delimitedRows.length < 8 || fallbackRows.length <= delimitedRows.length) return false;
  if (!isStructuredStudyPlanRowSet(delimitedRows)) return false;
  if (!delimitedRows.every((row) => /^docx-structured-table$/iu.test(cleanupLine(row.raw_payload?.parser || "")))) {
    return false;
  }

  const delimitedTotal = sumTopicHoursTotal(delimitedRows);
  const fallbackTotal = sumTopicHoursTotal(fallbackRows);
  if (!Number.isFinite(delimitedTotal) || !Number.isFinite(fallbackTotal)) return false;
  if (fallbackTotal < delimitedTotal * 1.25) return false;

  return calculateTopicSetOverlap(delimitedRows, fallbackRows) >= 0.65;
}

function selectOverviewStructuredStudyPlanGroup(groups) {
  if (!Array.isArray(groups) || groups.length < 2) return null;
  const candidates = groups
    .map((group, index) => ({
      group,
      index,
      depth: averageDelimitedNumberDepth(group),
      rows: group.length,
    }))
    .filter((item) => item.rows >= 10 && item.depth != null)
    .sort((left, right) => left.depth - right.depth || right.rows - left.rows || left.index - right.index);
  if (!candidates.length) return null;

  const best = candidates[0];
  const next = candidates[1];
  if (!next || best.depth + 0.4 < next.depth || best.rows >= next.rows * 1.5) {
    return best.group;
  }
  return null;
}

function selectAlternativeStructuredStudyPlanGroups(groups) {
  if (!Array.isArray(groups) || groups.length < 2) return groups || [];

  const alternatives = [];
  for (const group of groups) {
    const alternativeGroup = alternatives.find((candidate) =>
      candidate.some((existingGroup) => areAlternativeStructuredStudyPlanGroups(existingGroup, group)),
    );
    if (alternativeGroup) {
      alternativeGroup.push(group);
    } else {
      alternatives.push([group]);
    }
  }

  return alternatives.map((alternativeGroup) => alternativeGroup[0]);
}

function areAlternativeStructuredStudyPlanGroups(left, right) {
  if (areAlternativeStudyPlanRanges(left, right)) return true;
  if (!haveSimilarDelimitedHeaders(left, right)) return false;
  if (!haveComparableDelimitedGroupSizes(left, right)) return false;

  const overlap = calculateTopicSetOverlap(left, right);
  if (overlap >= 0.45) return true;

  const leftDepth = averageDelimitedNumberDepth(left);
  const rightDepth = averageDelimitedNumberDepth(right);
  return overlap >= 0.35 && leftDepth != null && rightDepth != null && leftDepth >= 1.4 && rightDepth >= 1.4;
}

function haveSimilarDelimitedHeaders(left, right) {
  const leftHeader = normalizeDelimitedHeaderKey(left?.[0]?.raw_payload?.header_cells || []);
  const rightHeader = normalizeDelimitedHeaderKey(right?.[0]?.raw_payload?.header_cells || []);
  return Boolean(leftHeader && rightHeader && leftHeader === rightHeader);
}

function normalizeDelimitedHeaderKey(headerCells) {
  return (headerCells || [])
    .map((cell) => cleanupLine(cell).toLowerCase())
    .filter(Boolean)
    .join("|");
}

function haveComparableDelimitedGroupSizes(left, right) {
  const leftLength = Array.isArray(left) ? left.length : 0;
  const rightLength = Array.isArray(right) ? right.length : 0;
  if (!leftLength || !rightLength) return false;
  const maxLength = Math.max(leftLength, rightLength);
  return Math.abs(leftLength - rightLength) <= Math.max(8, Math.ceil(maxLength * 0.35));
}

function calculateTopicSetOverlap(left, right) {
  const leftKeys = new Set((left || []).map((row) => normalizeTopicComparisonKey(row.topic_name || "")).filter(Boolean));
  const rightKeys = new Set((right || []).map((row) => normalizeTopicComparisonKey(row.topic_name || "")).filter(Boolean));
  if (!leftKeys.size || !rightKeys.size) return 0;

  let common = 0;
  for (const key of leftKeys) {
    if (rightKeys.has(key)) common += 1;
  }
  return common / Math.min(leftKeys.size, rightKeys.size);
}

function averageDelimitedNumberDepth(rows) {
  const depths = rows
    .map((row) => getDelimitedNumberDepth(getDelimitedNumberText(row)))
    .filter((depth) => depth != null);
  if (depths.length < Math.max(5, Math.ceil(rows.length * 0.4))) return null;
  return depths.reduce((sum, depth) => sum + depth, 0) / depths.length;
}

function getDelimitedNumberDepth(value) {
  const cleaned = cleanupLine(value).replace(/[.)]+$/u, "");
  if (!/^\d+(?:\.\d+)*$/u.test(cleaned)) return null;
  return cleaned.split(".").length;
}

function isStructuredStudyPlanRowSet(rows) {
  if (!Array.isArray(rows) || rows.length < 8) return false;
  if (isDetailedScheduleRowSet(rows) || isCalendarScheduleRowSet(rows)) return false;
  const splitRows = countSplitHourRows(rows);
  const rowsWithTotals = rows.filter((row) => Number(row.hours_total ?? row.hoursTotal) > 0).length;
  return splitRows >= Math.max(5, Math.ceil(rows.length * 0.35)) && rowsWithTotals >= Math.ceil(rows.length * 0.75);
}

function isCalendarScheduleRowSet(rows) {
  if (!Array.isArray(rows) || rows.length < 8) return false;
  const scheduleRows = rows.filter((row) => {
    const payload = row.raw_payload || row.rawPayload || {};
    const header = (payload.header_cells || []).join(" ");
    return (
      (/дата|месяц|число|время\s+провед/iu.test(header) || /форма\s+занят/iu.test(header)) &&
      /(наименование\s+тем|тема\s+занят|кол-?во\s+час|количество\s+час)/iu.test(header)
    );
  });
  if (scheduleRows.length < Math.max(8, Math.ceil(rows.length * 0.7))) return false;
  const smallHourRows = scheduleRows.filter((row) => {
    const total = Number(row.hours_total ?? row.hoursTotal);
    return Number.isFinite(total) && total > 0 && total <= 6;
  });
  return smallHourRows.length >= Math.ceil(scheduleRows.length * 0.8);
}

function applySectionSummariesToScheduleRows(rows, sectionSummaries) {
  if (!Array.isArray(sectionSummaries) || sectionSummaries.length < 2) return rows;
  const totalScheduleHours = roundHour(
    rows.reduce((sum, row) => sum + (Number(row.hours_total ?? row.hoursTotal) || 0), 0),
  );
  const totalSummaryHours = roundHour(
    sectionSummaries.reduce((sum, row) => sum + (Number(row.hours_total ?? row.hoursTotal) || 0), 0),
  );
  if (Math.abs(totalScheduleHours - totalSummaryHours) > 1) return rows;

  let summaryIndex = 0;
  let usedInSection = 0;
  return rows.map((row) => {
    const summary = sectionSummaries[Math.min(summaryIndex, sectionSummaries.length - 1)];
    const sectionTitle = summary.topic_name || summary.topicName || row.section_title || "";
    const hoursTotal = Number(row.hours_total ?? row.hoursTotal) || 0;
    const nextRow = {
      ...row,
      section_title: sectionTitle,
      source_section: sectionTitle || row.source_section,
      raw_payload: {
        ...(row.raw_payload || {}),
        mapped_section_summary: summary.topic_name || summary.topicName || "",
      },
    };
    usedInSection = roundHour(usedInSection + hoursTotal);
    const sectionHours = Number(summary.hours_total ?? summary.hoursTotal) || 0;
    if (sectionHours > 0 && usedInSection >= sectionHours - 0.001 && summaryIndex < sectionSummaries.length - 1) {
      summaryIndex += 1;
      usedInSection = 0;
    }
    return nextRow;
  });
}

function repairDelimitedRowsWithContentHeadingRows(rows, contentHeadingRows) {
  if (!Array.isArray(rows) || !rows.length) return rows || [];
  const repaired = rows.map(repairMalformedDelimitedHours);
  if (!Array.isArray(contentHeadingRows) || contentHeadingRows.length < 3) return repaired;

  const numberedRows = repaired
    .map((row, index) => ({ row, index, number: getDelimitedWholeRowNumber(row) }))
    .filter((item) => item.number != null);
  if (numberedRows.length < 8) return repaired;

  const output = [];
  let previousNumber = 0;
  let previousNumberedRow = null;
  for (let index = 0; index < repaired.length; index += 1) {
    const row = repaired[index];
    const number = getDelimitedWholeRowNumber(row);
    if (number != null && previousNumber > 0 && number > previousNumber + 1) {
      const missingHeadings = findContentHeadingsBetween(contentHeadingRows, previousNumberedRow, row);
      for (let missingNumber = previousNumber + 1; missingNumber < number; missingNumber += 1) {
        const headingOffset = missingNumber - previousNumber - 1;
        const headingRow = missingHeadings[headingOffset] || contentHeadingRows[missingNumber - 1];
        if (headingRow && !hasSimilarTopic(repaired, headingRow.topic_name)) {
          output.push(buildDelimitedRepairHeadingRow(headingRow, missingNumber, row));
        }
      }
    }
    output.push(row);
    if (number != null) {
      previousNumber = number;
      previousNumberedRow = row;
    }
  }

  return output;
}

function findContentHeadingsBetween(contentHeadingRows, previousRow, nextRow) {
  if (!previousRow || !nextRow) return [];
  const previousIndex = findSimilarHeadingIndex(contentHeadingRows, previousRow.topic_name || previousRow.topicName || "");
  const nextIndex = findSimilarHeadingIndex(contentHeadingRows, nextRow.topic_name || nextRow.topicName || "");
  if (previousIndex < 0 || nextIndex < 0 || nextIndex <= previousIndex + 1) return [];
  return contentHeadingRows.slice(previousIndex + 1, nextIndex);
}

function findSimilarHeadingIndex(contentHeadingRows, topicName) {
  const key = normalizeTopicComparisonKey(topicName);
  return contentHeadingRows.findIndex((row) => normalizeTopicComparisonKey(row.topic_name || "") === key);
}

function repairMalformedDelimitedHours(row) {
  const hoursTotal = Number(row.hours_total ?? row.hoursTotal);
  const hoursTheory = Number(row.hours_theory ?? row.hoursTheory);
  const hoursPractice = row.hours_practice ?? row.hoursPractice;
  if (
    Number.isFinite(hoursTotal) &&
    Number.isFinite(hoursTheory) &&
    hoursTotal > 0 &&
    hoursTheory > hoursTotal &&
    hoursPractice == null
  ) {
    const originalCells = row.raw_payload?.cells || [];

    return {
      ...row,
      hours_theory: hoursTheory,
      hours_practice: null,
      source_excerpt: `${originalCells.map(cleanupLine).join(" / ")} / hours_inconsistent: theory exceeds total`.slice(0, 1500),
      raw_payload: {
        ...(row.raw_payload || {}),
        hours_inconsistent: {
          reason: "theory exceeds total and practice is empty",
          original_theory: hoursTheory,
          total: hoursTotal,
        },
      },
    };
  }
  return row;
}

function getDelimitedWholeRowNumber(row) {
  return getDelimitedWholeCellNumber(getDelimitedNumberText(row));
}

function getDelimitedNumberText(row) {
  return cleanupLine((row.raw_payload?.cells || [])[0] || "");
}

function getDelimitedWholeCellNumber(value) {
  const firstCell = cleanupLine(value);
  if (!/^\d{1,3}$/u.test(firstCell)) return null;
  const number = Number(firstCell);
  return Number.isInteger(number) && number > 0 && number < 300 ? number : null;
}

function hasSimilarTopic(rows, topicName) {
  const key = normalizeTopicComparisonKey(topicName);
  return rows.some((row) => normalizeTopicComparisonKey(row.topic_name || row.topicName || "") === key);
}

function buildDelimitedRepairHeadingRow(headingRow, missingNumber, nearbyRow) {
  const sectionTitle = nearbyRow.section_title || nearbyRow.sectionTitle || headingRow.section_title || "";
  return {
    ...headingRow,
    section_title: sectionTitle,
    source_section: sectionTitle || headingRow.source_section,
    topic_order: missingNumber,
    raw_payload: {
      ...(headingRow.raw_payload || {}),
      parser: "content-heading-hours-repair",
      repaired_missing_number: missingNumber,
    },
  };
}

function isStructuredDocxTableLine(line) {
  return /^(STRUCTURED_DOCX_TABLE_BEGIN|STRUCTURED_DOCX_TABLE_END|TABLE_ROW\b)/iu.test(line);
}

function splitDelimitedTableCells(line) {
  const body = line.replace(/^TABLE_ROW\s*\|\|/iu, "");
  return body.split(/\s*\|\|\s*/u).map((cell) => cleanupLine(cell));
}

function isDelimitedHeaderRow(cells) {
  if (cells.length >= 5 && isScheduleActivityCell(cells[0]) && parseHourCell(cells[1]) != null) {
    return false;
  }
  if (isDelimitedHourSubheaderRow(cells) && !cells.some((cell) => /(тема|раздел|название|наименование)/iu.test(cell))) {
    return false;
  }

  const text = cells.join(" ").toLowerCase();
  const hasTopicHeader =
    /(?:^|\s)(?:тем[аы](?:\s+занят(?:ий|ия)?)?|раздел(?:ы|а)?|виды\s+подготовки|содержание\s+программы)(?:\s|$)/iu.test(text) ||
    (/наименование/iu.test(text) && /час|теор|практ|всего|контрол/iu.test(text));
  if (!hasTopicHeader) return false;
  return /(?:^|\s)(?:час(?:ов|а)?|теори[яи]|практик[аи]?|всего|контрол[ья]?|кол-?во\s+час|количество\s+час)(?:\s|$)/iu.test(text);
}

function isDelimitedStudyPlanHeader(cells) {
  const text = cells.join(" ").toLowerCase();
  if (/форма\s+занят|дата|месяц|место\s+провед|календар/iu.test(text)) return false;
  return (
    /(наименование\s+(?:тем|раздел)|название\s+(?:тем|раздел)|тем[аы]\s+занят)/iu.test(text) &&
    /(кол-?во|количество)\s+час|всего|теор|практ/iu.test(text)
  );
}

function isDelimitedHourSubheaderRow(cells) {
  const text = cells.join(" ").toLowerCase();
  return /(всего|итого|общее)/iu.test(text) && /(теор|аудиторн)/iu.test(text) && /практ/iu.test(text);
}

function detectDelimitedHourOrder(cells) {
  const labels = cells.map((cell) => cleanupLine(cell).toLowerCase());
  const positions = {
    total: labels.findIndex((cell) => /(всего|итого|общее)/iu.test(cell)),
    theory: labels.findIndex((cell) => /теор|аудиторн/iu.test(cell)),
    practice: labels.findIndex((cell) => /практ/iu.test(cell)),
  };
  if (positions.total < 0 || positions.theory < 0 || positions.practice < 0) return null;
  return [positions.total, positions.theory, positions.practice].sort((left, right) => left - right).map((position) => {
    if (position === positions.total) return "total";
    if (position === positions.theory) return "theory";
    return "practice";
  });
}

function expandDelimitedGroupedHourHeader(headerCells, subheaderCells) {
  const groupedHourIndex = headerCells.findIndex((cell) => /(кол-?во|количество)\s+час|час(?:ов|ы)?$/iu.test(cell));
  if (groupedHourIndex < 0) return headerCells;
  if (
    subheaderCells.length >= headerCells.length &&
    subheaderCells.slice(0, groupedHourIndex).every((cell) => !cleanupLine(cell))
  ) {
    const merged = headerCells.map((cell, index) => {
      const subheader = cleanupLine(subheaderCells[index] || "").toLowerCase();
      if (/(всего|итого|общее|теор|аудиторн|практ)/iu.test(subheader)) return subheader;
      return cleanupLine(cell).toLowerCase();
    });
    const mergedText = merged.join(" ");
    if (/(всего|итого|общее)/iu.test(mergedText) && /(теор|аудиторн)/iu.test(mergedText) && /практ/iu.test(mergedText)) {
      return merged;
    }
  }
  const prefix = headerCells.slice(0, groupedHourIndex);
  const suffix = headerCells.slice(groupedHourIndex + 1);
  return [
    ...prefix,
    ...subheaderCells.filter((cell) => cleanupLine(cell)).map((cell) => cleanupLine(cell).toLowerCase()),
    ...suffix,
  ];
}

function parseDelimitedSectionTitle(cells, headerCells) {
  const indexes = inferDelimitedIndexes(cells, headerCells);
  const rawTitle = cleanupLine(cells[indexes.topicIndex] || "");
  if (!/^раздел\s+\d+/iu.test(rawTitle)) return "";
  return cleanupBasicStudyPlanTopicName(rawTitle) || rawTitle;
}

function isDelimitedSectionSummaryRow(row) {
  return isDelimitedSectionSummaryTopic(row?.topic_name || row?.topicName || "");
}

function isDelimitedSectionSummaryTopic(value) {
  return /^раздел\s+\d+(?:[.\s]|$)/iu.test(cleanupLine(value));
}

function isBlankNumberedDelimitedSectionRow(cells, headerCells) {
  return (
    headerCells &&
    isDelimitedNumberHeaderCell(headerCells[0]) &&
    !cleanupLine(cells[0] || "") &&
    /^раздел\s+\d+(?:[.\s]|$)/iu.test(cleanupLine(cells[1] || ""))
  );
}

function looksLikeDelimitedTopicRow(cells) {
  const numericCells = cells.filter((cell) => parseHourCell(cell) != null);
  if (numericCells.length < 2) return false;
  return cells.some((cell) => isValidTopic(cleanupTopicName(cell)));
}

function parseDelimitedTableRow({ cells, headerCells, hourOrder, currentSection, tableNumber }) {
  if (cells.some((cell) => TOTAL_RE.test(cell))) return null;

  const compactScheduleRow = parseCompactScheduleDelimitedRow({
    cells,
    headerCells,
    currentSection,
    tableNumber,
  });
  if (compactScheduleRow) return compactScheduleRow;

  if (isDelimitedHeaderRow(cells)) return null;

  const indexes = inferDelimitedIndexes(cells, headerCells);
  let rawTopicCell = cleanupLine(cells[indexes.topicIndex] || "");
  let topicName = cleanupTopicName(rawTopicCell);
  const genericTopicAllowed = isAllowedGenericDelimitedTopic(topicName, rawTopicCell, headerCells, indexes);
  if (!genericTopicAllowed && !isValidTopic(topicName)) {
    const bestTopicCell = findBestTopicCell(cells);
    rawTopicCell = cleanupLine(bestTopicCell);
    topicName = cleanupTopicName(bestTopicCell);
    indexes.topicIndex = cells.indexOf(bestTopicCell);
  }
  alignDelimitedIndexesToCells(cells, headerCells, indexes);
  if (/^раздел\s+\d+(?:[.\s]|$)/iu.test(rawTopicCell)) {
    topicName = rawTopicCell;
  }
  if (!genericTopicAllowed && !isValidTopic(topicName)) return null;

  const hours = inferDelimitedHours(cells, indexes, hourOrder);
  if (!hours || !isPlausibleHours(hours.hoursTheory, hours.hoursPractice, hours.hoursTotal)) return null;

  const controlForm = cleanupControlForm(cells[indexes.controlIndex] || "");
  const normalizedHours = normalizeDelimitedHoursByTopicContext(hours, topicName, controlForm, {
    headerCells,
  });
  const activityType = inferActivityTypeFromHours(normalizedHours.hoursTheory, normalizedHours.hoursPractice);
  const sourceRowNumber = getDelimitedWholeCellNumber(cells[0]);
  const hasNumberColumn = indexes.topicIndex > 0 && (!headerCells?.length || isDelimitedNumberHeaderCell(headerCells[0]));

  return {
    ...(hasNumberColumn && sourceRowNumber ? { topic_order: sourceRowNumber } : {}),
    section_title: currentSection || "",
    topic_name: topicName,
    hours_theory: normalizedHours.hoursTheory,
    hours_practice: normalizedHours.hoursPractice,
    hours_total: normalizedHours.hoursTotal,
    activity_type: activityType,
    control_form: controlForm,
    source_section: currentSection || "docx-structured-table",
    source_excerpt: cells.join(" / ").slice(0, 1500),
    confidence: headerCells ? 0.9 : 0.74,
    raw_payload: {
      parser: "docx-structured-table",
      table_number: tableNumber,
      cells,
      header_cells: headerCells || [],
      hour_order: hourOrder || [],
      ...(sourceRowNumber ? { source_topic_number: sourceRowNumber } : {}),
      ...(genericTopicAllowed ? { allow_generic_topic: true } : {}),
    },
  };
}

function normalizeDelimitedHoursByTopicContext(hours, topicName, controlForm, context = {}) {
  if (isTotalOnlyCalendarDelimitedHeader(context.headerCells || [])) {
    return hours;
  }

  if (
    hours.hoursTotal != null &&
    hours.hoursTheory == null &&
    hours.hoursPractice == null &&
    isStrongPracticeOnlyTopic(topicName)
  ) {
    return {
      hoursTheory: 0,
      hoursPractice: hours.hoursTotal,
      hoursTotal: hours.hoursTotal,
    };
  }

  return hours;
}

function isTotalOnlyCalendarDelimitedHeader(headerCells) {
  const header = (headerCells || []).join(" ");
  return (
    /дата|месяц|число|календар/iu.test(header) &&
    /(кол-?во\s+час|количество\s+час|час(?:ов|а)?)/iu.test(header) &&
    !/(теори[яи]|практик[аи]?|аудиторн)/iu.test(header)
  );
}

function isStrongPracticeOnlyTopic(topicName) {
  const text = cleanupLine(topicName).toLowerCase();
  if (!text) return false;
  return /(практик|практич|отработк|экскурс|соревн|квест|проект|норматив|зач[её]т|маршрут)/iu.test(text);
}

function isAllowedGenericDelimitedTopic(topicName, rawTopicCell, headerCells, indexes) {
  if (!headerCells || indexes.topicIndex < 0) return false;
  const header = cleanupLine(headerCells[indexes.topicIndex] || "");
  if (!/(тема|название|наименование|содержание)/iu.test(header)) return false;
  return /^практика\.?$/iu.test(cleanupLine(topicName || rawTopicCell));
}

function parseCompactScheduleDelimitedRow({ cells, headerCells, currentSection, tableNumber }) {
  if (!isCompactScheduleDelimitedRow(cells, headerCells)) return null;

  const activityLine = cleanupLine(cells[0]);
  const hoursTotal = parseHourCell(cells[1]);
  const topicName = cleanupCompactScheduleTopicName(cells[2]);
  if (hoursTotal == null || hoursTotal <= 0 || hoursTotal > 1000 || !isValidCompactScheduleTopic(topicName)) return null;

  const allocation = allocateHoursByActivity(activityLine, hoursTotal);
  const controlForm = cleanupControlForm(cells[4] || "");

  return {
    section_title: currentSection || "Календарный учебный график",
    topic_name: topicName,
    hours_theory: allocation.hoursTheory,
    hours_practice: allocation.hoursPractice,
    hours_total: hoursTotal,
    activity_type:
      normalizeExplicitActivityType(activityLine) ||
      inferActivityType({
        topicName,
        controlForm,
        hoursTheory: allocation.hoursTheory,
        hoursPractice: allocation.hoursPractice,
      }),
    control_form: controlForm,
    source_section: currentSection || "docx-structured-schedule",
    source_excerpt: cells.join(" / ").slice(0, 1500),
    confidence: 0.88,
    raw_payload: {
      parser: "docx-structured-schedule",
      table_number: tableNumber,
      cells,
      header_cells: headerCells || [],
      activity_line: activityLine,
      place: cleanupLine(cells[3] || ""),
    },
  };
}

function isCompactScheduleDelimitedRow(cells, headerCells) {
  if (!headerCells || cells.length < 5) return false;
  const header = headerCells.join(" ");
  if (!/форма\s+занят/iu.test(header) || !/кол-?во\s+час/iu.test(header) || !/тема\s+занят/iu.test(header)) {
    return false;
  }
  if (!/место\s+провед/iu.test(header) || !/форма\s+контрол/iu.test(header)) return false;
  return (
    isScheduleActivityCell(cells[0]) &&
    parseHourCell(cells[1]) != null &&
    isValidCompactScheduleTopic(cleanupCompactScheduleTopicName(cells[2]))
  );
}

function isScheduleActivityCell(value) {
  const cleaned = cleanupLine(value);
  return (
    isActivityTypeLine(cleaned) ||
    /(занятие|бесед|тестирован|соревнован|сл[её]т|поход|экскурси|практическ|тематическ)/iu.test(cleaned)
  );
}

function cleanupCompactScheduleTopicName(value) {
  const topic = cleanupTopicName(value).replace(/\(\s*приказ\s+и\s+маршрутный\s+лист\s*\)/iu, "(маршрутный лист)");
  if (topic.length <= 260) return topic;

  const sentences = topic.split(/(?<=[.!?])\s+/u);
  let shortened = "";
  for (const sentence of sentences) {
    const candidate = [shortened, sentence].filter(Boolean).join(" ");
    if (candidate.length > 240) break;
    shortened = candidate;
  }

  if (shortened.length >= 20) return shortened;
  return topic.slice(0, 257).replace(/\s+\S*$/u, "").trim();
}

function isValidCompactScheduleTopic(topic) {
  if (isValidTopic(topic)) return true;
  const cleaned = cleanupLine(topic);
  if (cleaned.length < 12 || cleaned.length > 260) return false;
  if (/^[\d\s.,:-]+$/u.test(cleaned)) return false;
  if (/^(месяц|тема|раздел|занятие|количество|форма|контроль|теория|практика|всего|час|часа|часов)$/iu.test(cleaned)) {
    return false;
  }
  return /(поход|маршрут|турист|соревнован|сл[её]т|ориентирован|бивак|снаряжен|краевед|занятие)/iu.test(cleaned);
}

function inferDelimitedIndexes(cells, headerCells) {
  const indexes = {
    topicIndex: -1,
    theoryIndex: -1,
    practiceIndex: -1,
    totalIndex: -1,
    controlIndex: -1,
    activityIndex: -1,
  };

  if (headerCells) {
    for (let index = 0; index < headerCells.length; index += 1) {
      const header = headerCells[index];
      if (
        indexes.topicIndex < 0 &&
        (/(тем[аы](?:\s+занят(?:ий|ия)?)?|раздел|виды\s+подготовки|содержание\s+программы)/iu.test(header) ||
          (/наименование/iu.test(header) && /(час|теор|практ|всего|контрол)/iu.test(headerCells.join(" "))))
      ) {
        indexes.topicIndex = index;
      }
      if (indexes.theoryIndex < 0 && /теор|аудиторн/iu.test(header)) indexes.theoryIndex = index;
      if (indexes.practiceIndex < 0 && /практ/iu.test(header)) indexes.practiceIndex = index;
      if (indexes.totalIndex < 0 && /(всего|итого|общее|кол-?во|количество\s+час)/iu.test(header)) {
        indexes.totalIndex = index;
      }
      if (indexes.controlIndex < 0 && /(контрол|аттеста|провер|форма\s+подвед)/iu.test(header)) {
        indexes.controlIndex = index;
      }
      if (indexes.activityIndex < 0 && /(форма\s+занят|тип|вид\s+занят|деятельност)/iu.test(header)) {
        indexes.activityIndex = index;
      }
    }
  }

  if (indexes.topicIndex < 0) {
    indexes.topicIndex = cells.indexOf(findBestTopicCell(cells));
  }

  alignDelimitedIndexesToCells(cells, headerCells, indexes);

  return indexes;
}

function alignDelimitedIndexesToCells(cells, headerCells, indexes) {
  if (!headerCells || headerCells.length < 2) return;
  if (!isDelimitedNumberHeaderCell(headerCells[0])) return;
  if (indexes.topicIndex !== 0) return;
  if (parseHourCell(cells[0]) != null) return;
  const shouldShift = headerCells.length === cells.length + 1 || !/^\d+(?:[.)]|\.\d)/u.test(cleanupLine(cells[0]));
  if (!shouldShift) return;

  for (const key of ["theoryIndex", "practiceIndex", "totalIndex", "controlIndex", "activityIndex"]) {
    if (indexes[key] > 0) indexes[key] -= 1;
  }
}

function isDelimitedNumberHeaderCell(value) {
  return /^(?:№(?:\s*п\/?п)?|n\s*п\/?п|п\/?п|номер)$/iu.test(cleanupLine(value));
}

function findBestTopicCell(cells) {
  const candidates = cells
    .map((cell, index) => ({ cell, index, topic: cleanupTopicName(cell), numeric: parseHourCell(cell) != null }))
    .filter((item) => !item.numeric && isValidTopic(item.topic) && !isLikelyControlForm(item.topic));

  if (!candidates.length) return "";
  candidates.sort((left, right) => right.topic.length - left.topic.length || left.index - right.index);
  return candidates[0].cell;
}

function inferDelimitedHours(cells, indexes, hourOrder) {
  let hoursTheory = parseHourCell(cells[indexes.theoryIndex]);
  let hoursPractice = parseHourCell(cells[indexes.practiceIndex]);
  let hoursTotal = parseHourCell(cells[indexes.totalIndex]);

  if (hoursTotal == null && (hoursTheory != null || hoursPractice != null)) {
    hoursTotal = roundHour((hoursTheory || 0) + (hoursPractice || 0));
  }

  if (hoursTotal != null || hoursTheory != null || hoursPractice != null) {
    return adjustCollapsedDelimitedHourCells({
      hoursTheory,
      hoursPractice,
      hoursTotal,
    }, cells, indexes);
  }

  const orderedHours = inferDelimitedHoursByOrder(cells, indexes, hourOrder);
  if (orderedHours) return orderedHours;

  const numericCells = cells
    .map((cell, index) => ({ index, value: parseHourCell(cell) }))
    .filter((item) => indexes.topicIndex < 0 || item.index > indexes.topicIndex)
    .filter((item) => item.value != null);

  if (numericCells.length >= 3) {
    const lastThree = numericCells.slice(-3).map((item) => item.value);
    const totalTheoryPractice = {
      hoursTheory: lastThree[1],
      hoursPractice: lastThree[2],
      hoursTotal: lastThree[0],
    };
    if (isPlausibleHours(totalTheoryPractice.hoursTheory, totalTheoryPractice.hoursPractice, totalTheoryPractice.hoursTotal)) {
      return totalTheoryPractice;
    }
    return {
      hoursTheory: lastThree[0],
      hoursPractice: lastThree[1],
      hoursTotal: lastThree[2],
    };
  }

  if (numericCells.length === 2) {
    const [first, second] = numericCells.map((item) => item.value);
    if (first >= second) {
      return {
        hoursTheory: second,
        hoursPractice: roundHour(first - second),
        hoursTotal: first,
      };
    }
    if (second >= first) {
      return {
        hoursTheory: first,
        hoursPractice: roundHour(second - first),
        hoursTotal: second,
      };
    }
    return {
      hoursTheory: null,
      hoursPractice: null,
      hoursTotal: roundHour(first + second),
    };
  }

  return null;
}

function inferDelimitedHoursByOrder(cells, indexes, hourOrder) {
  if (!hourOrder || hourOrder.length !== 3) return null;

  const numericCells = cells
    .map((cell, index) => ({ index, value: parseHourCell(cell) }))
    .filter((item) => indexes.topicIndex < 0 || item.index > indexes.topicIndex)
    .filter((item) => item.value != null)
    .slice(0, 3);

  if (numericCells.length < 2) return null;

  const values = {};
  for (let index = 0; index < Math.min(hourOrder.length, numericCells.length); index += 1) {
    values[hourOrder[index]] = numericCells[index].value;
  }

  fillMissingHourByTotal(values);

  return adjustCollapsedDelimitedHourCells({
    hoursTheory: values.theory ?? null,
    hoursPractice: values.practice ?? null,
    hoursTotal: values.total ?? null,
  }, cells, indexes);
}

function adjustCollapsedDelimitedHourCells(hours, cells, indexes) {
  if (hours.hoursTotal == null) {
    return hours;
  }

  if (
    hours.hoursTheory != null &&
    hours.hoursPractice != null &&
    hours.hoursTheory === hours.hoursPractice &&
    hours.hoursTheory === hours.hoursTotal
  ) {
    const tailStart = indexes.practiceIndex >= 0 ? indexes.practiceIndex + 1 : cells.length;
    const tail = cells.slice(tailStart).map(cleanupLine).join(" ");
    if (looksLikePracticeOnlyDelimitedTail(tail)) {
      return {
        hoursTheory: 0,
        hoursPractice: hours.hoursTotal,
        hoursTotal: hours.hoursTotal,
      };
    }
    return {
      hoursTheory: hours.hoursTotal,
      hoursPractice: 0,
      hoursTotal: hours.hoursTotal,
    };
  }

  if (hours.hoursTheory != null && (hours.hoursPractice == null || hours.hoursPractice === 0)) {
    if (indexes.practiceIndex >= 0 && indexes.practiceIndex < cells.length) {
      const practiceCell = cleanupLine(cells[indexes.practiceIndex] || "");
      const tail = cells.slice(indexes.practiceIndex).map(cleanupLine).join(" ");
      if (parseHourCell(practiceCell) == null && looksLikePracticeOnlyDelimitedTail(tail)) {
        const practice = hours.hoursTheory;
        return {
          hoursTheory: hours.hoursTotal >= practice ? roundHour(hours.hoursTotal - practice) : 0,
          hoursPractice: practice,
          hoursTotal: hours.hoursTotal,
        };
      }
    }

    if (hours.hoursTotal >= hours.hoursTheory) {
      return {
        hoursTheory: hours.hoursTheory,
        hoursPractice: roundHour(hours.hoursTotal - hours.hoursTheory),
        hoursTotal: hours.hoursTotal,
      };
    }
  }

  if (hours.hoursTheory == null && hours.hoursPractice != null && hours.hoursTotal >= hours.hoursPractice) {
    return {
      hoursTheory: roundHour(hours.hoursTotal - hours.hoursPractice),
      hoursPractice: hours.hoursPractice,
      hoursTotal: hours.hoursTotal,
    };
  }

  return hours;
}

function looksLikePracticeOnlyDelimitedTail(value) {
  const text = cleanupLine(value).toLowerCase();
  if (!text) return false;
  if (/(опрос|бесед|тестов|контрольн)/iu.test(text) && !/(проект|практик|практич|соревн|экскурс|квест|норматив|зач[её]т)/iu.test(text)) {
    return false;
  }
  return /(практик|практич|отработк|экскурс|соревн|квест|проект|норматив|профессиональн|зач[её]т|маршрут|поход)/iu.test(text);
}

function fillMissingHourByTotal(values) {
  if (values.total == null) {
    if (values.theory != null && values.practice != null) {
      values.total = roundHour(values.theory + values.practice);
    }
    return;
  }

  if (values.theory != null && values.practice == null && values.total >= values.theory) {
    values.practice = roundHour(values.total - values.theory);
  }
  if (values.practice != null && values.theory == null && values.total >= values.practice) {
    values.theory = roundHour(values.total - values.practice);
  }
}

function extractVerticalCalendarRows(lines) {
  const topics = [];
  let insideCalendar = false;
  let currentSection = "";

  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line) continue;

    if (/календарн(?:ый|ого)\s+учебн(?:ый|ого)\s+график|календарн[оы]\s*[- ]?\s*тематическ/iu.test(line)) {
      insideCalendar = true;
      currentSection = line.slice(0, 180);
      continue;
    }

    if (!insideCalendar && !/^тема\s+занятия$/iu.test(line)) {
      continue;
    }

    if (insideCalendar && HARD_STOP_RE.test(line)) {
      insideCalendar = false;
      continue;
    }

    if (!isMonthLine(line)) {
      continue;
    }

    const parsed = parseVerticalCalendarRow(lines, index, currentSection);
    if (!parsed) continue;

    topics.push(parsed.topic);
    index = parsed.nextIndex;
  }

  return topics;
}

function parseVerticalCalendarRow(lines, startIndex, currentSection) {
  const month = cleanupLine(lines[startIndex]);
  const window = [];
  for (let offset = 1; offset <= 10 && startIndex + offset < lines.length; offset += 1) {
    const candidate = cleanupLine(lines[startIndex + offset]);
    if (!candidate || candidate === "•") continue;
    if (offset > 1 && isMonthLine(candidate)) break;
    window.push({ index: startIndex + offset, line: candidate });
  }

  const activity = window.find((item) => isActivityTypeLine(item.line));
  if (!activity) return null;

  const hours = window.find((item) => item.index > activity.index && isSingleHourLine(item.line));
  if (!hours) return null;

  const topic = window.find(
    (item) =>
      item.index > hours.index &&
      isValidTopic(cleanupTopicName(item.line)) &&
      !isLikelyPlace(item.line) &&
      !isLikelyControlForm(item.line),
  );
  if (!topic) return null;

  const control = window.find((item) => item.index > topic.index && isLikelyControlForm(item.line));
  const rawHours = Number(hours.line.replace(",", "."));
  if (!Number.isFinite(rawHours) || rawHours <= 0 || rawHours > 1000) return null;

  const allocation = allocateHoursByActivity(activity.line, rawHours);
  const topicName = cleanupTopicName(topic.line);
  const controlForm = cleanupControlForm(control?.line || "");

  return {
    nextIndex: Math.max(topic.index, control?.index || topic.index),
    topic: {
      section_title: currentSection || "Календарный учебный график",
      topic_name: topicName,
      hours_theory: allocation.hoursTheory,
      hours_practice: allocation.hoursPractice,
      hours_total: rawHours,
      activity_type:
        normalizeExplicitActivityType(activity.line) ||
        inferActivityType({
          topicName,
          controlForm,
          hoursTheory: allocation.hoursTheory,
          hoursPractice: allocation.hoursPractice,
        }),
      control_form: controlForm,
      source_section: currentSection || "vertical-calendar-schedule",
      source_excerpt: [month, ...window.map((item) => item.line)].join(" / ").slice(0, 1500),
      confidence: 0.82,
      raw_payload: {
        parser: "vertical-calendar-schedule",
        month,
        activity_type_line: activity.line,
        hours_line: hours.line,
        topic_line: topic.line,
        control_line: control?.line || "",
      },
    },
  };
}

function extractWideTrainingPlanRows(lines) {
  const topics = [];
  let insidePlan = false;
  let currentSection = "";

  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line) continue;

    if (/годовой\s+учебн[оы]\s*[- ]?\s*тренировочн|виды\s+подготовки\s+и\s+иные\s+мероприятия/iu.test(line)) {
      insidePlan = true;
      currentSection = line.slice(0, 180);
      continue;
    }

    if (insidePlan && HARD_STOP_RE.test(line)) {
      insidePlan = false;
      continue;
    }

    if (!insidePlan || !isTrainingTopicLine(line)) {
      continue;
    }

    const numbers = collectFollowingNumericLines(lines, index + 1, 8);
    if (numbers.values.length < 2) continue;
    const hoursTotal = roundHour(Math.max(...numbers.values));
    if (!isPlausibleAggregateHours(hoursTotal)) continue;

    const topicName = cleanupTopicName(line);
    if (!isValidTopic(topicName)) continue;

    topics.push({
      section_title: currentSection || "Годовой учебно-тренировочный план",
      topic_name: topicName,
      hours_theory: isTheoryTrainingTopic(topicName) ? hoursTotal : null,
      hours_practice: isTheoryTrainingTopic(topicName) ? null : hoursTotal,
      hours_total: hoursTotal,
      activity_type: inferTrainingActivityType(topicName),
      control_form: "",
      source_section: currentSection || "wide-training-plan",
      source_excerpt: [line, ...numbers.lines].join(" / ").slice(0, 1500),
      confidence: 0.72,
      raw_payload: {
        parser: "wide-training-plan",
        values_by_stage: numbers.values,
        source_lines: [line, ...numbers.lines],
      },
    });

    index = numbers.nextIndex - 1;
  }

  return topics;
}

function parseCalendarRow(line, buffer, currentSection) {
  const parsed = splitTrailingHours(line);
  if (!parsed) return null;

  const topicParts = [];
  const lineTopic = cleanupTopicName(parsed.topic);
  if (isValidTopic(lineTopic)) {
    topicParts.push(lineTopic);
  }

  if (buffer.length && shouldUseBufferedTopic(lineTopic)) {
    topicParts.unshift(...buffer.slice(-5).map(cleanupTopicName).filter(Boolean));
  }

  const topicName = cleanupTopicName(topicParts.join(" "));
  if (!isValidTopic(topicName)) return null;

  const controlForm = cleanupControlForm(parsed.tail);
  const activityType = inferActivityType({
    topicName,
    controlForm,
    hoursTheory: parsed.hoursTheory,
    hoursPractice: parsed.hoursPractice,
    hoursTotal: parsed.hoursTotal,
  });

  return {
    section_title: currentSection || "",
    topic_name: topicName,
    hours_theory: parsed.hoursTheory,
    hours_practice: parsed.hoursPractice,
    hours_total: parsed.hoursTotal,
    activity_type: activityType,
    control_form: controlForm,
    source_section: currentSection || "calendar-topic-plan",
    source_excerpt: [...buffer.slice(-3), line].join(" / ").slice(0, 1500),
    confidence: estimateConfidence(parsed, topicName, currentSection),
    raw_payload: {
      line,
      buffered_lines: buffer.slice(-5),
      parsed_hours: parsed.rawHours,
      control_form: controlForm,
    },
  };
}

function splitTrailingHours(line) {
  const normalized = line.replace(/\s+/g, " ").trim();
  const hoursOnlyMatch = normalized.match(
    /^((?:-|\d+(?:[,.]\d+)?)\s+(?:-|\d+(?:[,.]\d+)?)(?:\s+(?:-|\d+(?:[,.]\d+)?))?)(?:\s+(.+))?$/u,
  );
  if (hoursOnlyMatch) {
    return buildHourParse("", hoursOnlyMatch[1], hoursOnlyMatch[2] || "");
  }

  const match = normalized.match(
    /^(.+?)\s+((?:-|\d+(?:[,.]\d+)?)\s+(?:-|\d+(?:[,.]\d+)?)(?:\s+(?:-|\d+(?:[,.]\d+)?))?)(?:\s+(.+))?$/u,
  );
  if (!match) return null;

  return buildHourParse(match[1], match[2], match[3] || "");
}

function buildHourParse(topic, rawHours, tail) {
  if (/^-\s+\d/.test(rawHours) && /^час(?:а|ов)?\.?$/iu.test(String(tail || "").trim())) {
    return null;
  }

  const rawNumbers = rawHours.split(/\s+/).map(parseHourCell);
  if (rawNumbers.length < 2 || rawNumbers.every((value) => value == null)) return null;

  let hoursTheory = null;
  let hoursPractice = null;
  let hoursTotal = null;

  if (rawNumbers.length >= 3) {
    [hoursTheory, hoursPractice, hoursTotal] = rawNumbers;
  } else {
    hoursTheory = rawNumbers[0];
    hoursTotal = rawNumbers[1];
    if (hoursTheory != null && hoursTotal != null && hoursTotal >= hoursTheory) {
      hoursPractice = roundHour(hoursTotal - hoursTheory);
    }
  }

  if (hoursTotal == null && (hoursTheory != null || hoursPractice != null)) {
    hoursTotal = roundHour((hoursTheory || 0) + (hoursPractice || 0));
  }

  if (!isPlausibleHours(hoursTheory, hoursPractice, hoursTotal)) return null;

  return {
    topic,
    tail,
    hoursTheory,
    hoursPractice,
    hoursTotal,
    rawHours,
  };
}

function parseHourCell(value) {
  if (value === "-") return 0;
  if (!cleanupLine(value)) return null;
  const normalized = String(value)
    .trim()
    .replace(/[lIІі]/g, "1")
    .replace(/[Зз]/g, "3")
    .replace(/^[Jj]$/g, "3")
    .replace(/[)](?=\d)/g, "2")
    .replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function postProcessExtractedTopics(topics) {
  const result = [];

  for (const topic of topics) {
    const normalizedTopic = normalizeExtractedTopic(topic);
    if (!normalizedTopic) continue;
    result.push(normalizedTopic);
  }

  return dedupeRepeatedStudyPlanBlocks(dedupeExactStudyPlanTopicRows(result));
}

function dedupeExactStudyPlanTopicRows(topics) {
  const seen = new Set();
  const result = [];

  for (const topic of topics) {
    const source = cleanupLine(topic.source_section || topic.raw_payload?.parser || "");
    const shouldDedupe = /^generic-numbered-study-plan$/iu.test(
      source,
    );
    const key = [
      source,
      normalizeTopicComparisonKey(topic.topic_name),
      normalizeNullableHour(topic.hours_total),
      normalizeNullableHour(topic.hours_theory),
      normalizeNullableHour(topic.hours_practice),
    ].join("|");
    if (shouldDedupe && seen.has(key)) continue;
    if (shouldDedupe) seen.add(key);
    result.push(topic);
  }

  return result;
}

function dedupeRepeatedStudyPlanBlocks(topics) {
  const result = [];
  let index = 0;

  while (index < topics.length) {
    const replacement = findRepeatedStudyPlanBlock(topics, index);
    if (replacement) {
      result.push(...replacement.rows);
      index = replacement.nextIndex;
      continue;
    }

    result.push(topics[index]);
    index += 1;
  }

  return result;
}

function findRepeatedStudyPlanBlock(topics, startIndex) {
  const maxSize = Math.floor((topics.length - startIndex) / 2);
  for (let size = maxSize; size >= 3; size -= 1) {
    const left = topics.slice(startIndex, startIndex + size);
    const right = topics.slice(startIndex + size, startIndex + size * 2);
    if (!areRepeatedStudyPlanBlocks(left, right)) continue;

    return {
      rows: selectBestAlternativeStudyPlanRange([left, right]),
      nextIndex: startIndex + size * 2,
    };
  }

  return null;
}

function areRepeatedStudyPlanBlocks(left, right) {
  if (![...left, ...right].every(isRepeatedStudyPlanBlockCandidate)) return false;
  if (!areAlternativeStudyPlanRanges(left, right)) return false;
  const comparable = Math.min(left.length, right.length);
  let sameTotals = 0;
  for (let index = 0; index < comparable; index += 1) {
    if (Number(left[index].hours_total) === Number(right[index].hours_total)) sameTotals += 1;
  }
  return sameTotals >= Math.ceil(comparable * 0.8);
}

function isRepeatedStudyPlanBlockCandidate(row) {
  return /^(basic-study-plan|named-study-plan|annual-study-plan|cell-wise-study-plan|title-first-cell-wise-study-plan|course-planning-summary|compact-study-plan|section-topic-hour-plan|generic-numbered-study-plan)$/iu.test(
    row.source_section || "",
  );
}

function normalizeExtractedTopic(topic) {
  const topicName = cleanupExtractedTopicName(topic.topic_name);
  const allowGenericTopic = Boolean(topic.raw_payload?.allow_generic_topic);
  const allowFragmentedCalendarTopic = isFragmentedDocxCalendarTopic(topicName, topic);
  const allowServiceOnlyTopic = isStandaloneAssessmentStudyPlanTopic(topicName, topic);
  const allowEquipmentStudyPlanTopic = isNumberedEquipmentStudyPlanTopic(topicName, topic);
  const allowLongBasicTopic = isLongBasicStudyPlanTopic(topicName, topic);
  const allowBasicLiteratureActivityTopic = isBasicStudyPlanLiteratureActivityTopic(topicName, topic);
  if (
    !allowGenericTopic &&
    !allowFragmentedCalendarTopic &&
    !allowLongBasicTopic &&
    !allowBasicLiteratureActivityTopic &&
    !isValidTopic(topicName)
  ) {
    return null;
  }
  if (
    !allowGenericTopic &&
    !allowFragmentedCalendarTopic &&
    (isTotalTopicName(topicName) || (!allowServiceOnlyTopic && isServiceOnlyTopicName(topicName)))
  ) {
    return null;
  }
  if (
    !allowGenericTopic &&
    !allowEquipmentStudyPlanTopic &&
    !allowBasicLiteratureActivityTopic &&
    isBibliographicOrEquipmentTopic(topicName)
  ) {
    return null;
  }

  const cleaned = {
    ...topic,
    section_title: cleanupExtractedSectionTitle(topic.section_title, topic.source_section),
    topic_name: topicName,
    control_form: cleanupControlForm(topic.control_form),
  };

  const controlSplit = allowServiceOnlyTopic
    ? { topicName: cleaned.topic_name, controlForm: "" }
    : splitControlTail(cleaned.topic_name);
  if (controlSplit.topicName !== cleaned.topic_name) {
    cleaned.topic_name = controlSplit.topicName;
    cleaned.control_form = cleanupControlForm([cleaned.control_form, controlSplit.controlForm].filter(Boolean).join(", "));
  }

  const allowCleanedLongBasicTopic = isLongBasicStudyPlanTopic(cleaned.topic_name, cleaned);
  const allowCleanedBasicLiteratureActivityTopic = isBasicStudyPlanLiteratureActivityTopic(cleaned.topic_name, cleaned);
  if (
    !allowGenericTopic &&
    !allowFragmentedCalendarTopic &&
    !allowCleanedLongBasicTopic &&
    !allowCleanedBasicLiteratureActivityTopic &&
    !isValidTopic(cleaned.topic_name)
  ) {
    return null;
  }
  if (
    !allowGenericTopic &&
    !allowFragmentedCalendarTopic &&
    (isTotalTopicName(cleaned.topic_name) || (!allowServiceOnlyTopic && isServiceOnlyTopicName(cleaned.topic_name)))
  ) {
    return null;
  }

  const hours = normalizeExtractedHours(cleaned);
  cleaned.hours_theory = hours.hoursTheory;
  cleaned.hours_practice = hours.hoursPractice;
  cleaned.hours_total = hours.hoursTotal;
  cleaned.activity_type = inferActivityType({
    topicName: cleaned.topic_name,
    controlForm: cleaned.control_form,
    hoursTheory: cleaned.hours_theory,
    hoursPractice: cleaned.hours_practice,
  });

  if (hours.warning) {
    cleaned.raw_payload = {
      ...(cleaned.raw_payload || {}),
      postprocess_warning: hours.warning,
    };
    cleaned.confidence = Math.min(cleaned.confidence || 0.7, 0.62);
  }

  return cleaned;
}

function isFragmentedDocxCalendarTopic(topicName, topic) {
  const parser = cleanupLine(topic?.raw_payload?.parser || "");
  if (!/^fragmented-docx-calendar$/iu.test(parser)) return false;
  return isValidFragmentedDocxCalendarTopic(topicName);
}

function isStandaloneAssessmentStudyPlanTopic(topicName, topic) {
  const cleanedName = cleanupLine(topicName);
  if (!/^(?:входящая|текущая|промежуточная|итоговая)?\s*(?:аттестация|диагностика|контроль)\.?$/iu.test(cleanedName)) {
    return false;
  }

  const source = cleanupLine(topic?.source_section || topic?.raw_payload?.parser || "");
  if (!/^(basic-study-plan|annual-study-plan|cell-wise-study-plan|title-first-cell-wise-study-plan|course-planning-summary|section-topic-hour-plan|generic-numbered-study-plan|textutil-delimited-study-plan|alphabetic-tourism-study-plan|calendar-study-schedule)$/iu.test(source)) {
    return false;
  }

  const planNumber = cleanupLine(topic?.plan_number || topic?.raw_payload?.plan_number || "");
  if (!/^\d+(?:\.\d+)*\.?$/u.test(planNumber)) return false;

  const hoursTheory = normalizeNullableHour(topic?.hours_theory);
  const hoursPractice = normalizeNullableHour(topic?.hours_practice);
  const hoursTotal = normalizeNullableHour(topic?.hours_total);
  const resolvedTotal = hoursTotal ?? (
    hoursTheory != null || hoursPractice != null
      ? roundHour((hoursTheory || 0) + (hoursPractice || 0))
      : null
  );

  return resolvedTotal != null && resolvedTotal > 0;
}

function isLongBasicStudyPlanTopic(topicName, topic) {
  const source = cleanupLine(topic?.source_section || topic?.raw_payload?.parser || "");
  if (!/^basic-study-plan$/iu.test(source)) return false;
  return isLongBasicStudyPlanTopicName(topicName);
}

function isLongBasicStudyPlanTopicName(topicName) {
  const text = cleanupLine(topicName);
  if (text.length <= 260 || text.length > 320) return false;
  if (/^[\d\s.,:-]+$/u.test(text)) return false;
  if (isTotalTopicName(text) || isServiceOnlyTopicName(text)) return false;
  if (/(?:федеральн|постановление|приказ|санпин|литератур|нормативно|концепци|распоряжение|www\.|http)/iu.test(text)) {
    return false;
  }
  return /[А-ЯЁа-яё]/u.test(text);
}

function isNumberedEquipmentStudyPlanTopic(topicName, topic) {
  const cleanedName = cleanupLine(topicName);
  if (!/(?:снаряжени[ея]|оборудовани[ея]|инвентар)/iu.test(cleanedName)) return false;
  if (/(?:список\s+литературы|литература|учебно-?методическ|изд\.|издательство|https?:\/\/|www\.)/iu.test(cleanedName)) {
    return false;
  }

  const source = cleanupLine(topic?.source_section || topic?.raw_payload?.parser || "");
  const parser = cleanupLine(topic?.raw_payload?.parser || "");
  const isStudyPlanSource =
    /учебн[оы]\s*[- ]?\s*тематическ(?:ий|ого)?\s+план|учебн(?:ый|ого)\s+план/iu.test(source) ||
    /^(basic-study-plan|second-year-table-three-study-plan|annual-study-plan|cell-wise-study-plan|title-first-cell-wise-study-plan|course-planning-summary|section-topic-hour-plan|generic-numbered-study-plan|textutil-delimited-study-plan|alphabetic-tourism-study-plan|course-year-study-plan|docx-structured-table|numbered-calendar-schedule|ocr-split-header-study-plan)$/iu.test(
      parser || source,
    );
  if (!isStudyPlanSource) return false;

  const planNumber = cleanupLine(
    topic?.plan_number ||
    topic?.raw_payload?.plan_number ||
    (Array.isArray(topic?.raw_payload?.cells) ? topic.raw_payload.cells[0] : ""),
  );

  const hoursTotal = normalizeNullableHour(topic?.hours_total);
  if (hoursTotal == null || hoursTotal <= 0) return false;
  if (/^\d+(?:\.\d+)*\.?$/u.test(planNumber)) return true;

  const sourceText = cleanupLine([topic?.topic_name, topic?.control_form, topic?.source_excerpt].filter(Boolean).join(" "));
  return (
    /^(?:basic-study-plan|generic-numbered-study-plan|ocr-split-header-study-plan)$/iu.test(source || parser) &&
    hoursTotal <= 8 &&
    /(?:вид\s+туризма|снаряжени[ея]|оборудовани[ея]|инвентарь)/iu.test(cleanedName) &&
    /(?:лекци|практическ|контроль|диагностик|викторин|зач[её]т|наблюдени|опрос|соревновани)/iu.test(sourceText)
  );
}

function cleanupExtractedTopicName(value) {
  return stripLeadingHourFragments(cleanupTopicName(value))
    .replace(/^(?:(?:наблюдение|опрос|зач[её]т|тестирование|соревнование)\.?\s+){1,3}(?=[А-ЯЁ])/iu, "")
    .replace(/\s+(?:итого|всего)\s*:?\s*\d+(?:[,.]\d+)?(?:\s+\d+(?:[,.]\d+)?){0,4}\s*$/iu, "")
    .replace(/\s+\b(?:итого|всего)\b\s*$/iu, "")
    .replace(/\s+(?:форма\s+контроля|формы\s+контроля)\s*:?$/iu, "")
    .replace(/^\s*(?:текущий|промежуточный|итоговый)\s+контроль\s*:?/iu, "")
    .replace(
      /\s+(?:(?:лекция|игра-?\s*викторина|практическая\s+работа|текущий\s+контроль|входящая\s+диагностика|промежуточная\s+диагностика)(?:\s*,?\s*|\s+))*$/iu,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function stripLeadingHourFragments(value) {
  let text = cleanupLine(value);
  if (!/^(?:,\d{1,2}|\d{1,3},\d{1,2})(?:\s|$)/u.test(text)) return text;

  while (true) {
    const next = text
      .replace(/^(?:,\d{1,2}|\d{1,3},\d{1,2}|\d{1,3})(?:\s+|$)/u, "")
      .trim();
    if (next === text) break;
    text = next;
  }

  return text.replace(/^\d{1,3}[.)]\s*/u, "").replace(/^[,.;:\s-]+/u, "").trim();
}

function cleanupExtractedSectionTitle(value, sourceSection) {
  const section = cleanupLine(value);
  if (isTotalTopicName(section) || isServiceOnlyTopicName(section)) return "Учебный план";
  if (/^(basic-study-plan|named-study-plan|annual-study-plan|cell-wise-study-plan|title-first-cell-wise-study-plan|course-planning-summary|section-topic-hour-plan|total-only-study-plan|generic-numbered-study-plan)$/iu.test(sourceSection || "")) {
    if (!section || isBibliographicOrEquipmentTopic(section)) return "Учебный план";
  }
  return section;
}

function splitControlTail(topicName) {
  const match = cleanupLine(topicName).match(
    /^(.+?)\s+((?:входящая|текущая|промежуточная|итоговая)?\s*(?:диагностика|аттестация|контроль|опрос|наблюдение|тестирование|зач[её]т|соревнование|викторина|практическое\s+задание|проект|защита\s+проекта))\.?$/iu,
  );
  if (!match) {
    return { topicName, controlForm: "" };
  }

  const candidate = cleanupLine(match[1]);
  if (candidate.length < 8 || isServiceOnlyTopicName(candidate)) {
    return { topicName, controlForm: "" };
  }
  if (/(?:^|\s)и$/iu.test(candidate)) {
    return { topicName, controlForm: "" };
  }

  return {
    topicName: candidate,
    controlForm: cleanupLine(match[2]),
  };
}

function normalizeExtractedHours(topic) {
  const hoursTheory = normalizeNullableHour(topic.hours_theory);
  const hoursPractice = normalizeNullableHour(topic.hours_practice);
  let hoursTotal = normalizeNullableHour(topic.hours_total);

  if (hoursTotal == null && hoursTheory != null && hoursPractice != null) {
    hoursTotal = roundHour(hoursTheory + hoursPractice);
  }

  if (
    hoursTheory != null &&
    hoursPractice != null &&
    hoursTotal != null &&
    Math.abs(hoursTheory + hoursPractice - hoursTotal) > 0.01
  ) {
    return {
      hoursTheory,
      hoursPractice,
      hoursTotal,
      warning: `Inconsistent hours: theory(${hoursTheory}) + practice(${hoursPractice}) != total(${hoursTotal})`,
    };
  }

  return {
    hoursTheory,
    hoursPractice,
    hoursTotal,
    warning: "",
  };
}

function normalizeNullableHour(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1000) return null;
  return roundHour(number);
}

function isTotalTopicName(value) {
  const text = cleanupLine(value);
  return /^(?:итого|всего|общее\s+количество|всего\s+часов|итого\s+часов)(?:\s|:|$)/iu.test(text);
}

function isServiceOnlyTopicName(value) {
  const text = cleanupLine(value);
  return /^(?:входящая|текущая|промежуточная|итоговая)?\s*(?:контроль|диагностика|аттестация|опрос|наблюдение|тестирование|зач[её]т|соревнование|викторина|практическое\s+задание|самостоятельная\s+работа|анализ\s+результатов|выполнение\s+заданий(?:\s+(?:лично|по\s+подгруппам|с\s+группой))?)\.?$/iu.test(
    text,
  );
}

function isBibliographicOrEquipmentTopic(value) {
  const text = cleanupLine(value);
  return /(список\s+литературы|литература|учебно-?методическ|материально-?техническ|оборудовани[ея]|инвентарь|снаряжение\s*$|изд\.|издательство|^\d+\s*с\.?$|https?:\/\/|www\.)/iu.test(
    text,
  );
}

function isPlausibleHours(hoursTheory, hoursPractice, hoursTotal) {
  const values = [hoursTheory, hoursPractice, hoursTotal].filter((value) => value != null);
  if (!values.length) return false;
  if (values.some((value) => value < 0 || value > 1000)) return false;
  if (hoursTotal != null && hoursTotal === 0) return false;
  if (
    hoursTheory != null &&
    hoursPractice != null &&
    hoursTotal != null &&
    Math.abs(hoursTheory + hoursPractice - hoursTotal) > 2
  ) {
    return false;
  }
  return true;
}

function cleanupTopicName(value) {
  let topic = String(value || "")
    .replace(/^[•·*-]\s*/u, "")
    .replace(/П\s+с\s+и\s+х\s+о\s+л\s+о\s+г\s+о\s*-\s*п\s+е\s+д\s+а\s+г\s+о\s+г\s+и\s+ч\s+е\s+с\s+к\s+а\s+я/giu, "Психолого-педагогическая")
    .replace(/^\d+(?:\.\d+)*[.)]?\s*/u, "")
    .replace(MONTH_RE, "")
    .replace(/\s+/g, " ")
    .replace(/[«»]/g, '"')
    .trim();

  topic = topic.replace(/^(тема|раздел)\s+\d+[.:]?\s*/iu, "");
  topic = topic.replace(/\s+(дидактическая игра|опрос|викторина|зач[её]т|тестирование)$/iu, "");
  return topic.trim();
}

function cleanupControlForm(value) {
  const cleaned = String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[«»]/g, '"')
    .trim();
  if (!cleaned || PAGE_NUMBER_RE.test(cleaned)) return "";
  if (cleaned.length > 240) return cleaned.slice(0, 240);
  return cleaned;
}

function inferActivityType({ topicName, controlForm, hoursTheory, hoursPractice }) {
  const text = `${topicName} ${controlForm}`.toLowerCase();

  if (/проект/.test(text)) return "проект";
  if (/контрольн|аттестаци|зач[её]т|экзамен|тест|опрос|викторин|соревнован|норматив/.test(text)) {
    return "контроль";
  }
  if (/практик|лаборатор|упражнен|трениров|игровая|мастер-класс/.test(text)) return "практика";
  if (/теор|лекци|беседа|знакомство|история/.test(text)) return "теория";

  if ((hoursTheory || 0) > 0 && (hoursPractice || 0) > 0) return "теория+практика";
  if ((hoursPractice || 0) > 0) return "практика";
  if ((hoursTheory || 0) > 0) return "теория";
  return "не определено";
}

function estimateConfidence(parsed, topicName, currentSection) {
  let score = 0.45;
  if (currentSection) score += 0.2;
  if (parsed.hoursTheory != null && parsed.hoursPractice != null && parsed.hoursTotal != null) score += 0.2;
  if (topicName.length >= 8 && topicName.length <= 140) score += 0.1;
  if (parsed.tail) score += 0.05;
  return Math.min(1, Number(score.toFixed(2)));
}

function detectYearSection(line) {
  const match = line.match(
    /^((?:первый|второй|третий|четвертый|пятый|шестой|седьмой|восьмой|\d+)[-\s]*(?:й|ый|ой)?\s+год\s+(?:обучения|занятий)(?:\s*\([^)]*\))?)/iu,
  );
  if (match) return match[1];

  const moduleMatch = line.match(/^(модуль\s+\d+[^.]{0,120})$/iu);
  if (moduleMatch) return moduleMatch[1];
  return "";
}

function looksLikeStandaloneCalendarRow(line) {
  if (!/^\d+(?:[.)]|\.\d+)?\s+/.test(line)) return false;
  if (!/\s(?:-|\d+(?:[,.]\d+)?)\s+(?:-|\d+(?:[,.]\d+)?)\s+(?:-|\d+(?:[,.]\d+)?)(?:\s|$)/u.test(line)) {
    return false;
  }
  return /час|теор|практ|контрол|тема|раздел|занят|план/i.test(line);
}

function shouldSkipLine(line) {
  if (PAGE_NUMBER_RE.test(line)) return true;
  if (TOTAL_RE.test(line)) return true;
  if (/^(№|п\/п|название|количество\s+час|теория|практика|всего|форма\s+контроля)$/iu.test(line)) return true;
  if (/^таблица\s+\d+/iu.test(line)) return true;
  return false;
}

function shouldBufferLine(line) {
  if (TOTAL_RE.test(line)) return false;
  if (/^(дидактическая\s+игра|опрос|задачи|викторина|тест|зач[её]т|контроль|наблюдение|игровая\s+практика)\.?$/iu.test(line)) {
    return false;
  }
  if (new RegExp(`^${MONTH_PATTERN}\\s+[а-яё]`, "iu").test(line)) {
    return false;
  }
  if (/^\d+(?:[,.]\d+)?(?:\s+\d+(?:[,.]\d+)?){0,3}$/u.test(line)) return true;
  if (/^[А-ЯЁA-Z][\p{L}\p{N}\s.,;:()"'-]{2,220}$/u.test(line)) return true;
  return false;
}

function isMonthLine(line) {
  return new RegExp(`^(?:${MONTH_PATTERN})(?:\\s*[-–—]\\s*(?:${MONTH_PATTERN}))?$`, "iu").test(
    cleanupLine(line),
  );
}

function isActivityTypeLine(line) {
  return /^(теория|практика|теория\s*,\s*практика|теория\s+и\s+практика|проект|контроль|контрольная\s+работа|зач[её]т|соревновани[ея])$/iu.test(
    cleanupLine(line),
  );
}

function isSingleHourLine(line) {
  return /^\d+(?:[,.]\d+)?$/u.test(cleanupLine(line));
}

function isLikelyPlace(line) {
  return /(дюц|мбу|мау|моу|маодо|цдт|хибины|городской\s+парк|маршрутн|школ|кабинет|зал|стадион|бассейн|центр|ул\.|аудитори|ровесник)/iu.test(
    line,
  );
}

function isLikelyControlForm(line) {
  return /^(зач[её]т|опрос|тест|тестирование|контроль|контрольная\s+работа|наблюдение|викторина|выставка|конкурс|соревновани[ея]|диагностика|показ|защита|просмотр|практическая\s+работа|самостоятельная\s+работа)\.?$/iu.test(
    cleanupLine(line),
  );
}

function allocateHoursByActivity(activityLine, hoursTotal) {
  const normalized = activityLine.toLowerCase();
  if (/теория/.test(normalized) && /практика/.test(normalized)) {
    return {
      hoursTheory: null,
      hoursPractice: null,
    };
  }
  if (/теория/.test(normalized)) {
    return {
      hoursTheory: hoursTotal,
      hoursPractice: 0,
    };
  }
  if (/практик|проект|соревнован/.test(normalized)) {
    return {
      hoursTheory: 0,
      hoursPractice: hoursTotal,
    };
  }
  if (/контроль|зач[её]т/.test(normalized)) {
    return {
      hoursTheory: null,
      hoursPractice: null,
    };
  }
  return {
    hoursTheory: null,
    hoursPractice: null,
  };
}

function isTrainingTopicLine(line) {
  const cleaned = cleanupTopicName(line);
  if (!isValidTopic(cleaned)) return false;
  return /(подготовка|норматив|соревнователь|инструктор|судейск|аттестаци|мероприят|практика|тестирован|контроль)/iu.test(
    cleaned,
  );
}

function collectFollowingNumericLines(lines, startIndex, maxLines) {
  const values = [];
  const rawLines = [];
  let nextIndex = startIndex;

  for (let index = startIndex; index < lines.length && index < startIndex + maxLines; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line || line === "•") {
      nextIndex = index + 1;
      continue;
    }
    if (isTrainingTopicLine(line) || HARD_STOP_RE.test(line)) {
      break;
    }

    const lineValues = parseNumericLineValues(line);
    if (!lineValues.length) {
      if (values.length) break;
      continue;
    }

    values.push(...lineValues);
    rawLines.push(line);
    nextIndex = index + 1;
  }

  return {
    values,
    lines: rawLines,
    nextIndex,
  };
}

function parseNumericLineValues(line) {
  const cleaned = cleanupLine(line);
  if (!/^[-\d\s,.]+$/u.test(cleaned)) return [];

  const values = [];
  for (const match of cleaned.matchAll(/\d+(?:[,.]\d+)?/gu)) {
    const number = Number(match[0].replace(",", "."));
    if (Number.isFinite(number)) {
      values.push(number);
    }
  }
  return values.filter((value) => value >= 0 && value <= 1000);
}

function isPlausibleAggregateHours(hoursTotal) {
  return Number.isFinite(hoursTotal) && hoursTotal > 0 && hoursTotal <= 5000;
}

function extractOcrSplitHeaderStudyPlanRows(lines) {
  const headerIndexes = findOcrSplitHeaderStudyPlanHeaderIndexes(lines);
  const rows = [];

  for (let headerIndexPosition = 0; headerIndexPosition < headerIndexes.length; headerIndexPosition += 1) {
    const startIndex = headerIndexes[headerIndexPosition];
    const nextHeaderIndex = headerIndexes[headerIndexPosition + 1] || lines.length;
    const endIndex = findOcrSplitHeaderStudyPlanEndIndex(lines, startIndex + 1, nextHeaderIndex);
    rows.push(...extractOcrSplitHeaderStudyPlanRowsFromRange(lines, startIndex, endIndex));
  }

  return rows;
}

function findOcrSplitHeaderStudyPlanHeaderIndexes(lines) {
  const indexes = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!/учебн[оы]\s*[- ]?\s*тематическ(?:ий|ого)?\s+план/iu.test(line)) continue;

    const window = lines
      .slice(index, index + 18)
      .map(cleanupLine)
      .join(" ");
    if (
      /(?:^|\s)тео(?:\s|$)/iu.test(window) &&
      /пра\s*ктика/iu.test(window) &&
      /(?:^|\s)все(?:\s|$)/iu.test(window)
    ) {
      indexes.push(index);
    }
  }

  return indexes;
}

function findOcrSplitHeaderStudyPlanEndIndex(lines, startIndex, hardEnd) {
  for (let index = startIndex; index < hardEnd; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line) continue;
    if (index > startIndex + 12 && /^содержание\s+программы/iu.test(line)) return index;
    if (index > startIndex + 12 && /^(?:методическ|материально|список\s+литературы|приложение)/iu.test(line)) {
      return index;
    }
  }

  return Math.min(hardEnd, startIndex + 140);
}

function extractOcrSplitHeaderStudyPlanRowsFromRange(lines, startIndex, endIndex) {
  const rows = [];
  let currentSection = detectOcrSplitHeaderStudyPlanYear(lines, startIndex) || "Учебно-тематический план";
  let segment = null;
  let pendingMissingHourSegment = null;

  const flushPendingMissingHourSegment = () => {
    if (!pendingMissingHourSegment) return;
    const row = buildOcrSplitHeaderStudyPlanRow(pendingMissingHourSegment, currentSection);
    if (row) rows.push(row);
    pendingMissingHourSegment = null;
  };

  const flushSegment = () => {
    if (!segment) return;
    const row = buildOcrSplitHeaderStudyPlanRow(segment, currentSection);
    if (row) {
      if (hasOcrSplitHeaderStudyPlanHours(segment)) {
        flushPendingMissingHourSegment();
        rows.push(row);
      } else {
        flushPendingMissingHourSegment();
        pendingMissingHourSegment = segment;
      }
    }
    segment = null;
  };

  for (let index = startIndex + 1; index < endIndex; index += 1) {
    const line = cleanupLine(lines[index]);
    if (!line || isOcrSplitHeaderStudyPlanHeaderLine(line)) continue;
    if (/^(?:итого|всего)(?:\s|:|$)/iu.test(line)) break;

    const yearSection = detectBasicStudyPlanYearSection(line) || detectYearSection(line);
    if (yearSection) {
      currentSection = yearSection;
      continue;
    }

    const rowStart = parseOcrSplitHeaderStudyPlanRowStart(line);
    if (rowStart) {
      if (
        rowStart.standalone &&
        segment &&
        !hasOcrSplitHeaderStudyPlanHours(segment) &&
        isOcrSplitHeaderStudyPlanContinuationAfterStandaloneNumber(lines, index, endIndex)
      ) {
        continue;
      }
      flushSegment();
      segment = {
        number: rowStart.number,
        lines: rowStart.title ? [rowStart.title] : [],
        rawLines: [line],
      };
      continue;
    }

    if (!segment) continue;

    if (
      pendingMissingHourSegment &&
      !hasOcrSplitHeaderStudyPlanHours(segment) &&
      isOcrSplitHeaderDetachedHourLine(line)
    ) {
      pendingMissingHourSegment.lines.push(line);
      pendingMissingHourSegment.rawLines.push(line);
      const row = buildOcrSplitHeaderStudyPlanRow(pendingMissingHourSegment, currentSection);
      if (row && hasOcrSplitHeaderStudyPlanHours(pendingMissingHourSegment)) {
        rows.push(row);
        pendingMissingHourSegment = null;
        continue;
      }
    }

    if (hasOcrSplitHeaderStudyPlanHours(segment) && isUnnumberedOcrSplitHeaderStudyPlanRow(line)) {
      const nextNumber = Number(segment.number) + 1;
      flushSegment();
      segment = {
        number: Number.isInteger(nextNumber) && nextNumber > 0 ? nextNumber : rows.length + 1,
        lines: [line],
        rawLines: [line],
      };
      continue;
    }

    segment.lines.push(line);
    segment.rawLines.push(line);
  }

  flushSegment();
  flushPendingMissingHourSegment();

  return rows;
}

function detectOcrSplitHeaderStudyPlanYear(lines, startIndex) {
  for (let index = startIndex + 1; index < Math.min(lines.length, startIndex + 6); index += 1) {
    const line = cleanupLine(lines[index]);
    const match = line.match(/^(\d+)\s+год\s+обучения$/iu);
    if (match) return `${match[1]} год обучения`;
  }
  return "";
}

function isOcrSplitHeaderStudyPlanHeaderLine(line) {
  const cleaned = cleanupLine(line);
  return /^(?:(?:тео|пра|ктика|все|рия|в|на|го|пом|мес|еще|тно|нии|сти)\s*)+$/iu.test(cleaned);
}

function parseOcrSplitHeaderStudyPlanRowStart(line) {
  const cleaned = cleanupLine(line);
  const match = cleaned.match(/^(\d{1,2})[.)]\s*(.*)$/u);
  if (match) return buildOcrSplitHeaderStudyPlanRowStart(match[1], match[2], !cleanupLine(match[2] || ""));

  const bareMatch = cleaned.match(/^(\d{1,2})\s+(?=[А-ЯЁA-Zа-яёa-z])(.+)$/u);
  if (!bareMatch) return null;
  return buildOcrSplitHeaderStudyPlanRowStart(bareMatch[1], bareMatch[2], false);
}

function buildOcrSplitHeaderStudyPlanRowStart(rawNumber, rawTitle, standalone = false) {
  const number = Number(rawNumber);
  if (!Number.isInteger(number) || number <= 0 || number > 40) return null;
  return {
    number,
    title: cleanupLine(rawTitle || ""),
    standalone,
  };
}

function isOcrSplitHeaderStudyPlanContinuationAfterStandaloneNumber(lines, index, endIndex) {
  for (let nextIndex = index + 1; nextIndex < Math.min(endIndex, index + 8); nextIndex += 1) {
    const nextLine = cleanupLine(lines[nextIndex]);
    if (!nextLine || isOcrSplitHeaderStudyPlanHeaderLine(nextLine)) continue;
    return /^[а-яё]/u.test(nextLine);
  }
  return false;
}

function hasOcrSplitHeaderStudyPlanHours(segment) {
  return Boolean(segment && extractOcrSplitHeaderStudyPlanHours(segment.lines));
}

function isOcrSplitHeaderDetachedHourLine(line) {
  const values = extractOcrSplitHeaderStudyPlanLineHourValues(line);
  return values.length >= 3 && values.length <= 4;
}

function isUnnumberedOcrSplitHeaderStudyPlanRow(line) {
  const cleaned = cleanupLine(line);
  if (!/[А-ЯЁа-яё]/u.test(cleaned)) return false;
  if (parseOcrSplitHeaderStudyPlanRowStart(cleaned)) return false;
  if (!/(?:зач[её]тн|туристическ|поход|экскурс|соревнован)/iu.test(cleaned)) return false;
  return Boolean(extractOcrSplitHeaderStudyPlanHours([cleaned]));
}

function extractOcrSplitHeaderStudyPlanLineHourValues(line) {
  const cleaned = cleanupLine(line);
  if (!cleaned || isOcrSplitHeaderStudyPlanHeaderLine(cleaned)) return [];
  if (/^[\d\s,.]+$/u.test(cleaned)) {
    return parseNumericLineValues(cleaned);
  }

  const match = cleaned.match(/(?:^|\s)((?:\d+(?:[,.]\d+)?\s+){0,3}\d+(?:[,.]\d+)?)\s*$/u);
  if (!match) return [];
  const values = parseNumericLineValues(match[1]);
  if (values.length === 1) {
    const prefix = cleaned.slice(0, Math.max(0, cleaned.length - match[1].length)).trim();
    if (/(?:^|\s)(?:бег|лыжи|метр[а-яё]*|норматив[а-яё]*)\s*$/iu.test(prefix)) return [];
  }
  return values;
}

function buildOcrSplitHeaderStudyPlanRow(segment, currentSection) {
  const hours = extractOcrSplitHeaderStudyPlanHours(segment.lines);

  const topicName = cleanupOcrSplitHeaderStudyPlanTopicName(segment.lines);
  if (!isValidTopic(topicName) && !isLongBasicStudyPlanTopicName(topicName)) return null;

  return {
    plan_number: String(segment.number),
    section_title: currentSection || "Учебно-тематический план",
    topic_name: topicName,
    hours_theory: hours ? hours.hoursTheory : null,
    hours_practice: hours ? hours.hoursPractice : null,
    hours_total: hours ? hours.hoursTotal : null,
    activity_type: inferLessonThematicPlanningActivityType({
      hoursTheory: hours ? hours.hoursTheory : null,
      hoursPractice: hours ? hours.hoursPractice : null,
    }),
    control_form: "",
    source_section: "ocr-split-header-study-plan",
    source_excerpt: segment.rawLines.join(" / ").slice(0, 1500),
    confidence: hours ? 0.72 : 0.56,
    raw_payload: {
      parser: "ocr-split-header-study-plan",
      plan_number: String(segment.number),
      parsed_lines: segment.rawLines,
      parsed_hour_cells: hours ? hours.values : [],
      ...(!hours ? { missing_ocr_hours: true } : {}),
    },
  };
}

function extractOcrSplitHeaderStudyPlanHours(lines) {
  const values = [];
  const title = cleanupLine(lines.join(" "));
  for (const line of lines) {
    values.push(...extractOcrSplitHeaderStudyPlanLineHourValues(line));
  }

  if (values.length >= 4) {
    for (let index = values.length - 4; index >= 0; index -= 1) {
      const [theory, practiceInside, practiceOutside, total] = values.slice(index, index + 4);
      const practice = roundHour((practiceInside || 0) + (practiceOutside || 0));
      if (Math.abs(theory + practice - total) <= 1) {
        return {
          hoursTheory: theory,
          hoursPractice: practice,
          hoursTotal: total,
          values,
        };
      }
    }

    for (let index = values.length - 4; index >= 0; index -= 1) {
      const [theory, practiceInside, total, practiceOutside] = values.slice(index, index + 4);
      const practice = roundHour((practiceInside || 0) + (practiceOutside || 0));
      if (Math.abs(theory + practice - total) <= 1) {
        return {
          hoursTheory: theory,
          hoursPractice: practice,
          hoursTotal: total,
          values,
        };
      }
    }
  }

  if (values.length >= 3) {
    for (let index = values.length - 3; index >= 0; index -= 1) {
      const [theory, practice, total] = values.slice(index, index + 3);
      if (Math.abs(theory + practice - total) <= 1) {
        if (isOcrSplitHeaderPracticeOnlyTopic(title)) {
          return {
            hoursTheory: 0,
            hoursPractice: total,
            hoursTotal: total,
            values,
          };
        }
        return {
          hoursTheory: theory,
          hoursPractice: practice,
          hoursTotal: total,
          values,
        };
      }
    }
  }

  if (values.length >= 2) {
    const [first, second] = values.slice(-2);
    if (Math.abs(first - second) <= 0.01) {
      const isFinalHikeTopic = /зач[еёѐ]тн[а-яёѐ\s-]*туристическ[а-яёѐ\s-]*поход/iu.test(title);
      return {
        hoursTheory: isFinalHikeTopic ? 0 : first,
        hoursPractice: isFinalHikeTopic ? second : 0,
        hoursTotal: second,
        values,
      };
    }
  }

  return null;
}

function isOcrSplitHeaderPracticeOnlyTopic(title) {
  const text = cleanupLine(title);
  return (
    /общ(?:ая|ей)\s+и\s+специальн(?:ая|ой)\s+физическ(?:ая|ой)/iu.test(text) &&
    /подготовк/iu.test(text)
  );
}

function cleanupOcrSplitHeaderStudyPlanTopicName(lines) {
  const topicName = cleanupBasicStudyPlanTopicName(
    lines
      .map(cleanupLine)
      .filter((line) => line && !isOcrSplitHeaderStudyPlanHeaderLine(line))
      .map((line) => line.replace(/(?:^|\s)\d+(?:[,.]\d+)?(?:\s+\d+(?:[,.]\d+)?){0,3}\s*$/u, "").trim())
      .filter((line) => line && !/^[\d\s,.-]+$/u.test(line) && !/^глоссарий\.?$/iu.test(line))
      .join(" "),
  )
    .replace(/\s+Глоссарий\.?/giu, "")
    .replace(/\s+/g, " ")
    .trim();
  if (topicName.length <= 260) return topicName;
  return topicName.slice(0, 260).replace(/\s+\S*$/u, "").trim();
}

function isTheoryTrainingTopic(topicName) {
  return /теоретическ/i.test(topicName);
}

function inferTrainingActivityType(topicName) {
  if (/проект/i.test(topicName)) return "проект";
  if (/контроль|норматив|тестирован|аттестаци|соревновател/i.test(topicName)) return "контроль";
  if (/теоретическ/i.test(topicName)) return "теория";
  return "практика";
}

function extractOcrColumnarStudyPlanRows(lines) {
  const topics = [];

  for (let index = 0; index < lines.length; index += 1) {
    const sectionLine = cleanupLine(lines[index]);
    if (!/учебн[оы]\s*[- ]?\s*тематическ(?:ий|ого)?\s+план/iu.test(sectionLine)) continue;

    const endIndex = findOcrColumnarPlanEnd(lines, index + 1);
    const window = lines.slice(index + 1, endIndex).map(cleanupLine).filter(Boolean);
    const headerIndex = window.findIndex((line) => /наименовани[ея]\s+раздел/iu.test(line));
    if (headerIndex < 0) continue;

    const totalLabelIndex = window.findIndex((line, lineIndex) => lineIndex > headerIndex && /^(?:всего|итого)$/iu.test(line));
    const theoryLabelIndex = window.findIndex((line, lineIndex) => lineIndex > headerIndex && /^теори[яи]$/iu.test(line));
    const practiceLabelIndex = window.findIndex((line, lineIndex) => lineIndex > headerIndex && /^практик[аи]$/iu.test(line));
    if (totalLabelIndex < 0 || theoryLabelIndex < 0 || practiceLabelIndex < 0) continue;

    const topicNames = window
      .slice(headerIndex + 1, totalLabelIndex)
      .map(cleanupTopicName)
      .filter((line) => isValidOcrColumnTopic(line));
    if (topicNames.length < 3) continue;

    const totalColumn = parseOcrDurationColumn(window.slice(totalLabelIndex + 1, theoryLabelIndex));
    const theoryColumn = parseOcrDurationColumn(window.slice(theoryLabelIndex + 1, practiceLabelIndex), totalColumn.scale);
    const practiceColumn = parseOcrDurationColumn(window.slice(practiceLabelIndex + 1), totalColumn.scale);
    const rowCount = topicNames.length;
    const totalValues = totalColumn.values.slice(0, rowCount);
    if (totalValues.length !== rowCount) continue;

    const aligned = alignOcrTheoryPracticeColumns(totalValues, theoryColumn.values, practiceColumn.values);
    if (!aligned) continue;

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const topicName = topicNames[rowIndex];
      const hoursTotal = roundHour(totalValues[rowIndex]);
      const hoursTheory = roundHour(aligned.theory[rowIndex]);
      const hoursPractice = roundHour(aligned.practice[rowIndex]);
      if (!isPlausibleHours(hoursTheory, hoursPractice, hoursTotal)) continue;

      topics.push({
        section_title: sectionLine,
        topic_name: topicName,
        hours_theory: hoursTheory,
        hours_practice: hoursPractice,
        hours_total: hoursTotal,
        activity_type: inferActivityType({ topicName, controlForm: "", hoursTheory, hoursPractice }),
        control_form: "",
        source_section: "ocr-columnar-study-plan",
        source_excerpt: [sectionLine, ...window].join(" / ").slice(0, 1500),
        confidence: 0.72,
        raw_payload: {
          parser: "ocr-columnar-study-plan",
          topic_names: topicNames,
          total_column: totalColumn.rawValues,
          theory_column: theoryColumn.rawValues,
          practice_column: practiceColumn.rawValues,
          scale: totalColumn.scale,
        },
      });
    }

    if (topics.length) break;
  }

  return topics;
}

function findOcrColumnarPlanEnd(lines, startIndex) {
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = cleanupLine(lines[index]);
    if (index > startIndex && HARD_STOP_RE.test(line)) return index;
    if (index > startIndex + 8 && /^\d+\.\s+содержание\s+программы$/iu.test(line)) return index;
  }
  return Math.min(lines.length, startIndex + 90);
}

function isValidOcrColumnTopic(line) {
  if (!isValidTopic(line)) return false;
  if (/^(итого|всего|\(?мин\)?|\(?час(?:а|ов)?\)?|теори[яи]|практик[аи])$/iu.test(line)) return false;
  return /[а-яё]/iu.test(line);
}

function parseOcrDurationColumn(columnLines, inheritedScale = null) {
  const entries = [];

  for (const line of columnLines.map(cleanupLine)) {
    if (!line || /^(?:всего|итого|теори[яи]|практик[аи])$/iu.test(line)) continue;
    const parsed = parseOcrDurationCell(line);
    if (parsed) entries.push(parsed);
  }

  let scale = inheritedScale;
  let values = entries;
  if (entries.length >= 2) {
    const last = entries[entries.length - 1];
    const previous = entries[entries.length - 2];
    const rowEntries = entries.slice(0, -2);
    const rowSum = rowEntries.reduce((sum, entry) => sum + entry.value, 0);

    if (last.unit === "hour" && previous.unit === "minute" && Math.abs(previous.value - rowSum) <= 2) {
      scale = previous.value > 0 ? last.value / previous.value : inheritedScale;
      values = rowEntries;
    } else if (Math.abs(last.value - entries.slice(0, -1).reduce((sum, entry) => sum + entry.value, 0)) <= 2) {
      values = entries.slice(0, -1);
    }
  }

  const resolvedScale = scale ?? inferOcrDurationScale(values);
  return {
    values: values.map((entry) => entry.value * resolvedScale),
    rawValues: entries.map((entry) => entry.raw),
    scale: resolvedScale,
  };
}

function parseOcrDurationCell(line) {
  const match = cleanupLine(line).match(/^\(?\s*(\d+(?:[,.]\d+)?)\s*(мин|час(?:а|ов)?)?\s*\)?$/iu);
  if (!match) return null;
  const value = parseHourCell(match[1]);
  if (value == null) return null;
  const unit = /мин/iu.test(match[2] || "") ? "minute" : /час/iu.test(match[2] || "") ? "hour" : "number";
  return { value, unit, raw: line };
}

function inferOcrDurationScale(entries) {
  if (entries.some((entry) => entry.unit === "minute")) return 1 / 60;
  return 1;
}

function alignOcrTheoryPracticeColumns(totalValues, theoryValues, practiceValues) {
  const rowCount = totalValues.length;
  const theoryOptions = buildOcrColumnAlignmentOptions(theoryValues, rowCount);
  const practiceOptions = buildOcrColumnAlignmentOptions(practiceValues, rowCount);
  let best = null;

  for (const theory of theoryOptions) {
    for (const practice of practiceOptions) {
      const score = totalValues.reduce((sum, total, index) => sum + Math.abs(theory[index] + practice[index] - total), 0);
      if (!best || score < best.score) {
        best = { theory, practice, score };
      }
    }
  }

  if (!best || best.score > Math.max(0.15, rowCount * 0.04)) return null;
  return best;
}

function buildOcrColumnAlignmentOptions(values, rowCount) {
  const normalized = values.slice(0, rowCount);
  if (normalized.length === rowCount) return [normalized];

  if (normalized.length === rowCount - 1) {
    const options = [];
    for (let insertIndex = 0; insertIndex <= rowCount; insertIndex += 1) {
      options.push([...normalized.slice(0, insertIndex), 0, ...normalized.slice(insertIndex)]);
    }
    return options;
  }

  if (normalized.length < rowCount) {
    return [[...normalized, ...Array.from({ length: rowCount - normalized.length }, () => 0)]];
  }

  return [normalized.slice(0, rowCount)];
}

function normalizeExplicitActivityType(activityLine) {
  const normalized = cleanupLine(activityLine).toLowerCase();
  if (/теория/.test(normalized) && /практика/.test(normalized)) return "теория+практика";
  if (/теория/.test(normalized)) return "теория";
  if (/практик/.test(normalized)) return "практика";
  if (/проект/.test(normalized)) return "проект";
  if (/контроль|зач[её]т|соревнован/.test(normalized)) return "контроль";
  return "";
}

function shouldUseBufferedTopic(lineTopic) {
  if (!lineTopic) return true;
  if (lineTopic.length < 45) return false;
  return true;
}

function isValidTopic(topic) {
  if (!topic) return false;
  if (topic.length < 3 || topic.length > 260) return false;
  if (/^[\d\s.,:-]+$/u.test(topic)) return false;
  if (/\.{4,}|…{2,}|[.·_]{3,}\s*\d{1,3}$/u.test(topic)) return false;
  if (/^(месяц|тема|раздел|занятие|количество|форма|контроль|теория|практика|всего|час|часа|часов)$/iu.test(topic)) return false;
  if (
    /(кол-во\s+час|количество\s+час|недельная\s+нагрузка|возраст\s+зачисления|продолжительность\s+обучения|этап\s+начальной\s+подготовки|тренировочный\s+этап)/iu.test(
      topic,
    )
  ) {
    return false;
  }
  if (/(?:^|\s)этап(?:\s|$)/iu.test(topic) || /^-\d+\s+год/iu.test(topic)) {
    return false;
  }
  if (/^(специальная|техническая|тактическая|техническая\s+тактическая|специальная\s+техническая.*|подготовка)$/iu.test(topic)) {
    return false;
  }
  if (
    /федеральн|постановление|приказ|санпин|литератур|нормативно|концепци|распоряжение|дополнительного образования детей до|www\.|http/iu.test(
      topic,
    )
  ) {
    return false;
  }
  return true;
}

function cleanupLine(value) {
  return String(value || "")
    .replaceAll("\ufeff", "")
    .replace(/\u00a0/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTopicComparisonKey(value) {
  return cleanupTopicName(value)
    .toLowerCase()
    .replace(/ё/gu, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function normalizeText(value) {
  return String(value || "")
    .replaceAll("\ufeff", "")
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .replaceAll("\f", "\n")
    .replace(/\u0007/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/[–—]/g, "-");
}

function normalizeTextPreservingSpaces(value) {
  return String(value || "")
    .replaceAll("\ufeff", "")
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .replaceAll("\f", "\n")
    .replace(/\u0007/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[–—]/g, "-");
}

function pushUnique(target, seen, topic) {
  const key = [
    topic.section_title.toLowerCase(),
    topic.topic_name.toLowerCase(),
    topic.hours_theory,
    topic.hours_practice,
    topic.hours_total,
  ].join("|");
  if (seen.has(key)) return;
  seen.add(key);
  target.push(topic);
}

function pushUniqueTopics(target, seen, topics) {
  for (const topic of topics) {
    pushUnique(target, seen, topic);
  }
}

function roundHour(value) {
  return Number(Number(value).toFixed(2));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = {
  extractCalendarTopicsFromText,
};
