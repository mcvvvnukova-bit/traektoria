#!/usr/bin/env bash
# Запускается НА СЕРВЕРЕ Beget (через SSH из GitHub Actions).
# Обновляет код, ставит зависимости и перезапускает сервис.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/telegram-bot}"
SERVICE="${SERVICE:-traektoria51-bot}"
BRANCH="${BRANCH:-main}"

echo "==> Deploy start: $(date -Is)"
cd "$APP_DIR"

echo "==> git fetch & reset to origin/$BRANCH"
git fetch --prune origin
git reset --hard "origin/$BRANCH"

echo "==> npm install (prod)"
npm install --omit=dev --no-audit --no-fund

# Применяем схему БД (idempotent: CREATE TABLE IF NOT EXISTS и т.п.)
echo "==> setup-db"
node scripts/setup-db.js

echo "==> restart service: $SERVICE"
# Требуется passwordless sudo на эту команду (см. инструкцию по sudoers)
sudo systemctl restart "$SERVICE"

echo "==> health check"
sleep 3
curl -fsS http://127.0.0.1:3000/health && echo
echo "==> Deploy done: $(date -Is)"
