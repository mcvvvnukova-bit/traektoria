# Traektoria51 Deploy Runbook

## Сервер
- Хост: `beget-bot`
- Публичный адрес: см. DNS/панель хостинга
- Домен бота: `bot.traektoria51.ru`

## Где лежит проект
- Приложение: `/opt/telegram-bot`
- Конфиг окружения: `/opt/telegram-bot/.env`
- systemd unit: `/etc/systemd/system/traektoria51-bot.service`
- PFDO sync unit: `/etc/systemd/system/traektoria51-pfdo-sync.service`
- PFDO sync timer: `/etc/systemd/system/traektoria51-pfdo-sync.timer`
- nginx site: `/etc/nginx/sites-available/traektoria51-bot`

## Что запущено
- Сервис бота: `traektoria51-bot`
- Ночной sync PFDO-зеркала: `traektoria51-pfdo-sync.timer`
- Transport: `webhook`
- Внутренний webhook listener: `127.0.0.1:3000`
- Публичный webhook URL: `https://bot.traektoria51.ru/telegram/webhook`
- Публичный MAX webhook URL: `https://bot.traektoria51.ru/max/webhook/...`
- Публичный Alice webhook URL: `https://bot.traektoria51.ru/alice/webhook/...`
- Health endpoint: `https://bot.traektoria51.ru/health`

## Базы
- `telegram_bot`
- `pfdo_51_mirror`

Обе базы живут на сервере в локальном PostgreSQL 16.

## Полезные команды

Подключиться на сервер:
```bash
ssh beget-bot
```

Проверить статус бота:
```bash
sudo systemctl status traektoria51-bot
```

Проверить ночной sync PFDO:
```bash
sudo systemctl status traektoria51-pfdo-sync.timer
sudo systemctl list-timers traektoria51-pfdo-sync.timer
journalctl -u traektoria51-pfdo-sync -n 100 --no-pager
```

Запустить sync PFDO вручную:
```bash
cd /opt/telegram-bot
node scripts/sync-pfdo-programs.js --trigger manual
```

Перезапустить бота:
```bash
sudo systemctl restart traektoria51-bot
```

Посмотреть live-логи:
```bash
journalctl -u traektoria51-bot -f
```

Проверить nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

Проверить health:
```bash
curl -sS https://bot.traektoria51.ru/health
```

Проверить webhook у Telegram:
```bash
curl -sS "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```

Проверить токен бота MAX:
```bash
curl -sS "https://platform-api.max.ru/me" -H "Authorization: <MAX_BOT_TOKEN>"
```

Проверить Mattermost:

- отправьте личное сообщение боту;
- в канале упомяните бота и напишите запрос;
- убедитесь, что бот показывает нумерованный список вариантов и принимает ответ номером.

Зарегистрировать webhook MAX вручную, если `MAX_WEBHOOK_REGISTER=false`:
```bash
curl -sS -X POST "https://platform-api.max.ru/subscriptions" \
  -H "Authorization: <MAX_BOT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://bot.traektoria51.ru/max/webhook/...","update_types":["message_created","message_callback","bot_started"],"secret":"<MAX_WEBHOOK_SECRET>"}'
```

Проверить, что сервис слушает локально:
```bash
curl -sS http://127.0.0.1:3000/health
```

Проверить подключение к базам:
```bash
psql -d telegram_bot -c "select count(*) from bot_sessions;"
psql -d pfdo_51_mirror -c "select count(*) from pfdo_programs;"
```

## SSL
- Сертификат выдан Let's Encrypt
- Certbot настроил автообновление

Ручная проверка:
```bash
sudo certbot renew --dry-run
```

## Где смотреть секреты
Все рабочие значения лежат в:
- `/opt/telegram-bot/.env`

Не выносить токен бота и пароли БД в документацию или публичные файлы.

## Как обновлять код
1. Подключиться к серверу: `ssh beget-bot`
2. Перейти в каталог проекта: `cd /opt/telegram-bot`
3. Обновить нужные файлы
4. Если менялась SQL-схема для `telegram_bot`, отдельно применить ее до рестарта
5. Перезапустить сервис:
```bash
sudo systemctl restart traektoria51-bot
```
6. Проверить:
```bash
curl -sS https://bot.traektoria51.ru/health
journalctl -u traektoria51-bot -n 50 --no-pager
```

## Что проверить после любого изменения
1. `systemctl is-active traektoria51-bot` возвращает `active`
2. `https://bot.traektoria51.ru/health` отвечает `{"ok":true,...}` и показывает включенные transports
3. `getWebhookInfo` у Telegram показывает правильный URL
4. `GET /me` у MAX отвечает данными бота
5. Бот отвечает на `/start`, `/text`, `/quiz`, `/deep`, `/wide` в Telegram
6. Бот отвечает на запуск и команды меню в MAX
7. Web-chat отправляет сообщение и получает ответ
8. Mattermost отвечает на личное сообщение или mention, если включен
9. `systemctl list-timers traektoria51-pfdo-sync.timer` показывает активный PFDO sync timer

## Если бот не стартует
1. Проверить статус `traektoria51-bot`
2. Проверить логи через `journalctl -u traektoria51-bot -n 100 --no-pager`
3. Проверить доступность PostgreSQL
4. Проверить `PSQL_BIN` и строки подключения в `.env`
5. Проверить `https://bot.traektoria51.ru/health`
6. Проверить `getWebhookInfo`

## Если нужно переехать обратно на polling
В `.env`:
```env
TELEGRAM_TRANSPORT=polling
```

После этого:
```bash
sudo systemctl restart traektoria51-bot
```
