# Схема базы `pfdo_51_mirror`

Документ описывает актуальные таблицы локального зеркала PFDO, их назначение, ключи, связи и атрибуты. Состояние зафиксировано по локальной базе `pfdo_51_mirror` на 2026-05-25.

## Общая структура

| Таблица | Строк | Назначение |
|---|---:|---|
| `pfdo_regions` | 28 | Регионы/порталы PFDO из справочника регионов. |
| `pfdo_operator_info` | 1 | Сырые сведения о региональном операторе. |
| `pfdo_main_municipalities` | 17 | Муниципалитеты оператора, их описание и полезные контакты. |
| `pfdo_programs` | 5614 | Основные карточки образовательных программ. |
| `pfdo_program_directions` | 6 | Справочник направленностей программ. |
| `pfdo_program_kinds` | 3 | Справочник видов образовательных программ. |
| `pfdo_program_education_forms` | 3 | Справочник форм обучения. |
| `pfdo_program_medical_certificate_requirements` | 2 | Справочник требований медицинской справки. |
| `pfdo_program_levels` | 5 | Справочник уровней сложности. |
| `pfdo_program_document_types` | 11 | Справочник документов по итогам обучения. |
| `pfdo_organizational_forms` | 5 | Справочник организационно-правовых типов организаций. |
| `pfdo_organizations` | 358 | Организации, реализующие программы. |
| `pfdo_addresses` | 798 | Адреса площадок/организаций. |
| `pfdo_program_modules` | 10955 | Модули программ. |
| `pfdo_program_registry_entries` | 16842 | Реестровые признаки программ. |
| `pfdo_program_groups` | 7285 | Группы/наборы внутри программ. |
| `pfdo_group_addresses` | 5659 | Адреса групп. |
| `pfdo_program_group_periods` | 6939 | Периоды обучения в группах программ. |
| `pfdo_group_schedule_entries` | 22919 | Расписание занятий групп. |
| `pfdo_pedagogues` | 2048 | Педагоги из расписания/групп. |
| `pfdo_schedule_entry_pedagogues` | 18343 | Связь расписания с педагогами. |
| `pfdo_program_keywords` | 1083 | Справочник тегов/ключевых слов PFDO. |
| `pfdo_program_keyword_links` | 10036 | Связь программ с тегами. |
| `pfdo_program_activity_links` | 8331 | Числовые идентификаторы видов деятельности программы. |
| `pfdo_program_activities` | 5606 | Текстовые виды деятельности программы. |
| `pfdo_program_project_links` | 5264 | Связь программ с проектами PFDO. |
| `pfdo_program_calendar_topics` | 65095 | Темы календарно-тематических планов, извлеченные из документов программ. |
| `pfdo_program_topic_normalizations` | 65095 | Нормализованные темы календарных планов. |
| `pfdo_program_topic_aggregates` | 53799 | Агрегаты нормализованных тем. |
| `pfdo_program_topic_classifications` | 53799 | Классификации агрегированных тем. |
| `pfdo_program_topic_review_queue` | 35306 | Очередь ручной проверки классификаций. |
| `pfdo_topic_classifier_golden_labels` | 1198 | Эталонные метки классификатора тем. |
| `pfdo_raw_documents` | 5760 | Сырые ответы PFDO API. |

## Таблицы и атрибуты

### `pfdo_regions`

Хранит регионы/порталы PFDO из `/main-page/regions`.

Ключи: PK `id`.

| Атрибут | Тип | NULL | Значение |
|---|---|---:|---|
| `id` | `INTEGER` | Нет | Идентификатор региона PFDO. |
| `name` | `TEXT` | Нет | Название региона. |
| `url` | `TEXT` | Да | URL регионального портала. |
| `external` | `BOOLEAN` | Да | Признак внешнего портала/перехода. |
| `raw_payload` | `JSONB` | Нет | Исходный объект региона из API. |
| `imported_at` | `TIMESTAMPTZ` | Нет | Время импорта записи. |

### `pfdo_operator_info`

Хранит сырой объект с информацией о региональном операторе.

Ключи: PK `operator_id`.

| Атрибут | Тип | NULL | Значение |
|---|---|---:|---|
| `operator_id` | `INTEGER` | Нет | Идентификатор оператора PFDO. |
| `raw_payload` | `JSONB` | Нет | Исходный ответ `/main-page/operator-info/{operator_id}`. |
| `imported_at` | `TIMESTAMPTZ` | Нет | Время импорта записи. |

### `pfdo_main_municipalities`

Муниципалитеты регионального оператора, расширенные HTML-описанием и полезными контактами.

Ключи: PK `id`. Используется как FK для `pfdo_programs.municipality_id`.

| Атрибут | Тип | NULL | Значение |
|---|---|---:|---|
| `id` | `INTEGER` | Нет | Идентификатор муниципалитета PFDO. |
| `operator_id` | `INTEGER` | Нет | Идентификатор оператора PFDO. |
| `name` | `TEXT` | Нет | Название муниципалитета. |
| `raw_payload` | `JSONB` | Нет | Исходный объект муниципалитета. |
| `imported_at` | `TIMESTAMPTZ` | Нет | Время импорта записи. |
| `info_html` | `TEXT` | Да | HTML-описание муниципалитета из PFDO. |
| `useful_contacts` | `JSONB` | Нет | Массив полезных контактов муниципалитета. |
| `useful_contacts_count` | `INTEGER` | Нет | Количество полезных контактов. |

### `pfdo_programs`

Основная таблица карточек образовательных программ. Хранит нормализованные поля, ссылки на справочники и очищенные JSON-снимки поисковой и детальной карточек.

Ключи: PK `id`. FK: `kind -> pfdo_program_kinds.id`, `direction_id -> pfdo_program_directions.id`, `edu_form -> pfdo_program_education_forms.id`, `need_medical_certificate -> pfdo_program_medical_certificate_requirements.id`, `directory_level_id -> pfdo_program_levels.id`, `directory_program_document_id -> pfdo_program_document_types.id`, `municipality_id -> pfdo_main_municipalities.id`, `organization_id -> pfdo_organizations.id`.

| Атрибут | Тип | NULL | Значение |
|---|---|---:|---|
| `id` | `BIGINT` | Нет | Идентификатор программы PFDO. |
| `operator_id` | `INTEGER` | Нет | Идентификатор регионального оператора. |
| `municipality_id` | `INTEGER` | Да | Муниципалитет программы, FK на `pfdo_main_municipalities(id)`. |
| `search_name` | `TEXT` | Да | Название из поисковой карточки. |
| `full_name` | `TEXT` | Да | Полное название из детальной карточки. |
| `short_name` | `TEXT` | Да | Краткое название из детальной карточки. |
| `kind` | `INTEGER` | Да | Вид программы, FK на `pfdo_program_kinds(id)`. |
| `direction_id` | `INTEGER` | Да | Направленность, FK на `pfdo_program_directions(id)`. |
| `edu_form` | `INTEGER` | Да | Форма обучения, FK на `pfdo_program_education_forms(id)`. |
| `duration_year` | `INTEGER` | Да | Длительность в годах. |
| `duration_month` | `INTEGER` | Да | Дополнительная длительность в месяцах. |
| `age_group_min` | `INTEGER` | Да | Минимальный возраст обучающегося в месяцах. |
| `age_group_max` | `INTEGER` | Да | Максимальный возраст обучающегося в месяцах. |
| `need_medical_certificate` | `INTEGER` | Да | Требование медицинской справки, FK на справочник требований. |
| `modules_count` | `INTEGER` | Да | Количество модулей по данным PFDO. |
| `directory_level_id` | `INTEGER` | Да | Уровень сложности, FK на `pfdo_program_levels(id)`. |
| `directory_program_document_id` | `INTEGER` | Да | Документ по итогам обучения, FK на `pfdo_program_document_types(id)`. |
| `video_link` | `TEXT` | Да | Ссылка на видео о программе. |
| `annotation_html` | `TEXT` | Да | HTML-аннотация программы. |
| `task_html` | `TEXT` | Да | HTML-цели и задачи программы. |
| `duration_string` | `TEXT` | Да | Текстовая длительность из поисковой выдачи. |
| `organization_name` | `TEXT` | Да | Денормализованное название организации для отображения/совместимости. |
| `address_name` | `TEXT` | Да | Денормализованный адрес из поисковой карточки. |
| `all_region` | `INTEGER` | Да | Флаг охвата всего региона. |
| `enrollment` | `INTEGER` | Да | Статус доступности записи в PFDO. |
| `source_url` | `TEXT` | Да | Публичная ссылка на карточку программы. |
| `search_payload` | `JSONB` | Да | Очищенный объект из поисковой выдачи PFDO. |
| `detail_payload` | `JSONB` | Нет | Очищенный объект детальной карточки PFDO. |
| `imported_at` | `TIMESTAMPTZ` | Нет | Время импорта/обновления программы. |
| `program_document_url` | `TEXT` | Да | URL документа образовательной программы. |
| `program_document_local_path` | `TEXT` | Да | Локальный путь к скачанному документу. |
| `program_document_file_url` | `TEXT` | Да | Прямая ссылка на файл документа. |
| `program_document_content_type` | `TEXT` | Да | MIME-тип документа. |
| `program_document_file_size` | `BIGINT` | Да | Размер файла документа в байтах. |
| `program_document_downloaded_at` | `TIMESTAMPTZ` | Да | Время успешного скачивания документа. |
| `program_document_download_error` | `TEXT` | Да | Ошибка скачивания документа. |
| `organization_id` | `BIGINT` | Да | Организация из детальной карточки, FK на `pfdo_organizations(id)`. |

### `pfdo_program_directions`

Справочник направленностей программ.

Ключи: PK `id`. Используется как FK для `pfdo_programs.direction_id`.

| Атрибут | Тип | NULL | Значение |
|---|---|---:|---|
| `id` | `INTEGER` | Нет | Идентификатор направленности PFDO. |
| `name` | `TEXT` | Нет | Название направленности. |
| `icon` | `TEXT` | Да | Иконка/код иконки из PFDO. |
| `imported_at` | `TIMESTAMPTZ` | Нет | Время импорта записи. |

### `pfdo_program_kinds`

Справочник видов образовательных программ.

Ключи: PK `id`. Используется как FK для `pfdo_programs.kind`.

| Атрибут | Тип | NULL | Значение |
|---|---|---:|---|
| `id` | `INTEGER` | Нет | Код вида программы. |
| `name` | `TEXT` | Нет | Название вида программы. |

### `pfdo_program_education_forms`

Справочник форм обучения.

Ключи: PK `id`. Используется как FK для `pfdo_programs.edu_form`.

| Атрибут | Тип | NULL | Значение |
|---|---|---:|---|
| `id` | `INTEGER` | Нет | Код формы обучения. |
| `name` | `TEXT` | Нет | Название формы обучения. |

### `pfdo_program_medical_certificate_requirements`

Справочник требования медицинской справки.

Ключи: PK `id`. Используется как FK для `pfdo_programs.need_medical_certificate`.

| Атрибут | Тип | NULL | Значение |
|---|---|---:|---|
| `id` | `INTEGER` | Нет | Код требования: `0` или `1`. |
| `name` | `TEXT` | Нет | Текстовое значение требования. |

### `pfdo_program_levels`

Справочник уровней сложности программы.

Ключи: PK `id`. Используется как FK для `pfdo_programs.directory_level_id`.

| Атрибут | Тип | NULL | Значение |
|---|---|---:|---|
| `id` | `INTEGER` | Нет | Код уровня сложности. |
| `name` | `TEXT` | Нет | Название уровня сложности. |
| `description` | `TEXT` | Нет | Описание уровня сложности. |

### `pfdo_program_document_types`

Справочник документов, выдаваемых по итогам освоения программы.

Ключи: PK `id`. Используется как FK для `pfdo_programs.directory_program_document_id`.

| Атрибут | Тип | NULL | Значение |
|---|---|---:|---|
| `id` | `INTEGER` | Нет | Код вида документа. |
| `name` | `TEXT` | Нет | Название вида документа. |

### `pfdo_organizational_forms`

Справочник организационных форм организаций.

Ключи: PK `id`. Используется как FK для `pfdo_organizations.organizational_form`.

| Атрибут | Тип | NULL | Значение |
|---|---|---:|---|
| `id` | `INTEGER` | Нет | Код организационной формы. |
| `name` | `TEXT` | Нет | Краткое название формы. |
| `description` | `TEXT` | Нет | Описание формы и примеры. |

### `pfdo_organizations`

Организации из детальных карточек программ.

Ключи: PK `id`. FK: `organizational_form -> pfdo_organizational_forms.id`. Используется как FK для `pfdo_programs.organization_id`.

| Атрибут | Тип | NULL | Значение |
|---|---|---:|---|
| `id` | `BIGINT` | Нет | Идентификатор организации PFDO. |
| `name` | `TEXT` | Нет | Название организации. |
| `phone` | `TEXT` | Да | Телефон организации. |
| `organizational_form` | `INTEGER` | Да | Организационная форма, FK на `pfdo_organizational_forms(id)`. |
| `level_id` | `INTEGER` | Да | Уровень/тип организации по данным PFDO. |
| `raw_payload` | `JSONB` | Нет | Исходный объект организации. |
| `imported_at` | `TIMESTAMPTZ` | Нет | Время импорта записи. |

### `pfdo_addresses`

Адреса площадок, групп и организаций.

Ключи: PK `id`.

| Атрибут | Тип | NULL | Значение |
|---|---|---:|---|
| `id` | `BIGINT` | Нет | Идентификатор адреса PFDO. |
| `name` | `TEXT` | Нет | Текст адреса. |
| `lat` | `TEXT` | Да | Широта из PFDO. |
| `lng` | `TEXT` | Да | Долгота из PFDO. |
| `raw_payload` | `JSONB` | Нет | Исходный объект адреса. |
| `imported_at` | `TIMESTAMPTZ` | Нет | Время импорта записи. |

### `pfdo_program_modules`

Модули образовательных программ.

Ключи: PK `id`. Логическая связь: `program_id -> pfdo_programs.id`.

| Атрибут | Тип | NULL | Значение |
|---|---|---:|---|
| `id` | `BIGINT` | Нет | Идентификатор модуля PFDO. |
| `program_id` | `BIGINT` | Нет | Идентификатор программы. |
| `name` | `TEXT` | Нет | Название модуля. |
| `month` | `INTEGER` | Да | Месяц/порядковый месяц модуля по данным PFDO. |
| `hours_group` | `TEXT` | Да | Часы группы. |
| `hours_group_dop` | `TEXT` | Да | Дополнительные часы группы. |
| `min_child_group` | `INTEGER` | Да | Минимальное количество детей в группе. |
| `max_child_group` | `INTEGER` | Да | Максимальное количество детей в группе. |
| `teacher_level_id` | `INTEGER` | Да | Код уровня педагога. |
| `teacher_category_id` | `INTEGER` | Да | Код категории педагога. |
| `teacher_skill_level_id` | `INTEGER` | Да | Код квалификационного уровня педагога. |
| `normative_price` | `TEXT` | Да | Нормативная цена модуля. |
| `price` | `TEXT` | Да | Цена модуля. |
| `results_html` | `TEXT` | Да | HTML-описание результатов модуля. |
| `raw_payload` | `JSONB` | Нет | Исходный объект модуля. |
| `imported_at` | `TIMESTAMPTZ` | Нет | Время импорта записи. |

### `pfdo_program_registry_entries`

Реестровые признаки программы: сертифицированная, бюджетная, платная и другие статусы из PFDO.

Ключи: PK (`program_id`, `registry_value`). Логическая связь: `program_id -> pfdo_programs.id`.

| Атрибут | Тип | NULL | Значение |
|---|---|---:|---|
| `program_id` | `BIGINT` | Нет | Идентификатор программы. |
| `registry_value` | `INTEGER` | Нет | Код реестрового признака. |
| `name` | `TEXT` | Да | Название признака. |
| `status` | `INTEGER` | Да | Статус признака. |
| `tooltip` | `TEXT` | Да | Подсказка признака. |
| `button_name` | `TEXT` | Да | Текст кнопки, связанной с признаком. |
| `button_active` | `INTEGER` | Да | Активность кнопки. |
| `button_tooltip` | `TEXT` | Да | Подсказка кнопки. |
| `reasons` | `JSONB` | Да | Причины/пояснения статуса. |
| `raw_payload` | `JSONB` | Нет | Исходный объект признака. |
| `imported_at` | `TIMESTAMPTZ` | Нет | Время импорта записи. |

### `pfdo_program_groups`

Группы/наборы внутри программ.

Ключи: PK `id`. FK: `program_id -> pfdo_programs.id`.

| Атрибут | Тип | NULL | Значение |
|---|---|---:|---|
| `id` | `BIGINT` | Нет | Идентификатор группы PFDO. |
| `program_id` | `BIGINT` | Нет | Идентификатор программы, FK на `pfdo_programs(id)`. |
| `organization_id` | `BIGINT` | Да | Организация группы по данным PFDO. |
| `module_id` | `BIGINT` | Да | Модуль, к которому относится группа. |
| `name` | `TEXT` | Нет | Название группы. |
| `start_date` | `TEXT` | Да | Дата начала группы в исходном формате PFDO. |
| `end_date` | `TEXT` | Да | Дата окончания группы в исходном формате PFDO. |
| `status` | `INTEGER` | Да | Статус группы/набора. |
| `free_places_counter` | `INTEGER` | Да | Количество свободных мест. |
| `typical_lesson_duration_minutes` | `INTEGER` | Да | Типовая длительность занятия в минутах. |
| `module_name` | `TEXT` | Да | Название модуля, продублированное в группе. |
| `recommended_min_age_for_enrollment` | `INTEGER` | Да | Рекомендуемый минимальный возраст для записи. |
| `recommended_max_age_for_enrollment` | `INTEGER` | Да | Рекомендуемый максимальный возраст для записи. |
| `extra_places` | `INTEGER` | Да | Дополнительные места. |
| `period_price` | `TEXT` | Да | Цена периода обучения. |
| `main_pedagogue_id` | `BIGINT` | Да | Основной педагог группы. |
| `raw_payload` | `JSONB` | Нет | Исходный объект группы. |
| `imported_at` | `TIMESTAMPTZ` | Нет | Время импорта записи. |

### `pfdo_group_addresses`

Адреса, привязанные к группам.

Ключи: PK (`group_id`, `address_id`, `office_id`). Логическая связь: `group_id -> pfdo_program_groups.id`, `address_id -> pfdo_addresses.id`.

| Атрибут | Тип | NULL | Значение |
|---|---|---:|---|
| `group_id` | `BIGINT` | Нет | Идентификатор группы. |
| `address_id` | `BIGINT` | Нет | Идентификатор адреса. |
| `office_id` | `BIGINT` | Нет | Идентификатор кабинета/офиса. |
| `office_name` | `TEXT` | Да | Название кабинета/офиса. |

### `pfdo_program_group_periods`

Периоды обучения внутри групп программы.

Ключи: PK (`group_id`, `period_hash`). FK: `group_id -> pfdo_program_groups.id`.

| Атрибут | Тип | NULL | Значение |
|---|---|---:|---|
| `group_id` | `BIGINT` | Нет | Идентификатор группы, FK на `pfdo_program_groups(id)`. |
| `period_hash` | `BIGINT` | Нет | Хеш/идентификатор периода из PFDO. |
| `start_date` | `TEXT` | Да | Дата начала периода в исходном формате PFDO. |
| `end_date` | `TEXT` | Да | Дата окончания периода в исходном формате PFDO. |
| `raw_payload` | `JSONB` | Нет | Исходный объект периода. |
| `imported_at` | `TIMESTAMPTZ` | Нет | Время импорта записи. |

### `pfdo_group_schedule_entries`

Расписание занятий групп. Запись относится к группе и периоду через `group_id` и `period_hash`.

Ключи: PK `id`. Логическая связь: (`group_id`, `period_hash`) -> `pfdo_program_group_periods`.

| Атрибут | Тип | NULL | Значение |
|---|---|---:|---|
| `id` | `BIGINT` | Нет | Идентификатор записи расписания PFDO. |
| `group_id` | `BIGINT` | Нет | Идентификатор группы. |
| `period_hash` | `BIGINT` | Нет | Идентификатор периода группы. |
| `week_day` | `TEXT` | Да | День недели. |
| `start_time` | `TEXT` | Да | Время начала занятия. |
| `end_time` | `TEXT` | Да | Время окончания занятия. |
| `office_id` | `BIGINT` | Да | Идентификатор кабинета/офиса. |
| `office_name` | `TEXT` | Да | Название кабинета/офиса. |
| `office_address` | `TEXT` | Да | Адрес кабинета/площадки. |
| `hours_count` | `TEXT` | Да | Количество часов занятия. |
| `week_policy` | `INTEGER` | Да | Правило недельности расписания. |
| `is_odd` | `INTEGER` | Да | Признак нечетной недели. |
| `week_number` | `INTEGER` | Да | Номер недели. |
| `group_type` | `INTEGER` | Да | Тип группы/занятия по данным PFDO. |
| `subject` | `TEXT` | Да | Предмет/тема занятия. |
| `raw_payload` | `JSONB` | Нет | Исходный объект расписания. |
| `imported_at` | `TIMESTAMPTZ` | Нет | Время импорта записи. |

### `pfdo_pedagogues`

Педагоги, извлеченные из групп и расписания.

Ключи: PK `id`.

| Атрибут | Тип | NULL | Значение |
|---|---|---:|---|
| `id` | `BIGINT` | Нет | Идентификатор педагога PFDO. |
| `first_name` | `TEXT` | Да | Имя педагога. |
| `last_name` | `TEXT` | Да | Фамилия педагога. |
| `middle_name` | `TEXT` | Да | Отчество педагога. |
| `raw_payload` | `JSONB` | Нет | Исходный объект педагога. |
| `imported_at` | `TIMESTAMPTZ` | Нет | Время импорта записи. |

### `pfdo_schedule_entry_pedagogues`

Связь многие-ко-многим между записями расписания и педагогами.

Ключи: PK (`schedule_entry_id`, `pedagogue_id`). Логическая связь: `schedule_entry_id -> pfdo_group_schedule_entries.id`, `pedagogue_id -> pfdo_pedagogues.id`.

| Атрибут | Тип | NULL | Значение |
|---|---|---:|---|
| `schedule_entry_id` | `BIGINT` | Нет | Идентификатор записи расписания. |
| `pedagogue_id` | `BIGINT` | Нет | Идентификатор педагога. |

### `pfdo_program_keywords`

Справочник ключевых слов/тегов PFDO.

Ключи: PK `id`. Используется как FK для `pfdo_program_keyword_links.keyword_id`.

| Атрибут | Тип | NULL | Значение |
|---|---|---:|---|
| `id` | `INTEGER` | Нет | Идентификатор ключевого слова PFDO. |
| `name` | `TEXT` | Нет | Название ключевого слова. |
| `raw_payload` | `JSONB` | Нет | Исходный объект ключевого слова. |
| `imported_at` | `TIMESTAMPTZ` | Нет | Время импорта записи. |

### `pfdo_program_keyword_links`

Связь программ с ключевыми словами.

Ключи: PK (`program_id`, `keyword_id`). FK: `program_id -> pfdo_programs.id`, `keyword_id -> pfdo_program_keywords.id`.

| Атрибут | Тип | NULL | Значение |
|---|---|---:|---|
| `program_id` | `BIGINT` | Нет | Идентификатор программы. |
| `keyword_id` | `INTEGER` | Нет | Идентификатор ключевого слова. |

### `pfdo_program_activity_links`

Связь программ с числовыми идентификаторами видов деятельности из PFDO.

Ключи: PK (`program_id`, `activity_id`). Логическая связь: `program_id -> pfdo_programs.id`.

| Атрибут | Тип | NULL | Значение |
|---|---|---:|---|
| `program_id` | `BIGINT` | Нет | Идентификатор программы. |
| `activity_id` | `INTEGER` | Нет | Идентификатор вида деятельности PFDO. |

### `pfdo_program_activities`

Текстовые виды деятельности из детальной карточки программы.

Ключи: PK (`program_id`, `activity_name`). Логическая связь: `program_id -> pfdo_programs.id`.

| Атрибут | Тип | NULL | Значение |
|---|---|---:|---|
| `program_id` | `BIGINT` | Нет | Идентификатор программы. |
| `activity_name` | `TEXT` | Нет | Название вида деятельности. |

### `pfdo_program_project_links`

Связь программ с проектами PFDO.

Ключи: PK (`program_id`, `project_id`). Логическая связь: `program_id -> pfdo_programs.id`.

| Атрибут | Тип | NULL | Значение |
|---|---|---:|---|
| `program_id` | `BIGINT` | Нет | Идентификатор программы. |
| `project_id` | `INTEGER` | Нет | Идентификатор проекта PFDO. |

### `pfdo_program_calendar_topics`

Темы календарно-тематического плана, извлеченные из документов программ.

Ключи: PK `id`. Логическая связь: `program_id -> pfdo_programs.id`.

| Атрибут | Тип | NULL | Значение |
|---|---|---:|---|
| `id` | `BIGSERIAL` | Нет | Внутренний идентификатор темы. |
| `program_id` | `BIGINT` | Нет | Идентификатор программы. |
| `topic_order` | `INTEGER` | Нет | Порядок темы в документе. |
| `section_title` | `TEXT` | Да | Название раздела календарного плана. |
| `topic_name` | `TEXT` | Нет | Название темы. |
| `hours_theory` | `NUMERIC` | Да | Теоретические часы. |
| `hours_practice` | `NUMERIC` | Да | Практические часы. |
| `hours_total` | `NUMERIC` | Да | Всего часов. |
| `activity_type` | `TEXT` | Да | Тип занятия/активности. |
| `control_form` | `TEXT` | Да | Форма контроля. |
| `source_section` | `TEXT` | Да | Раздел исходного документа. |
| `source_excerpt` | `TEXT` | Да | Фрагмент исходного текста. |
| `document_path` | `TEXT` | Да | Путь к документу-источнику. |
| `document_format` | `TEXT` | Да | Формат документа. |
| `extraction_method` | `TEXT` | Да | Метод извлечения темы. |
| `confidence` | `NUMERIC` | Да | Уверенность извлечения. |
| `raw_payload` | `JSONB` | Нет | Сырой объект результата извлечения. |
| `imported_at` | `TIMESTAMPTZ` | Нет | Время импорта записи. |

### `pfdo_program_topic_normalizations`

Нормализованные представления тем календарного плана.

Ключи: PK `id`, UNIQUE `topic_id`.

| Атрибут | Тип | NULL | Значение |
|---|---|---:|---|
| `id` | `BIGSERIAL` | Нет | Внутренний идентификатор нормализации. |
| `topic_id` | `BIGINT` | Нет | Идентификатор исходной темы из `pfdo_program_calendar_topics`. |
| `program_id` | `BIGINT` | Нет | Идентификатор программы. |
| `raw_topic_name` | `TEXT` | Нет | Исходное название темы. |
| `normalized_topic_name` | `TEXT` | Да | Нормализованное название темы. |
| `normalized_topic_key` | `TEXT` | Да | Ключ нормализованной темы для группировки. |
| `activity_type_normalized` | `TEXT` | Да | Нормализованный тип активности. |
| `record_type` | `TEXT` | Нет | Тип записи после нормализации. |
| `noise_reason` | `TEXT` | Да | Причина отнесения темы к шуму. |
| `normalization_method` | `TEXT` | Нет | Метод нормализации. |
| `normalization_version` | `TEXT` | Нет | Версия нормализации. |
| `normalization_confidence` | `NUMERIC` | Да | Уверенность нормализации. |
| `raw_payload` | `JSONB` | Нет | Сырой объект нормализации. |
| `created_at` | `TIMESTAMPTZ` | Нет | Время создания записи. |

### `pfdo_program_topic_aggregates`

Агрегаты нормализованных тем по программе, ключу темы и типу записи.

Ключи: PK `id`, UNIQUE (`program_id`, `normalized_topic_key`, `record_type`).

| Атрибут | Тип | NULL | Значение |
|---|---|---:|---|
| `id` | `BIGSERIAL` | Нет | Внутренний идентификатор агрегата. |
| `program_id` | `BIGINT` | Нет | Идентификатор программы. |
| `normalized_topic_name` | `TEXT` | Нет | Нормализованное название темы. |
| `normalized_topic_key` | `TEXT` | Нет | Ключ нормализованной темы. |
| `record_type` | `TEXT` | Нет | Тип записи. |
| `topic_rows` | `INTEGER` | Нет | Количество исходных строк тем в агрегате. |
| `source_topic_ids` | `BIGINT[]` | Нет | Массив исходных `topic_id`. |
| `raw_topic_examples` | `JSONB` | Нет | Примеры исходных тем. |
| `activity_types` | `JSONB` | Нет | Типы активностей, вошедшие в агрегат. |
| `hours_theory` | `NUMERIC` | Да | Сумма теоретических часов. |
| `hours_practice` | `NUMERIC` | Да | Сумма практических часов. |
| `hours_control` | `NUMERIC` | Да | Сумма часов контроля. |
| `hours_total` | `NUMERIC` | Да | Общая сумма часов. |
| `first_topic_order` | `INTEGER` | Да | Порядок первой исходной темы. |
| `aggregation_method` | `TEXT` | Нет | Метод агрегации. |
| `aggregation_version` | `TEXT` | Нет | Версия агрегации. |
| `created_at` | `TIMESTAMPTZ` | Нет | Время создания агрегата. |

### `pfdo_program_topic_classifications`

Классификации агрегированных тем.

Ключи: PK `id`, UNIQUE `aggregate_id`.

| Атрибут | Тип | NULL | Значение |
|---|---|---:|---|
| `id` | `BIGSERIAL` | Нет | Внутренний идентификатор классификации. |
| `aggregate_id` | `BIGINT` | Нет | Идентификатор агрегата темы. |
| `program_id` | `BIGINT` | Нет | Идентификатор программы. |
| `record_type` | `TEXT` | Нет | Тип записи. |
| `parent_code` | `TEXT` | Да | Код родительской категории. |
| `parent_name` | `TEXT` | Да | Название родительской категории. |
| `category_code` | `TEXT` | Нет | Код предсказанной категории. |
| `category_name` | `TEXT` | Нет | Название предсказанной категории. |
| `confidence` | `NUMERIC` | Нет | Уверенность классификации. |
| `top_categories` | `JSONB` | Нет | Список лучших категорий-кандидатов. |
| `matched_rules` | `JSONB` | Нет | Сработавшие правила классификатора. |
| `input_text` | `TEXT` | Нет | Текст, поданный в классификатор. |
| `classifier_method` | `TEXT` | Нет | Метод классификации. |
| `classifier_version` | `TEXT` | Нет | Версия классификатора. |
| `review_status` | `TEXT` | Нет | Статус проверки классификации. |
| `created_at` | `TIMESTAMPTZ` | Нет | Время создания записи. |

### `pfdo_program_topic_review_queue`

Очередь ручной проверки спорных или низкоуверенных классификаций тем.

Ключи: PK `id`, UNIQUE `classification_id`.

| Атрибут | Тип | NULL | Значение |
|---|---|---:|---|
| `id` | `BIGSERIAL` | Нет | Внутренний идентификатор записи очереди. |
| `classification_id` | `BIGINT` | Нет | Идентификатор классификации. |
| `aggregate_id` | `BIGINT` | Нет | Идентификатор агрегата темы. |
| `program_id` | `BIGINT` | Нет | Идентификатор программы. |
| `raw_topic_examples` | `JSONB` | Нет | Примеры исходных тем для проверки. |
| `normalized_topic_name` | `TEXT` | Нет | Нормализованное название темы. |
| `predicted_record_type` | `TEXT` | Нет | Предсказанный тип записи. |
| `predicted_category_code` | `TEXT` | Нет | Предсказанный код категории. |
| `predicted_category_name` | `TEXT` | Нет | Предсказанное название категории. |
| `confidence` | `NUMERIC` | Нет | Уверенность предсказания. |
| `reason` | `TEXT` | Нет | Причина попадания в очередь проверки. |
| `review_status` | `TEXT` | Нет | Статус ручной проверки. |
| `manual_record_type` | `TEXT` | Да | Тип записи, заданный вручную. |
| `manual_category_code` | `TEXT` | Да | Код категории, заданный вручную. |
| `manual_category_name` | `TEXT` | Да | Название категории, заданное вручную. |
| `reviewed_by` | `TEXT` | Да | Кто выполнил проверку. |
| `reviewed_at` | `TIMESTAMPTZ` | Да | Когда выполнена проверка. |
| `created_at` | `TIMESTAMPTZ` | Нет | Время создания записи очереди. |
| `reviewer_note` | `TEXT` | Да | Комментарий проверяющего. |

### `pfdo_topic_classifier_golden_labels`

Эталонные метки для проверки и настройки классификатора тем.

Ключи: PK `id`.

| Атрибут | Тип | NULL | Значение |
|---|---|---:|---|
| `id` | `BIGSERIAL` | Нет | Внутренний идентификатор эталонной метки. |
| `normalized_topic_name` | `TEXT` | Нет | Нормализованная тема. |
| `context_text` | `TEXT` | Да | Контекст темы. |
| `record_type` | `TEXT` | Нет | Эталонный тип записи. |
| `category_code` | `TEXT` | Нет | Эталонный код категории. |
| `category_name` | `TEXT` | Да | Эталонное название категории. |
| `source` | `TEXT` | Нет | Источник метки, по умолчанию `manual`. |
| `notes` | `TEXT` | Да | Примечания к метке. |
| `created_at` | `TIMESTAMPTZ` | Нет | Время создания записи. |

### `pfdo_raw_documents`

Сырые ответы PFDO API, сохраненные для трассировки импорта и восстановления данных.

Ключи: PK `document_key`.

| Атрибут | Тип | NULL | Значение |
|---|---|---:|---|
| `document_key` | `TEXT` | Нет | Уникальный ключ сохраненного ответа. |
| `endpoint` | `TEXT` | Нет | Endpoint PFDO API. |
| `payload` | `JSONB` | Нет | Сырой ответ API. |
| `imported_at` | `TIMESTAMPTZ` | Нет | Время сохранения ответа. |

