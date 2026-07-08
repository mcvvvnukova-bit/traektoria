#!/usr/bin/env bash
set -euo pipefail

echo "== Traektoria51 Codex Cloud setup =="
echo "Node: $(node --version)"
echo "npm: $(npm --version)"

npm ci

PYTHON_BIN="${PYTHON_BIN:-python3}"
PYTHON_VENV="${HOME}/.cache/traektoria51-python"

if command -v "${PYTHON_BIN}" >/dev/null 2>&1; then
  "${PYTHON_BIN}" -m venv "${PYTHON_VENV}"
  "${PYTHON_VENV}/bin/python" -m pip install --upgrade pip
  "${PYTHON_VENV}/bin/python" -m pip install pypdf

  BASHRC="${HOME}/.bashrc"
  TOUCH_LINE="export TOPIC_EXTRACTOR_PYTHON_BIN=\"${PYTHON_VENV}/bin/python\""
  touch "${BASHRC}"
  if ! grep -Fq "${TOUCH_LINE}" "${BASHRC}"; then
    printf '\n# Traektoria51 document extractor\n%s\n' "${TOUCH_LINE}" >> "${BASHRC}"
  fi
else
  echo "WARN: python3 is not available; PDF extraction helpers will not work."
fi

if command -v psql >/dev/null 2>&1; then
  echo "psql: $(psql --version)"
else
  echo "WARN: psql is not available; live PostgreSQL scripts will fail until installed."
fi

npm test
