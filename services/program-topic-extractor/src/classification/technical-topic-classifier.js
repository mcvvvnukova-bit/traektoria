const NORMALIZER_VERSION = "topic-normalizer-v3";
const CLASSIFIER_VERSION = "directional-hierarchical-taxonomy-v4";
const AGGREGATION_VERSION = "program-topic-aggregate-v1";

const SERVICE_CATEGORY_BY_CODE = {
  assessment: "Диагностика, контроль и аттестация",
  intro_final: "Вводные, повторение и итоговые занятия",
  methods: "Формы занятий и методики",
  schedule: "Организация занятий и учебный график",
  materials_equipment: "Оборудование, материалы и источники",
};

const NOISE_CATEGORY_BY_CODE = {
  ocr_noise: "OCR/табличный шум",
  too_generic: "Слишком общая тема",
  toc_fragment: "Фрагмент оглавления",
  location_fragment: "Место проведения или кабинет",
  unknown: "Не удалось классифицировать",
};
const UNKNOWN_CONTENT_CATEGORY = "Предметная тема без категории";
const DOMAIN_BY_CODE = {
  it: "IT и программирование",
  engineering: "Инженерия и робототехника",
  media_design: "Медиа и дизайн",
  transport: "Транспорт и безопасность",
  project: "Проектная деятельность",
  tourism_skills: "Туристская подготовка",
  orientation: "Ориентирование и топография",
  local_history: "Краеведение и региональная история",
  museum_excursion: "Музейное и экскурсионное дело",
  sport_training: "Физическая и соревновательная подготовка",
  civic_patriotic: "Патриотическая и гражданско-спортивная подготовка",
  service: "Служебные темы",
  noise: "Шум и нераспознанные темы",
  unknown_content: "Предметные темы без категории",
  content: "Предметные темы",
};
const CONTENT_CATEGORY_BY_CODE = {
  programming: "Программирование и алгоритмы",
  robotics: "Робототехника и LEGO",
  electronics: "Электроника, схемотехника и Arduino",
  web: "Веб-разработка",
  games_apps: "Разработка игр и приложений",
  cad_3d: "3D-моделирование и печать",
  engineering_graphics: "САПР, черчение и инженерная графика",
  technical_modeling: "Техническое моделирование и механизмы",
  digital_design: "Графический и цифровой дизайн",
  media_animation: "Медиа, фото, видео и анимация",
  data_ai: "Данные, базы данных и искусственный интеллект",
  networks_security: "Интернет, сети и цифровая безопасность",
  math_logic: "Математика, логика и олимпиадные задачи",
  engineering_science: "Инженерные и естественнонаучные основы",
  transport_safety: "ПДД, транспорт и первая помощь",
  project_research: "Проектная и исследовательская деятельность",
  tourism_basics: "Основы туризма и туристский быт",
  tourism_equipment_knots: "Снаряжение и туристские узлы",
  hiking_routes_technique: "Походы, маршруты, техника и тактика",
  safety_survival: "Безопасность и выживание в природной среде",
  first_aid: "Первая помощь и походная медицина",
  orientation_topography: "Карты, компас и топография",
  sport_orienteering: "Спортивное ориентирование",
  regional_studies: "Краеведение и история родного края",
  nature_geography: "Природа, география и экология края",
  ethnography_culture: "Этнография, культура и традиции",
  military_history: "Военная история и память",
  museum_studies: "Музейное дело, фонды и экспозиции",
  excursion_guiding: "Экскурсоведение и работа экскурсовода",
  excursion_routes: "Экскурсионные маршруты и путеводители",
  tourism_competitions: "Туристские соревнования и техника туризма",
  physical_training: "Общая и специальная физическая подготовка",
  patriotic_civic: "Юнармия и гражданско-патриотическая подготовка",
  drill_civil_defense: "Строевая подготовка, ГО и спасательные работы",
};
const CONTENT_DOMAIN_BY_CATEGORY = {
  programming: "it",
  web: "it",
  games_apps: "it",
  data_ai: "it",
  networks_security: "it",
  math_logic: "it",
  robotics: "engineering",
  electronics: "engineering",
  cad_3d: "engineering",
  engineering_graphics: "engineering",
  technical_modeling: "engineering",
  engineering_science: "engineering",
  digital_design: "media_design",
  media_animation: "media_design",
  transport_safety: "transport",
  project_research: "project",
  tourism_basics: "tourism_skills",
  tourism_equipment_knots: "tourism_skills",
  hiking_routes_technique: "tourism_skills",
  safety_survival: "tourism_skills",
  first_aid: "tourism_skills",
  orientation_topography: "orientation",
  sport_orienteering: "orientation",
  regional_studies: "local_history",
  nature_geography: "local_history",
  ethnography_culture: "local_history",
  military_history: "local_history",
  museum_studies: "museum_excursion",
  excursion_guiding: "museum_excursion",
  excursion_routes: "museum_excursion",
  tourism_competitions: "sport_training",
  physical_training: "sport_training",
  patriotic_civic: "civic_patriotic",
  drill_civil_defense: "civic_patriotic",
};

const TECHNICAL_CONTENT_RULES = [
  rule("programming", "Программирование и алгоритмы", "it", "IT и программирование", [
    "программир",
    "алгоритм",
    "python",
    "java",
    "pascal",
    "scratch",
    "c++",
    "переменн",
    "цикл",
    "массив",
    "функц",
    "рекурс",
    "код",
    "компиля",
    "оператор",
    "язык программ",
    "блоки программы",
    "лабиринт",
    "сумо",
    "команды",
  ], ["язык программирования", "основы программирования", "блоки программы", "интеллектуальное сумо"]),
  rule("robotics", "Робототехника и LEGO", "engineering", "Инженерия и робототехника", [
    "робот",
    "lego",
    "wedo",
    "ev3",
    "mindstorms",
    "spike",
    "nxt",
    "датчик",
    "манипулятор",
    "кегельринг",
    "автоматическая дверь",
    "автоматическая урна",
    "жучок",
    "карусель",
    "качели",
    "лягушка",
    "вездеход",
  ], ["соревнования роботов", "роботы на сцене", "колесо обозрения", "голодный аллигатор"]),
  rule("electronics", "Электроника, схемотехника и Arduino", "engineering", "Инженерия и робототехника", [
    "электр",
    "электрон",
    "схем",
    "цепь",
    "ток",
    "напряж",
    "резист",
    "транзист",
    "arduino",
    "ардуино",
    "микроконтрол",
    "пайк",
    "светодиод",
    "breadboard",
  ], ["электрическая цепь"]),
  rule("web", "Веб-разработка", "it", "IT и программирование", [
    "html",
    "css",
    "javascript",
    "веб",
    "web",
    "сайт",
    "страниц",
    "гипертекст",
    "хостинг",
    "домен",
    "браузер",
  ], ["создание сайта", "web-дизайн", "веб-дизайн"]),
  rule("games_apps", "Разработка игр и приложений", "it", "IT и программирование", [
    "создание игры",
    "игровой проект",
    "компьютерная игра",
    "unity",
    "minecraft",
    "майнкрафт",
    "приложен",
    "android",
    "pygame",
    "персонаж",
    "сценарий игры",
  ], ["разработка приложений"]),
  rule("cad_3d", "3D-моделирование и печать", "engineering", "Инженерия и робототехника", [
    "3d",
    "3д",
    "трехмер",
    "объемн",
    "объёмн",
    "blender",
    "tinkercad",
    "sketchup",
    "fusion",
    "stl",
    "слайсер",
    "3d-принтер",
    "3d принтер",
    "печать",
    "прототип",
  ], ["3d моделирование", "3d-моделирование", "3d печать", "трехмерное моделирование"]),
  rule("engineering_graphics", "САПР, черчение и инженерная графика", "engineering", "Инженерия и робототехника", [
    "чертеж",
    "чертёж",
    "сапр",
    "cad",
    "autocad",
    "inventor",
    "компас",
    "ескд",
    "проекц",
    "размер",
    "разрез",
    "сечен",
    "инженерн граф",
  ], ["инженерная графика"]),
  rule("technical_modeling", "Техническое моделирование и механизмы", "engineering", "Инженерия и робототехника", [
    "авиа",
    "самолет",
    "самолёт",
    "планер",
    "ракета",
    "судо",
    "кораб",
    "автомод",
    "модель",
    "моделизм",
    "катапульт",
    "кран",
    "механизм",
    "передач",
    "рычаг",
    "шасси",
    "конструктор",
    "конструирование",
    "тяга",
    "тягач",
  ], ["модель самолета", "модель ракеты", "техническое моделирование", "конструирование по замыслу", "создание модели", "свободная сборка"]),
  rule("digital_design", "Графический и цифровой дизайн", "media_design", "Медиа и дизайн", [
    "дизайн",
    "композици",
    "цвет",
    "шрифт",
    "логотип",
    "фирменн",
    "бренд",
    "айдентик",
    "макет",
    "графическ",
    "плакат",
    "иллюстрац",
    "интерфейс",
    "krita",
    "оригами",
    "рисунок",
    "живопись",
  ], ["графический дизайн", "цифровой дизайн", "техника оригами", "тематический рисунок"]),
  rule("media_animation", "Медиа, фото, видео и анимация", "media_design", "Медиа и дизайн", [
    "видео",
    "монтаж",
    "фильм",
    "ролик",
    "звук",
    "аудио",
    "фото",
    "фотограф",
    "кадр",
    "камера",
    "мульт",
    "анимац",
    "медиа",
    "журналист",
  ], ["создание мультфильма", "культура речи журналиста"]),
  rule("data_ai", "Данные, базы данных и искусственный интеллект", "it", "IT и программирование", [
    "данн",
    "база данных",
    "sql",
    "таблиц",
    "нейро",
    "искусственн интеллект",
    "машинн",
    "анализ данных",
  ], ["базы данных", "искусственный интеллект"]),
  rule("networks_security", "Интернет, сети и цифровая безопасность", "it", "IT и программирование", [
    "интернет",
    "сеть",
    "сетев",
    "кибер",
    "безопасн",
    "аккаунт",
    "парол",
    "почт",
    "поисков",
    "социальн сет",
  ], ["цифровая безопасность"]),
  rule("math_logic", "Математика, логика и олимпиадные задачи", "it", "IT и программирование", [
    "математ",
    "логик",
    "задач",
    "олимпиад",
    "геометр",
    "комбинатор",
    "головолом",
    "шифр",
    "системы счисления",
  ], ["решение задач"]),
  rule("engineering_science", "Инженерные и естественнонаучные основы", "engineering", "Инженерия и робототехника", [
    "физик",
    "хими",
    "энерг",
    "возобновляем",
    "эксперимент",
    "опыт",
    "измерен",
    "сила",
    "давлен",
    "температур",
  ], ["возобновляемые источники энергии"]),
  rule("transport_safety", "ПДД, транспорт и первая помощь", "transport", "Транспорт и безопасность", [
    "пдд",
    "дорож",
    "транспорт",
    "автомоб",
    "велосип",
    "светофор",
    "пешеход",
    "дтп",
    "первая помощь",
    "аптечк",
    "повязк",
    "эвакуац",
    "перекрест",
    "регулировщик",
    "ожог",
    "кровотеч",
  ], ["правила дорожного движения", "проезд перекрестков", "знаки регулировщика", "оказание первой помощи"]),
  rule("project_research", "Проектная и исследовательская деятельность", "project", "Проектная деятельность", [
    "проект",
    "исслед",
    "защита",
    "презентация проекта",
    "стартап",
    "бизнес",
    "заказчик",
    "творческ проект",
    "соревнован",
  ], ["защита проекта", "проектная деятельность", "подготовка к защите", "участие в соревнованиях"]),
];

const TOURISM_CONTENT_RULES = [
  rule("excursion_guiding", "Экскурсоведение и работа экскурсовода", "museum_excursion", "Музейное и экскурсионное дело", [
    "экскурсов",
    "экскурсионн",
    "экскурс",
    "показ",
    "рассказ",
    "речь экскурсов",
    "профессиональные качества экскурсовода",
    "методика подготовки экскурсии",
    "методика проведения экскурсии",
    "экскурсионный метод",
    "экскурсионная речь",
  ], ["основы экскурсоведения", "методика подготовки экскурсии", "методика проведения экскурсии", "построение экскурсионного рассказа", "школа юного экскурсовода"]),
  rule("museum_studies", "Музейное дело, фонды и экспозиции", "museum_excursion", "Музейное и экскурсионное дело", [
    "музе",
    "музейн",
    "музеевед",
    "экспозиц",
    "экспонат",
    "выставк",
    "фонд",
    "музейный предмет",
    "источники и материалы",
    "учет",
    "учёт",
    "описание музейных",
    "стенд",
  ], ["основы музейных знаний", "структура и организация музея", "источники и материалы для музейной работы", "фонды школьного музея", "музейная экспозиция"]),
  rule("excursion_routes", "Экскурсионные маршруты и путеводители", "museum_excursion", "Музейное и экскурсионное дело", [
    "экскурсионн маршрут",
    "путевод",
    "буклет",
    "маршрут экскурсии",
    "пешеходная экскурсия",
    "автобусная экскурсия",
    "экологическая тропа",
    "тропа",
    "геокешинг",
    "терренкур",
  ], ["построение и защита экскурсионного маршрута", "разработка тематических экскурсий", "создание буклета-путеводителя"]),
  rule("orientation_topography", "Карты, компас и топография", "orientation", "Ориентирование и топография", [
    "топограф",
    "карта",
    "картограф",
    "компас",
    "азимут",
    "масштаб",
    "условные знаки",
    "план местности",
    "план учебного кабинета",
    "стороны горизонта",
    "горизонтал",
    "легенда карты",
  ], ["ориентирование и топография", "топографическая подготовка", "ориентирование на местности"]),
  rule("sport_orienteering", "Спортивное ориентирование", "orientation", "Ориентирование и топография", [
    "спортивное ориентирование",
    "ориентирован",
    "контрольный пункт",
    "дистанц",
    "техника ориентирования",
    "тактика ориентирования",
    "кп",
    "легенды кп",
    "отметк",
  ], ["спортивное ориентирование", "техника ориентирования", "тактика ориентирования", "краткий обзор развития спортивного ориентирования"]),
  rule("tourism_basics", "Основы туризма и туристский быт", "tourism_skills", "Туристская подготовка", [
    "знакомство с туризмом",
    "основы туризма",
    "история развития туризма",
    "туристские путешествия",
    "виды туризма",
    "юный турист",
    "туристята",
  ], ["знакомство с туризмом", "основы туризма", "туристские путешествия история развития туризма"]),
  rule("tourism_equipment_knots", "Снаряжение и туристские узлы", "tourism_skills", "Туристская подготовка", [
    "снаряж",
    "туристские узлы",
    "узлы",
    "узел",
    "верев",
    "верёв",
    "рюкзак",
    "палатк",
    "тент",
    "карабин",
    "личное и групповое",
    "личное и общественное",
  ], ["специальное туристское снаряжение", "личное и групповое снаряжение", "личное и общественное туристское снаряжение", "узлы применяемые в туризме"]),
  rule("tourism_competitions", "Туристские соревнования и техника туризма", "sport_training", "Физическая и соревновательная подготовка", [
    "соревн",
    "слет",
    "слёт",
    "тпт",
    "тлт",
    "кпт",
    "полоса препятств",
    "командная техника",
    "техника пешеходного туризма",
    "техника лыжного туризма",
    "спортивно-турист",
    "туристские норматив",
  ], ["соревнования по технике пешеходного туризма", "соревнования по технике лыжного туризма", "спортивно-туристическое мероприятие по тпт"]),
  rule("hiking_routes_technique", "Походы, маршруты, техника и тактика", "tourism_skills", "Туристская подготовка", [
    "поход",
    "маршрут",
    "пешеходн",
    "лыжн",
    "водн",
    "учебно-тренировочный поход",
    "утпвд",
    "марш-бросок",
    "привал",
    "ночлег",
    "бивак",
    "питание",
    "питьевой режим",
    "туристский быт",
    "походные должности",
    "туристск",
    "туризм",
    "препятств",
  ], ["основы туризма", "основы туристской подготовки", "организация туристского быта", "техника и тактика в пешем походе", "техника и тактика в лыжном походе", "подготовка к пешему походу", "подготовка к лыжному походу"]),
  rule("safety_survival", "Безопасность и выживание в природной среде", "tourism_skills", "Туристская подготовка", [
    "безопасн",
    "техника безопасности",
    "инструктаж",
    "опасност",
    "опасности на маршруте",
    "опасности зимнего маршрута",
    "выжив",
    "сигнал бедствия",
    "экстремальн",
    "природной среде",
    "заготовка дров",
    "костер",
    "костёр",
    "пожар",
    "противопожар",
  ], ["выживание в природной среде", "способы подачи сигналов бедствия", "опасности на маршруте", "опасности зимнего маршрута"]),
  rule("first_aid", "Первая помощь и походная медицина", "tourism_skills", "Туристская подготовка", [
    "первая помощь",
    "доврачеб",
    "медицин",
    "аптечк",
    "травм",
    "походный травматизм",
    "бинт",
    "жгут",
    "кровотеч",
    "ожог",
    "неотложн",
    "самоконтроль",
    "гигиен",
    "здоров",
  ], ["оказание первой помощи", "составление медицинской аптечки", "первая помощь при неотложных состояниях", "гигиена туриста-путешественника"]),
  rule("regional_studies", "Краеведение и история родного края", "local_history", "Краеведение и региональная история", [
    "краевед",
    "родной край",
    "малая родина",
    "мой край",
    "история области",
    "история с",
    "история города",
    "история улиц",
    "земляк",
    "достопримеч",
    "памятник",
    "символ",
    "герб",
    "флаг",
    "поселени",
    "населенн",
    "населённ",
    "кольский край",
    "мурманск",
    "алакуртт",
    "кандалакш",
  ], ["введение в краеведение", "моя малая родина", "краеведение кольского края", "родной край его природные особенности история мурманской области"]),
  rule("nature_geography", "Природа, география и экология края", "local_history", "Краеведение и региональная история", [
    "географ",
    "рельеф",
    "климат",
    "природ",
    "эколог",
    "ископаем",
    "минерал",
    "геолог",
    "животн",
    "раститель",
    "водные",
    "водопад",
    "сопк",
    "полуостров",
    "тундр",
    "заповед",
  ], ["география мурманской области", "природные ископаемые кольского полуострова", "климатические условия", "животный и растительный мир", "тропинка в природу"]),
  rule("ethnography_culture", "Этнография, культура и традиции", "local_history", "Краеведение и региональная история", [
    "этнограф",
    "традиц",
    "культур",
    "фольклор",
    "народ",
    "саам",
    "помор",
    "обыча",
    "ремесл",
  ], ["этнография кольского края"]),
  rule("military_history", "Военная история и память", "local_history", "Краеведение и региональная история", [
    "вов",
    "великая отечественная",
    "война",
    "герои",
    "полковод",
    "вооруженных сил",
    "вооружённых сил",
    "локальных конфликт",
    "сво",
    "память",
    "мужеств",
    "доблест",
    "слава",
  ], ["основные сражения вов", "юные герои вов", "великие полководцы россии", "земляки-участники и герои великой отечественной войны"]),
  rule("patriotic_civic", "Юнармия и гражданско-патриотическая подготовка", "civic_patriotic", "Патриотическая и гражданско-спортивная подготовка", [
    "юнарм",
    "юнармеец",
    "юнармейц",
    "кодекс юнармейца",
    "патриот",
    "гражданск",
    "присяга",
    "символы юнарм",
  ], ["юнармия история символы стиль кодекс юнармейца"]),
  rule("drill_civil_defense", "Строевая подготовка, ГО и спасательные работы", "civic_patriotic", "Патриотическая и гражданско-спортивная подготовка", [
    "строев",
    "гражданская оборона",
    "огневая",
    "радиацион",
    "химическ",
    "биологическ",
    "средства связи",
    "спасательн",
    "спасательные работы",
    "противопожар",
    "самообор",
    "военно-приклад",
  ], ["основы строевой подготовки", "строевые приемы и движения", "спасательные работы", "средства связи"]),
  rule("physical_training", "Общая и специальная физическая подготовка", "sport_training", "Физическая и соревновательная подготовка", [
    "общая физическая",
    "специальная физическая",
    "офп",
    "сфп",
    "технико-тактическая подготовка",
    "бег",
    "эстафет",
    "спортивные игры",
    "подвижные игры",
    "тренировка",
    "физическая подготовка",
  ], ["общая физическая подготовка", "специальная физическая подготовка", "технико-тактическая подготовка"]),
  rule("project_research", "Проектная и исследовательская деятельность", "project", "Проектная деятельность", [
    "проект",
    "исслед",
    "защита",
    "презентац",
    "творческ",
    "фотовыставк",
    "буклет",
    "веб-квест",
    "квест",
  ], ["проектная деятельность", "защита проектной работы", "презентация творческих работ"]),
];

const CONTENT_RULES = TECHNICAL_CONTENT_RULES;

const SERVICE_RULES = [
  serviceRule("assessment", ["диагност", "контроль", "тест", "аттеста", "зачет", "зачёт", "опрос", "экзамен", "викторин", "провероч", "норматив"]),
  serviceRule("intro_final", ["вводн", "инструктаж", "повтор", "заключ", "итогов", "подведение итогов", "обобщение", "рефлексия"]),
  serviceRule("schedule", ["режим", "расписан", "продолжительность", "учебн недел", "академическ", "год обуч", "срок осво", "срок реализации", "объем программы", "наполняемость", "периодичность"]),
  serviceRule("materials_equipment", ["кабинет", "оборудован", "материал", "литератур", "пособие", "энциклопед", "издатель", "ноутбук", "стул", "стол", "накопитель", "ssd"]),
  serviceRule("methods", ["практическая работа", "практическая", "практические", "беседа", "демонстрац", "наблюдение", "самостоятельная", "лекция", "группов", "индивидуальн"]),
];

const MANUAL_BATCH1_RULES = [
  manualRule("noise", "toc_fragment", [
    /\b(м\.|москва|санкт-петербург|петербург|пресс|просвещение|астрель|диалектика|бхв|наука|бином|лаборатория знаний|мозаика-синтез|вильямс|аркти|галактика)\b/u,
    /\b(20[0-2]\d|19\d\d)\b\.?$/u,
    /поляков .* еремин/u,
    /педагог дополнительного образования/u,
  ]),
  manualRule("noise", "ocr_noise", [
    /^\(?макс\.?$/u,
    /^тий$/u,
    /^часа?,?$/u,
    /^программы$/u,
    /^группы$/u,
    /^занятиями$/u,
    /^последствия\)?$/u,
    /^формы форма занятия$/u,
    /^конструирование по$/u,
    /^инструктаж по$/u,
    /^пострадавшему\.?$/u,
  ]),
  manualRule("noise", "too_generic", [
    /^первые шаги$/u,
    /^введение\.?$/u,
    /^введение в программу$/u,
    /^творческая$/u,
    /^выполнение$/u,
    /^использование$/u,
    /^заказать$/u,
    /^информации$/u,
    /^современность\)?$/u,
    /^высокий уровень$/u,
    /^третий уровень сложности\.?$/u,
  ]),
  manualRule("service", "schedule", [
    /срок реализации программы/u,
    /объем программы/u,
    /длительность программы/u,
    /кол(?:ич)?-?во учебных недель/u,
    /количество учебных недель/u,
    /учебн(ый|ых|ого) график/u,
    /время (занятий|обучения)/u,
    /период обучения/u,
    /перерыв после первого часа/u,
    /\b36 недель\b/u,
    /\b18 учебных недель\b/u,
    /\b45 мин\b/u,
    /установленного периода обучения/u,
    /количество обучающихся в группе/u,
    /наполняемость/u,
  ]),
  manualRule("service", "materials_equipment", [
    /накопитель/u,
    /\bssd\b/u,
    /стулья/u,
    /столы/u,
    /ноутбук/u,
    /доска магнитно-маркерная/u,
    /карандаши/u,
    /ножницы/u,
    /линейка/u,
    /надфил/u,
    /напильник/u,
    /металлическ/u,
    /инструменты:/u,
    /яндекс\.телемост/u,
  ]),
  manualRule("service", "assessment", [
    /^промежуточн\w*\.?$/u,
    /^предварительн\w*\.?$/u,
    /^текущий\.?$/u,
    /^устный\.?$/u,
    /^практическое задание\.?$/u,
    /максимальное количество баллов/u,
    /соответствие требуемой структуре/u,
    /наличия плана действий/u,
    /качество презентации/u,
    /новизна/u,
    /актуальность/u,
    /анализ существующих аналогов/u,
    /техническая красота/u,
    /выступление/u,
    /вая аттес/u,
  ]),
  manualRule("service", "intro_final", [/подведение работы объединения за год/u]),
  manualRule("content", "robotics", [
    /автоматическая (дверь|урна)/u,
    /жучок/u,
    /карусель/u,
    /качели/u,
    /лягушка/u,
    /танцующие птицы/u,
    /рычащий лев/u,
    /голодный аллигатор/u,
    /обезьянка-барабанщица/u,
    /колесо обозрения/u,
    /вездеход/u,
    /динозавры/u,
    /великан/u,
    /машины будущего/u,
    /старинные машины/u,
  ]),
  manualRule("content", "technical_modeling", [
    /конструирование по замыслу/u,
    /конструирование$/u,
    /конструирование и/u,
    /простое моделирование/u,
    /моделирование на каркасах/u,
    /конструкции/u,
    /полезные приспособления/u,
    /свободная сборка/u,
    /создание модели/u,
    /терминал для прохода/u,
    /тяга/u,
  ]),
  manualRule("content", "programming", [/блоки программы/u, /лабиринт/u, /интеллектуальное сумо/u]),
  manualRule("content", "digital_design", [
    /символика мира/u,
    /тематический рисунок/u,
    /рисунок\. живопись/u,
    /фантазируй/u,
    /наш двор/u,
    /что нас окружает/u,
    /день победы/u,
    /техника оригами/u,
    /косынка/u,
    /домашние животные/u,
  ]),
  manualRule("content", "media_animation", [/культура речи журналиста/u]),
  manualRule("content", "transport_safety", [
    /проезд перекрестков/u,
    /перекрестки/u,
    /знаки регулировщика/u,
    /регулировщик/u,
    /знаки приоритета/u,
    /запрещающие знаки/u,
    /предупреждающие знаки/u,
    /дорога,/u,
    /дорож/u,
    /юид/u,
    /водителя/u,
    /ожоги/u,
    /первая помощь/u,
    /кровотеч/u,
    /повяз/u,
    /наложение жгута/u,
    /обморок/u,
    /формы тб и пп/u,
    /команды движения/u,
    /переходы/u,
    /движения и повороты/u,
  ]),
  manualRule("content", "project_research", [
    /подготовка к защите/u,
    /подготовка к соревнованиям/u,
    /участие в соревнованиях/u,
    /возможность реализации/u,
  ]),
  manualRule("content", "engineering_science", [/основы медицинских знаний/u, /освещение/u]),
  manualRule("content", "engineering_graphics", [/линейка металлическая/u]),
];

const MANUAL_RULES = MANUAL_BATCH1_RULES;

const SYNONYMS = [
  [/\b3д\b/giu, "3D"],
  [/\bтр[её]хмерн\w*/giu, "3D"],
  [/\bардуино\b/giu, "Arduino"],
  [/\bлего\b/giu, "LEGO"],
  [/\bпайтон\b/giu, "Python"],
  [/\bджаваскрипт\b/giu, "JavaScript"],
  [/\bскретч\b/giu, "Scratch"],
];

function classifierScopeForDirection(directionName) {
  const key = normalizeKey(directionName);
  if (/турист|краевед/u.test(key)) return "tourism";
  return "technical";
}

function contentRulesForScope(classifierScope) {
  if (classifierScope === "tourism") return TOURISM_CONTENT_RULES;
  return TECHNICAL_CONTENT_RULES;
}

function normalizeAndClassifyTopic(row) {
  const classifierScope = classifierScopeForDirection(row.directionName);
  const normalized = normalizeTopic(row, classifierScope);
  const classification = classifyNormalizedTopic({
    normalizedTopicName: normalized.normalizedTopicName,
    normalizedTopicKey: normalized.normalizedTopicKey,
    programName: row.programName,
    sectionTitle: row.sectionTitle,
    directionName: row.directionName,
    recordTypeHint: normalized.recordType,
    noiseReason: normalized.noiseReason,
  });

  return {
    ...normalized,
    classification,
  };
}

function normalizeTopic(row, classifierScope = classifierScopeForDirection(row.directionName)) {
  const rawTopicName = String(row.topicName || "").trim();
  const activityType = normalizeActivityType(row.activityType, rawTopicName);
  const cleaned = cleanTopicName(rawTopicName);
  const key = normalizeKey(cleaned);
  const noiseReason = detectNoiseReason(rawTopicName, cleaned, key);
  const contentRules = contentRulesForScope(classifierScope);
  const manualRuleMatch = !noiseReason ? detectManualBatch1Rule(key, classifierScope) : null;
  const serviceCode = !noiseReason && !manualRuleMatch ? detectServiceCode(key, contentRules) : "";
  const recordType = noiseReason ? "noise" : manualRuleMatch ? manualRuleMatch.recordType : serviceCode ? "service" : "content";
  const confidence = estimateNormalizationConfidence(rawTopicName, cleaned, noiseReason, serviceCode);

  return {
    rawTopicName,
    normalizedTopicName: cleaned || rawTopicName,
    normalizedTopicKey: key || normalizeKey(rawTopicName),
    activityTypeNormalized: activityType,
    recordType,
    serviceCode,
    noiseReason: noiseReason || (manualRuleMatch?.recordType === "noise" ? manualRuleMatch.categoryCode : ""),
    manualRule: manualRuleMatch?.ruleId || "",
    normalizationMethod: "rules",
    normalizationVersion: NORMALIZER_VERSION,
    normalizationConfidence: confidence,
    rawPayload: {
      original_activity_type: row.activityType || "",
      section_title: row.sectionTitle || "",
      control_form: row.controlForm || "",
      manual_rule_category: manualRuleMatch?.categoryCode || "",
    },
  };
}

function classifyNormalizedTopic({ normalizedTopicName, normalizedTopicKey, programName, sectionTitle, directionName, recordTypeHint, noiseReason }) {
  const classifierScope = classifierScopeForDirection(directionName);
  const contentRules = contentRulesForScope(classifierScope);

  if (recordTypeHint === "noise") {
    const code = noiseReason || "unknown";
    return buildClassification({
      recordType: "noise",
      parentCode: "noise",
      parentName: "Шум и нераспознанные темы",
      categoryCode: code,
      categoryName: NOISE_CATEGORY_BY_CODE[code] || NOISE_CATEGORY_BY_CODE.unknown,
      confidence: code === "unknown" ? 0.35 : 0.9,
      topCategories: [],
      matchedRules: [{ rule: `noise:${code}` }],
      inputText: normalizedTopicName,
    });
  }

  const manualRuleMatch = detectManualBatch1Rule(normalizedTopicKey, classifierScope);
  if (manualRuleMatch) {
    return buildManualBatch1Classification(
      manualRuleMatch,
      buildInputText(normalizedTopicName, programName, sectionTitle),
    );
  }

  const serviceCode = detectServiceCode(normalizedTopicKey, contentRules);
  if (recordTypeHint === "service" || serviceCode) {
    const code = serviceCode || "methods";
    return buildClassification({
      recordType: "service",
      parentCode: "service",
      parentName: "Служебные темы",
      categoryCode: code,
      categoryName: SERVICE_CATEGORY_BY_CODE[code],
      confidence: serviceCode ? 0.86 : 0.62,
      topCategories: [],
      matchedRules: [{ rule: `service:${code}` }],
      inputText: buildInputText(normalizedTopicName, programName, sectionTitle),
    });
  }

  const inputText = buildInputText(normalizedTopicName, programName, sectionTitle);
  const topicKey = normalizeKey(normalizedTopicName);
  const contextKey = normalizeKey(`${sectionTitle || ""} ${programName || ""}`);
  const scored = scoreContentRules(topicKey, contextKey, contentRules);
  const best = scored[0];

  if (!best || best.score <= 0 || (!best.topicMatches.length && !best.phraseMatches.length)) {
    return buildClassification({
      recordType: "content",
      parentCode: "unknown_content",
      parentName: "Предметные темы без категории",
      categoryCode: "unknown_content",
      categoryName: UNKNOWN_CONTENT_CATEGORY,
      confidence: best?.score > 0 ? 0.42 : 0.34,
      topCategories: [],
      matchedRules: [],
      inputText,
    });
  }

  const secondScore = scored[1]?.score || 0;
  const confidence = estimateClassificationConfidence(best.score, secondScore, best.topicMatches.length, best.phraseMatches.length);

  return buildClassification({
    recordType: "content",
    parentCode: best.rule.parentCode,
    parentName: best.rule.parentName,
    categoryCode: best.rule.code,
    categoryName: best.rule.name,
    confidence,
    topCategories: scored.slice(0, 3).map((item) => ({
      category_code: item.rule.code,
      category_name: item.rule.name,
      score: Number(item.score.toFixed(3)),
    })),
    matchedRules: [...best.phraseMatches, ...best.topicMatches, ...best.contextMatches].map((match) => ({
      rule: `${best.rule.code}:${match.kind}`,
      value: match.value,
      weight: match.weight,
    })),
    inputText,
  });
}

function classificationFromGoldenLabel({ normalizedTopicName, programName, recordType, categoryCode, categoryName, source }) {
  const resolvedCategoryName = categoryName || categoryNameFor(recordType, categoryCode);
  const parentCode = parentCodeFor(recordType, categoryCode);
  const parentName = parentNameFor(recordType, categoryCode);
  return buildClassification({
    recordType,
    parentCode,
    parentName,
    categoryCode,
    categoryName: resolvedCategoryName,
    confidence: 0.99,
    topCategories: [{
      category_code: categoryCode,
      category_name: resolvedCategoryName,
      score: 100,
    }],
    matchedRules: [{ rule: `golden_label:${source || "manual"}` }],
    inputText: buildInputText(normalizedTopicName, programName, ""),
  });
}

function cleanTopicName(value) {
  let text = String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/[«»]/g, '"')
    .replace(/\s+/g, " ")
    .trim();

  text = text.replace(/^TABLE_ROW\s*\|\|\s*/iu, "");
  text = text.replace(/^(?:текущий|предварительный|промежуточный)\s+\d+(?:[.)])?\s*/iu, "");
  text = text.replace(/^\d+(?:[.)]|\.\d+)?\s*/u, "");
  text = text.replace(/^(?:тема|раздел|модуль)\s*\d+(?:[.)])?\s*/iu, "");
  text = text.replace(/^(?:практическая\s+работа|самостоятельная\s+работа|теоретическое\s+занятие|теория|практика|комбинированное|контроль|проект)\s*[:.-]\s*/iu, "");
  text = text.replace(/\s+(?:теория|практика|контроль|зач[её]т|опрос|наблюдение)\.?$/iu, "");
  text = text.replace(/\s+\d+(?:[,.]\d+)?\s*(?:час(?:а|ов)?\.?)?$/iu, "");
  text = text.replace(/\s+/g, " ").trim(" .;-");

  for (const [pattern, replacement] of SYNONYMS) {
    text = text.replace(pattern, replacement);
  }

  text = text.replace(/\bhtml\b/giu, "HTML");
  text = text.replace(/\bcss\b/giu, "CSS");
  text = text.replace(/\bsql\b/giu, "SQL");
  text = text.replace(/\bev3\b/giu, "EV3");
  text = text.replace(/\bwedo\b/giu, "WeDo");
  return text.trim();
}

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/\u00a0/g, " ")
    .replace(/[«»"“”]/g, "")
    .replace(/[^0-9a-zа-я+#. -]+/giu, " ")
    .replace(/\s+/g, " ")
    .trim(" .-");
}

function detectNoiseReason(raw, cleaned, key) {
  if (!key) return "unknown";
  if (key.length <= 2) return "too_generic";
  if (/^table_row\b/iu.test(raw)) return "ocr_noise";
  if (/^[\d .,:;/-]+$/u.test(key)) return "ocr_noise";
  if (/\b(м\.|москва|санкт-петербург|петербург|пресс|просвещение|астрель|диалектика|бхв|наука|бином|лаборатория знаний|мозаика-синтез|вильямс|аркти|галактика)\b/iu.test(key)) {
    return "toc_fragment";
  }
  if (/\b(20[0-2]\d|19\d\d)\b\.?$/u.test(key) && key.length < 120) return "toc_fragment";
  if (/\.{4,}|…{2,}|[._·]{3,}\s*\d{1,3}$/u.test(raw)) return "toc_fragment";
  if (/^(январь|февраль|март|апрель|май|июнь|июль|август|сентябрь|октябрь|ноябрь|декабрь)$/iu.test(key)) {
    return "too_generic";
  }
  if (/^(цели|формы|текст|результат|урок|занятие|макс|транспорт|информация|интернет|компьютерный|компьютер|практика|теория|введение)$/iu.test(key)) {
    return "too_generic";
  }
  if (/^(каб\.?|кабинет|аудитория|зал|дюц|мбу|мау|моу)\b/iu.test(key)) return "location_fragment";
  if (/ддт|дию|полярис|ровесник/iu.test(key) && key.length < 40) return "location_fragment";
  if (/^-\d+\s+год/iu.test(key)) return "ocr_noise";
  if (/^(специальная|техническая|тактическая|подготовка)$/iu.test(key)) return "too_generic";
  if (!cleaned || cleaned.length < 3) return "too_generic";
  return "";
}

function detectServiceCode(key, contentRules = CONTENT_RULES) {
  const exactAssessment = /^(промежуточн\w*|предварительн\w*|текущий|устный|практическое задание)\.?$/iu;
  if (exactAssessment.test(key)) return "assessment";
  for (const item of SERVICE_RULES) {
    if (
      (item.code === "methods" || item.code === "intro_final" || item.code === "assessment" || item.code === "materials_equipment") &&
      looksContentLike(key, contentRules)
    ) continue;
    if (item.needles.some((needle) => key.includes(needle))) return item.code;
  }
  return "";
}

function detectManualBatch1Rule(key, classifierScope = "technical") {
  for (const item of MANUAL_RULES) {
    if (item.scope !== "all" && item.scope !== classifierScope) continue;
    if (item.patterns.some((pattern) => pattern.test(key))) {
      return item;
    }
  }
  return null;
}

function buildManualBatch1Classification(item, inputText) {
  if (item.recordType === "noise") {
    return buildClassification({
      recordType: "noise",
      parentCode: "noise",
      parentName: "Шум и нераспознанные темы",
      categoryCode: item.categoryCode,
      categoryName: NOISE_CATEGORY_BY_CODE[item.categoryCode] || NOISE_CATEGORY_BY_CODE.unknown,
      confidence: 0.9,
      topCategories: [],
      matchedRules: [{ rule: item.ruleId }],
      inputText,
    });
  }

  if (item.recordType === "service") {
    return buildClassification({
      recordType: "service",
      parentCode: "service",
      parentName: "Служебные темы",
      categoryCode: item.categoryCode,
      categoryName: SERVICE_CATEGORY_BY_CODE[item.categoryCode],
      confidence: 0.9,
      topCategories: [],
      matchedRules: [{ rule: item.ruleId }],
      inputText,
    });
  }

  const categoryName = CONTENT_CATEGORY_BY_CODE[item.categoryCode] || item.categoryCode;
  return buildClassification({
    recordType: "content",
    parentCode: parentCodeFor("content", item.categoryCode),
    parentName: parentNameFor("content", item.categoryCode),
    categoryCode: item.categoryCode,
    categoryName,
    confidence: 0.9,
    topCategories: [{
      category_code: item.categoryCode,
      category_name: categoryName,
      score: 10,
    }],
    matchedRules: [{ rule: item.ruleId }],
    inputText,
  });
}

function parentCodeFor(recordType, categoryCode) {
  if (recordType === "service") return "service";
  if (recordType === "noise") return "noise";
  if (categoryCode === "unknown_content") return "unknown_content";
  return CONTENT_DOMAIN_BY_CATEGORY[categoryCode] || "content";
}

function parentNameFor(recordType, categoryCode) {
  return DOMAIN_BY_CODE[parentCodeFor(recordType, categoryCode)] || DOMAIN_BY_CODE.content;
}

function categoryNameFor(recordType, categoryCode) {
  if (recordType === "service") return SERVICE_CATEGORY_BY_CODE[categoryCode] || categoryCode;
  if (recordType === "noise") return NOISE_CATEGORY_BY_CODE[categoryCode] || categoryCode;
  if (categoryCode === "unknown_content") return UNKNOWN_CONTENT_CATEGORY;
  return CONTENT_CATEGORY_BY_CODE[categoryCode] || categoryCode;
}

function domainNameForCode(code) {
  return DOMAIN_BY_CODE[code] || code;
}

function looksContentLike(key, contentRules = CONTENT_RULES) {
  return contentRules.some(
    (item) => item.phrases.some((phrase) => key.includes(phrase)) || item.needles.some((needle) => key.includes(needle)),
  );
}

function scoreContentRules(topicKey, contextKey, contentRules = CONTENT_RULES) {
  return contentRules.map((item) => {
    const phraseMatches = item.phrases
      .filter((phrase) => topicKey.includes(phrase))
      .map((value) => ({ kind: "phrase", value, weight: 3 }));
    const topicMatches = item.needles
      .filter((needle) => topicKey.includes(needle))
      .map((value) => ({ kind: "topic", value, weight: 2 }));
    const contextMatches = item.needles
      .filter((needle) => contextKey.includes(needle))
      .map((value) => ({ kind: "context", value, weight: 0.5 }));
    const score =
      phraseMatches.reduce((sum, match) => sum + match.weight, 0) +
      topicMatches.reduce((sum, match) => sum + match.weight, 0) +
      Math.min(2, contextMatches.reduce((sum, match) => sum + match.weight, 0));

    return {
      rule: item,
      phraseMatches,
      topicMatches,
      contextMatches,
      score,
    };
  }).sort((left, right) => right.score - left.score);
}

function estimateNormalizationConfidence(raw, cleaned, noiseReason, serviceCode) {
  if (noiseReason) return 0.9;
  let score = 0.72;
  if (cleaned && cleaned !== raw) score += 0.08;
  if (serviceCode) score += 0.08;
  if (cleaned.length >= 8 && cleaned.length <= 120) score += 0.08;
  return Number(Math.min(0.95, score).toFixed(2));
}

function estimateClassificationConfidence(score, secondScore, topicMatchCount, phraseMatchCount) {
  let confidence = 0.52 + Math.min(0.32, score * 0.08);
  if (phraseMatchCount > 0) confidence += 0.08;
  if (topicMatchCount >= 2) confidence += 0.06;
  if (secondScore > 0 && score - secondScore < 1.5) confidence -= 0.18;
  return Number(Math.max(0.35, Math.min(0.96, confidence)).toFixed(2));
}

function normalizeActivityType(activityType, topicName) {
  const text = normalizeKey(`${activityType || ""} ${topicName || ""}`);
  if (/контроль|зачет|зачёт|тест|экзамен|опрос|аттеста|соревнован|норматив/.test(text)) return "контроль";
  if (/проект/.test(text)) return "проект";
  if (/теория/.test(text) && /практик/.test(text)) return "теория+практика";
  if (/практик|лаборатор|упражнен|трениров/.test(text)) return "практика";
  if (/теор|лекци|беседа|знакомство|история/.test(text)) return "теория";
  return activityType || "не определено";
}

function buildInputText(topicName, programName, sectionTitle) {
  return [
    `Тема: ${topicName || ""}`,
    programName ? `Программа: ${programName}` : "",
    sectionTitle ? `Раздел: ${sectionTitle}` : "",
  ].filter(Boolean).join("\n");
}

function buildClassification({
  recordType,
  parentCode,
  parentName,
  categoryCode,
  categoryName,
  confidence,
  topCategories,
  matchedRules,
  inputText,
}) {
  return {
    recordType,
    parentCode,
    parentName,
    categoryCode,
    categoryName,
    confidence,
    topCategories,
    matchedRules,
    inputText,
    classifierMethod: "rules",
    classifierVersion: CLASSIFIER_VERSION,
  };
}

function rule(code, name, parentCode, parentName, needles, phrases = []) {
  return {
    code,
    name,
    parentCode,
    parentName,
    needles: needles.map(normalizeKey),
    phrases: phrases.map(normalizeKey),
  };
}

function serviceRule(code, needles) {
  return {
    code,
    needles: needles.map(normalizeKey),
  };
}

function manualRule(recordType, categoryCode, patterns, scope = "technical") {
  return {
    recordType,
    categoryCode,
    patterns,
    scope,
    ruleId: `manual_batch1:${recordType}:${categoryCode}`,
  };
}

module.exports = {
  normalizeAndClassifyTopic,
  classifyNormalizedTopic,
  classificationFromGoldenLabel,
  normalizeKey,
  domainNameForCode,
  classifierScopeForDirection,
  NORMALIZER_VERSION,
  CLASSIFIER_VERSION,
  AGGREGATION_VERSION,
};
