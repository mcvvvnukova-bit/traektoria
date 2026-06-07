from __future__ import annotations

import sys

try:
    from pypdf import PdfReader
except Exception as exc:  # pragma: no cover
    raise SystemExit(f"pypdf import failed: {exc}") from exc


def main() -> int:
    if len(sys.argv) < 2:
        raise SystemExit("Usage: pdf_extract.py /absolute/path/to/file.pdf")

    path = sys.argv[1]
    reader = PdfReader(path)
    chunks = []
    for page in reader.pages:
        text = page.extract_text() or ""
        chunks.append(text)

    sys.stdout.write("\n".join(chunks))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
