# Справочник конфигурации

Статус: первый рабочий черновик от 2026-06-13.

Документ описывает переменные окружения для бота, каналов, баз данных, PFDO, PDF и сервисных скриптов. Примеры значений лежат в [.env.example](../.env.example) и [deploy/env.production.example](../deploy/env.production.example).

Не храните реальные токены, пароли и webhook secret paths в репозитории.

## Как загружается конфигурация

При старте `src/index.js` вызывает `loadEnvFile()` из `src/load-env.js`. Значения берутся из переменных окружения и локального `.env`. Уже заданные переменные окружения имеют приоритет над `.env`.

Запуск:

```bash
node src/index.js
```

Инициализация основной базы:

```bash
node scripts/setup-db.js
```

## Базы данных и системные команды

| Переменная | Обязательна | Значение по умолчанию | Назначение |
| --- | --- | --- | --- |
| `DATABASE_URL` | Да | Нет | PostgreSQL-база бота. Хранит сессии, runtime state и историю рекомендаций. |
| `PFDO_MIRROR_DATABASE_URL` | Да для рекомендаций из PFDO | `postgresql://localhost:5432/pfdo_51_mirror` в части модулей | Локальное зеркало каталога PFDO. |
| `PSQL_BIN` | Обычно да на сервере | На macOS: `~/Applications/Postgres.app/Contents/Versions/latest/bin/psql` | Путь к `psql`, через который выполняются SQL-команды. |

## Telegram

| Переменная | Обязательна | Значение по умолчанию | Назначение |
| --- | --- | --- | --- |
| `TELEGRAM_ENABLED` | Нет | `true` | Включает или отключает Telegram. |
| `TELEGRAM_BOT_TOKEN` | Да, если Telegram включен | Нет | Токен бота от `@BotFather`. |
| `TELEGRAM_API_BASE` | Нет | `https://api.telegram.org` | Базовый URL Telegram Bot API. |
| `TELEGRAM_TRANSPORT` | Нет | `polling` | Режим `polling` или `webhook`. |
| `TELEGRAM_WEBHOOK_URL` | Да для webhook-регистрации | Нет | Публичный базовый URL, например `https://bot.traektoria51.ru`. |
| `TELEGRAM_WEBHOOK_HOST` | Нет | `0.0.0.0` | Host, на котором слушает локальный HTTP-сервер. |
| `TELEGRAM_WEBHOOK_PORT` | Нет | `3000` | Порт локального HTTP-сервера. |
| `TELEGRAM_WEBHOOK_PATH` | Нет | Генерируется из токена | Путь webhook. Лучше задавать секретный путь явно. |
| `TELEGRAM_WEBHOOK_SECRET_TOKEN` | Нет | Пусто | Secret token для проверки заголовка `x-telegram-bot-api-secret-token`. |
| `TELEGRAM_WEBHOOK_REGISTER` | Нет | `true` | Разрешает боту вызвать `setWebhook` при старте. |

Минимальный локальный запуск в polling:

```env
TELEGRAM_ENABLED=true
TELEGRAM_TRANSPORT=polling
TELEGRAM_BOT_TOKEN=...
DATABASE_URL=postgresql://localhost:5432/telegram_bot
PFDO_MIRROR_DATABASE_URL=postgresql://localhost:5432/pfdo_51_mirror
```

## MAX

| Переменная | Обязательна | Значение по умолчанию | Назначение |
| --- | --- | --- | --- |
| `MAX_ENABLED` | Нет | `false` | Включает транспорт MAX. |
| `MAX_BOT_TOKEN` | Да, если MAX включен | Нет | Токен бота MAX. |
| `MAX_API_BASE` | Нет | `https://platform-api.max.ru` | Базовый URL MAX API. |
| `MAX_WEBHOOK_URL` | Да для webhook-регистрации | Берется из `TELEGRAM_WEBHOOK_URL`, если не задан | Публичный базовый URL webhook. |
| `MAX_WEBHOOK_PATH` | Нет | Генерируется из токена | Путь webhook для MAX. |
| `MAX_WEBHOOK_SECRET` | Нет | Пусто | Секрет для проверки заголовка `X-Max-Bot-Api-Secret`. |
| `MAX_WEBHOOK_REGISTER` | Нет | `true` | Разрешает регистрацию подписки через `POST /subscriptions`. |
| `MAX_UPDATE_TYPES` | Нет | `message_created,message_callback,bot_started` | Типы событий MAX. |

## Яндекс Алиса

| Переменная | Обязательна | Значение по умолчанию | Назначение |
| --- | --- | --- | --- |
| `ALICE_ENABLED` | Нет | `false` | Включает endpoint Алисы. |
| `ALICE_WEBHOOK_PATH` | Да, если Алиса включена | `/alice/webhook/disabled` | Секретный путь, который указывается в Яндекс.Диалогах. |

Важно: Алиса сейчас отвечает справкой и подсказками. Полный сценарий рекомендаций через Алису не реализован.

## Web-chat

| Переменная | Обязательна | Значение по умолчанию | Назначение |
| --- | --- | --- | --- |
| `WEB_CHAT_ENABLED` | Нет | `true` | Включает HTTP API web-chat. |
| `WEB_CHAT_PATH_PREFIX` | Нет | `/web-chat` | Префикс endpoint-ов web-chat. |
| `WEB_CHAT_ALLOWED_ORIGINS` | Нет | Список доменов `traektoria51.ru` и localhost | Разрешенные CORS origins. |
| `WEB_CHAT_BODY_LIMIT_BYTES` | Нет | `16384` | Максимальный размер JSON-запроса. |
| `WEB_CHAT_MESSAGE_MAX_LENGTH` | Нет | `2000` | Максимальная длина сообщения пользователя. |
| `WEB_CHAT_RATE_LIMIT_PER_MINUTE` | Нет | `30` | Лимит запросов в минуту на IP. |
| `WEB_CHAT_DOCUMENT_TTL_MS` | Нет | `3600000` | Время жизни ссылки на PDF-документ. |

Endpoint-ы:

| Метод | Путь | Назначение |
| --- | --- | --- |
| `POST` | `/web-chat/message` | Отправить текст пользователя. |
| `POST` | `/web-chat/callback` | Отправить callback кнопки. |
| `POST` | `/web-chat/reset` | Начать заново. |
| `GET` | `/web-chat/document/<token>` | Скачать PDF. |

## Mattermost

| Переменная | Обязательна | Значение по умолчанию | Назначение |
| --- | --- | --- | --- |
| `MATTERMOST_ENABLED` | Нет | `false` | Включает Mattermost transport. |
| `MATTERMOST_URL` | Да, если Mattermost включен | Нет | URL Mattermost-сервера. |
| `MATTERMOST_TOKEN` | Один из способов авторизации | Пусто | Personal access token. |
| `MATTERMOST_USERNAME` | Если нет token | Пусто | Имя пользователя бота. |
| `MATTERMOST_PASSWORD` | Если нет token | Пусто | Пароль пользователя бота. |
| `MATTERMOST_MODE` | Нет | `mentions` | Режим обработки сообщений. |
| `MATTERMOST_REPLY_MODE` | Нет | `thread` | Отправлять ответы в thread или основной канал. |

Если `MATTERMOST_TOKEN` задан, он используется вместо логина и пароля.

Mattermost работает через обычные сообщения. Custom slash command и interactive button integrations не нужны: бот отправляет нумерованные варианты, пользователь отвечает номером или текстом.

## PFDO

| Переменная | Обязательна | Значение по умолчанию | Назначение |
| --- | --- | --- | --- |
| `PFDO_API_BASE` | Нет | `https://api.pfdo.ru/v2` | Базовый URL PFDO API. |
| `PFDO_PORTAL_BASE` | Нет | `https://51.pfdo.ru` | Базовый URL публичного портала. |
| `PFDO_OPERATOR_ID` | Нет | `37` | Оператор Мурманской области. |
| `PFDO_MAX_PAGES` | Нет | `3` | Максимальное число страниц при прямых API-запросах. |
| `PFDO_REQUEST_TIMEOUT_MS` | Нет | `30000` | Timeout прямого PFDO API-запроса. |
| `PFDO_REQUEST_RETRIES` | Нет | `4` | Количество попыток прямого PFDO API-запроса. |

Runtime-рекомендации читают локальное зеркало через `PFDO_MIRROR_DATABASE_URL`. Прямой PFDO API нужен в первую очередь для импортных скриптов и служебных операций.

## Локальная LLM

| Переменная | Обязательна | Значение по умолчанию | Назначение |
| --- | --- | --- | --- |
| `LOCAL_LLM_ENABLED` | Нет | `false` | Включает локальный анализ свободного текста. |
| `LOCAL_LLM_API_URL` | Нет | `http://127.0.0.1:8012/v1/chat/completions` | OpenAI-compatible endpoint локальной модели. |
| `LOCAL_LLM_MODEL` | Нет | `qwen2.5-3b-instruct-q4_k_m` | Имя модели в запросе. |
| `LOCAL_LLM_TIMEOUT_MS` | Нет | `20000` | Timeout запроса к локальной модели. |

Локальная LLM используется в сценарии «Подобрать по описанию». Если она выключена или недоступна, бот использует эвристический разбор.

## PDF

| Переменная | Обязательна | Значение по умолчанию | Назначение |
| --- | --- | --- | --- |
| `PDF_OUTPUT_DIR` | Нет | Временный каталог ОС | Куда сохранять PDF-файлы подборок. |
| `PDF_FONT_PATH` | Нет | `assets/fonts/GolosText-Regular.ttf`, затем системные fallback-шрифты | Основной TTF-шрифт. |
| `PDF_FONT_REGULAR_PATH` | Нет | См. выше | Regular-шрифт. |
| `PDF_FONT_MEDIUM_PATH` | Нет | `assets/fonts/GolosText-Medium.ttf` | Medium-шрифт. |
| `PDF_FONT_SEMIBOLD_PATH` | Нет | `assets/fonts/GolosText-SemiBold.ttf` | Semibold-шрифт. |
| `PDF_FONT_BOLD_PATH` | Нет | `assets/fonts/GolosText-Bold.ttf` | Bold-шрифт. |

Шрифт должен поддерживать кириллицу.

## Скрипты PFDO-зеркала и тем

| Переменная | Где используется | Значение по умолчанию | Назначение |
| --- | --- | --- | --- |
| `PFDO_IMPORT_CONCURRENCY` | `scripts/import-pfdo-mirror.js` | `6` | Параллельность загрузки деталей программ. |
| `PFDO_IMPORT_SQL_FLUSH_BYTES` | `scripts/import-pfdo-mirror.js` | `4194304` | Размер SQL-буфера перед flush. |
| `PFDO_KEYWORDS_BACKFILL_CONCURRENCY` | `scripts/backfill-pfdo-keywords.js` | `8` | Параллельность backfill ключевых слов. |
| `PFDO_DOCUMENT_DOWNLOAD_CONCURRENCY` | `scripts/download-pfdo-program-documents.js` | `10` | Параллельность скачивания документов. |
| `PFDO_DOCUMENT_DOWNLOAD_TIMEOUT_MS` | `scripts/download-pfdo-program-documents.js` | `90000` | Timeout скачивания документа. |
| `PFDO_DOCUMENT_DOWNLOAD_ATTEMPTS` | `scripts/download-pfdo-program-documents.js` | `3` | Количество попыток скачивания. |
| `PFDO_DOCUMENT_DOWNLOAD_FORCE` | `scripts/download-pfdo-program-documents.js` | `false` | Принудительно перекачивать документы при `1`. |
| `PFDO_CALENDAR_TOPIC_CONCURRENCY` | `scripts/import-pfdo-calendar-topics.js` | `3` | Параллельность импорта календарных тем. |
| `PFDO_CALENDAR_TOPIC_INSERT_BATCH_SIZE` | `scripts/import-pfdo-calendar-topics.js` | `500` | Размер batch-вставки тем. |
| `PFDO_TOPIC_ANALYTICS_BATCH_SIZE` | `scripts/build-pfdo-topic-analytics.js` | `500` | Размер batch для аналитического слоя тем. |
| `PFDO_PROGRAMS_CSV_FILENAME` | `scripts/export-pfdo-programs-csv.js` | `pfdo_51_programs_export.csv` | Имя CSV-экспорта программ. |

## Parser auto-updater и OpenAI

| Переменная | Обязательна | Значение по умолчанию | Назначение |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | Да для parser auto-updater | Нет | API-ключ OpenAI для аудита парсера. |
| `OPENAI_MODEL` | Нет | Зависит от кода auto-updater | Общая модель OpenAI, если не задана специализированная. |
| `PFDO_PARSER_UPDATER_MODEL` | Нет | Зависит от кода auto-updater | Модель для parser auto-updater. |
| `PFDO_PARSER_UPDATER_OPENAI_CACHE_DIR` | Нет | `tmp/parser-updater-cache/openai` | Каталог кеша OpenAI-ответов. |
| `PFDO_PARSER_UPDATER_OPENAI_RETRIES` | Нет | `4` | Количество повторов OpenAI-запроса. |

Parser auto-updater не должен использоваться как автоматический генератор патчей. Он готовит диагностику и repair plan, а изменения кода проходят обычную разработку и тесты.

## Program Topic Extractor

| Переменная | Обязательна | Значение по умолчанию | Назначение |
| --- | --- | --- | --- |
| `TOPIC_EXTRACTOR_PYTHON_BIN` | Нет | bundled Codex Python или `python3` | Python для PDF extraction helper. |

Если `pypdf` недоступен в выбранном Python, извлечение PDF завершится понятной ошибкой.

## Минимальные профили окружения

### Локальная разработка через Telegram polling

```env
TELEGRAM_ENABLED=true
TELEGRAM_TRANSPORT=polling
TELEGRAM_BOT_TOKEN=...
DATABASE_URL=postgresql://localhost:5432/telegram_bot
PFDO_MIRROR_DATABASE_URL=postgresql://localhost:5432/pfdo_51_mirror
PSQL_BIN=psql
MAX_ENABLED=false
ALICE_ENABLED=false
MATTERMOST_ENABLED=false
```

### Прод webhook

```env
TELEGRAM_ENABLED=true
TELEGRAM_TRANSPORT=webhook
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_URL=https://bot.traektoria51.ru
TELEGRAM_WEBHOOK_HOST=127.0.0.1
TELEGRAM_WEBHOOK_PORT=3000
TELEGRAM_WEBHOOK_PATH=/telegram/webhook/<secret-path>
TELEGRAM_WEBHOOK_SECRET_TOKEN=<secret-token>
TELEGRAM_WEBHOOK_REGISTER=true

DATABASE_URL=postgresql://localhost:5432/telegram_bot
PFDO_MIRROR_DATABASE_URL=postgresql://localhost:5432/pfdo_51_mirror
PSQL_BIN=psql
```

## Проверка после изменения конфигурации

1. Перезапустите сервис.
2. Проверьте `/health`.
3. Проверьте логи на старте.
4. Отправьте `/start` в Telegram или тестовый запрос в нужный канал.
5. Если менялся PFDO-доступ, проверьте `select count(*) from pfdo_programs;`.
6. Если менялся PDF, скачайте тестовую подборку.

## Связанные документы

- [README](../README.md)
- [Руководство оператора](operator-guide.md)
- [Deploy Runbook](deploy-runbook.md)
- [Архитектура](architecture-overview.md)
- [Безопасность и приватность](security-and-privacy.md)
- [Релизы и управление изменениями](release-and-change-management.md)
