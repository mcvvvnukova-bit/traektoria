# PFDO OpenAPI Import Notes

Файл спецификации:

- [pfdo-public-api.swagger.json](pfdo-public-api.swagger.json)

## Postman

1. `Import`
2. `File`
3. выбрать `pfdo-public-api.swagger.json`
4. импортировать как `OpenAPI 3.0`

После импорта:

- базовый URL уже задан: `https://api.pfdo.ru/v2`
- в файле описано 33 публично доступных endpoint'а PFDO v2
- для `51.pfdo.ru` используй `operator=37`
- для фильтрации программ по муниципалитету используй `search[mun]`

## Swagger Editor

1. открыть [editor.swagger.io](https://editor.swagger.io/)
2. `File -> Import File`
3. выбрать `pfdo-public-api.swagger.json`

## Ограничения

- это наблюдаемая, а не официальная vendor-спека
- публичные `/swagger.json`, `/openapi.json`, `/swagger`, `/docs`, `/api-docs` у API не найдены
- кабинетные маршруты, которые без токена возвращают `401`, не включены как открытые методы
- часть error responses описана как практический контракт для интеграции
- контракт удаленного API может меняться без уведомления
