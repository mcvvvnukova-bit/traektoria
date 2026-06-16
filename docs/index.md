# Пакет документации проекта «Траектория талантов»

Статус: первый рабочий черновик от 2026-06-13.

Этот раздел помогает быстро понять проект, найти нужную документацию и передать сопровождение другой команде. Проект уже содержит технические сценарии, схемы данных и runbook. Этот пакет добавляет верхнеуровневый навигатор и закрывает документы, которых не хватало для продукта, архитектуры, эксплуатации и конфигурации.

## С чего начать

| Если вы... | Читайте сначала |
| --- | --- |
| впервые знакомитесь с проектом | [Обзор продукта](product-overview.md) |
| принимаете проект в разработку | [Архитектура](architecture-overview.md), затем [README](../README.md) |
| сопровождаете работающий сервис | [Руководство оператора](operator-guide.md), затем [Deploy Runbook](deploy-runbook.md) |
| настраиваете окружение | [Справочник конфигурации](configuration-reference.md) |
| меняете подбор программ | [Архитектура](architecture-overview.md), сценарии и `src/recommendations.js` |
| работаете с данными PFDO | [PFDO-пайплайн данных](pfdo-data-pipeline.md), [Схема PFDO-зеркала](pfdo-database-schema.md), [Program Topic Extractor](../services/program-topic-extractor/README.md), [Классификация тем](program-topic-classification.md) |

## Документы пакета

### Продукт и пользователи

- [Обзор продукта](product-overview.md) — назначение, аудитории, сценарии, каналы и ограничения MVP.
- [Пользовательское руководство в DOCX](user-guide-program-selection.docx) — готовый пользовательский документ с иллюстрациями.
- [Сценарий 1. Подобрать по описанию](scenario-1-description-flow.md) — быстрый подбор по свободному тексту.
- [Сценарий 2. Подобрать с AI агентом](scenario-2-ai-agent-flow.md) — пошаговый сценарий с уточняющими вопросами.
- [Сценарий 3. Составить углубленную траекторию](superpowers/specs/2026-05-22-scenario-3-deep-continuation-design.md) — подбор продолжения по уже пройденным программам.
- [Названия сценариев бота](bot-scenario-names.md) — тексты сценариев для пользовательского меню.

### Разработка и архитектура

- [Архитектура](architecture-overview.md) — компоненты, потоки данных, хранилища и точки расширения.
- [Рекомендательная логика](recommendation-engine.md) — скоринг, фильтры, confidence, fallback и углубленная траектория.
- [README проекта](../README.md) — запуск, возможности MVP и текущие ограничения.
- [PFDO Parser Auto-Updater Design](superpowers/specs/2026-06-01-pfdo-parser-auto-updater-design.md) — дизайн автоаудита парсеров.
- [Mattermost Transport Design](superpowers/specs/2026-06-07-mattermost-transport-design.md) — дизайн транспорта Mattermost.
- [Планы реализации](plans/) — исторические планы по крупным изменениям.

### Эксплуатация

- [Руководство оператора](operator-guide.md) — ежедневные проверки, инциденты, обновление данных и релизы.
- [Deploy Runbook](deploy-runbook.md) — фактические серверные команды и параметры прод-окружения.
- [Справочник конфигурации](configuration-reference.md) — переменные окружения для бота, каналов, PFDO, PDF и сервисных скриптов.
- [QA и приемка](qa-and-acceptance.md) — автотесты, ручные сценарии и критерии готовности.
- [Безопасность и приватность](security-and-privacy.md) — секреты, пользовательские данные, webhook-и, логи и артефакты.
- [Релизы и управление изменениями](release-and-change-management.md) — порядок проверок, деплоя, rollback и release notes.

### Данные PFDO и аналитика тем

- [PFDO-пайплайн данных](pfdo-data-pipeline.md) — импорт зеркала, документы, темы, аналитика и parser auto-updater.
- [Схема базы `pfdo_51_mirror`](pfdo-database-schema.md) — структура локального зеркала PFDO.
- [Атрибуты таблицы `pfdo_programs`](pfdo-programs-attributes.md) — поля основной таблицы программ.
- [PFDO OpenAPI Import Notes](pfdo-public-api.import.md) — заметки по импорту OpenAPI-описания.
- [PFDO OpenAPI Swagger](pfdo-public-api.swagger.json) — локальная копия Swagger-описания.
- [Program Topic Extractor](../services/program-topic-extractor/README.md) — извлечение, нормализация и классификация тем программ.
- [Классификация тем программ](program-topic-classification.md) — таксономии, правила, экспорты и ручная проверка тем.
- [Схема потока рекомендаций](recommendation-data-flow.svg) — визуальная схема data flow.

## Карта читательских ролей

### Заказчик или продуктовый владелец

1. [Обзор продукта](product-overview.md)
2. [Пользовательское руководство](user-guide-program-selection.docx)
3. Сценарии 1-3
4. Раздел «Ограничения текущей версии» в [README](../README.md)

### Разработчик

1. [README](../README.md)
2. [Архитектура](architecture-overview.md)
3. [Рекомендательная логика](recommendation-engine.md)
4. [Справочник конфигурации](configuration-reference.md)
5. [QA и приемка](qa-and-acceptance.md)
6. Сценарии и релевантные планы из `docs/plans/`
7. Тесты в `test/`

### Оператор или сопровождающий

1. [Руководство оператора](operator-guide.md)
2. [Deploy Runbook](deploy-runbook.md)
3. [Справочник конфигурации](configuration-reference.md)
4. [QA и приемка](qa-and-acceptance.md)
5. [Релизы и управление изменениями](release-and-change-management.md)
6. [Схема PFDO-зеркала](pfdo-database-schema.md)

### Сопровождающий данных

1. [PFDO-пайплайн данных](pfdo-data-pipeline.md)
2. [Схема PFDO-зеркала](pfdo-database-schema.md)
3. [Program Topic Extractor](../services/program-topic-extractor/README.md)
4. [Классификация тем программ](program-topic-classification.md)
5. [Руководство оператора](operator-guide.md#обновление-данных-pfdo)
6. `scripts/import-pfdo-mirror.js`, `scripts/download-pfdo-program-documents.js`, `scripts/import-pfdo-calendar-topics.js`, `scripts/build-pfdo-topic-analytics.js`

## Термины

- **Бот** — Node.js-приложение из `src/index.js`, которое принимает сообщения из подключенных каналов.
- **Транспорт** — адаптер канала общения: Telegram, MAX, web-chat, Mattermost или Алиса.
- **PFDO-зеркало** — локальная база `pfdo_51_mirror` с программами, группами, расписанием, документами и темами программ.
- **Основная база бота** — база `telegram_bot`, где хранятся сессии, runtime-состояние и история рекомендаций.
- **Сценарий** — пользовательский поток подбора: быстрый подбор, пошаговый подбор или углубленная траектория.
- **Темы программ** — нормализованные темы из документов программ, которые используются для углубленных рекомендаций.

## Как поддерживать пакет

- Обновляйте этот файл, когда добавляется новый документ.
- Если меняется поведение сценария, обновляйте и сценарий, и [Обзор продукта](product-overview.md).
- Если добавляется переменная окружения, обновляйте [Справочник конфигурации](configuration-reference.md) и `.env.example` или `deploy/env.production.example`.
- Если меняется деплой, обновляйте [Deploy Runbook](deploy-runbook.md) и [Руководство оператора](operator-guide.md).
- Если меняется структура PFDO-зеркала, обновляйте [Схему PFDO-зеркала](pfdo-database-schema.md).
- Если меняется ранжирование, обновляйте [Рекомендательную логику](recommendation-engine.md).
- Если меняются проверки или релизный процесс, обновляйте [QA и приемку](qa-and-acceptance.md) и [Релизы](release-and-change-management.md).

## Что еще стоит дописать

- `docs/user-guide.md` — Markdown-версия пользовательского руководства рядом с DOCX.
- `docs/release-notes.md` — журнал фактических релизов.
- `docs/adr/` — короткие architecture decision records для важных решений.
