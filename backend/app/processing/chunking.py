"""Split parsed paragraphs into retrieval chunks that keep their citations."""
from __future__ import annotations

import re
from dataclasses import dataclass

from app.processing.parsers import ParsedParagraph

_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")

CHUNK_SIZE = 1200
CHUNK_OVERLAP = 200


@dataclass(frozen=True)
class TextChunk:
    text: str
    page_number: int | None
    paragraph_number: int | None
    document_name: str = ""


def _split_long(text: str) -> list[str]:
    if len(text) <= CHUNK_SIZE:
        return [text]
    pieces: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + CHUNK_SIZE, len(text))
        if end < len(text):
            # prefer to break on whitespace
            space = text.rfind(" ", start + CHUNK_SIZE // 2, end)
            if space > start:
                end = space
        piece = text[start:end].strip()
        if piece:
            pieces.append(piece)
        if end >= len(text):
            break
        start = max(end - CHUNK_OVERLAP, start + 1)
    return pieces


def chunk_paragraphs(
    paragraphs: list[ParsedParagraph],
    document_name: str = "",
) -> list[TextChunk]:
    """One chunk per paragraph (long paragraphs are split with overlap).

    Keeping chunks paragraph-aligned means every search hit and extracted
    requirement can cite an exact page/paragraph (or spreadsheet row).
    """
    chunks: list[TextChunk] = []
    for paragraph in paragraphs:
        text = _CONTROL_CHARS.sub("", paragraph.text).strip()
        if not text:
            continue
        for piece in _split_long(text):
            chunks.append(
                TextChunk(
                    text=piece,
                    page_number=paragraph.page,
                    paragraph_number=paragraph.paragraph,
                    document_name=document_name,
                )
            )
    return chunks
