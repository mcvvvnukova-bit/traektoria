const QRCode = require("qrcode/lib/core/qrcode");
const SvgRenderer = require("qrcode/lib/renderer/svg-tag");

const ERROR_CORRECTION_LEVELS = {
  low: "L",
  l: "L",
  medium: "M",
  m: "M",
  quartile: "Q",
  q: "Q",
  high: "H",
  h: "H",
};

const ERROR_CORRECTION_LABELS = {
  0: "medium",
  1: "low",
  2: "high",
  3: "quartile",
};

function createQrMatrix(text, options = {}) {
  const content = normalizeContent(text);
  const qr = QRCode.create(content, toLibraryOptions(options));
  const size = qr.modules.size;

  return {
    text: content,
    version: qr.version,
    size,
    mask: qr.maskPattern,
    errorCorrectionLevel: ERROR_CORRECTION_LABELS[qr.errorCorrectionLevel.bit] || qr.errorCorrectionLevel.bit,
    modules: toModuleRows(qr.modules.data, size),
  };
}

function createQrSvg(text, options = {}) {
  const content = normalizeContent(text);
  const qr = QRCode.create(content, toLibraryOptions(options));
  return SvgRenderer.render(qr, {
    margin: normalizeInteger(options.border ?? options.margin, 4, 0),
    width: normalizeInteger(options.width, undefined, 21),
    color: {
      dark: normalizeColor(options.dark, "#111111"),
      light: normalizeColor(options.light, "#ffffff"),
    },
  });
}

function toLibraryOptions(options) {
  return {
    errorCorrectionLevel: normalizeErrorCorrectionLevel(options.errorCorrectionLevel || "medium"),
    version: normalizeVersion(options.version),
  };
}

function normalizeContent(text) {
  if (text === undefined || text === null || String(text).length === 0) {
    throw new Error("QR content must be a non-empty string.");
  }
  return String(text);
}

function normalizeErrorCorrectionLevel(value) {
  const level = ERROR_CORRECTION_LEVELS[String(value).toLowerCase()];
  if (!level) {
    throw new Error(`Unsupported QR error correction level: ${value}`);
  }
  return level;
}

function normalizeVersion(value) {
  if (value === undefined || value === null) return undefined;
  const version = Number(value);
  if (!Number.isInteger(version) || version < 1 || version > 40) {
    throw new Error("QR version must be an integer from 1 to 40.");
  }
  return version;
}

function normalizeInteger(value, fallback, min) {
  if (value === undefined || value === null) return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.floor(number));
}

function normalizeColor(value, fallback) {
  return value || fallback;
}

function toModuleRows(data, size) {
  const rows = [];
  for (let y = 0; y < size; y += 1) {
    rows.push(data.slice(y * size, (y + 1) * size).map(Boolean));
  }
  return rows;
}

module.exports = {
  createQrMatrix,
  createQrSvg,
};
