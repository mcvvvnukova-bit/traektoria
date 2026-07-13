const EDUCATION_FORM_LABELS = {
  1: "Очная",
  2: "Очно-заочная",
  3: "Заочная",
};

const EDUCATION_FORM_IDS = new Set(Object.keys(EDUCATION_FORM_LABELS).map(Number));

function normalizeEducationFormId(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(String(value).trim());
  if (!Number.isInteger(number)) return null;
  return EDUCATION_FORM_IDS.has(number) ? number : null;
}

function educationFormLabel(value) {
  const id = normalizeEducationFormId(value);
  return id ? EDUCATION_FORM_LABELS[id] : "";
}

module.exports = {
  EDUCATION_FORM_LABELS,
  EDUCATION_FORM_IDS,
  normalizeEducationFormId,
  educationFormLabel,
};
