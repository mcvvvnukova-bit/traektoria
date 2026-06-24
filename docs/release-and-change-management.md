# Релизы и управление изменениями

Статус: обновлено 2026-06-17 с учетом доработок за 2026-06-15 - 2026-06-17.

Документ описывает, как безопасно выпускать изменения в проекте «Траектория талантов».

## Цель процесса

Релиз должен быть воспроизводимым: команда понимает, что изменилось, какие проверки прошли, как откатиться и какие документы обновлены.

## Типы изменений

| Тип | Примеры | Основной риск |
| --- | --- | --- |
| Сценарии | новые вопросы, тексты, callback-и | пользователь застрянет в диалоге |
| Рекомендации | скоринг, фильтры, fallback | ухудшение качества подбора |
| PFDO pipeline | импорт, парсинг, классификация | пустое зеркало или плохие темы |
| Транспорт | Telegram, MAX, web-chat, Mattermost, Алиса | канал перестанет отвечать |
| Конфигурация | env, nginx, systemd | сервис не стартует |
| PDF | верстка, шрифты, доставка | пользователь не получит файл |
| Landing | web-chat, footer-ссылки, Метрика | сайт не ведет в нужный канал или собирает лишние данные |
| Схема БД | `telegram_bot`, `pfdo_51_mirror` | несовместимость данных |
| Документация | runbook, guides | команда будет действовать по старым инструкциям |

## Перед началом работы

1. Определите тип изменения.
2. Найдите владельца проверки: разработчик, оператор, продуктовый владелец или сопровождающий данных.
3. Проверьте текущий статус рабочей директории.
4. Уточните, есть ли несвязанные изменения в тех же файлах.
5. Для изменения данных или схемы запланируйте backup или snapshot.

## Документы, которые нужно обновлять

| Изменение | Документы |
| --- | --- |
| Новый пользовательский сценарий | `docs/product-overview.md`, `docs/scenario-*.md`, `docs/index.md` |
| Изменение рекомендаций | `docs/recommendation-engine.md`, `docs/Скоринговая модель.md`, тесты |
| Новая env-переменная | `.env.example`, `deploy/env.production.example`, `docs/configuration-reference.md` |
| Изменение деплоя | `docs/deploy-runbook.md`, `docs/operator-guide.md` |
| Изменение PFDO pipeline | `docs/pfdo-data-pipeline.md`, `docs/pfdo-database-schema.md` |
| Изменение безопасности | `docs/security-and-privacy.md` |
| Изменение приемки | `docs/qa-and-acceptance.md` |
| Изменение landing или web-chat UI | `README.md`, `docs/architecture-overview.md`, `docs/qa-and-acceptance.md`, `docs/security-and-privacy.md` |

## Локальная проверка

Минимум:

```bash
npm test
```

Если менялся PFDO parser:

```bash
node scripts/import-pfdo-calendar-topics.js --program-id <PROGRAM_ID>
node scripts/build-pfdo-topic-analytics.js --limit 1000
npm test
```

Если менялась конфигурация:

```bash
node scripts/setup-db.js
node src/index.js
```

Для локального webhook без регистрации:

```bash
TELEGRAM_TRANSPORT=webhook TELEGRAM_WEBHOOK_REGISTER=false node src/index.js
```

## Предрелизный чек-лист

1. Изменения соответствуют задаче.
2. Нет случайно измененных секретов.
3. `.env` не попал в diff.
4. `npm test` проходит.
5. Документация обновлена.
6. Миграции или SQL-изменения применимы повторно.
7. PFDO-скрипты проверены на ограниченном наборе, если они менялись.
8. Есть план rollback.
9. Известные ограничения записаны в PR, release notes или задаче.

## Деплой

Базовый порядок на сервере:

```bash
ssh beget-bot
cd /opt/telegram-bot
```

Дальше примените выбранный способ доставки кода. После обновления файлов:

```bash
sudo systemctl restart traektoria51-bot
curl -sS https://bot.traektoria51.ru/health
journalctl -u traektoria51-bot -n 50 --no-pager
```

Если менялся nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Если менялась схема `telegram_bot`, примените SQL до рестарта или в явно согласованном окне.

## Post-deploy smoke

После деплоя проверьте:

1. `systemctl is-active traektoria51-bot`.
2. `GET /health`.
3. Telegram `/start`.
4. Telegram `/text`, `/quiz`, `/deep`, `/wide`, если менялись меню или сценарии.
5. MAX, если включен.
6. Web-chat и landing-меню, если включены.
7. Mattermost, если включен.
8. PDF-выгрузку.
9. Один пользовательский happy path.
10. Логи за последние 50-100 строк.

## Rollback

Rollback зависит от типа изменения.

| Изменение | Возможный rollback |
| --- | --- |
| Только код | Вернуть предыдущую версию файлов и перезапустить сервис. |
| Конфигурация | Вернуть предыдущий `.env` и перезапустить сервис. |
| nginx | Вернуть предыдущий site config, `nginx -t`, reload. |
| `telegram_bot` schema | Использовать заранее подготовленный SQL отката или backup. |
| PFDO данные | Восстановить backup/snapshot или повторить предыдущий импорт. |
| Parser auto-updater | Использовать snapshot артефакты и regression verification. |

Не делайте destructive rollback без понимания, какие пользовательские данные будут потеряны.

## Управление схемами

`db/schema.sql` должен быть идемпотентным для основной базы бота. Сейчас он использует `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS` и безопасные ALTER-блоки.

Для PFDO-зеркала схема лежит в `db/pfdo-mirror-schema.sql`. Если меняется структура:

1. Обновите SQL.
2. Обновите [pfdo-database-schema.md](pfdo-database-schema.md).
3. Проверьте импорт на тестовой базе или ограниченном наборе.
4. Опишите миграционный риск.

## Управление env

При добавлении переменной:

1. Добавьте ее в `.env.example`, если она нужна локально.
2. Добавьте ее в `deploy/env.production.example`, если она нужна на сервере.
3. Опишите в [configuration-reference.md](configuration-reference.md).
4. Укажите default и обязательность.
5. Проверьте старт без переменной, если она optional.

## Parser auto-updater changes

Для изменений parser auto-updater:

1. Запустите dry-run.
2. Проверьте `tmp/parser-updater/<program_id>/`.
3. Проверьте `exports/parser-updater-report.csv`.
4. Запустите regression-тесты.
5. Не принимайте repair plan как готовый patch без review.
6. После apply проверьте snapshot/restore поведение.

## Release notes

Для каждого заметного релиза фиксируйте:

- дату;
- краткое описание;
- затронутые сценарии;
- миграции и PFDO-операции;
- результат тестов;
- каналы, проверенные вручную;
- известные ограничения;
- ссылку на commit или PR.

Шаблон:

```markdown
## YYYY-MM-DD

Что изменилось:
- ...

Проверки:
- npm test: passed
- /health: passed
- Telegram /start: passed

Данные и миграции:
- ...

Rollback:
- ...

Известные ограничения:
- ...
```

## Когда нужен отдельный план

Создавайте отдельный план в `docs/plans/`, если изменение:

- затрагивает несколько сценариев;
- меняет схему БД;
- меняет PFDO pipeline;
- добавляет новый канал;
- меняет безопасность;
- требует ручной миграции данных;
- может повлиять на качество рекомендаций.

## Связанные документы

- [QA и приемка](qa-and-acceptance.md)
- [Руководство оператора](operator-guide.md)
- [Справочник конфигурации](configuration-reference.md)
- [PFDO-пайплайн данных](pfdo-data-pipeline.md)
- [Безопасность и приватность](security-and-privacy.md)
