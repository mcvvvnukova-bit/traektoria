const fs = require("node:fs/promises");
const path = require("node:path");
const { loadEnvFile } = require("../src/load-env");

loadEnvFile();

const { queryRows } = require("../src/db");

const DATABASE_URL =
  process.env.PFDO_MIRROR_DATABASE_URL || "postgresql://localhost:5432/pfdo_51_mirror";
const exportDir = path.resolve(__dirname, "..", "exports");

async function main() {
  const rows = await loadEvaluationRows();
  const metrics = buildMetrics(rows);
  await fs.mkdir(exportDir, { recursive: true });
  await fs.writeFile(
    path.join(exportDir, "качество классификатора тем технической направленности.json"),
    `${JSON.stringify(metrics, null, 2)}\n`,
    "utf-8",
  );
  await writeCsv(
    path.join(exportDir, "ошибки классификатора тем технической направленности.csv"),
    rows.filter((row) => !row.isCorrect),
    [
      "normalized_topic_name",
      "program_name",
      "gold_record_type",
      "gold_category_code",
      "predicted_record_type",
      "predicted_category_code",
      "confidence",
    ],
  );
  console.log(JSON.stringify(metrics, null, 2));
}

async function loadEvaluationRows() {
  const rows = await queryRows(
    `
SELECT
  replace(encode(convert_to(COALESCE(g.normalized_topic_name, ''), 'UTF8'), 'base64'), E'\\n', ''),
  replace(encode(convert_to(COALESCE(g.context_text, ''), 'UTF8'), 'base64'), E'\\n', ''),
  replace(encode(convert_to(COALESCE(g.record_type, ''), 'UTF8'), 'base64'), E'\\n', ''),
  replace(encode(convert_to(COALESCE(g.category_code, ''), 'UTF8'), 'base64'), E'\\n', ''),
  replace(encode(convert_to(COALESCE(c.record_type, ''), 'UTF8'), 'base64'), E'\\n', ''),
  replace(encode(convert_to(COALESCE(c.category_code, ''), 'UTF8'), 'base64'), E'\\n', ''),
  COALESCE(c.confidence::TEXT, '')
FROM pfdo_topic_classifier_golden_labels g
JOIN pfdo_programs p ON p.search_name = g.context_text
JOIN pfdo_program_directions d ON d.id = p.direction_id AND d.name = 'Техническая'
JOIN pfdo_program_topic_aggregates a
  ON a.program_id = p.id
 AND a.normalized_topic_name = g.normalized_topic_name
JOIN pfdo_program_topic_classifications c ON c.aggregate_id = a.id
WHERE g.source = 'codex_batch1'
ORDER BY g.normalized_topic_name, p.search_name;
`,
    DATABASE_URL,
  );

  return rows.map((row) => {
    const item = {
      normalized_topic_name: decodeBase64(row[0]),
      program_name: decodeBase64(row[1]),
      gold_record_type: decodeBase64(row[2]),
      gold_category_code: decodeBase64(row[3]),
      predicted_record_type: decodeBase64(row[4]),
      predicted_category_code: decodeBase64(row[5]),
      confidence: row[6],
    };
    item.isCorrect =
      item.gold_record_type === item.predicted_record_type &&
      item.gold_category_code === item.predicted_category_code;
    return item;
  });
}

function buildMetrics(rows) {
  const total = rows.length;
  const correct = rows.filter((row) => row.isCorrect).length;
  const byCategory = new Map();

  for (const row of rows) {
    const key = `${row.gold_record_type}/${row.gold_category_code}`;
    if (!byCategory.has(key)) {
      byCategory.set(key, { label: key, total: 0, correct: 0, accuracy: 0 });
    }
    const item = byCategory.get(key);
    item.total += 1;
    if (row.isCorrect) item.correct += 1;
  }

  return {
    classifier_scope: "technical_direction",
    golden_source: "codex_batch1",
    evaluated_rows: total,
    correct_rows: correct,
    accuracy: total ? Number((correct / total).toFixed(4)) : null,
    error_rows: total - correct,
    by_category: [...byCategory.values()]
      .map((item) => ({
        ...item,
        accuracy: item.total ? Number((item.correct / item.total).toFixed(4)) : null,
      }))
      .sort((left, right) => right.total - left.total || left.label.localeCompare(right.label)),
  };
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

function decodeBase64(value) {
  return Buffer.from(String(value || ""), "base64").toString("utf-8");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
