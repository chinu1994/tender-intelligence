"""
Document parsers: file -> list of ParsedParagraph (with page/paragraph numbers).

Pure functions. No database, no network, no AI. Safe to call from a
Celery task later.

Citation meaning per format:
  PDF   page = real page number,       paragraph = n-th text block on the page
  DOCX  page = None (Word has no fixed pages without rendering),
        paragraph = n-th paragraph/table row in the file
  XLSX  page = sheet number (1-based), paragraph = row number
"""
import re
import zipfile
from dataclasses import dataclass
from pathlib import Path

SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".xlsx"}

# ZIP safety limits (protect the server from zip bombs / path tricks)
MAX_ZIP_FILES = 500
MAX_ZIP_TOTAL_BYTES = 500 * 1024 * 1024  # 500 MB uncompressed


class DocumentParseError(Exception):
    """Human-readable parsing error (shown to the user as the failure reason)."""


@dataclass
class ParsedParagraph:
    text: str
    page: int | None
    paragraph: int


# ----------------------------------------------------------------------
# PDF
# ----------------------------------------------------------------------
def parse_pdf(path: Path) -> list[ParsedParagraph]:
    import pdfplumber

    paragraphs: list[ParsedParagraph] = []
    try:
        with pdfplumber.open(path) as pdf:
            for page_number, page in enumerate(pdf.pages, start=1):
                text = page.extract_text() or ""
                blocks = [b.strip() for b in re.split(r"\n\s*\n", text)]
                blocks = [re.sub(r"\s*\n\s*", " ", b) for b in blocks if b]

                for index, block in enumerate(blocks, start=1):
                    paragraphs.append(ParsedParagraph(block, page_number, index))
    except Exception as exc:  # pdfplumber raises many different errors
        raise DocumentParseError(
            f"Could not read this PDF. It may be corrupted or password protected. ({exc.__class__.__name__})"
        ) from exc

    if not paragraphs:
        raise DocumentParseError(
            "No text found in this PDF. It may be a scanned image (OCR is not enabled)."
        )
    return paragraphs


# ----------------------------------------------------------------------
# DOCX
# ----------------------------------------------------------------------
def parse_docx(path: Path) -> list[ParsedParagraph]:
    import docx

    try:
        document = docx.Document(str(path))
    except Exception as exc:
        raise DocumentParseError(
            f"Could not read this Word file. It may be corrupted. ({exc.__class__.__name__})"
        ) from exc

    paragraphs: list[ParsedParagraph] = []
    counter = 0

    for para in document.paragraphs:
        text = para.text.strip()
        if text:
            counter += 1
            paragraphs.append(ParsedParagraph(text, None, counter))

    for table in document.tables:
        for row in table.rows:
            cells = [c.text.strip() for c in row.cells if c.text.strip()]
            if cells:
                counter += 1
                paragraphs.append(ParsedParagraph(" | ".join(cells), None, counter))

    if not paragraphs:
        raise DocumentParseError("This Word file contains no text.")
    return paragraphs


# ----------------------------------------------------------------------
# XLSX
# ----------------------------------------------------------------------
def parse_xlsx(path: Path) -> list[ParsedParagraph]:
    import openpyxl

    try:
        workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
    except Exception as exc:
        raise DocumentParseError(
            f"Could not read this Excel file. It may be corrupted. ({exc.__class__.__name__})"
        ) from exc

    paragraphs: list[ParsedParagraph] = []
    for sheet_number, sheet in enumerate(workbook.worksheets, start=1):
        for row_number, row in enumerate(sheet.iter_rows(values_only=True), start=1):
            cells = [str(v).strip() for v in row if v is not None and str(v).strip()]
            if cells:
                text = f"[{sheet.title}] " + " | ".join(cells)
                paragraphs.append(ParsedParagraph(text, sheet_number, row_number))
    workbook.close()

    if not paragraphs:
        raise DocumentParseError("This Excel file contains no data.")
    return paragraphs


# ----------------------------------------------------------------------
# ZIP
# ----------------------------------------------------------------------
def unpack_zip(zip_path: Path, destination: Path) -> list[Path]:
    """
    Extract supported files from a ZIP into `destination`.
    Returns the list of extracted file paths.
    Blocks path traversal ("zip slip") and oversized archives.
    """
    destination.mkdir(parents=True, exist_ok=True)
    root = destination.resolve()
    extracted: list[Path] = []

    try:
        with zipfile.ZipFile(zip_path) as archive:
            infos = [i for i in archive.infolist() if not i.is_dir()]

            if len(infos) > MAX_ZIP_FILES:
                raise DocumentParseError(
                    f"This ZIP has too many files (limit {MAX_ZIP_FILES})."
                )
            if sum(i.file_size for i in infos) > MAX_ZIP_TOTAL_BYTES:
                raise DocumentParseError("This ZIP is too large when unpacked.")

            for info in infos:
                name = Path(info.filename).name  # flatten; drops folders
                if (
                    not name
                    or name.startswith(("._", "."))
                    or "__MACOSX" in info.filename
                    or Path(name).suffix.lower() not in SUPPORTED_EXTENSIONS
                ):
                    continue

                target = (root / name).resolve()
                if root not in target.parents:  # zip-slip guard
                    continue
                if target.exists():
                    target = target.with_stem(f"{target.stem}_{len(extracted)}")

                target.write_bytes(archive.read(info))
                extracted.append(target)
    except zipfile.BadZipFile as exc:
        raise DocumentParseError("This ZIP file is corrupted or not a valid ZIP.") from exc

    if not extracted:
        raise DocumentParseError(
            "No supported files (PDF, DOCX, XLSX) were found inside this ZIP."
        )
    return extracted


# ----------------------------------------------------------------------
# Dispatcher
# ----------------------------------------------------------------------
def parse_file(path: Path) -> list[ParsedParagraph]:
    extension = path.suffix.lower()

    if extension == ".pdf":
        return parse_pdf(path)
    if extension == ".docx":
        return parse_docx(path)
    if extension == ".xlsx":
        return parse_xlsx(path)

    raise DocumentParseError(
        f"File type '{extension or 'unknown'}' is not supported. Use PDF, DOCX, XLSX or ZIP."
    )
