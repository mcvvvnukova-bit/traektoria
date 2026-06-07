from __future__ import annotations

import csv
import re
from collections import Counter, defaultdict
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[1]
INPUT_PATH = BASE_DIR / "exports" / "программы и темы технической направленности.csv"
SUMMARY_PATH = BASE_DIR / "exports" / "semantic_technical_topic_clusters_summary.csv"
TOPICS_PATH = BASE_DIR / "exports" / "semantic_technical_topic_clusters.csv"
REPORT_PATH = BASE_DIR / "exports" / "семантические кластеры тем технической направленности.md"


CLUSTERS = [
    ("Диагностика, контроль и аттестация", ["диагност", "контроль", "тест", "аттеста", "зачет", "зачёт", "опрос", "экзамен", "викторин", "провероч"]),
    ("Вводные, повторение и итоговые занятия", ["вводн", "повтор", "заключ", "итогов", "подведение итогов", "обобщение", "рефлексия"]),
    ("Организация занятий и учебный график", ["режим", "расписан", "продолжительность", "учебн недел", "академическ", "год обуч", "срок осво", "наполняемость", "число обуч", "периодичность"]),
    ("Оборудование, материалы и источники", ["кабинет", "стуль", "доска", "проектор", "ноутбук", "оборудован", "материал", "литератур", "пособие", "энциклопед", "издатель", "мозаика", "аркти", "просвещение"]),
    ("Формы занятий и методики", ["практическая работа", "практическая", "практические", "беседа", "демонстрац", "наблюдение", "самостоятельная", "лекция", "группов", "индивидуальн", "игровые задания"]),
    ("Робототехника и LEGO", ["робот", "lego", "wedo", "ev3", "mindstorms", "spike", "nxt", "датчик", "манипулятор", "кегельринг"]),
    ("Программирование и алгоритмы", ["программир", "алгоритм", "python", "java", "pascal", "scratch", "c++", "переменн", "цикл", "массив", "функц", "рекурс", "код", "компиля", "оператор", "язык программ"]),
    ("Веб-разработка", ["html", "css", "javascript", "веб", "web", "сайт", "страниц", "гипертекст", "хостинг", "домен", "браузерн"]),
    ("Разработка игр и приложений", ["создание игры", "игровой проект", "компьютерная игра", "unity", "minecraft", "майнкрафт", "приложен", "android", "pygame", "персонаж", "сценарий игры"]),
    ("3D-моделирование и печать", ["3d", "3д", "трехмер", "объемн", "объёмн", "blender", "tinkercad", "sketchup", "fusion", "stl", "слайсер", "3d-принтер", "3d принтер", "печать", "прототип"]),
    ("САПР, черчение и инженерная графика", ["чертеж", "чертёж", "сапр", "cad", "autocad", "inventor", "компас", "ескд", "проекц", "размер", "разрез", "сечен", "инженерн граф"]),
    ("Электроника, схемотехника и Arduino", ["электр", "электрон", "схем", "цепь", "ток", "напряж", "резист", "транзист", "arduino", "ардуино", "микроконтрол", "пайк", "светодиод", "breadboard"]),
    ("Техническое моделирование и механизмы", ["авиа", "самолет", "самолёт", "планер", "ракета", "судо", "кораб", "автомод", "модель", "моделизм", "катапульт", "кран", "механизм", "передач", "рычаг", "шасси", "конструктор"]),
    ("Медиа, фото, видео и анимация", ["видео", "монтаж", "фильм", "ролик", "звук", "аудио", "фото", "фотограф", "кадр", "камера", "мульт", "анимац", "медиа"]),
    ("Графический и цифровой дизайн", ["дизайн", "композици", "цвет", "шрифт", "логотип", "фирменн", "бренд", "айдентик", "макет", "графическ", "плакат", "иллюстрац", "интерфейс"]),
    ("Компьютерная грамотность и офисные инструменты", ["компьютер", "windows", "файл", "папк", "word", "excel", "powerpoint", "офис", "клавиатур", "мыш", "текстов", "презентац"]),
    ("Интернет, сети и цифровая безопасность", ["интернет", "сеть", "сетев", "кибер", "безопасн", "аккаунт", "парол", "почт", "поисков", "социальн сет"]),
    ("Данные, базы данных и искусственный интеллект", ["данн", "база данных", "sql", "таблиц", "нейро", "искусственн интеллект", "машинн", "анализ данных"]),
    ("Математика, логика и олимпиадные задачи", ["математ", "логик", "задач", "олимпиад", "геометр", "комбинатор", "головолом", "шифр", "системы счисления"]),
    ("Проектная и исследовательская деятельность", ["проект", "исслед", "защита", "презентация проекта", "стартап", "бизнес", "заказчик", "творческ проект"]),
    ("ПДД, транспорт и первая помощь", ["пдд", "дорож", "транспорт", "автомоб", "велосип", "светофор", "пешеход", "дтп", "первая помощь", "аптечк", "повязк", "эвакуац"]),
    ("Техническое творчество и изготовление изделий", ["изготов", "издел", "сборк", "детал", "инструмент", "материал", "конструкц", "макет", "мастер-класс", "пневмат", "оригами", "квиллинг"]),
    ("Инженерные и естественнонаучные основы", ["физик", "хими", "энерг", "возобновляем", "эксперимент", "опыт", "измерен", "сила", "давлен", "температур"]),
]

OTHER_CLUSTER = "Прочие и плохо распознанные темы"
SERVICE_CLUSTERS = {
    "Диагностика, контроль и аттестация",
    "Вводные, повторение и итоговые занятия",
    "Организация занятий и учебный график",
    "Оборудование, материалы и источники",
    "Формы занятий и методики",
}
CLUSTER_TYPE_ORDER = {"content": 0, "service": 1, "noise": 2}


def main() -> None:
    rows = read_rows(INPUT_PATH)
    topic_groups = aggregate(rows)
    detailed_rows = []
    summary = defaultdict(
        lambda: {"cluster_type": "content", "topic_rows": 0, "unique_topics": 0, "programs": set(), "hours": 0.0, "examples": Counter()}
    )

    for topic_key, item in topic_groups.items():
        cluster, cluster_type = classify(item["topic_name"], item["program_names"])
        item["cluster_name"] = cluster
        item["cluster_type"] = cluster_type
        detailed_rows.append(item)
        summary[cluster]["cluster_type"] = cluster_type
        summary[cluster]["topic_rows"] += item["topic_rows"]
        summary[cluster]["unique_topics"] += 1
        summary[cluster]["programs"].update(item["program_urls"])
        summary[cluster]["hours"] += item["hours_total"]
        summary[cluster]["examples"][item["topic_name"]] += item["topic_rows"]

    summary_rows = build_summary_rows(summary)
    write_summary(summary_rows)
    write_details(detailed_rows, summary_rows)
    write_report(summary_rows)

    print(
        {
            "input_rows": len(rows),
            "unique_topics": len(topic_groups),
            "clusters": len(summary_rows),
            "summary_path": str(SUMMARY_PATH),
            "topics_path": str(TOPICS_PATH),
            "report_path": str(REPORT_PATH),
        }
    )


def read_rows(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8-sig", newline="") as file:
        return list(csv.DictReader(file))


def aggregate(rows: list[dict]) -> dict[str, dict]:
    grouped = {}
    names = defaultdict(Counter)

    for row in rows:
        topic_key = normalize(row["topic_name"])
        if not topic_key:
            continue
        if topic_key not in grouped:
            grouped[topic_key] = {
                "topic_key": topic_key,
                "topic_name": row["topic_name"].strip(),
                "topic_rows": 0,
                "program_urls": set(),
                "program_names": Counter(),
                "hours_total": 0.0,
            }
        grouped[topic_key]["topic_rows"] += 1
        grouped[topic_key]["program_urls"].add(row["portal_url"])
        grouped[topic_key]["program_names"][row["program_name"].strip()] += 1
        grouped[topic_key]["hours_total"] += safe_float(row["hours_total"])
        names[topic_key][row["topic_name"].strip()] += 1

    for topic_key, item in grouped.items():
        item["topic_name"] = names[topic_key].most_common(1)[0][0]
    return grouped


def classify(topic_name: str, program_names: Counter) -> tuple[str, str]:
    topic_text = normalize(topic_name)
    if is_noise_topic(topic_text):
        return OTHER_CLUSTER, "noise"

    for cluster_name, needles in CLUSTERS:
        if any(needle in topic_text for needle in needles):
            return cluster_name, get_cluster_type(cluster_name)
    return OTHER_CLUSTER, "noise"


def get_cluster_type(cluster_name: str) -> str:
    if cluster_name == OTHER_CLUSTER:
        return "noise"
    if cluster_name in SERVICE_CLUSTERS:
        return "service"
    return "content"


def is_noise_topic(topic_text: str) -> bool:
    if not topic_text:
        return True
    if len(topic_text) <= 2:
        return True
    if re.fullmatch(r"[\d .,:;/-]+", topic_text):
        return True
    if re.fullmatch(r"(январь|февраль|март|апрель|май|июнь|июль|август|сентябрь|октябрь|ноябрь|декабрь)", topic_text):
        return True
    if re.fullmatch(
        r"(цели|формы|текст|результат|урок|занятие|макс|транспорт|информация|интернет|компьютерный|компьютер|практика|теория)",
        topic_text,
    ):
        return True
    if re.fullmatch(r"(практическая|практическое|теоретическое|самостоятельная)\s+(работа|занятие)", topic_text):
        return True
    if re.search(r"\.{4,}|…{2,}|[._·]{3,}\s*\d{1,3}$", topic_text):
        return True
    if "ддт" in topic_text or "дию" in topic_text or "полярис" in topic_text:
        return True
    return False


def build_summary_rows(summary: dict) -> list[dict]:
    rows = []
    for cluster_name, item in summary.items():
        rows.append(
            {
                "cluster_type": item["cluster_type"],
                "cluster_name": cluster_name,
                "topic_rows": item["topic_rows"],
                "unique_topics": item["unique_topics"],
                "program_count": len(item["programs"]),
                "hours_total": round(item["hours"], 2),
                "examples": " | ".join(topic for topic, _ in item["examples"].most_common(10)),
            }
        )
    rows.sort(key=lambda row: (CLUSTER_TYPE_ORDER.get(row["cluster_type"], 9), -row["program_count"], -row["topic_rows"], row["cluster_name"]))
    for index, row in enumerate(rows, start=1):
        row["cluster_number"] = index
    return rows


def write_summary(rows: list[dict]) -> None:
    fields = ["cluster_number", "cluster_type", "cluster_name", "topic_rows", "unique_topics", "program_count", "hours_total", "examples"]
    with SUMMARY_PATH.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def write_details(topic_rows: list[dict], summary_rows: list[dict]) -> None:
    number_by_name = {row["cluster_name"]: row["cluster_number"] for row in summary_rows}
    type_by_name = {row["cluster_name"]: row["cluster_type"] for row in summary_rows}
    fields = ["cluster_number", "cluster_type", "cluster_name", "topic_name", "topic_rows", "program_count", "hours_total"]
    with TOPICS_PATH.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader()
        for row in sorted(topic_rows, key=lambda item: (number_by_name[item["cluster_name"]], -item["topic_rows"], item["topic_name"])):
            writer.writerow(
                {
                    "cluster_number": number_by_name[row["cluster_name"]],
                    "cluster_type": type_by_name[row["cluster_name"]],
                    "cluster_name": row["cluster_name"],
                    "topic_name": row["topic_name"],
                    "topic_rows": row["topic_rows"],
                    "program_count": len(row["program_urls"]),
                    "hours_total": round(row["hours_total"], 2),
                }
            )


def write_report(rows: list[dict]) -> None:
    lines = [
        "# Семантические кластеры тем программ технической направленности",
        "",
        f"Источник: `{INPUT_PATH}`",
        f"Кластеров: {len(rows)}",
        "",
    ]

    groups = [
        ("content", "Предметные кластеры"),
        ("service", "Служебные кластеры"),
        ("noise", "Шум и нераспознанные темы"),
    ]

    for cluster_type, title in groups:
        group_rows = [row for row in rows if row["cluster_type"] == cluster_type]
        if not group_rows:
            continue

        lines.extend(
            [
                f"## {title}",
                "",
                "| # | Кластер | Строк тем | Уникальных тем | Программ | Часы | Примеры тем |",
                "|---:|---|---:|---:|---:|---:|---|",
            ]
        )

        for row in group_rows:
            examples = row["examples"].replace("|", ";")
            lines.append(
                f"| {row['cluster_number']} | {row['cluster_name']} | {row['topic_rows']} | {row['unique_topics']} | "
                f"{row['program_count']} | {row['hours_total']} | {examples} |"
            )
        lines.append("")

    REPORT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def normalize(value: str) -> str:
    text = str(value or "").lower().replace("ё", "е")
    text = re.sub(r"[\u00a0\t\r\n]+", " ", text)
    text = re.sub(r"[^0-9a-zа-я+#. -]+", " ", text)
    return re.sub(r"\s+", " ", text).strip(" .-")


def safe_float(value: str | None) -> float:
    try:
        return float(str(value or "0").replace(",", "."))
    except ValueError:
        return 0.0


if __name__ == "__main__":
    main()
