from __future__ import annotations

import base64
import csv
import json
import os
import subprocess
import tempfile
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = BASE_DIR / "exports" / "ручная разметка тем технической направленности batch1.csv"
DATABASE_URL = os.environ.get("PFDO_MIRROR_DATABASE_URL", "postgresql://localhost:5432/pfdo_51_mirror")
PSQL_BIN = os.environ.get("PSQL_BIN", f"{Path.home()}/Applications/Postgres.app/Contents/Versions/latest/bin/psql")


def main() -> None:
    input_path = Path(os.environ.get("PFDO_TOPIC_MANUAL_MARKUP_CSV", DEFAULT_INPUT))
    rows = read_rows(input_path)
    if not rows:
        print({"input_path": str(input_path), "updated_rows": 0})
        return

    temp_csv = write_temp_csv(rows)
    sql = f"""
CREATE TEMP TABLE manual_topic_markup_import (
  portal_url TEXT NOT NULL,
  normalized_topic_name TEXT NOT NULL,
  manual_record_type TEXT NOT NULL,
  manual_category_code TEXT NOT NULL,
  reviewer_note TEXT
);

\\copy manual_topic_markup_import FROM '{temp_csv}' WITH CSV HEADER

UPDATE pfdo_program_topic_review_queue
SET
  manual_record_type = NULL,
  manual_category_code = NULL,
  manual_category_name = NULL,
  reviewer_note = NULL,
  reviewed_by = NULL,
  reviewed_at = NULL,
  review_status = 'pending'
WHERE reviewed_by = 'codex'
  AND reviewer_note LIKE 'manual_batch1:%';

DELETE FROM pfdo_topic_classifier_golden_labels
WHERE source = 'codex_batch1';

UPDATE pfdo_program_topic_review_queue q
SET
  manual_record_type = m.manual_record_type,
  manual_category_code = m.manual_category_code,
  manual_category_name = COALESCE(category_names.category_name, m.manual_category_code),
  reviewer_note = m.reviewer_note,
  reviewed_by = 'codex',
  reviewed_at = NOW(),
  review_status = 'reviewed'
FROM manual_topic_markup_import m
JOIN pfdo_programs p ON p.source_url = m.portal_url
LEFT JOIN (
  VALUES
    ('content','programming','Программирование и алгоритмы'),
    ('content','robotics','Робототехника и LEGO'),
    ('content','electronics','Электроника, схемотехника и Arduino'),
    ('content','web','Веб-разработка'),
    ('content','games_apps','Разработка игр и приложений'),
    ('content','cad_3d','3D-моделирование и печать'),
    ('content','engineering_graphics','САПР, черчение и инженерная графика'),
    ('content','technical_modeling','Техническое моделирование и механизмы'),
    ('content','digital_design','Графический и цифровой дизайн'),
    ('content','media_animation','Медиа, фото, видео и анимация'),
    ('content','data_ai','Данные, базы данных и искусственный интеллект'),
    ('content','networks_security','Интернет, сети и цифровая безопасность'),
    ('content','math_logic','Математика, логика и олимпиадные задачи'),
    ('content','engineering_science','Инженерные и естественнонаучные основы'),
    ('content','transport_safety','ПДД, транспорт и первая помощь'),
    ('content','project_research','Проектная и исследовательская деятельность'),
    ('service','intro_final','Вводные, повторение и итоговые занятия'),
    ('service','assessment','Диагностика, контроль и аттестация'),
    ('service','methods','Формы занятий и методики'),
    ('service','schedule','Организация занятий и учебный график'),
    ('service','materials_equipment','Оборудование, материалы и источники'),
    ('noise','ocr_noise','OCR/табличный шум'),
    ('noise','too_generic','Слишком общая тема'),
    ('noise','toc_fragment','Фрагмент оглавления'),
    ('noise','location_fragment','Место проведения или кабинет'),
    ('noise','unknown','Не удалось классифицировать')
) AS category_names(record_type, category_code, category_name)
  ON category_names.record_type = m.manual_record_type
 AND category_names.category_code = m.manual_category_code
WHERE q.program_id = p.id
  AND q.normalized_topic_name = m.normalized_topic_name;

UPDATE pfdo_program_topic_classifications c
SET review_status = 'reviewed'
FROM pfdo_program_topic_review_queue q
WHERE q.classification_id = c.id
  AND q.review_status = 'reviewed'
  AND q.reviewed_by = 'codex'
  AND q.reviewer_note LIKE 'manual_batch1:%';

INSERT INTO pfdo_topic_classifier_golden_labels (
  normalized_topic_name,
  context_text,
  record_type,
  category_code,
  category_name,
  source,
  notes
)
SELECT DISTINCT
  m.normalized_topic_name,
  p.search_name,
  m.manual_record_type,
  m.manual_category_code,
  COALESCE(category_names.category_name, m.manual_category_code),
  'codex_batch1',
  m.reviewer_note
FROM manual_topic_markup_import m
JOIN pfdo_programs p ON p.source_url = m.portal_url
LEFT JOIN (
  VALUES
    ('content','programming','Программирование и алгоритмы'),
    ('content','robotics','Робототехника и LEGO'),
    ('content','electronics','Электроника, схемотехника и Arduino'),
    ('content','web','Веб-разработка'),
    ('content','games_apps','Разработка игр и приложений'),
    ('content','cad_3d','3D-моделирование и печать'),
    ('content','engineering_graphics','САПР, черчение и инженерная графика'),
    ('content','technical_modeling','Техническое моделирование и механизмы'),
    ('content','digital_design','Графический и цифровой дизайн'),
    ('content','media_animation','Медиа, фото, видео и анимация'),
    ('content','data_ai','Данные, базы данных и искусственный интеллект'),
    ('content','networks_security','Интернет, сети и цифровая безопасность'),
    ('content','math_logic','Математика, логика и олимпиадные задачи'),
    ('content','engineering_science','Инженерные и естественнонаучные основы'),
    ('content','transport_safety','ПДД, транспорт и первая помощь'),
    ('content','project_research','Проектная и исследовательская деятельность'),
    ('service','intro_final','Вводные, повторение и итоговые занятия'),
    ('service','assessment','Диагностика, контроль и аттестация'),
    ('service','methods','Формы занятий и методики'),
    ('service','schedule','Организация занятий и учебный график'),
    ('service','materials_equipment','Оборудование, материалы и источники'),
    ('noise','ocr_noise','OCR/табличный шум'),
    ('noise','too_generic','Слишком общая тема'),
    ('noise','toc_fragment','Фрагмент оглавления'),
    ('noise','location_fragment','Место проведения или кабинет'),
    ('noise','unknown','Не удалось классифицировать')
) AS category_names(record_type, category_code, category_name)
  ON category_names.record_type = m.manual_record_type
 AND category_names.category_code = m.manual_category_code
ON CONFLICT DO NOTHING;
"""
    run_psql(sql)
    temp_csv.unlink(missing_ok=True)
    print({"input_path": str(input_path), "updated_rows": len(rows)})


def read_rows(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8", newline="") as file:
        rows = []
        for row in csv.DictReader(file):
            if row.get("manual_record_type") and row.get("manual_category_code"):
                rows.append(row)
        return rows


def write_temp_csv(rows: list[dict]) -> Path:
    handle = tempfile.NamedTemporaryFile("w", encoding="utf-8", newline="", delete=False, suffix=".csv")
    path = Path(handle.name)
    with handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["portal_url", "normalized_topic_name", "manual_record_type", "manual_category_code", "reviewer_note"],
        )
        writer.writeheader()
        for row in rows:
            writer.writerow({
                "portal_url": row["portal_url"],
                "normalized_topic_name": row["normalized_topic_name"],
                "manual_record_type": row["manual_record_type"],
                "manual_category_code": row["manual_category_code"],
                "reviewer_note": row.get("reviewer_note", ""),
            })
    return path


def run_psql(sql: str) -> None:
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False, suffix=".sql") as handle:
        sql_path = Path(handle.name)
        handle.write(sql)
    try:
        subprocess.run([PSQL_BIN, DATABASE_URL, "-X", "-v", "ON_ERROR_STOP=1", "-q", "-f", str(sql_path)], check=True)
    finally:
        sql_path.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
