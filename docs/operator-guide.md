# Руководство оператора

Статус: первый рабочий черновик от 2026-06-13.

Документ описывает ежедневное сопровождение проекта «Траектория талантов»: как проверить, что сервис работает, как реагировать на типовые сбои, как обновлять данные PFDO и что смотреть после релиза.

Фактические параметры прод-сервера и команды деплоя также описаны в [Deploy Runbook](deploy-runbook.md).

## Быстрая проверка

Проверить публичный health endpoint:

```bash
curl -sS https://bot.traektoria51.ru/health
```

Ожидаемый результат:

```json
{
  "ok": true,
  "transports": {
    "telegram": "webhook",
    "max": "webhook",
    "alice": "webhook",
    "web": "enabled",
    "mattermost": "disabled"
  }
}
```

Проверить systemd-сервис:

```bash
sudo systemctl status traektoria51-bot
```

Проверить последние логи:

```bash
journalctl -u traektoria51-bot -n 100 --no-pager
```

Проверить, что базы доступны:

```bash
psql -d telegram_bot -c "select count(*) from bot_sessions;"
psql -d pfdo_51_mirror -c "select count(*) from pfdo_programs;"
```

## Ежедневный чек-лист

1. `https://bot.traektoria51.ru/health` отвечает `ok: true`.
2. `systemctl is-active traektoria51-bot` возвращает `active`.
3. В логах нет повторяющихся ошибок подключения к PostgreSQL, PFDO, Telegram, MAX или Mattermost.
4. В Telegram бот отвечает на `/start`.
5. В MAX бот отвечает на стартовое сообщение или callback.
6. Web-chat на сайте может отправить сообщение и получить ответ.
7. В `pfdo_51_mirror.pfdo_programs` есть данные.

## Основные команды

Подключиться к серверу:

```bash
ssh beget-bot
```

Перейти в каталог приложения:

```bash
cd /opt/telegram-bot
```

Перезапустить бота:

```bash
sudo systemctl restart traektoria51-bot
```

Смотреть live-логи:

```bash
journalctl -u traektoria51-bot -f
```

Проверить nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Проверка каналов

### Telegram

Проверить webhook:

```bash
curl -sS "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```

Что смотреть:

- `url` совпадает с продовым webhook URL;
- нет накопления `pending_update_count`;
- нет свежих ошибок доставки.

Если нужно временно перейти на polling, измените `.env`:

```env
TELEGRAM_TRANSPORT=polling
```

Затем перезапустите сервис:

```bash
sudo systemctl restart traektoria51-bot
```

### MAX

Проверить токен:

```bash
curl -sS "https://platform-api.max.ru/me" -H "Authorization: <MAX_BOT_TOKEN>"
```

Если `MAX_WEBHOOK_REGISTER=false`, webhook регистрируется вручную:

```bash
curl -sS -X POST "https://platform-api.max.ru/subscriptions" \
  -H "Authorization: <MAX_BOT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://bot.traektoria51.ru/max/webhook/...","update_types":["message_created","message_callback","bot_started"],"secret":"<MAX_WEBHOOK_SECRET>"}'
```

### Web-chat

Проверить локальный endpoint на сервере:

```bash
curl -sS http://127.0.0.1:3000/health
```

Если сайт не получает ответы, проверьте:

- `WEB_CHAT_ENABLED`;
- `WEB_CHAT_PATH_PREFIX`;
- `WEB_CHAT_ALLOWED_ORIGINS`;
- nginx proxy для `/web-chat`;
- rate limit по IP.

### Mattermost

Проверьте:

- `MATTERMOST_ENABLED=true`;
- `MATTERMOST_URL`;
- `MATTERMOST_TOKEN` или пару `MATTERMOST_USERNAME` / `MATTERMOST_PASSWORD`;
- режим `MATTERMOST_MODE`;
- логи WebSocket-подключения в `journalctl`.

### Алиса

Алиса сейчас отвечает справкой и примерами запроса. Полный сценарий подбора через общий runtime не подключен.

Проверьте:

- `ALICE_ENABLED=true`;
- `ALICE_WEBHOOK_PATH`;
- URL навыка в Яндекс.Диалогах;
- ответ на ping, если он используется при проверке.

## Обновление данных PFDO

Перед обновлением убедитесь, что известен источник данных и есть место на диске для документов программ.

Базовый порядок:

```bash
node scripts/import-pfdo-mirror.js
node scripts/download-pfdo-program-documents.js
node scripts/import-pfdo-calendar-topics.js --concurrency 4
node scripts/build-pfdo-topic-analytics.js
```

После обновления проверьте:

```bash
psql -d pfdo_51_mirror -c "select count(*) from pfdo_programs;"
psql -d pfdo_51_mirror -c "select count(*) from pfdo_program_calendar_topics;"
psql -d pfdo_51_mirror -c "select count(*) from pfdo_program_topic_aggregates;"
```

Если обновлялись темы программ, проверьте качество классификатора:

```bash
node scripts/evaluate-pfdo-topic-classifier.js
```

## Parser auto-updater

Parser auto-updater используется для аудита отдельных программ и подготовки repair plan. Он не должен автоматически применять кодовые патчи.

Начинайте с dry-run:

```bash
node scripts/update-pfdo-program-parser.js \
  --program-ids exports/parser_update_programs.csv \
  --limit 1
```

Apply-режим включается явно:

```bash
node scripts/update-pfdo-program-parser.js \
  --program-ids exports/parser_update_programs.csv \
  --apply
```

Перед apply-режимом проверьте:

- `OPENAI_API_KEY`;
- `PFDO_MIRROR_DATABASE_URL`;
- список program id;
- наличие regression-файла `services/program-topic-extractor/regression/checked-programs.csv`.

## Релизный чек-лист

Перед релизом:

```bash
npm test
```

Проверьте, что:

1. Тесты проходят.
2. `.env.example` и [Справочник конфигурации](configuration-reference.md) соответствуют новым переменным.
3. Если менялась схема `telegram_bot`, обновлен `db/schema.sql`.
4. Если менялась схема PFDO-зеркала, обновлены `db/pfdo-mirror-schema.sql` и [pfdo-database-schema.md](pfdo-database-schema.md).
5. Если менялся пользовательский сценарий, обновлен соответствующий документ в `docs/`.
6. После деплоя `/health` отвечает.
7. Telegram, MAX и web-chat проходят ручную smoke-проверку.

## Типовые проблемы

| Симптом | Возможная причина | Что сделать |
| --- | --- | --- |
| Сервис не стартует | Нет обязательного токена или базы | Проверить `.env`, `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `MAX_BOT_TOKEN`. |
| `Missing DATABASE_URL` | Не задана основная база | Заполнить `DATABASE_URL` для `telegram_bot`. |
| Ошибка `psql` | Неверный путь к бинарнику | Проверить `PSQL_BIN` и наличие `psql` на сервере. |
| Быстрый подбор ничего не нашел | PFDO-зеркало пустое или недоступно | Проверить `PFDO_MIRROR_DATABASE_URL` и `select count(*) from pfdo_programs;`. |
| В webhook приходит 401 | Неверный secret header | Сверить `TELEGRAM_WEBHOOK_SECRET_TOKEN` или `MAX_WEBHOOK_SECRET`. |
| PDF не создается | Не найден шрифт с кириллицей или нет прав на каталог | Проверить `assets/fonts/`, `PDF_OUTPUT_DIR`, права на запись. |
| Web-chat получает CORS-ошибку | Origin не разрешен | Добавить домен в `WEB_CHAT_ALLOWED_ORIGINS`. |
| Mattermost не отвечает | Нет WebSocket-сессии или прав | Проверить credentials, режим mention и логи транспорта. |
| Алиса не ведет подбор | Это текущее ограничение | Использовать Telegram, MAX или web-chat для полного сценария. |

## Что нельзя делать

- Не коммитить заполненный `.env`.
- Не публиковать токены, пароли БД и webhook secret paths.
- Не запускать apply-режим parser auto-updater без dry-run и проверки артефактов.
- Не обновлять PFDO-зеркало без проверки количества программ и тем после импорта.
- Не считать mock-рекомендации продуктивным результатом.

## Связанные документы

- [Deploy Runbook](deploy-runbook.md)
- [Справочник конфигурации](configuration-reference.md)
- [Архитектура](architecture-overview.md)
- [PFDO-пайплайн данных](pfdo-data-pipeline.md)
- [QA и приемка](qa-and-acceptance.md)
- [Релизы и управление изменениями](release-and-change-management.md)
- [Безопасность и приватность](security-and-privacy.md)
- [Program Topic Extractor](../services/program-topic-extractor/README.md)
