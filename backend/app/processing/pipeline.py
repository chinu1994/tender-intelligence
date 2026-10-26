"""Storage-independent processing pipeline: file -> parsed, cited chunks.

Used by the Celery tasks and directly testable without a database.
"""
from __future__ import annotations

import logging
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

from app.processing.chunking import TextChunk, chunk_paragraphs
from app.processing.parsers import (
    DocumentParseError,
    original_name,
    parse_file,
    unpack_zip,
)

logger = logging.getLogger(__name__)

GENERIC_ERROR = (
    "An unexpected error occurred while processing this document. "
    "Please retry; if the problem persists, contact support."
)


@dataclass
class FileResult:
    document_id: str
    file_name: str
    chunks: list[TextChunk] = field(default_factory=list)
    error: str | None = None


def readable_error(exc: Exception) -> str:
    if isinstance(exc, DocumentParseError):
        return str(exc)
    logger.exception("Unexpected document processing failure", exc_info=exc)
    return GENERIC_ERROR


def process_single_file(path: Path, *, document_id: str, file_name: str | None = None,
                        file_type: str | None = None) -> FileResult:
    name = file_name or Path(path).name
    try:
        paragraphs = parse_file(Path(path), file_type)
        return FileResult(document_id, name, chunk_paragraphs(paragraphs, name))
    except Exception as exc:  # noqa: BLE001 - converted to a readable message
        return FileResult(document_id, name, [], readable_error(exc))


def process_file(path: Path, *, document_id: str, work_dir: Path | None = None) -> list[FileResult]:
    """Process a PDF/DOCX/XLSX file, or every supported file inside a ZIP."""
    path = Path(path)
    if path.suffix.lower() != ".zip":
        return [process_single_file(path, document_id=document_id)]

    with tempfile.TemporaryDirectory(dir=work_dir) as tmp:
        try:
            members = unpack_zip(path, Path(tmp))
        except Exception as exc:  # noqa: BLE001
            return [FileResult(document_id, path.name, [], readable_error(exc))]
        if not members:
            return [FileResult(
                document_id, path.name, [],
                "The ZIP archive does not contain any supported PDF, DOCX or XLSX files.",
            )]
        return [
            process_single_file(member, document_id=f"{document_id}:{index}",
                                file_name=original_name(member))
            for index, member in enumerate(members)
        ]
