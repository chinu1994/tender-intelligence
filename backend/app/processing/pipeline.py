"""
High-level helper: file on disk -> list[DocumentChunk].

ZIPs are unpacked; every child file is parsed. A failure in one child does
not stop the others (the error is returned so the UI can show it).
"""
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

from app.ai.schemas import DocumentChunk
from app.processing.chunker import chunk_paragraphs
from app.processing.parsers import DocumentParseError, parse_file, unpack_zip


@dataclass
class FileResult:
    file_name: str
    chunks: list[DocumentChunk] = field(default_factory=list)
    error: str | None = None  # human-readable


def process_file(path: Path, *, document_id: str) -> list[FileResult]:
    if path.suffix.lower() == ".zip":
        results: list[FileResult] = []
        with tempfile.TemporaryDirectory() as tmp:
            try:
                children = unpack_zip(path, Path(tmp))
            except DocumentParseError as exc:
                return [FileResult(path.name, error=str(exc))]

            for index, child in enumerate(children, start=1):
                results.append(
                    _process_single(child, document_id=f"{document_id}-{index}")
                )
        return results

    return [_process_single(path, document_id=document_id)]


def _process_single(path: Path, *, document_id: str) -> FileResult:
    try:
        paragraphs = parse_file(path)
        chunks = chunk_paragraphs(
            paragraphs, document_id=document_id, document_name=path.name
        )
        return FileResult(path.name, chunks=chunks)
    except DocumentParseError as exc:
        return FileResult(path.name, error=str(exc))
