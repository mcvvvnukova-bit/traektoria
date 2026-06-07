const test = require("node:test");
const assert = require("node:assert/strict");

const {
  extractCalendarTopicsFromText,
} = require("../services/program-topic-extractor/src/parsers/calendar-topics");

test("uses blank cells from structured doc tables for theory/practice hours", () => {
  const text = `
STRUCTURED_DOCX_TABLE_BEGIN 1
TABLE_ROW || № п/п || Содержание программы || Количество часов
TABLE_ROW || Теория || Практика || Всего
TABLE_ROW ||  || Раздел 1. Введение. || 2 || 2 || 4
TABLE_ROW || 1. || Типы и виды музеев. || 1 ||  || 1
TABLE_ROW || 2. || О чем рассказывает наш школьный музей. ||  || 2 || 2
TABLE_ROW || 3. || Знакомство с теоретическими понятиями. || 1 || 1 || 2
STRUCTURED_DOCX_TABLE_END
`;

  const { topics } = extractCalendarTopicsFromText({
    text,
    documentPath: "/tmp/structured.doc",
    documentFormat: "doc",
  });

  assert.deepEqual(topics.map((topic) => ({
    name: topic.topic_name,
    theory: topic.hours_theory,
    practice: topic.hours_practice,
    total: topic.hours_total,
    section: topic.section_title,
  })), [
    {
      name: "Типы и виды музеев.",
      theory: 1,
      practice: 0,
      total: 1,
      section: "Введение.",
    },
    {
      name: "О чем рассказывает наш школьный музей.",
      theory: 0,
      practice: 2,
      total: 2,
      section: "Введение.",
    },
    {
      name: "Знакомство с теоретическими понятиями.",
      theory: 1,
      practice: 1,
      total: 2,
      section: "Введение.",
    },
  ]);
});

test("does not replace focused parser rows with many extra structured table rows", () => {
  const text = `
Учебно-тематический план
№
Тема занятий
Всего часов
Теория
Практика
1
Тема А
2
1
1
2
Тема Б
2
1
1
3
Тема В
2
1
1

Итого
6
3
3

STRUCTURED_DOCX_TABLE_BEGIN 1
TABLE_ROW || № п/п || Содержание программы || Количество часов
TABLE_ROW || Всего || Теория || Практика
TABLE_ROW || 1. || Тема А || 2 || 1 || 1
TABLE_ROW || 2. || Тема Б || 2 || 1 || 1
TABLE_ROW || 3. || Тема В || 2 || 1 || 1
TABLE_ROW || 4. || Лишняя календарная строка 1 || 2 || 1 || 1
TABLE_ROW || 5. || Лишняя календарная строка 2 || 2 || 1 || 1
TABLE_ROW || 6. || Лишняя календарная строка 3 || 2 || 1 || 1
TABLE_ROW || 7. || Лишняя календарная строка 4 || 2 || 1 || 1
TABLE_ROW || 8. || Лишняя календарная строка 5 || 2 || 1 || 1
TABLE_ROW || 9. || Лишняя календарная строка 6 || 2 || 1 || 1
STRUCTURED_DOCX_TABLE_END
`;

  const { topics } = extractCalendarTopicsFromText({
    text,
    documentPath: "/tmp/too-many-structured.doc",
    documentFormat: "doc",
  });

  assert.deepEqual(topics.map((topic) => topic.topic_name), ["Тема А", "Тема Б", "Тема В"]);
  assert.equal(topics.every((topic) => topic.source_section === "cell-wise-study-plan"), true);
});

test("parses title-first cell-wise study plan rows like 818033", () => {
  const text = `
Учебный план
Название раздела, темы
Количество часов
Всего
Теория
Практика
Ознакомление с планом работы объединения. Техника безопасности при выполнении работ. Основные понятия курса обучения
3
1
2
1.1
Первый поход: выбор места похода, составление маршрутного листа, направление его в МКК на согласование
3
0
3
2.1
Итоговое занятие: подведение итогов
3
1
2
5.1
Итого
9
2
7
`;

  const { topics } = extractCalendarTopicsFromText({
    text,
    documentPath: "/tmp/818033.docx",
    documentFormat: "docx",
  });

  assert.deepEqual(topics.map((topic) => ({
    name: topic.topic_name,
    theory: topic.hours_theory,
    practice: topic.hours_practice,
    total: topic.hours_total,
    section: topic.source_section,
  })), [
    {
      name: "Ознакомление с планом работы объединения. Техника безопасности при выполнении работ. Основные понятия курса обучения",
      theory: 1,
      practice: 2,
      total: 3,
      section: "title-first-cell-wise-study-plan",
    },
    {
      name: "Первый поход: выбор места похода, составление маршрутного листа, направление его в МКК на согласование",
      theory: 0,
      practice: 3,
      total: 3,
      section: "title-first-cell-wise-study-plan",
    },
    {
      name: "Итоговое занятие: подведение итогов",
      theory: 1,
      practice: 2,
      total: 3,
      section: "title-first-cell-wise-study-plan",
    },
  ]);
});

test("joins multiline title-first study plan topic before hour cells", () => {
  const text = `
Учебный план
№
Название раздела, темы
Количество часов
Всего
Теория
Практика
1
Общие сведения


1.1
Ознакомление с планом работы объединения. Техника безопасности при выполнении работ. Основные понятия курса обучения
2
1
1
Тестирование
4.3
Второй поход: лесополоса на левом берегу реки Нива (ущелье «Разочарований»).
Цель: наблюдение за сезонными изменениями в природе
8
1
7
Практическое задание
5.1
Итоговое занятие: подведение итогов
2
0
2
Практическое задание
Итого:
12
2
10
`;

  const { topics } = extractCalendarTopicsFromText({
    text,
    documentPath: "/tmp/1161277.docx",
    documentFormat: "docx",
  });

  assert.deepEqual(topics.map((topic) => ({
    name: topic.topic_name,
    theory: topic.hours_theory,
    practice: topic.hours_practice,
    total: topic.hours_total,
    section: topic.source_section,
  })), [
    {
      name: "Ознакомление с планом работы объединения. Техника безопасности при выполнении работ. Основные понятия курса обучения",
      theory: 1,
      practice: 1,
      total: 2,
      section: "title-first-cell-wise-study-plan",
    },
    {
      name: "Второй поход: лесополоса на левом берегу реки Нива (ущелье \"Разочарований\"). Цель: наблюдение за сезонными изменениями в природе",
      theory: 1,
      practice: 7,
      total: 8,
      section: "title-first-cell-wise-study-plan",
    },
    {
      name: "Итоговое занятие: подведение итогов",
      theory: 0,
      practice: 2,
      total: 2,
      section: "title-first-cell-wise-study-plan",
    },
  ]);
});

test("keeps numbered assessment row in cell-wise study plan", () => {
  const text = `
Учебно-тематический план носит примерный характер и может корректироваться по усмотрению педагога.
№
Название темы
Количество часов
теория
практика
всего
1.
Вводное занятие. Что такое туризм.
2
-
2
2.
Основы туристской подготовки (пешеходный туризм)
30
10
40
7.
Промежуточная аттестация
2
2
4
Итого:
34
12
46
`;

  const { topics } = extractCalendarTopicsFromText({
    text,
    documentPath: "/tmp/1177953.docx",
    documentFormat: "docx",
  });

  assert.deepEqual(topics.map((topic) => ({
    name: topic.topic_name,
    theory: topic.hours_theory,
    practice: topic.hours_practice,
    total: topic.hours_total,
    section: topic.source_section,
  })), [
    {
      name: "Вводное занятие. Что такое туризм.",
      theory: 2,
      practice: 0,
      total: 2,
      section: "cell-wise-study-plan",
    },
    {
      name: "Основы туристской подготовки (пешеходный туризм)",
      theory: 30,
      practice: 10,
      total: 40,
      section: "cell-wise-study-plan",
    },
    {
      name: "Промежуточная аттестация",
      theory: 2,
      practice: 2,
      total: 4,
      section: "cell-wise-study-plan",
    },
  ]);
});

test("keeps numbered equipment topic inside structured study plan", () => {
  const text = `
Учебно-тематический план
STRUCTURED_DOCX_TABLE_BEGIN 5
TABLE_ROW || № || Название темы || Количество часов
TABLE_ROW ||  ||  || Всего || Теория || Практика
TABLE_ROW || 1.1 || Туристские путешествия, история развития туризма || 1 || 1 || -
TABLE_ROW || 1.2 || Воспитательная роль туризма || 1 || 1 || -
TABLE_ROW || 1.3 || Личное и групповое туристское снаряжение || 3 || 1 || 2
STRUCTURED_DOCX_TABLE_END
`;

  const { topics } = extractCalendarTopicsFromText({
    text,
    documentPath: "/tmp/1202022.docx",
    documentFormat: "docx",
  });

  assert.deepEqual(topics.map((topic) => ({
    name: topic.topic_name,
    theory: topic.hours_theory,
    practice: topic.hours_practice,
    total: topic.hours_total,
    section: topic.source_section,
  })), [
    {
      name: "Туристские путешествия, история развития туризма",
      theory: 1,
      practice: 0,
      total: 1,
      section: "Учебно-тематический план",
    },
    {
      name: "Воспитательная роль туризма",
      theory: 1,
      practice: 0,
      total: 1,
      section: "Учебно-тематический план",
    },
    {
      name: "Личное и групповое туристское снаряжение",
      theory: 1,
      practice: 2,
      total: 3,
      section: "Учебно-тематический план",
    },
  ]);
});

test("prefers more complete structured calendar over incomplete title-first study plan", () => {
  const text = `
Учебный план
Название раздела, темы
Количество часов
Всего
Теория
Практика
Первый поход: подготовка маршрута
2
0
2
1.1
Второй поход: подготовка маршрута
2
0
2
2.1
Итоговое занятие
2
0
2
3.1
Итого
6
0
6

Календарный учебный график
STRUCTURED_DOCX_TABLE_BEGIN 2
TABLE_ROW || № || Месяц || Число || Время проведения занятия || Форма занятия || Кол-во часов || Тема занятия || Место проведения || Форма контроля
TABLE_ROW || 1. ||  ||  ||  || Практическое занятие || 2 || Первый поход: подготовка маршрута || Учебный кабинет || Практическое задание
TABLE_ROW || 2. ||  ||  ||  || Практическое занятие || 2 || Первый поход: проверка снаряжения || Учебный кабинет || Практическое задание
TABLE_ROW || 3. ||  ||  ||  || Практическое занятие || 2 || Первый поход: выход на маршрут || Улица || Практическое задание
TABLE_ROW || 4. ||  ||  ||  || Практическое занятие || 2 || Первый поход: подготовка отчета || Учебный кабинет || Практическое задание
TABLE_ROW || 5. ||  ||  ||  || Практическое занятие || 2 || Второй поход: подготовка маршрута || Учебный кабинет || Практическое задание
TABLE_ROW || 6. ||  ||  ||  || Практическое занятие || 2 || Второй поход: проверка снаряжения || Учебный кабинет || Практическое задание
TABLE_ROW || 7. ||  ||  ||  || Практическое занятие || 2 || Второй поход: выход на маршрут || Улица || Практическое задание
TABLE_ROW || 8. ||  ||  ||  || Практическое занятие || 2 || Итоговое занятие || Учебный кабинет || Опрос
STRUCTURED_DOCX_TABLE_END
`;

  const { topics } = extractCalendarTopicsFromText({
    text,
    documentPath: "/tmp/1161277.docx",
    documentFormat: "docx",
  });

  assert.equal(topics.length, 8);
  assert.equal(topics[1].topic_name, "Первый поход: проверка снаряжения");
  assert.equal(topics[7].topic_name, "Итоговое занятие");
  assert.deepEqual(topics.map((topic) => topic.hours_total), Array(8).fill(2));
  assert.equal(topics.every((topic) => topic.source_section === "Календарный учебный график"), true);
});

test("keeps first structured study plan when later tables are alternatives", () => {
  const text = `
Учебно-тематический план (1 год обучения)
STRUCTURED_DOCX_TABLE_BEGIN 5
TABLE_ROW || № || Название темы || Количество часов
TABLE_ROW ||  ||  || Всего || Теория || Практика
TABLE_ROW || 1.1 || Туристские путешествия, история развития туризма || 1 || 1 || -
TABLE_ROW || 1.2 || Воспитательная роль туризма || 1 || 1 || -
TABLE_ROW || 1.3 || Личное и групповое туристское снаряжение || 3 || 1 || 2
TABLE_ROW || 1.4 || Организация туристского быта. Привалы и ночлеги || 4 || 1 || 3
TABLE_ROW || 1.5 || Подготовка к походу, путешествию || 5 || 1 || 4
TABLE_ROW || 1.6 || Питание в туристском походе || 2 || 1 || 1
TABLE_ROW || 1.7 || Туристские должности в группе || 1 || 1 || -
TABLE_ROW || 1.8 || Правила движения в походе || 2 || 1 || 1
TABLE_ROW ||  || ВСЕГО || 18 || 8 || 10
STRUCTURED_DOCX_TABLE_END

Учебно-тематический план (вариант)
STRUCTURED_DOCX_TABLE_BEGIN 7
TABLE_ROW || № || Название темы || Количество часов
TABLE_ROW ||  ||  || Всего || Теория || Практика
TABLE_ROW || 1.1 || Туристские путешествия, история развития туризма || 1 || 1 || -
TABLE_ROW || 1.2 || Личное и групповое туристское снаряжение || 4 || 1 || 3
TABLE_ROW || 1.3 || Организация туристского быта. Привалы и ночлеги || 5 || 1 || 4
TABLE_ROW || 1.4 || Подготовка к походу, путешествию || 3 || 1 || 2
TABLE_ROW || 1.5 || Питание в туристском походе || 3 || 1 || 2
TABLE_ROW || 1.6 || Туристские должности в группе || 2 || 1 || 1
TABLE_ROW || 1.7 || Правила движения в походе || 2 || 1 || 1
TABLE_ROW || 1.8 || Преодоление препятствий || 4 || 1 || 3
TABLE_ROW ||  || ВСЕГО || 26 || 9 || 17
STRUCTURED_DOCX_TABLE_END
`;

  const { topics } = extractCalendarTopicsFromText({
    text,
    documentPath: "/tmp/1202022.docx",
    documentFormat: "docx",
  });

  assert.equal(topics.length, 8);
  assert.equal(topics[0].topic_name, "Туристские путешествия, история развития туризма");
  assert.equal(topics[2].topic_name, "Личное и групповое туристское снаряжение");
  assert.equal(topics.some((topic) => topic.topic_name === "Преодоление препятствий"), false);
  assert.equal(topics.every((topic) => topic.raw_payload.table_number === "5"), true);
});

test("prefers full structured calendar table when plain text calendar is truncated", () => {
  const text = `
КАЛЕНДАРНО-ТЕМАТИЧЕСКИЙ ПЛАН
Календарный учебный график
№
Дата
проведения
Наименование темы
Количество часов
1
04.09.2024
Музейное дело. Вводное занятие.
1
2
11.09.2024
Музейное дело.
1
3
18.09.2024
Музей как институт социальной памяти
1
4
25.09.2024
Школьный музей.
1
ИТОГО
4

STRUCTURED_DOCX_TABLES
STRUCTURED_DOCX_TABLE_BEGIN 1
TABLE_ROW || № || Дата проведения || Наименование темы || Количество часов
TABLE_ROW || 1 || 04.09.2024 || Музейное дело. Вводное занятие. || 1
TABLE_ROW || 2 || 11.09.2024 || Музейное дело. || 1
TABLE_ROW || 3 || 18.09.2024 || Музей как институт социальной памяти || 1
TABLE_ROW || 4 || 25.09.2024 || Школьный музей. || 1
TABLE_ROW || 5 || 02.10.2024 || История родной школы. || 1
TABLE_ROW || 6 || 09.10.2024 || Наша школа в истории края || 1
TABLE_ROW || 7 || 16.10.2024 || Практикум по разработке системы документов учёта и описания музейных предметов || 1
TABLE_ROW || 8 || 23.10.2024 || Методика подготовки экскурсий. || 1
TABLE_ROW || 9 || 30.10.2024 || Правила проведения экскурсии. || 1
TABLE_ROW || 10 || 06.11.2024 || Я – экскурсовод. || 1
TABLE_ROW ||  ||  || ИТОГО || 10
STRUCTURED_DOCX_TABLE_END
`;

  const { topics } = extractCalendarTopicsFromText({
    text,
    documentPath: "/tmp/1067842.docx",
    documentFormat: "docx",
  });

  assert.equal(topics.length, 10);
  assert.equal(topics[0].topic_name, "Музейное дело. Вводное занятие.");
  assert.equal(topics[6].topic_name, "Практикум по разработке системы документов учёта и описания музейных предметов");
  assert.equal(topics[9].topic_name, "Я - экскурсовод.");
  assert.deepEqual(topics.map((topic) => topic.hours_total), Array(10).fill(1));
  assert.equal(topics.every((topic) => topic.source_section === "Календарный учебный график"), true);
});

test("prefers complete fragmented DOCX calendar over two aggregate study plans", () => {
  const text = `
Учебно-тематический план
STRUCTURED_DOCX_TABLE_BEGIN 1
TABLE_ROW || № п/п || Наименование тем || Всего часов || Теория || Практика
TABLE_ROW || 1. || Растительный мир || 4 || 2 || 2
TABLE_ROW || 2. || Животный мир || 4 || 2 || 2
TABLE_ROW || 3. || Водоемы края || 2 || 1 || 1
TABLE_ROW || Итого || 10 || 5 || 5
STRUCTURED_DOCX_TABLE_END

STRUCTURED_DOCX_TABLE_BEGIN 2
TABLE_ROW || № п/п || Наименование тем || Всего часов || Теория || Практика
TABLE_ROW || 1. || Культура края || 4 || 2 || 2
TABLE_ROW || 2. || История края || 4 || 2 || 2
TABLE_ROW || 3. || Итоговое занятие || 2 || 1 || 1
TABLE_ROW || Итого || 10 || 5 || 5
STRUCTURED_DOCX_TABLE_END

Календарный учебный график
STRUCTURED_DOCX_TABLE_BEGIN 5
TABLE_ROW || № || Месяц || Число || Время проведения занятия || Форма занятия || Кол- во часов || Тема занятия || Место проведения || Форма контроля
TABLE_ROW || 1 || сентябрь ||  ||  || Беседа || 2 || Вводное занятие ||  || Входная диагностика
TABLE_ROW || 2 || сентябрь ||  ||  || Беседа || 2 || Географическое положение Мурманской области ||  || Опрос
TABLE_ROW || 3 || сентябрь ||  ||  || Беседа || 2 || История освоения Кольского Севера ||  || Опрос
TABLE_ROW || 4 || сентябрь ||  ||  || Беседа || 2 || Экскурсия в областной краеведческий музей ||  || Наблюдение
STRUCTURED_DOCX_TABLE_END
STRUCTURED_DOCX_TABLE_BEGIN 6
TABLE_ROW || 5 ||  ||  ||  || Беседа || 2 || Литературная гостиная Саамские сказки и предания ||  || 
TABLE_ROW || 6 || октябрь ||  ||  || Беседа ||  || С.Варзуга, Умба. Просмотр фото и видеоматериалов. Литературная гостиная. ||  || Собеседование
TABLE_ROW || 7 || октябрь ||  ||  || Беседа || 2 || Посещение центра коренных малочисленных народов Севера ||  || Наблюдение
TABLE_ROW || 8 || октябрь ||  ||  || Беседа || 2 || Подведение итогов обучения ||  || Собеседование
TABLE_ROW || 9 || ноябрь ||  ||  || Беседа || 2 || Водоемы Кольского края ||  || Опрос
TABLE_ROW || 10 || ноябрь ||  ||  || Беседа || 2 || Заключительное занятие ||  || Собеседование
STRUCTURED_DOCX_TABLE_END
`;

  const { topics } = extractCalendarTopicsFromText({
    text,
    documentPath: "/tmp/1217145.docx",
    documentFormat: "docx",
  });

  assert.equal(topics.length, 10);
  assert.deepEqual(topics.map((topic) => topic.hours_total), Array(10).fill(2));
  assert.equal(topics[4].topic_name, "Литературная гостиная Саамские сказки и предания");
  assert.equal(topics[5].topic_name, "С.Варзуга, Умба. Просмотр фото и видеоматериалов. Литературная гостиная.");
  assert.equal(topics.every((topic) => topic.source_section === "Тема занятия"), true);
  assert.equal(topics.every((topic) => topic.raw_payload.parser === "fragmented-docx-calendar"), true);
});
