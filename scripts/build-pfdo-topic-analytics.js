const fs = require("node:fs/promises");
const path = require("node:path");
const { loadEnvFile } = require("../src/load-env");
const { executeSql, executeSqlFile, jsonToSql, queryRows, textToSql } = require("../src/db");
const { parseCsv } = require("../services/program-topic-extractor/src/csv");
const {
  normalizeAndClassifyTopic,
  classifyNormalizedTopic,
  classificationFromGoldenLabel,
  normalizeKey,
  NORMALIZER_VERSION,
  CLASSIFIER_VERSION,
  AGGREGATION_VERSION,
} = require("../services/program-topic-extractor/src/classification/technical-topic-classifier");

loadEnvFile();

const DATABASE_URL =
  process.env.PFDO_MIRROR_DATABASE_URL || "postgresql://localhost:5432/pfdo_51_mirror";
const schemaPath = path.resolve(__dirname, "..", "db", "pfdo-mirror-schema.sql");
const batchSize = Math.max(100, Number(process.env.PFDO_TOPIC_ANALYTICS_BATCH_SIZE || 500));
const exportDir = path.resolve(__dirname, "..", "exports");

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const counters = await runTopicAnalytics(options);
  console.log(JSON.stringify(counters, null, 2));
}

async function runTopicAnalytics(options = {}) {
  const normalizedOptions = normalizeOptions(options);
  await executeSqlFile(schemaPath, DATABASE_URL);
  const programIds = await resolveProgramIds(normalizedOptions);
  await clearAnalyticsTables(programIds);

  const counters = {
    scope: programIds.length ? "programs" : "all",
    programIds: programIds.length ? programIds : [],
    sourceRows: 0,
    normalizations: 0,
    aggregates: 0,
    classifications: 0,
    reviewItems: 0,
  };
  const aggregateMap = new Map();

  let lastId = 0;
  while (true) {
    const rows = await loadTopicRows(
      lastId,
      normalizedOptions.limit ? normalizedOptions.limit - counters.sourceRows : null,
      programIds,
    );
    if (!rows.length) break;

    const normalizationRows = [];
    for (const row of rows) {
      lastId = Math.max(lastId, row.topicId);
      const normalized = normalizeAndClassifyTopic(row);
      normalizationRows.push({ row, normalized });
      addToAggregate(aggregateMap, row, normalized);
    }

    await insertNormalizations(normalizationRows);
    counters.sourceRows += rows.length;
    counters.normalizations += normalizationRows.length;

    if (normalizedOptions.limit && counters.sourceRows >= normalizedOptions.limit) break;
    if (counters.sourceRows % 10000 === 0) {
      console.log(JSON.stringify(counters));
    }
  }

  const aggregateRows = [...aggregateMap.values()];
  await insertAggregates(aggregateRows);
  counters.aggregates = aggregateRows.length;

  const persistedAggregates = await loadAggregates(programIds);
  const goldenLabels = await loadGoldenLabels();
  const classificationRows = persistedAggregates.map((aggregate) => ({
    aggregate,
    classification: classifyAggregate(aggregate, goldenLabels),
  }));

  await insertClassifications(classificationRows);
  counters.classifications = classificationRows.length;

  const reviewRows = classificationRows.filter(shouldReviewClassification);
  await insertReviewQueue(reviewRows);
  counters.reviewItems = reviewRows.length;

  if (!normalizedOptions.skipExports) {
    await writeTechnicalExports();
  }

  return counters;
}

function parseArgs(argv) {
  const options = {
    limit: null,
    programId: null,
    programIdsPath: null,
    programIds: [],
    skipExports: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    const next = argv[index + 1];

    if (value === "--limit") {
      options.limit = Number(next);
      index += 1;
      continue;
    }

    if (value === "--program-id") {
      options.programId = Number(next);
      index += 1;
      continue;
    }

    if (value === "--program-ids") {
      options.programIdsPath = next;
      index += 1;
      continue;
    }

    if (value === "--skip-exports") {
      options.skipExports = true;
      continue;
    }

    if (value === "--help" || value === "-h") {
      console.log(`
Usage:
  node scripts/build-pfdo-topic-analytics.js

Options:
  --limit 1000        Process only first N extracted topic rows.
  --program-id 364163 Rebuild analytics only for one program.
  --program-ids file  Rebuild analytics for programs from CSV with a program_id column.
  --skip-exports      Do not refresh CSV exports after analytics rebuild.
`);
      process.exit(0);
    }
  }

  return options;
}

function normalizeOptions(options) {
  return {
    limit: normalizeNullablePositiveInteger(options.limit, "limit"),
    programId: normalizeNullablePositiveInteger(options.programId, "program-id"),
    programIdsPath: options.programIdsPath || null,
    programIds: normalizeProgramIds(options.programIds || []),
    skipExports: Boolean(options.skipExports),
  };
}

async function resolveProgramIds(options) {
  const ids = [...options.programIds];
  if (options.programId) ids.push(options.programId);

  if (options.programIdsPath) {
    const csvPath = path.resolve(options.programIdsPath);
    const rows = parseCsv(await fs.readFile(csvPath, "utf-8"));
    for (const row of rows) {
      const rawValue = String(row.program_id || "").trim();
      if (!rawValue) continue;
      ids.push(normalizePositiveInteger(rawValue, `program_id in ${csvPath}`));
    }
  }

  return normalizeProgramIds(ids);
}

function normalizeProgramIds(values) {
  const ids = [];
  const seen = new Set();
  for (const value of values || []) {
    const id = normalizePositiveInteger(value, "program id");
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function normalizeNullablePositiveInteger(value, name) {
  if (value == null || value === "") return null;
  return normalizePositiveInteger(value, name);
}

function normalizePositiveInteger(value, name) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`Invalid ${name}: ${value}`);
  }
  return id;
}

function programIdFilterSql(alias, programIds) {
  if (!programIds.length) return "";
  return ` AND ${alias}.program_id IN (${programIds.map(Number).join(", ")})`;
}

async function clearAnalyticsTables(programIds = []) {
  if (programIds.length) {
    const ids = programIds.map(Number).join(", ");
    await executeSql(
      `
DELETE FROM pfdo_program_topic_review_queue WHERE program_id IN (${ids});
DELETE FROM pfdo_program_topic_classifications WHERE program_id IN (${ids});
DELETE FROM pfdo_program_topic_aggregates WHERE program_id IN (${ids});
DELETE FROM pfdo_program_topic_normalizations WHERE program_id IN (${ids});
`,
      DATABASE_URL,
    );
    return;
  }

  await executeSql(
    `
DELETE FROM pfdo_program_topic_review_queue;
DELETE FROM pfdo_program_topic_classifications;
DELETE FROM pfdo_program_topic_aggregates;
DELETE FROM pfdo_program_topic_normalizations;
`,
    DATABASE_URL,
  );
}

async function loadTopicRows(lastId, remainingLimit, programIds = []) {
  if (remainingLimit != null && remainingLimit <= 0) return [];
  const limit = Math.min(5000, remainingLimit || 5000);
  const programFilter = programIdFilterSql("t", programIds);
  const rows = await queryRows(
    `
SELECT
  t.id,
  t.program_id,
  t.topic_order,
  replace(encode(convert_to(COALESCE(t.topic_name, ''), 'UTF8'), 'base64'), E'\\n', ''),
  replace(encode(convert_to(COALESCE(t.section_title, ''), 'UTF8'), 'base64'), E'\\n', ''),
  COALESCE(t.hours_theory::TEXT, ''),
  COALESCE(t.hours_practice::TEXT, ''),
  COALESCE(t.hours_total::TEXT, ''),
  replace(encode(convert_to(COALESCE(t.activity_type, ''), 'UTF8'), 'base64'), E'\\n', ''),
  replace(encode(convert_to(COALESCE(t.control_form, ''), 'UTF8'), 'base64'), E'\\n', ''),
  replace(encode(convert_to(COALESCE(p.search_name, ''), 'UTF8'), 'base64'), E'\\n', ''),
  replace(encode(convert_to(COALESCE(p.source_url, ''), 'UTF8'), 'base64'), E'\\n', ''),
  replace(encode(convert_to(COALESCE(d.name, ''), 'UTF8'), 'base64'), E'\\n', '')
FROM pfdo_program_calendar_topics t
JOIN pfdo_programs p ON p.id = t.program_id
LEFT JOIN pfdo_program_directions d ON d.id = p.direction_id
WHERE t.id > ${Number(lastId)}
${programFilter}
ORDER BY t.id
LIMIT ${Number(limit)};
`,
    DATABASE_URL,
  );

  return rows.map((row) => ({
    topicId: Number(row[0]),
    programId: Number(row[1]),
    topicOrder: Number(row[2]),
    topicName: decodeBase64(row[3]),
    sectionTitle: decodeBase64(row[4]),
    hoursTheory: parseNullableNumber(row[5]),
    hoursPractice: parseNullableNumber(row[6]),
    hoursTotal: parseNullableNumber(row[7]),
    activityType: decodeBase64(row[8]),
    controlForm: decodeBase64(row[9]),
    programName: decodeBase64(row[10]),
    portalUrl: decodeBase64(row[11]),
    directionName: decodeBase64(row[12]),
  }));
}

function addToAggregate(aggregateMap, row, normalized) {
  const normalizedKey = normalized.normalizedTopicKey || "unknown";
  const key = `${row.programId}|${normalized.recordType}|${normalizedKey}`;
  if (!aggregateMap.has(key)) {
    aggregateMap.set(key, {
      programId: row.programId,
      programName: row.programName,
      portalUrl: row.portalUrl,
      directionName: row.directionName,
      normalizedTopicName: normalized.normalizedTopicName || row.topicName,
      normalizedTopicKey: normalizedKey,
      recordType: normalized.recordType,
      sourceTopicIds: [],
      rawExamples: new Map(),
      activityTypes: new Map(),
      hoursTheory: 0,
      hoursPractice: 0,
      hoursControl: 0,
      hoursTotal: 0,
      firstTopicOrder: row.topicOrder,
    });
  }

  const item = aggregateMap.get(key);
  item.sourceTopicIds.push(row.topicId);
  item.firstTopicOrder = Math.min(item.firstTopicOrder, row.topicOrder);
  item.rawExamples.set(row.topicName, (item.rawExamples.get(row.topicName) || 0) + 1);
  item.activityTypes.set(normalized.activityTypeNormalized, (item.activityTypes.get(normalized.activityTypeNormalized) || 0) + 1);
  item.hoursTheory += row.hoursTheory || 0;
  item.hoursPractice += row.hoursPractice || 0;
  item.hoursTotal += row.hoursTotal || 0;
  if (normalized.activityTypeNormalized === "контроль") {
    item.hoursControl += row.hoursTotal || 0;
  }
}

async function insertNormalizations(rows) {
  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize);
    const values = batch
      .map(({ row, normalized }) => {
        return `(
          ${Number(row.topicId)},
          ${Number(row.programId)},
          ${textToSql(normalized.rawTopicName)},
          ${nullableText(normalized.normalizedTopicName)},
          ${nullableText(normalized.normalizedTopicKey)},
          ${nullableText(normalized.activityTypeNormalized)},
          ${textToSql(normalized.recordType)},
          ${nullableText(normalized.noiseReason)},
          ${textToSql(normalized.normalizationMethod)},
          ${textToSql(normalized.normalizationVersion)},
          ${nullableNumber(normalized.normalizationConfidence)},
          ${jsonToSql(normalized.rawPayload)}
        )`;
      })
      .join(",\n");

    await executeSql(
      `
INSERT INTO pfdo_program_topic_normalizations (
  topic_id,
  program_id,
  raw_topic_name,
  normalized_topic_name,
  normalized_topic_key,
  activity_type_normalized,
  record_type,
  noise_reason,
  normalization_method,
  normalization_version,
  normalization_confidence,
  raw_payload
) VALUES ${values}
ON CONFLICT (topic_id) DO UPDATE SET
  raw_topic_name = EXCLUDED.raw_topic_name,
  normalized_topic_name = EXCLUDED.normalized_topic_name,
  normalized_topic_key = EXCLUDED.normalized_topic_key,
  activity_type_normalized = EXCLUDED.activity_type_normalized,
  record_type = EXCLUDED.record_type,
  noise_reason = EXCLUDED.noise_reason,
  normalization_method = EXCLUDED.normalization_method,
  normalization_version = EXCLUDED.normalization_version,
  normalization_confidence = EXCLUDED.normalization_confidence,
  raw_payload = EXCLUDED.raw_payload;
`,
      DATABASE_URL,
    );
  }
}

async function insertAggregates(rows) {
  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize);
    const values = batch
      .map((row) => `(
        ${Number(row.programId)},
        ${textToSql(row.normalizedTopicName)},
        ${textToSql(row.normalizedTopicKey)},
        ${textToSql(row.recordType)},
        ${Number(row.sourceTopicIds.length)},
        ARRAY[${row.sourceTopicIds.map(Number).join(",")}]::BIGINT[],
        ${jsonToSql(counterToArray(row.rawExamples))},
        ${jsonToSql(counterToArray(row.activityTypes))},
        ${nullableNumber(row.hoursTheory)},
        ${nullableNumber(row.hoursPractice)},
        ${nullableNumber(row.hoursControl)},
        ${nullableNumber(row.hoursTotal)},
        ${nullableNumber(row.firstTopicOrder)},
        'program_topic_sum',
        ${textToSql(AGGREGATION_VERSION)}
      )`)
      .join(",\n");

    await executeSql(
      `
INSERT INTO pfdo_program_topic_aggregates (
  program_id,
  normalized_topic_name,
  normalized_topic_key,
  record_type,
  topic_rows,
  source_topic_ids,
  raw_topic_examples,
  activity_types,
  hours_theory,
  hours_practice,
  hours_control,
  hours_total,
  first_topic_order,
  aggregation_method,
  aggregation_version
) VALUES ${values}
ON CONFLICT (program_id, normalized_topic_key, record_type) DO UPDATE SET
  normalized_topic_name = EXCLUDED.normalized_topic_name,
  topic_rows = EXCLUDED.topic_rows,
  source_topic_ids = EXCLUDED.source_topic_ids,
  raw_topic_examples = EXCLUDED.raw_topic_examples,
  activity_types = EXCLUDED.activity_types,
  hours_theory = EXCLUDED.hours_theory,
  hours_practice = EXCLUDED.hours_practice,
  hours_control = EXCLUDED.hours_control,
  hours_total = EXCLUDED.hours_total,
  first_topic_order = EXCLUDED.first_topic_order,
  aggregation_method = EXCLUDED.aggregation_method,
  aggregation_version = EXCLUDED.aggregation_version;
`,
      DATABASE_URL,
    );
  }
}

async function loadAggregates(programIds = []) {
  const output = [];
  let lastId = 0;
  const programFilter = programIdFilterSql("a", programIds);

  while (true) {
    const rows = await queryRows(
      `
SELECT
  a.id,
  a.program_id,
  replace(encode(convert_to(COALESCE(a.normalized_topic_name, ''), 'UTF8'), 'base64'), E'\\n', ''),
  replace(encode(convert_to(COALESCE(a.normalized_topic_key, ''), 'UTF8'), 'base64'), E'\\n', ''),
  replace(encode(convert_to(COALESCE(a.record_type, ''), 'UTF8'), 'base64'), E'\\n', ''),
  a.topic_rows,
  COALESCE(a.hours_total::TEXT, ''),
  replace(encode(convert_to(COALESCE(p.search_name, ''), 'UTF8'), 'base64'), E'\\n', ''),
  replace(encode(convert_to(COALESCE(p.source_url, ''), 'UTF8'), 'base64'), E'\\n', ''),
  replace(encode(convert_to(COALESCE(d.name, ''), 'UTF8'), 'base64'), E'\\n', ''),
  replace(encode(convert_to(a.raw_topic_examples::TEXT, 'UTF8'), 'base64'), E'\\n', '')
FROM pfdo_program_topic_aggregates a
JOIN pfdo_programs p ON p.id = a.program_id
LEFT JOIN pfdo_program_directions d ON d.id = p.direction_id
WHERE a.id > ${Number(lastId)}
${programFilter}
ORDER BY a.id
LIMIT 5000;
`,
      DATABASE_URL,
    );

    if (!rows.length) break;
    for (const row of rows) {
      lastId = Math.max(lastId, Number(row[0]));
      output.push({
        aggregateId: Number(row[0]),
        programId: Number(row[1]),
        normalizedTopicName: decodeBase64(row[2]),
        normalizedTopicKey: decodeBase64(row[3]),
        recordType: decodeBase64(row[4]),
        topicRows: Number(row[5]),
        hoursTotal: parseNullableNumber(row[6]) || 0,
        programName: decodeBase64(row[7]),
        portalUrl: decodeBase64(row[8]),
        directionName: decodeBase64(row[9]),
        rawExamples: JSON.parse(decodeBase64(row[10])),
      });
    }
  }

  return output;
}

async function loadGoldenLabels() {
  const rows = await queryRows(
    `
SELECT
  replace(encode(convert_to(COALESCE(normalized_topic_name, ''), 'UTF8'), 'base64'), E'\\n', ''),
  replace(encode(convert_to(COALESCE(record_type, ''), 'UTF8'), 'base64'), E'\\n', ''),
  replace(encode(convert_to(COALESCE(category_code, ''), 'UTF8'), 'base64'), E'\\n', ''),
  replace(encode(convert_to(COALESCE(category_name, ''), 'UTF8'), 'base64'), E'\\n', ''),
  replace(encode(convert_to(COALESCE(source, ''), 'UTF8'), 'base64'), E'\\n', ''),
  COUNT(*)
FROM pfdo_topic_classifier_golden_labels
GROUP BY normalized_topic_name, record_type, category_code, category_name, source;
`,
    DATABASE_URL,
  );

  const grouped = new Map();
  for (const row of rows) {
    const normalizedTopicName = decodeBase64(row[0]);
    const key = normalizeKey(normalizedTopicName);
    const item = {
      normalizedTopicName,
      recordType: decodeBase64(row[1]),
      categoryCode: decodeBase64(row[2]),
      categoryName: decodeBase64(row[3]),
      source: decodeBase64(row[4]),
      count: Number(row[5]),
    };
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item);
  }

  const labels = new Map();
  for (const [key, items] of grouped.entries()) {
    items.sort((left, right) => right.count - left.count || left.categoryCode.localeCompare(right.categoryCode));
    labels.set(key, items[0]);
  }
  return labels;
}

function classifyAggregate(aggregate, goldenLabels) {
  const golden = goldenLabels.get(aggregate.normalizedTopicKey);
  if (golden) {
    return classificationFromGoldenLabel({
      normalizedTopicName: aggregate.normalizedTopicName,
      programName: aggregate.programName,
      recordType: golden.recordType,
      categoryCode: golden.categoryCode,
      categoryName: golden.categoryName,
      source: golden.source,
    });
  }

  return classifyNormalizedTopic({
    normalizedTopicName: aggregate.normalizedTopicName,
    normalizedTopicKey: aggregate.normalizedTopicKey,
    programName: aggregate.programName,
    sectionTitle: "",
    recordTypeHint: aggregate.recordType,
    noiseReason: aggregate.recordType === "noise" ? "unknown" : "",
  });
}

async function insertClassifications(rows) {
  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize);
    const values = batch
      .map(({ aggregate, classification }) => `(
        ${Number(aggregate.aggregateId)},
        ${Number(aggregate.programId)},
        ${textToSql(classification.recordType)},
        ${nullableText(classification.parentCode)},
        ${nullableText(classification.parentName)},
        ${textToSql(classification.categoryCode)},
        ${textToSql(classification.categoryName)},
        ${nullableNumber(classification.confidence)},
        ${jsonToSql(classification.topCategories)},
        ${jsonToSql(classification.matchedRules)},
        ${textToSql(classification.inputText)},
        ${textToSql(classification.classifierMethod)},
        ${textToSql(classification.classifierVersion)},
        ${textToSql(classification.confidence < 0.6 || classification.categoryCode === "unknown_content" ? "needs_review" : "auto")}
      )`)
      .join(",\n");

    await executeSql(
      `
INSERT INTO pfdo_program_topic_classifications (
  aggregate_id,
  program_id,
  record_type,
  parent_code,
  parent_name,
  category_code,
  category_name,
  confidence,
  top_categories,
  matched_rules,
  input_text,
  classifier_method,
  classifier_version,
  review_status
) VALUES ${values}
ON CONFLICT (aggregate_id) DO UPDATE SET
  record_type = EXCLUDED.record_type,
  parent_code = EXCLUDED.parent_code,
  parent_name = EXCLUDED.parent_name,
  category_code = EXCLUDED.category_code,
  category_name = EXCLUDED.category_name,
  confidence = EXCLUDED.confidence,
  top_categories = EXCLUDED.top_categories,
  matched_rules = EXCLUDED.matched_rules,
  input_text = EXCLUDED.input_text,
  classifier_method = EXCLUDED.classifier_method,
  classifier_version = EXCLUDED.classifier_version,
  review_status = EXCLUDED.review_status;
`,
      DATABASE_URL,
    );
  }
}

async function insertReviewQueue(rows) {
  if (!rows.length) return;
  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize);
    const ids = batch.map((row) => row.aggregate.aggregateId);
    const classificationIdRows = await queryRows(
      `
SELECT aggregate_id, id
FROM pfdo_program_topic_classifications
WHERE aggregate_id IN (${ids.map(Number).join(",")});
`,
      DATABASE_URL,
    );
    const classificationIdByAggregate = new Map(classificationIdRows.map((row) => [Number(row[0]), Number(row[1])]));
    const values = batch
      .map(({ aggregate, classification }) => `(
        ${Number(classificationIdByAggregate.get(aggregate.aggregateId))},
        ${Number(aggregate.aggregateId)},
        ${Number(aggregate.programId)},
        ${jsonToSql(aggregate.rawExamples)},
        ${textToSql(aggregate.normalizedTopicName)},
        ${textToSql(classification.recordType)},
        ${textToSql(classification.categoryCode)},
        ${textToSql(classification.categoryName)},
        ${nullableNumber(classification.confidence)},
        ${textToSql(reviewReason(aggregate, classification))}
      )`)
      .join(",\n");

    await executeSql(
      `
INSERT INTO pfdo_program_topic_review_queue (
  classification_id,
  aggregate_id,
  program_id,
  raw_topic_examples,
  normalized_topic_name,
  predicted_record_type,
  predicted_category_code,
  predicted_category_name,
  confidence,
  reason
) VALUES ${values}
ON CONFLICT (classification_id) DO UPDATE SET
  raw_topic_examples = EXCLUDED.raw_topic_examples,
  normalized_topic_name = EXCLUDED.normalized_topic_name,
  predicted_record_type = EXCLUDED.predicted_record_type,
  predicted_category_code = EXCLUDED.predicted_category_code,
  predicted_category_name = EXCLUDED.predicted_category_name,
  confidence = EXCLUDED.confidence,
  reason = EXCLUDED.reason,
  review_status = 'pending';
`,
      DATABASE_URL,
    );
  }
}

function shouldReviewClassification({ aggregate, classification }) {
  if (classification.categoryCode === "unknown_content") return true;
  if (classification.confidence < 0.6) return true;
  if (classification.categoryCode === "unknown" && aggregate.topicRows >= 2) return true;
  if (classification.recordType === "noise" && aggregate.hoursTotal >= 10) return true;
  return false;
}

function reviewReason(aggregate, classification) {
  if (classification.categoryCode === "unknown_content") return "unknown_content";
  if (classification.confidence < 0.6) return "low_confidence";
  if (classification.categoryCode === "unknown" && aggregate.topicRows >= 2) return "frequent_unknown";
  if (classification.recordType === "noise" && aggregate.hoursTotal >= 10) return "high_hours_noise";
  return "manual_check";
}

async function writeTechnicalExports() {
  const rows = await queryRows(
    `
SELECT
  replace(encode(convert_to(COALESCE(p.search_name, ''), 'UTF8'), 'base64'), E'\\n', ''),
  replace(encode(convert_to(COALESCE(p.source_url, ''), 'UTF8'), 'base64'), E'\\n', ''),
  replace(encode(convert_to(COALESCE(a.normalized_topic_name, ''), 'UTF8'), 'base64'), E'\\n', ''),
  a.topic_rows,
  COALESCE(a.hours_total::TEXT, ''),
  replace(encode(convert_to(COALESCE(c.record_type, ''), 'UTF8'), 'base64'), E'\\n', ''),
  replace(encode(convert_to(COALESCE(c.parent_code, ''), 'UTF8'), 'base64'), E'\\n', ''),
  replace(encode(convert_to(COALESCE(c.category_code, ''), 'UTF8'), 'base64'), E'\\n', ''),
  replace(encode(convert_to(COALESCE(c.category_name, ''), 'UTF8'), 'base64'), E'\\n', ''),
  COALESCE(c.confidence::TEXT, '')
FROM pfdo_program_topic_aggregates a
JOIN pfdo_program_topic_classifications c ON c.aggregate_id = a.id
JOIN pfdo_programs p ON p.id = a.program_id
JOIN pfdo_program_directions d ON d.id = p.direction_id
WHERE d.name = 'Техническая'
ORDER BY p.search_name, p.id, c.record_type, c.category_code, a.first_topic_order;
`,
    DATABASE_URL,
  );

  const detailRows = rows.map((row) => ({
    program_name: decodeBase64(row[0]),
    portal_url: decodeBase64(row[1]),
    normalized_topic_name: decodeBase64(row[2]),
    topic_rows: row[3],
    hours_total: row[4],
    record_type: decodeBase64(row[5]),
    domain_code: decodeBase64(row[6]),
    domain_name: domainName(decodeBase64(row[6])),
    category_code: decodeBase64(row[7]),
    category_name: decodeBase64(row[8]),
    taxonomy_path: [decodeBase64(row[5]), decodeBase64(row[6]), decodeBase64(row[7])].filter(Boolean).join(" > "),
    confidence: row[9],
  }));

  await fs.mkdir(exportDir, { recursive: true });
  await writeCsv(
    path.join(exportDir, "классификатор тем технической направленности.csv"),
    detailRows,
    ["program_name", "portal_url", "normalized_topic_name", "topic_rows", "hours_total", "record_type", "domain_code", "domain_name", "category_code", "category_name", "taxonomy_path", "confidence"],
  );

  const summary = new Map();
  for (const row of detailRows) {
    const key = `${row.record_type}|${row.domain_code}|${row.category_code}|${row.category_name}`;
    if (!summary.has(key)) {
      summary.set(key, {
        record_type: row.record_type,
        domain_code: row.domain_code,
        domain_name: row.domain_name,
        category_code: row.category_code,
        category_name: row.category_name,
        aggregate_topics: 0,
        programs: new Set(),
        hours_total: 0,
      });
    }
    const item = summary.get(key);
    item.aggregate_topics += 1;
    item.programs.add(row.portal_url);
    item.hours_total += parseNullableNumber(row.hours_total) || 0;
  }

  const summaryRows = [...summary.values()]
    .map((row) => ({
      record_type: row.record_type,
      domain_code: row.domain_code,
      domain_name: row.domain_name,
      category_code: row.category_code,
      category_name: row.category_name,
      aggregate_topics: row.aggregate_topics,
      program_count: row.programs.size,
      hours_total: Number(row.hours_total.toFixed(2)),
    }))
    .sort((left, right) => recordTypeOrder(left.record_type) - recordTypeOrder(right.record_type) || right.program_count - left.program_count);

  await writeCsv(
    path.join(exportDir, "сводка классификатора тем технической направленности.csv"),
    summaryRows,
    ["record_type", "domain_code", "domain_name", "category_code", "category_name", "aggregate_topics", "program_count", "hours_total"],
  );

  await writeTechnicalReviewQueueExport();
}

async function writeTechnicalReviewQueueExport() {
  const rows = await queryRows(
    `
SELECT
  replace(encode(convert_to(COALESCE(p.search_name, ''), 'UTF8'), 'base64'), E'\\n', ''),
  replace(encode(convert_to(COALESCE(p.source_url, ''), 'UTF8'), 'base64'), E'\\n', ''),
  replace(encode(convert_to(COALESCE(q.normalized_topic_name, ''), 'UTF8'), 'base64'), E'\\n', ''),
  replace(encode(convert_to(COALESCE(q.predicted_record_type, ''), 'UTF8'), 'base64'), E'\\n', ''),
  replace(encode(convert_to(COALESCE(q.predicted_category_code, ''), 'UTF8'), 'base64'), E'\\n', ''),
  replace(encode(convert_to(COALESCE(q.predicted_category_name, ''), 'UTF8'), 'base64'), E'\\n', ''),
  COALESCE(q.confidence::TEXT, ''),
  replace(encode(convert_to(COALESCE(q.reason, ''), 'UTF8'), 'base64'), E'\\n', ''),
  replace(encode(convert_to(q.raw_topic_examples::TEXT, 'UTF8'), 'base64'), E'\\n', '')
FROM pfdo_program_topic_review_queue q
JOIN pfdo_programs p ON p.id = q.program_id
JOIN pfdo_program_directions d ON d.id = p.direction_id
WHERE d.name = 'Техническая'
ORDER BY
  CASE q.reason WHEN 'unknown_content' THEN 1 WHEN 'low_confidence' THEN 2 ELSE 3 END,
  q.confidence ASC,
  p.search_name,
  q.normalized_topic_name;
`,
    DATABASE_URL,
  );

  const exportRows = rows.map((row) => ({
    program_name: decodeBase64(row[0]),
    portal_url: decodeBase64(row[1]),
    normalized_topic_name: decodeBase64(row[2]),
    predicted_record_type: decodeBase64(row[3]),
    predicted_category_code: decodeBase64(row[4]),
    predicted_category_name: decodeBase64(row[5]),
    confidence: row[6],
    reason: decodeBase64(row[7]),
    raw_topic_examples: decodeBase64(row[8]),
    manual_record_type: "",
    manual_category_code: "",
    reviewer_note: "",
  }));

  await writeCsv(
    path.join(exportDir, "очередь ручной проверки тем технической направленности.csv"),
    exportRows,
    [
      "program_name",
      "portal_url",
      "normalized_topic_name",
      "predicted_record_type",
      "predicted_category_code",
      "predicted_category_name",
      "confidence",
      "reason",
      "raw_topic_examples",
      "manual_record_type",
      "manual_category_code",
      "reviewer_note",
    ],
  );
}

function counterToArray(counter) {
  return [...counter.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "ru"))
    .slice(0, 20)
    .map(([value, count]) => ({ value, count }));
}

async function writeCsv(filePath, rows, fields) {
  const lines = [fields.join(",")];
  for (const row of rows) {
    lines.push(fields.map((field) => csvCell(row[field])).join(","));
  }
  await fs.writeFile(filePath, `${lines.join("\n")}\n`, "utf-8");
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function recordTypeOrder(value) {
  if (value === "content") return 0;
  if (value === "service") return 1;
  return 2;
}

function domainName(code) {
  return {
    it: "IT и программирование",
    engineering: "Инженерия и робототехника",
    media_design: "Медиа и дизайн",
    transport: "Транспорт и безопасность",
    project: "Проектная деятельность",
    service: "Служебные темы",
    noise: "Шум и нераспознанные темы",
    unknown_content: "Предметные темы без категории",
    content: "Предметные темы",
  }[code] || code;
}

function nullableText(value) {
  if (value == null || value === "") return "NULL";
  return textToSql(value);
}

function nullableNumber(value) {
  if (value == null || value === "" || Number.isNaN(Number(value))) return "NULL";
  return String(Number(value));
}

function parseNullableNumber(value) {
  if (value == null || value === "") return null;
  const number = Number(String(value).replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function decodeBase64(value) {
  return Buffer.from(String(value || ""), "base64").toString("utf-8");
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  runTopicAnalytics,
  parseArgs,
  normalizeProgramIds,
  programIdFilterSql,
};
