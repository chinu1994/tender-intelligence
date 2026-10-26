"""Text extraction for tender documents (PDF, DOCX, XLSX) and ZIP unpacking.

Every parser returns ``ParsedParagraph`` items carrying citation metadata:

* PDF  -> ``page`` (1-based) and ``paragraph`` (1-based within the page)
* DOCX -> ``paragraph`` (1-based across body paragraphs and table rows)
* XLSX -> ``paragraph`` is the spreadsheet row number, ``sheet`` the sheet name

All failures are raised as ``DocumentParseError`` with a message that can be
shown to end users unchanged.
"""
from __future__ import annotations

import logging
import re
import uuid
import zipfile
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".xlsx"}

MAX_MEMBER_BYTES = 50 * 1024 * 1024
MAX_TOTAL_BYTES = 500 * 1024 * 1024
MAX_MEMBERS = 500
MAX_COMPRESSION_RATIO = 200  # zip-bomb guard


class DocumentParseError(Exception):
    """A document could not be processed. ``str(exc)`` is user-presentable."""


@dataclass(frozen=True)
class ParsedParagraph:
    text: str
    page: int | None
    paragraph: int
    sheet: str | None = None


# --------------------------------------------------------------------------
# PDF
# --------------------------------------------------------------------------

_SENTENCE_END = re.compile(r"[.:;!?)\]]\s*$")
_BULLET_START = re.compile(r"^\s*(?:[-•▪●*]|\(?[0-9]{1,3}[.)]|\(?[a-zA-Z][.)])\s+")


_CONTINUATION_END = re.compile(r"(?:[,\-/&(]|\b(?:and|or|of|the|a|an|to|in|for|with|by|on|at))$", re.IGNORECASE)


def _looks_like_heading(line: str, next_line: str, lines_in_paragraph: int) -> bool:
    """A short, unpunctuated single line followed by a capitalised line."""
    return (
        lines_in_paragraph == 1
        and len(line) <= 70
        and bool(next_line)
        and next_line[:1].isupper()
        and not _CONTINUATION_END.search(line)
    )


def split_pdf_page_into_paragraphs(text: str) -> list[str]:
    """Group raw PDF text lines into paragraphs.

    PDF text extraction yields visual lines. Blank lines always separate
    paragraphs; otherwise a line that ends a sentence, or a line followed by a
    bullet/numbered item, closes the current paragraph.
    """
    paragraphs: list[str] = []
    current: list[str] = []

    def flush() -> None:
        if current:
            joined = re.sub(r"\s+", " ", " ".join(current)).strip()
            if joined:
                paragraphs.append(joined)
            current.clear()

    lines = text.replace("\r", "\n").split("\n")
    for index, raw in enumerate(lines):
        line = raw.strip()
        if not line:
            flush()
            continue
        if current and _BULLET_START.match(line):
            flush()
        current.append(line)
        next_line = lines[index + 1].strip() if index + 1 < len(lines) else ""
        if (
            _SENTENCE_END.search(line)
            or (next_line and _BULLET_START.match(next_line))
            or _looks_like_heading(line, next_line, len(current))
        ):
            flush()
    flush()
    return paragraphs


def parse_pdf(path: Path) -> list[ParsedParagraph]:
    from pypdf import PdfReader
    from pypdf.errors import PdfReadError

    try:
        reader = PdfReader(str(path))
        if reader.is_encrypted:
            try:
                if not reader.decrypt(""):
                    raise DocumentParseError(
                        "The PDF is password-protected. Remove the password and upload it again."
                    )
            except DocumentParseError:
                raise
            except Exception as exc:
                raise DocumentParseError(
                    "The PDF is password-protected. Remove the password and upload it again."
                ) from exc

        result: list[ParsedParagraph] = []
        for page_number, page in enumerate(reader.pages, start=1):
            text = page.extract_text() or ""
            for paragraph_number, paragraph in enumerate(
                split_pdf_page_into_paragraphs(text), start=1
            ):
                result.append(ParsedParagraph(paragraph, page_number, paragraph_number))
    except DocumentParseError:
        raise
    except (PdfReadError, ValueError, KeyError, TypeError, OSError) as exc:
        logger.info("PDF parse failure for %s: %s", path.name, exc)
        raise DocumentParseError(
            "The file could not be read as a PDF. It may be corrupted or not a real PDF document."
        ) from exc

    if not result:
        raise DocumentParseError(
            "No extractable text was found in the PDF. It may be a scanned image; "
            "OCR is not supported yet, so please upload a text-based PDF."
        )
    return result


# --------------------------------------------------------------------------
# DOCX
# --------------------------------------------------------------------------


def parse_docx(path: Path) -> list[ParsedParagraph]:
    import docx
    from docx.document import Document as _Doc
    from docx.table import Table
    from docx.text.paragraph import Paragraph

    try:
        document: _Doc = docx.Document(str(path))
    except Exception as exc:
        logger.info("DOCX parse failure for %s: %s", path.name, exc)
        raise DocumentParseError(
            "The file could not be read as a Word (DOCX) document. It may be corrupted, "
            "password-protected, or saved in the older .doc format."
        ) from exc

    result: list[ParsedParagraph] = []
    counter = 0

    def add(text: str) -> None:
        nonlocal counter
        text = re.sub(r"\s+", " ", text).strip()
        if text:
            counter += 1
            result.append(ParsedParagraph(text, None, counter))

    # Walk the body in document order so tables keep their position.
    body = document.element.body
    for child in body.iterchildren():
        tag = child.tag.rsplit("}", 1)[-1]
        if tag == "p":
            add(Paragraph(child, document).text)
        elif tag == "tbl":
            table = Table(child, document)
            for row in table.rows:
                cells: list[str] = []
                for cell in row.cells:
                    value = cell.text.strip()
                    # merged cells repeat; keep each value once per row
                    if value and (not cells or cells[-1] != value):
                        cells.append(value)
                if cells:
                    add(" | ".join(cells))

    if not result:
        raise DocumentParseError("The Word document does not contain any text.")
    return result


# --------------------------------------------------------------------------
# XLSX
# --------------------------------------------------------------------------


def _cell_to_text(value) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value).strip()


def parse_xlsx(path: Path) -> list[ParsedParagraph]:
    from openpyxl import load_workbook

    try:
        workbook = load_workbook(filename=str(path), read_only=True, data_only=True)
    except Exception as exc:
        logger.info("XLSX parse failure for %s: %s", path.name, exc)
        raise DocumentParseError(
            "The file could not be read as an Excel (XLSX) workbook. It may be corrupted, "
            "password-protected, or saved in the older .xls format."
        ) from exc

    result: list[ParsedParagraph] = []
    try:
        for worksheet in workbook.worksheets:
            for row_number, row in enumerate(worksheet.iter_rows(values_only=True), start=1):
                values = [text for text in (_cell_to_text(v) for v in row) if text]
                if not values:
                    continue
                result.append(
                    ParsedParagraph(
                        text=f"{worksheet.title}: " + " | ".join(values),
                        page=None,
                        paragraph=row_number,
                        sheet=worksheet.title,
                    )
                )
    finally:
        workbook.close()

    if not result:
        raise DocumentParseError("The Excel workbook does not contain any data.")
    return result


# --------------------------------------------------------------------------
# Dispatch
# --------------------------------------------------------------------------

_PARSERS = {".pdf": parse_pdf, ".docx": parse_docx, ".xlsx": parse_xlsx}


def parse_file(path: Path, file_type: str | None = None) -> list[ParsedParagraph]:
    """Extract paragraphs from a PDF, DOCX or XLSX file."""
    path = Path(path)
    extension = f".{file_type.lower().lstrip('.')}" if file_type else path.suffix.lower()
    parser = _PARSERS.get(extension)
    if parser is None:
        raise DocumentParseError(
            f"Unsupported file type '{extension or 'unknown'}'. Supported types: PDF, DOCX, XLSX, ZIP."
        )
    if not path.exists():
        raise DocumentParseError("The stored file could not be found. Please upload it again.")
    if path.stat().st_size == 0:
        raise DocumentParseError("The file is empty.")
    return parser(path)


# --------------------------------------------------------------------------
# ZIP
# --------------------------------------------------------------------------


def _safe_member_name(member_name: str) -> str:
    """Flatten an archive path to a bare, safe file name (zip-slip proof)."""
    name = member_name.replace("\\", "/").rsplit("/", 1)[-1]
    name = re.sub(r"[\x00-\x1f]", "", name).strip()
    if name in {"", ".", ".."}:
        return ""
    if len(name.encode("utf-8")) > 200:  # stay well below filesystem limits
        stem, dot, suffix = name.rpartition(".")
        stem = stem.encode("utf-8")[:180].decode("utf-8", "ignore")
        name = f"{stem}{dot}{suffix}" if dot else stem
    return name


def unpack_zip(
    zip_path: Path,
    output_dir: Path,
    *,
    max_members: int = MAX_MEMBERS,
    max_member_bytes: int = MAX_MEMBER_BYTES,
    max_total_bytes: int = MAX_TOTAL_BYTES,
) -> list[Path]:
    """Extract supported files from ``zip_path`` into ``output_dir``.

    Directory structure is flattened and each file gets a unique prefix, so no
    archive entry can escape ``output_dir`` (zip-slip) or overwrite another.
    Unsupported entries (and nested archives) are ignored. Returns the paths
    of extracted files in archive order; their original names are available
    via ``original_name(path)``.
    """
    output_dir = Path(output_dir).resolve()
    try:
        archive = zipfile.ZipFile(zip_path)
    except (zipfile.BadZipFile, OSError) as exc:
        raise DocumentParseError(
            "The file is not a valid ZIP archive or it is corrupted."
        ) from exc

    extracted: list[Path] = []
    try:
        _extract_members(archive, output_dir, extracted, max_members, max_member_bytes, max_total_bytes)
    except Exception:
        # Do not leave a partial extraction behind.
        for path in extracted:
            path.unlink(missing_ok=True)
        raise
    return extracted


def _extract_members(archive, output_dir, extracted, max_members, max_member_bytes, max_total_bytes) -> None:
    with archive:
        members = [m for m in archive.infolist() if not m.is_dir()]
        if len(members) > max_members:
            raise DocumentParseError(
                f"The ZIP archive contains {len(members)} files; the limit is {max_members}."
            )
        total = 0
        for member in members:
            if member.flag_bits & 0x1:
                raise DocumentParseError(
                    "The ZIP archive is password-protected. Upload an unencrypted archive."
                )
            name = _safe_member_name(member.filename)
            if not name or name.startswith("._") or "__MACOSX" in member.filename:
                continue
            if Path(name).suffix.lower() not in SUPPORTED_EXTENSIONS:
                continue
            if member.file_size > max_member_bytes:
                raise DocumentParseError(
                    f"'{name}' inside the ZIP archive exceeds the "
                    f"{max_member_bytes // (1024 * 1024)} MB per-file limit."
                )
            if member.compress_size and member.file_size / member.compress_size > MAX_COMPRESSION_RATIO:
                raise DocumentParseError(
                    f"'{name}' inside the ZIP archive has a suspicious compression ratio and was rejected."
                )
            total += member.file_size
            if total > max_total_bytes:
                raise DocumentParseError(
                    "The ZIP archive expands beyond the "
                    f"{max_total_bytes // (1024 * 1024)} MB total size limit."
                )

            output_dir.mkdir(parents=True, exist_ok=True)
            destination = (output_dir / f"{uuid.uuid4().hex[:12]}_{name}").resolve()
            if destination.parent != output_dir:  # defence in depth
                continue
            written = 0
            try:
                with archive.open(member) as source, destination.open("wb") as target:
                    while True:
                        block = source.read(1024 * 1024)
                        if not block:
                            break
                        written += len(block)
                        if written > max_member_bytes:
                            raise DocumentParseError(
                                f"'{name}' inside the ZIP archive exceeds the size limit."
                            )
                        target.write(block)
            except DocumentParseError:
                destination.unlink(missing_ok=True)
                raise
            except (zipfile.BadZipFile, OSError, RuntimeError) as exc:
                destination.unlink(missing_ok=True)
                raise DocumentParseError(
                    f"'{name}' could not be extracted from the ZIP archive; the archive may be corrupted."
                ) from exc
            extracted.append(destination)


def original_name(extracted_path: Path) -> str:
    """Original file name of a path produced by ``unpack_zip``."""
    name = Path(extracted_path).name
    prefix, sep, rest = name.partition("_")
    return rest if sep and len(prefix) == 12 else name
