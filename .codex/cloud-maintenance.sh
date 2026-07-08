#!/usr/bin/env bash
set -euo pipefail

echo "== Traektoria51 Codex Cloud maintenance =="
npm ci

PYTHON_VENV="${HOME}/.cache/traektoria51-python"
if [ -x "${PYTHON_VENV}/bin/python" ]; then
  "${PYTHON_VENV}/bin/python" -m pip install --upgrade pypdf
fi

npm test
