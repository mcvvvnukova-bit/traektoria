function parseCsv(content) {
  const rows = [];
  let current = "";
  let row = [];
  let insideQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (char === '"') {
      if (insideQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === "," && !insideQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }

      row.push(current);
      current = "";

      if (row.some((cell) => cell !== "")) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    current += char;
  }

  if (current !== "" || row.length > 0) {
    row.push(current);
    if (row.some((cell) => cell !== "")) {
      rows.push(row);
    }
  }

  if (rows.length === 0) return [];
  const [header, ...body] = rows;

  return body.map((cells) => {
    const record = {};
    header.forEach((column, index) => {
      record[column] = cells[index] || "";
    });
    return record;
  });
}

function stringifyCsv(rows, fieldOrder) {
  const lines = [fieldOrder.map(escapeCsvCell).join(",")];

  for (const row of rows) {
    const line = fieldOrder.map((field) => escapeCsvCell(row[field] ?? "")).join(",");
    lines.push(line);
  }

  return `${lines.join("\n")}\n`;
}

function escapeCsvCell(value) {
  const stringValue = String(value);
  if (!/[",\n\r]/.test(stringValue)) {
    return stringValue;
  }

  return `"${stringValue.replaceAll('"', '""')}"`;
}

module.exports = {
  parseCsv,
  stringifyCsv,
};
