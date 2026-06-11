#!/usr/bin/env bash
# Деплой статического лендинга на сервере Beget (через SSH из GitHub Actions, под root).
# Источник — папка landing/ в git-чекауте /opt/telegram-bot.
# Назначение — веб-рут, из которого nginx отдаёт сайт.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/telegram-bot}"
WEBROOT="${WEBROOT:-/var/www/static/landing}"
BRANCH="${BRANCH:-main}"
# Deploy key (read-only) для доступа сервера к приватному репозиторию на GitHub
export GIT_SSH_COMMAND="ssh -i /root/.ssh/github_deploy -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"

echo "==> Landing deploy start: $(date -Is)"
cd "$APP_DIR"

echo "==> git fetch + reset origin/$BRANCH"
git fetch --prune origin
git reset --hard "origin/$BRANCH"

echo "==> publish landing/ -> $WEBROOT (rsync --delete)"
mkdir -p "$WEBROOT"
# --delete синхронизирует один-в-один: удаляет в вебруте то, чего нет в репозитории
rsync -a --delete --exclude='.DS_Store' "$APP_DIR/landing/" "$WEBROOT/"

echo "==> содержимое вебрута:"
ls -1 "$WEBROOT"
echo "==> Landing deploy done: $(date -Is)"
