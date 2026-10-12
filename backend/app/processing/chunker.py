"""
Paragraphs -> DocumentChunk list (the common input format of the AI layer).

Rules:
- Very short paragraphs (headings like "3. Evidence") are joined with the
  next paragraph on the same page so the heading is not lost.
- Paragraphs longer than max_chars are split at sentence boundaries.
- Every chunk keeps the document name + page + paragraph number, so every
  AI / search result can show a visible source reference.
- chunk_id is deterministic: re-indexing the same file gives the same ids.
"""
import re

from app.ai.schemas import DocumentChunk
from app.processing.parsers import ParsedParagraph

SHORT_PARAGRAPH_CHARS = 60
_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")


def _split_long(text: str, max_chars: int) -> list[str]:
    if len(text) <= max_chars:
        return [text]

    parts: list[str] = []
    current = ""
    for sentence in _SENTENCE_SPLIT.split(text):
        # a single huge "sentence": hard-cut it
        while len(sentence) > max_chars:
            if current:
                parts.append(current)
                current = ""
            parts.append(sentence[:max_chars])
            sentence = sentence[max_chars:]

        if current and len(current) + 1 + len(sentence) > max_chars:
            parts.append(current)
            current = sentence
        else:
            current = f"{current} {sentence}".strip()

    if current:
        parts.append(current)
    return parts


def chunk_paragraphs(
    paragraphs: list[ParsedParagraph],
    *,
    document_id: str,
    document_name: str,
    max_chars: int = 1000,
) -> list[DocumentChunk]:
    # 1) join short heading-like paragraphs with the next one (same page)
    merged: list[ParsedParagraph] = []
    carry: ParsedParagraph | None = None

    for para in paragraphs:
        if carry is not None:
            if carry.page == para.page:
                para = ParsedParagraph(
                    f"{carry.text} {para.text}", para.page, para.paragraph
                )
            else:
                merged.append(carry)  # nothing to join with, keep alone
            carry = None

        if len(para.text) < SHORT_PARAGRAPH_CHARS:
            carry = para
        else:
            merged.append(para)

    if carry is not None:
        merged.append(carry)

    # 2) split long ones and build chunks
    chunks: list[DocumentChunk] = []
    for para in merged:
        pieces = _split_long(para.text, max_chars)
        for part_index, piece in enumerate(pieces):
            suffix = f"-{part_index}" if len(pieces) > 1 else ""
            chunks.append(
                DocumentChunk(
                    chunk_id=f"{document_id}:p{para.page or 0}:n{para.paragraph}{suffix}",
                    document_id=document_id,
                    document_name=document_name,
                    text=piece,
                    page_number=para.page,
                    paragraph_number=para.paragraph,
                )
            )
    return chunks
