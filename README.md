# Traektoria51 Bot MVP

Минимальный бот для подбора кружков на основе уже проработанного диалогового сценария. Сейчас поддерживает Telegram, MAX, web-chat и Mattermost.

## Что уже умеет

- ведет пользователя по короткому onboarding-сценарию;
- поддерживает быстрый подбор по свободному описанию с обязательными параметрами: возраст, место и интересы или направленность;
- собирает базовый профиль ребенка и ограничения семьи;
- задает 1-2 уточняющих вопроса, если уверенность низкая;
- умеет разбирать свободный текст пользователя через LLM-провайдер `openrouter` или `local` и сводить его к ограниченному набору сценариев;
- читает каталог из локальной базы `pfdo_51_mirror`;
- объясняет, почему варианты подходят;
- показывает, что спросить на пробном занятии и как понять, что кружок подходит.

## Что нужно для запуска

1. Создать бота через `@BotFather` и получить `TELEGRAM_BOT_TOKEN`.
2. Для MAX создать бота в MAX Business, пройти модерацию и получить `MAX_BOT_TOKEN`.
3. При необходимости поменять параметры PFDO:

- `PFDO_OPERATOR_ID=37` — Мурманская область / `51.pfdo.ru`
- `PFDO_PORTAL_BASE=https://51.pfdo.ru`
- `PFDO_API_BASE=https://api.pfdo.ru/v2`
- `PFDO_MIRROR_DATABASE_URL=postgresql://localhost:5432/pfdo_51_mirror`
- `DATABASE_URL=postgresql://localhost:5432/telegram_bot`

4. Выбрать транспорт:

- `TELEGRAM_TRANSPORT=polling` — локальный запуск через long polling
- `TELEGRAM_TRANSPORT=webhook` — запуск через HTTP webhook

Для webhook дополнительно нужны:

- `TELEGRAM_WEBHOOK_URL=https://your-domain.ru`
- `TELEGRAM_WEBHOOK_PORT=3000`
- `TELEGRAM_WEBHOOK_PATH=/telegram/webhook/...`
- `TELEGRAM_WEBHOOK_SECRET_TOKEN=...` — опционально, но лучше включить

Для MAX дополнительно нужны:

- `MAX_ENABLED=true`
- `MAX_BOT_TOKEN=...`
- `MAX_WEBHOOK_URL=https://your-domain.ru`
- `MAX_WEBHOOK_PATH=/max/webhook/...`
- `MAX_WEBHOOK_SECRET=...` — используется для проверки заголовка `X-Max-Bot-Api-Secret`
- `MAX_WEBHOOK_REGISTER=true` — при старте зарегистрирует webhook через `POST /subscriptions`

Для Яндекс Алисы дополнительно нужны:

- `ALICE_ENABLED=true`
- `ALICE_WEBHOOK_PATH=/alice/webhook/...` — секретная часть URL, который указывается в Яндекс.Диалогах

Для Mattermost дополнительно нужны:

- `MATTERMOST_ENABLED=true`
- `MATTERMOST_URL=https://mattermost.example.ru`
- `MATTERMOST_TOKEN=...` — token Mattermost Bot Account, только в `.env` или переменных окружения, не коммитить
- `MATTERMOST_USERNAME=botnumber2` и `MATTERMOST_PASSWORD=...` — запасной вариант, если token-based авторизация недоступна
- `MATTERMOST_MODE=mentions` — личные сообщения и сообщения в канале только при упоминании бота
- `MATTERMOST_REPLY_MODE=thread` — ответы в канале отправляются в тред к сообщению пользователя

В Mattermost бот работает без slash-команд и интерактивных кнопок: он отправляет нумерованный список вариантов, пользователь отвечает номером пункта или вводит данные текстом.

5. Запустить бота:

```bash
TELEGRAM_BOT_TOKEN=... node src/index.js
```

Можно просто заполнить `.env` и запускать:

```bash
node scripts/setup-db.js
node src/index.js
```

Для локальной проверки webhook без регистрации в Telegram можно временно использовать:

```bash
TELEGRAM_TRANSPORT=webhook
TELEGRAM_WEBHOOK_REGISTER=false
node src/index.js
```

Для локальной проверки MAX webhook без регистрации подписки можно временно использовать:

```bash
MAX_ENABLED=true
MAX_WEBHOOK_REGISTER=false
node src/index.js
```

Для включения LLM-анализа используются:

- `LLM_ENABLED=true`
- `LLM_PROVIDER=openrouter` или `LLM_PROVIDER=local`
- `LLM_DEFAULT_MODEL=openai/gpt-5.2`
- `OPENROUTER_API_KEY=...` — для провайдера `openrouter`
- `LOCAL_LLM_API_URL=http://127.0.0.1:8012/v1/chat/completions` — для провайдера `local`
- `LOCAL_LLM_MODEL=qwen2.5-3b-instruct-q4_k_m`
- `LLM_PROVIDER_DESCRIPTION_SELECTION=local`
- `LLM_MODEL_DESCRIPTION_SELECTION=qwen2.5-3b-instruct-q4_k_m`
- `LLM_PROVIDER_TRAJECTORY_DEEP=local`
- `LLM_MODEL_TRAJECTORY_DEEP=qwen2.5-3b-instruct-q4_k_m`
- `SCENARIO1_LLM_ONLY=true` — тестовый режим сценария 1 без regexp-разбора до LLM
- `LOCAL_LLM_ENABLED=true` — legacy-флаг, поддерживается для совместимости

Parser auto-updater использует те же переменные маршрутизации и отдельные шаги:

- `LLM_PROVIDER_PFDO_PARSER_EVALUATION=openrouter`
- `LLM_MODEL_PFDO_PARSER_EVALUATION=openai/gpt-5.2`
- `LLM_PROVIDER_PFDO_PARSER_REPAIR_PLAN=openrouter`
- `LLM_MODEL_PFDO_PARSER_REPAIR_PLAN=openai/gpt-5.2`

Старые `LOCAL_LLM_ENABLED`, `LOCAL_LLM_API_URL`, `LOCAL_LLM_MODEL`, `LOCAL_LLM_TIMEOUT_MS` продолжают поддерживаться для совместимости локального runtime.

## PostgreSQL schema

SQL вынесен в отдельные файлы:

- `db/schema.sql`
- `db/seeds.sql`

Инициализация базы:

```bash
node scripts/setup-db.js
```

## Документация

Пакет документации начинается с `docs/index.md`. Там есть навигация по продуктовым, архитектурным, эксплуатационным и PFDO-документам проекта.

## Что еще нужно для реального MVP

- логирование и обработка ошибок;
- деплой на сервер или контейнер.

## Ограничения текущей версии

 - бот хранит свои сессии в `telegram_bot`, а каталог читает из отдельной базы `pfdo_51_mirror`;
 - сессии и update offset сохраняются в PostgreSQL;
 - реализован основной режим `подобрать кружки сейчас`;
 - сценарий углубленного продолжения пройденных программ использует ссылки PFDO, темы программ и локальное зеркало каталога;
 - если локальное зеркало недоступно или пустое, бот не идет напрямую в PFDO API и использует только резервный mock-режим;
 - в webhook-режиме нужен публичный `https`-адрес, доступный Telegram;
 - если у программы нет открытых групп или расписания, бот отправляет ссылку на карточку и просит уточнить детали там.
