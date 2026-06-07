from __future__ import annotations

import csv
import re
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[1]
INPUT_PATH = BASE_DIR / "exports" / "очередь ручной проверки тем технической направленности.csv"
OUTPUT_PATH = BASE_DIR / "exports" / "ручная разметка тем технической направленности batch1.csv"
FULL_OUTPUT_PATH = BASE_DIR / "exports" / "очередь ручной проверки тем технической направленности с разметкой batch1.csv"


RULES = [
    # Noise and non-topic fragments.
    ("noise", "toc_fragment", "manual_batch1: библиографическая ссылка или фрагмент оглавления", [
        r"\b(м\.|москва|санкт-петербург|петербург|пресс|просвещение|астрель|диалектика|бхв|наука|бином|лаборатория знаний|мозаика-синтез|вильямс|аркти|галактика)\b",
        r"\b(20[0-2]\d|19\d\d)\b\.?$",
        r"поляков .* еремин",
        r"педагог дополнительного образования",
    ]),
    ("noise", "ocr_noise", "manual_batch1: обрывок OCR или неинформативная ячейка", [
        r"^\(?макс\.?$",
        r"^тий$",
        r"^часа?,?$",
        r"^программы$",
        r"^группы$",
        r"^занятиями$",
        r"^последствия\)?$",
        r"^формы форма занятия$",
        r"^конструирование по$",
        r"^инструктаж по$",
        r"^пострадавшему\.?$",
    ]),
    ("noise", "too_generic", "manual_batch1: слишком общая формулировка без предмета", [
        r"^первые шаги$",
        r"^введение\.?$",
        r"^введение в программу$",
        r"^творческая$",
        r"^выполнение$",
        r"^использование$",
        r"^заказать$",
        r"^информации$",
        r"^современность\)?$",
        r"^высокий уровень$",
        r"^третий уровень сложности\.?$",
    ]),

    # Service topics.
    ("service", "schedule", "manual_batch1: срок, объем или график обучения", [
        r"срок реализации программы",
        r"объем программы",
        r"длительность программы",
        r"кол(?:ич)?-?во учебных недель",
        r"количество учебных недель",
        r"учебн(ый|ых|ого) график",
        r"время (занятий|обучения)",
        r"период обучения",
        r"перерыв после первого часа",
        r"\b36 недель\b",
        r"\b18 учебных недель\b",
        r"\b45 мин\b",
        r"установленного периода обучения",
        r"количество обучающихся в группе",
        r"наполняемость",
    ]),
    ("service", "materials_equipment", "manual_batch1: оборудование или материалы", [
        r"накопитель",
        r"\bssd\b",
        r"стулья",
        r"столы",
        r"ноутбук",
        r"доска магнитно-маркерная",
        r"карандаши",
        r"ножницы",
        r"линейка",
        r"надфил",
        r"напильник",
        r"металлическ",
        r"инструменты:",
        r"яндекс\.телемост",
    ]),
    ("service", "assessment", "manual_batch1: контроль, оценивание или аттестация", [
        r"^промежуточн\w*\.?$",
        r"^предварительн\w*\.?$",
        r"^текущий\.?$",
        r"^устный\.?$",
        r"^практическое задание\.?$",
        r"максимальное количество баллов",
        r"соответствие требуемой структуре",
        r"наличия плана действий",
        r"качество презентации",
        r"новизна",
        r"актуальность",
        r"анализ существующих аналогов",
        r"техническая красота",
        r"выступление",
        r"вая аттес",
    ]),
    ("service", "intro_final", "manual_batch1: вводная или итоговая часть", [
        r"подведение работы объединения за год",
    ]),

    # Content topics.
    ("content", "robotics", "manual_batch1: модель или задание из робототехники/LEGO", [
        r"автоматическая (дверь|урна)",
        r"жучок",
        r"карусель",
        r"качели",
        r"лягушка",
        r"танцующие птицы",
        r"рычащий лев",
        r"голодный аллигатор",
        r"обезьянка-барабанщица",
        r"колесо обозрения",
        r"вездеход",
        r"динозавры",
        r"великан",
        r"машины будущего",
        r"старинные машины",
    ]),
    ("content", "technical_modeling", "manual_batch1: техническое моделирование и сборка моделей", [
        r"конструирование по замыслу",
        r"конструирование$",
        r"конструирование и",
        r"простое моделирование",
        r"моделирование на каркасах",
        r"конструкции",
        r"полезные приспособления",
        r"свободная сборка",
        r"создание модели",
        r"терминал для прохода",
        r"тяга",
    ]),
    ("content", "programming", "manual_batch1: программирование и логика программ", [
        r"блоки программы",
        r"лабиринт",
        r"интеллектуальное сумо",
    ]),
    ("content", "digital_design", "manual_batch1: рисунок, композиция или декоративная техника", [
        r"символика мира",
        r"тематический рисунок",
        r"рисунок\. живопись",
        r"фантазируй",
        r"наш двор",
        r"что нас окружает",
        r"день победы",
        r"техника оригами",
        r"косынка",
        r"домашние животные",
    ]),
    ("content", "media_animation", "manual_batch1: журналистика, речь или медиа", [
        r"культура речи журналиста",
    ]),
    ("content", "transport_safety", "manual_batch1: ПДД, транспорт или первая помощь", [
        r"проезд перекрестков",
        r"перекрестки",
        r"знаки регулировщика",
        r"регулировщик",
        r"знаки приоритета",
        r"запрещающие знаки",
        r"предупреждающие знаки",
        r"дорога,",
        r"дорож",
        r"юид",
        r"водителя",
        r"ожоги",
        r"первая помощь",
        r"кровотеч",
        r"повяз",
        r"наложение жгута",
        r"обморок",
        r"формы тб и пп",
        r"команды движения",
        r"переходы",
        r"движения и повороты",
    ]),
    ("content", "project_research", "manual_batch1: проектная подготовка или защита", [
        r"подготовка к защите",
        r"подготовка к соревнованиям",
        r"участие в соревнованиях",
        r"возможность реализации",
    ]),
    ("content", "engineering_science", "manual_batch1: естественнонаучная или медицинская база", [
        r"основы медицинских знаний",
        r"освещение",
    ]),
    ("content", "engineering_graphics", "manual_batch1: чертежи или инструментальные измерения", [
        r"линейка металлическая",
    ]),
]


def main() -> None:
    rows = read_rows(INPUT_PATH)
    annotated = []
    full_rows = []

    for row in rows:
        match = classify(row["normalized_topic_name"])
        updated = dict(row)
        if match:
            record_type, category_code, note = match
            updated["manual_record_type"] = record_type
            updated["manual_category_code"] = category_code
            updated["reviewer_note"] = note
            annotated.append(updated)
        full_rows.append(updated)

    write_rows(OUTPUT_PATH, annotated, rows[0].keys())
    write_rows(FULL_OUTPUT_PATH, full_rows, rows[0].keys())

    by_category = {}
    for row in annotated:
        key = (row["manual_record_type"], row["manual_category_code"])
        by_category[key] = by_category.get(key, 0) + 1

    print({
        "input_rows": len(rows),
        "annotated_rows": len(annotated),
        "output_path": str(OUTPUT_PATH),
        "full_output_path": str(FULL_OUTPUT_PATH),
        "by_category": {f"{key[0]}/{key[1]}": value for key, value in sorted(by_category.items())},
    })


def classify(topic: str) -> tuple[str, str, str] | None:
    normalized = normalize(topic)
    for record_type, category_code, note, patterns in RULES:
        if any(re.search(pattern, normalized, flags=re.IGNORECASE) for pattern in patterns):
            return record_type, category_code, note
    return None


def normalize(value: str) -> str:
    text = str(value or "").lower().replace("ё", "е")
    text = re.sub(r"[\u00a0\t\r\n]+", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def read_rows(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8", newline="") as file:
        return list(csv.DictReader(file))


def write_rows(path: Path, rows: list[dict], fieldnames) -> None:
    with path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=list(fieldnames))
        writer.writeheader()
        writer.writerows(rows)


if __name__ == "__main__":
    main()
