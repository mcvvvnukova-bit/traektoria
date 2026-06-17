#!/usr/bin/env bash
# Запускается НА СЕРВЕРЕ Beget (через SSH из GitHub Actions, под root).
# Прод = git-чекаут в /opt/telegram-bot, обновляется до origin/main.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/telegram-bot}"
SERVICE="${SERVICE:-traektoria51-bot}"
SERVICE_USER="${SERVICE_USER:-botsvc}"
BRANCH="${BRANCH:-main}"
# Deploy key (read-only) для доступа сервера к приватному репозиторию на GitHub
export GIT_SSH_COMMAND="ssh -i /root/.ssh/github_deploy -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"

echo "==> Deploy start: $(date -Is)"
cd "$APP_DIR"

echo "==> git fetch origin"
git fetch --prune origin

echo "==> sparse-checkout: skills/ держим только в репозитории, на прод не выкатываем"
git config core.sparseCheckout true
mkdir -p .git/info
printf '/*\n!/skills/\n' > .git/info/sparse-checkout

echo "==> git reset --hard origin/$BRANCH"
# .env, node_modules, tmp/, .deploy-backups/ — в .gitignore/untracked, reset их не трогает
# skills/ исключается sparse-checkout, codex-skills/ (старое имя) удаляется как отсутствующий в main
git reset --hard "origin/$BRANCH"
rm -rf "$APP_DIR/codex-skills" "$APP_DIR/skills"

echo "==> npm install (prod-зависимости)"
npm install --omit=dev --no-audit --no-fund

echo "==> setup-db (idempotent)"
node scripts/setup-db.js

echo "==> pfdo mirror schema (idempotent)"
PFDO_MIRROR_DATABASE_NAME="${PFDO_MIRROR_DATABASE_NAME:-pfdo_51_mirror}"
PFDO_MIRROR_DATABASE_USER="${PFDO_MIRROR_DATABASE_USER:-botapp}"
sudo -u postgres psql -d "$PFDO_MIRROR_DATABASE_NAME" -X -v ON_ERROR_STOP=1 -q -f db/pfdo-mirror-schema.sql

echo "==> pfdo mirror grants for $PFDO_MIRROR_DATABASE_USER"
sudo -u postgres psql -d "$PFDO_MIRROR_DATABASE_NAME" -X -v ON_ERROR_STOP=1 -q \
  -v app_user="$PFDO_MIRROR_DATABASE_USER" <<'SQL'
GRANT USAGE ON SCHEMA public TO :"app_user";
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public TO :"app_user";
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO :"app_user";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLES TO :"app_user";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO :"app_user";
SQL

echo "==> chown $SERVICE_USER (сервис работает под этим пользователем)"
chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR"

echo "==> install PFDO sync timer"
if [[ -f "$APP_DIR/deploy/traektoria51-pfdo-sync.service" && -f "$APP_DIR/deploy/traektoria51-pfdo-sync.timer" ]]; then
  cp "$APP_DIR/deploy/traektoria51-pfdo-sync.service" /etc/systemd/system/traektoria51-pfdo-sync.service
  cp "$APP_DIR/deploy/traektoria51-pfdo-sync.timer" /etc/systemd/system/traektoria51-pfdo-sync.timer
  systemctl daemon-reload
  systemctl enable --now traektoria51-pfdo-sync.timer
else
  echo "PFDO sync timer files not found, skipping"
fi

echo "==> restart service: $SERVICE"
systemctl restart "$SERVICE"

echo "==> health check"
sleep 3
if curl -fsS http://127.0.0.1:3000/health; then
  echo
  echo "==> health OK"
else
  echo "!! health не ответил — проверьте journalctl -u $SERVICE -n 50"
fi
echo "==> Deploy done: $(date -Is)"
