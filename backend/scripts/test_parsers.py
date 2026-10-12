"""
Terminal check for parsers + chunker.

    python scripts/test_parsers.py /path/to/tender.pdf
    python scripts/test_parsers.py /path/to/package.zip
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.processing.pipeline import process_file


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python scripts/test_parsers.py <file.pdf|docx|xlsx|zip>")
        return 1

    path = Path(sys.argv[1])
    failed = False
    for res in process_file(path, document_id="demo"):
        if res.error:
            failed = True
            print(f"FAILED  {res.file_name}: {res.error}")
            continue
        print(f"OK      {res.file_name}: {len(res.chunks)} chunks")
        for c in res.chunks[:3]:
            print(f"   page={c.page_number} para={c.paragraph_number} | {c.text[:80]!r}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
