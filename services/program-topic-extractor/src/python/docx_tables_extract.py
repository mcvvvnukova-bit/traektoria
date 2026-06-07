from __future__ import annotations

import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path


NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: docx_tables_extract.py /absolute/path/to/file.docx")

    document_path = Path(sys.argv[1])
    if not document_path.exists():
        raise SystemExit(f"File not found: {document_path}")

    with zipfile.ZipFile(document_path) as archive:
        xml_bytes = archive.read("word/document.xml")

    root = ET.fromstring(xml_bytes)
    table_count = 0

    for table in root.findall(".//w:tbl", NS):
        rows = []
        for row in table.findall("./w:tr", NS):
            cells = [normalize(cell_text(cell)) for cell in row.findall("./w:tc", NS)]
            if any(cells):
                rows.append(cells)

        if not rows:
            continue

        table_count += 1
        print(f"STRUCTURED_DOCX_TABLE_BEGIN {table_count}")
        for cells in rows:
            safe_cells = [cell.replace("||", "/").strip() for cell in cells]
            print("TABLE_ROW || " + " || ".join(safe_cells))
        print("STRUCTURED_DOCX_TABLE_END")


def cell_text(cell: ET.Element) -> str:
    paragraphs = []
    for paragraph in cell.findall(".//w:p", NS):
        parts = []
        for node in paragraph.iter():
            tag = strip_namespace(node.tag)
            if tag == "t" and node.text:
                parts.append(node.text)
            elif tag == "tab":
                parts.append(" ")
            elif tag == "br":
                parts.append(" ")
        text = normalize("".join(parts))
        if text:
            paragraphs.append(text)
    return " ".join(paragraphs)


def strip_namespace(tag: str) -> str:
    if "}" in tag:
        return tag.rsplit("}", 1)[1]
    return tag


def normalize(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "").replace("\u00a0", " ")).strip()


if __name__ == "__main__":
    main()
