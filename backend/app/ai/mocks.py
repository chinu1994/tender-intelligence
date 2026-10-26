"""Deterministic mock/fixture adapters for local development and automated tests.

No network access, no API keys. Outputs are stable for identical inputs so
tests are repeatable.

* ``MockLLMProvider`` uses transparent keyword/regex heuristics to classify
  tender paragraphs into the structured extraction schema (deadlines, lots,
  mandatory requirements, evaluation criteria, evidence, document references).
* ``MockEmbeddingProvider`` uses feature hashing of normalised words and
  bigrams. It is not a neural model, but texts that share vocabulary are
  closer than unrelated texts, which makes similarity search behave sensibly
  in demos and tests.
* ``MockVectorRetriever`` serves a small in-memory, tenant-partitioned fixture.
"""
from __future__ import annotations

import hashlib
import math
import re

from app.ai.interfaces import (
    EmbeddingProviderInterface,
    LLMProviderInterface,
    VectorRetrieverInterface,
)
from app.ai.schemas import (
    DraftRequest,
    DraftResult,
    EmbeddingRequest,
    EmbeddingResult,
    ExtractedRequirement,
    ExtractionRequest,
    ExtractionResult,
    SourceReference,
    VectorSearchRequest,
    VectorSearchResponse,
    VectorSearchResult,
)
from app.core.constants import EMBEDDING_DIMENSION

# ---------------------------------------------------------------------------
# Extraction heuristics
# ---------------------------------------------------------------------------

_MONTHS = (
    "january|february|march|april|may|june|july|august|september|october|november|december|"
    "jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec"
)
DATE_PATTERN = re.compile(
    rf"\b(?:\d{{1,2}}(?:st|nd|rd|th)?\s+(?:{_MONTHS})\.?,?\s+\d{{4}}"
    rf"|(?:{_MONTHS})\.?\s+\d{{1,2}}(?:st|nd|rd|th)?,?\s+\d{{4}}"
    r"|\d{4}-\d{2}-\d{2}"
    r"|\d{1,2}[./]\d{1,2}[./]\d{4})"
    r"(?:,?\s+(?:at\s+)?\d{1,2}[:.]\d{2}\s*(?:hrs|h|am|pm|cet|cest|utc|gmt|ist)?)?",
    re.IGNORECASE,
)
DEADLINE_WORDS = (
    "deadline", "due date", "submit by", "closing date", "submission date",
    "no later than", "not later than", "latest by", "must be received by",
    "must be submitted by", "clarification questions", "validity period",
)
EVALUATION_WORDS = (
    "evaluation", "evaluated", "award criteri", "scoring", "weighting", "weighted",
    "criterion", "criteria", "points will be", "most economically advantageous",
)
LOT_PATTERN = re.compile(r"\b(lot|bundle|package)\s*(?:no\.?|number|#)?\s*([0-9]{1,3}|[A-Z])\b", re.IGNORECASE)
EVIDENCE_WORDS = (
    "evidence", "certificate", "certification", "insurance", "registration",
    "proof of", "attach", "enclose", "provide a copy", "copy of", "reference letter",
    "references from", "curriculum vitae", " cv", "financial statement", "audited accounts",
    "declaration", "statement of",
)
DOC_REF_PATTERN = re.compile(
    r"\b(?:appendix|annex|annexure|schedule|attachment|exhibit|form)\s+(?:[A-Z]|[0-9]{1,3}|[IVX]{1,4})\b"
    r"|\b[\w-]+\.(?:pdf|docx|xlsx)\b",
    re.IGNORECASE,
)
MANDATORY_WORDS = (
    "must", "shall", "mandatory", "required", "obligatory", "is required to",
    "will be excluded", "will be disqualified", "minimum requirement", "requirement:",
)
WEIGHT_PATTERN = re.compile(r"\b(\d{1,3}(?:\.\d+)?)\s?(?:%|percent\b|points\b)(?!\w)", re.IGNORECASE)


def find_weights(text: str) -> str | None:
    weights = [m.group(0).replace(" ", "") for m in WEIGHT_PATTERN.finditer(text)]
    return ", ".join(dict.fromkeys(weights)) or None


def _has_any(lowered: str, words: tuple[str, ...]) -> bool:
    return any(word in lowered for word in words)


def _has_word(lowered: str, words: tuple[str, ...]) -> bool:
    return any(re.search(rf"\b{re.escape(word.strip())}\b", lowered) for word in words)


def classify_text(text: str) -> ExtractedRequirement | None:
    """Classify one paragraph. Returns ``None`` for non-requirement text."""
    text = text.strip()
    if len(text) < 12 or not re.search(r"[A-Za-z]{3}", text):
        return None
    lowered = text.lower()

    date_match = DATE_PATTERN.search(text)
    is_deadline = _has_any(lowered, DEADLINE_WORDS)
    is_evaluation = _has_any(lowered, EVALUATION_WORDS)
    lot_match = LOT_PATTERN.search(text)
    is_evidence = _has_any(lowered, EVIDENCE_WORDS)
    doc_refs = list(dict.fromkeys(m.group(0).strip() for m in DOC_REF_PATTERN.finditer(text)))
    is_mandatory_language = _has_word(lowered, MANDATORY_WORDS) or "requirement:" in lowered

    if is_deadline:
        category, confidence = "deadline", 0.9 if date_match else 0.7
    elif is_evaluation:
        category, confidence = "evaluation", 0.85
    elif lot_match:
        category, confidence = "lots", 0.85
    elif is_evidence:
        category, confidence = "evidence", 0.9
    elif is_mandatory_language:
        category, confidence = "mandatory", 0.9
    elif doc_refs:
        category, confidence = "document_reference", 0.8
    else:
        return None

    deadline_value = None
    if category == "deadline":
        if date_match:
            deadline_value = date_match.group(0).strip()
        else:
            keyword_match = re.search(
                r"(?:deadline|due date|closing date|submit by|submission date)[:\s-]{0,12}([^.;\n]{3,80})",
                text,
                re.IGNORECASE,
            )
            deadline_value = keyword_match.group(1).strip() if keyword_match else None

    lot_bundle = None
    if lot_match:
        lot_bundle = f"{lot_match.group(1).capitalize()} {lot_match.group(2).upper()}"

    evaluation = None
    if category == "evaluation":
        evaluation = text

    return ExtractedRequirement(
        requirement=text,
        category=category,
        mandatory=category in {"mandatory", "evidence", "deadline"} or is_mandatory_language,
        deadline_value=deadline_value,
        lot_bundle=lot_bundle,
        evaluation_criteria=evaluation,
        document_reference="; ".join(doc_refs)[:500] if doc_refs else None,
        required_evidence=[text[:500]] if category == "evidence" or (is_evidence and is_mandatory_language) else [],
        confidence=confidence,
    )


class MockLLMProvider(LLMProviderInterface):
    """Deterministic LLM mock for local development and testing."""

    def extract(
        self,
        request: ExtractionRequest,
    ) -> ExtractionResult:
        requirements: list[ExtractedRequirement] = []

        for chunk in request.chunks:
            if not chunk.text.strip():
                continue
            classified = classify_text(chunk.text)
            if classified is None:
                continue
            requirements.append(
                classified.model_copy(
                    update={
                        "source_chunk_id": chunk.chunk_id,
                        "source_document": chunk.document_name,
                        "source_page": chunk.page_number,
                        "source_paragraph": chunk.paragraph_number,
                    }
                )
            )

        return ExtractionResult(requirements=requirements)

    def draft_section(self, request: DraftRequest) -> DraftResult:
        lines: list[str] = []
        if request.existing_content.strip():
            lines.append(request.existing_content.strip())
            lines.append("")
        lines.append(
            f"This section sets out our response regarding {request.section_title.lower()} "
            f"for {request.case_name}."
        )
        if request.requirements:
            lines.append("")
            lines.append("Our response addresses the following tender requirements:")
            for item in request.requirements[:25]:
                marker = " (mandatory)" if item.mandatory else ""
                source = f" [{item.source}]" if item.source else ""
                lines.append(f"- {item.requirement.strip()}{marker}{source}")
                lines.append("  Response: We confirm compliance. [Add specific detail]")
        if request.snippets:
            lines.append("")
            lines.append("Relevant precedent from previous bids:")
            for snippet in request.snippets[:5]:
                where = snippet.document_name
                if snippet.page_number:
                    where += f", page {snippet.page_number}"
                if snippet.paragraph_number:
                    where += f", paragraph {snippet.paragraph_number}"
                lines.append(f"- {snippet.text.strip()} [Source: {where}]")
        lines.append("")
        lines.append("[Draft generated for review - verify and tailor before submission.]")
        return DraftResult(content="\n".join(lines))


# ---------------------------------------------------------------------------
# Embeddings
# ---------------------------------------------------------------------------

_STOPWORDS = frozenset(
    "a an and are as at be by for from has have in is it its of on or that the this to "
    "was were will with we our you your their they them all any can may shall must "
    "should would could also into than then there these those such per".split()
)


def _stem(token: str) -> str:
    for suffix in ("ations", "ation", "ings", "ing", "ments", "ment", "ies", "es", "ed", "s"):
        if token.endswith(suffix) and len(token) - len(suffix) >= 4:
            return token[: -len(suffix)]
    return token


def _tokens(text: str) -> list[str]:
    raw = re.findall(r"[a-z0-9]+", text.lower())
    return [_stem(t) for t in raw if t not in _STOPWORDS and (len(t) > 1 or t.isdigit())]


def _bucket(feature: str) -> tuple[int, float]:
    digest = hashlib.blake2b(feature.encode("utf-8"), digest_size=8).digest()
    value = int.from_bytes(digest, "big")
    return value % EMBEDDING_DIMENSION, 1.0 if (value >> 63) & 1 else -1.0


class MockEmbeddingProvider(EmbeddingProviderInterface):
    """Deterministic hashed bag-of-words embeddings (no external API)."""

    DIMENSION = EMBEDDING_DIMENSION

    def embed(
        self,
        request: EmbeddingRequest,
    ) -> EmbeddingResult:
        embeddings = []

        for text in request.texts:
            vector = [0.0] * self.DIMENSION
            tokens = _tokens(text)
            features: list[tuple[str, float]] = [(t, 1.0) for t in tokens]
            features += [(f"{a}_{b}", 0.5) for a, b in zip(tokens, tokens[1:])]
            if not features:
                features = [(f"__raw__{text.strip().lower()}", 1.0)]
            for feature, weight in features:
                index, sign = _bucket(feature)
                vector[index] += sign * weight

            magnitude = math.sqrt(sum(value * value for value in vector))
            embeddings.append([value / magnitude for value in vector] if magnitude else vector)

        return EmbeddingResult(embeddings=embeddings)


# ---------------------------------------------------------------------------
# Vector retrieval fixture
# ---------------------------------------------------------------------------


class MockVectorRetriever(VectorRetrieverInterface):
    """In-memory, tenant-partitioned retriever for unit tests."""

    def __init__(self) -> None:
        self._documents = [
            {
                "tenant_id": "tenant-a",
                "chunk_id": "chunk-a-1",
                "document_id": "doc-a-1",
                "text": "Bid submission deadline is 30 days.",
                "document_name": "tender-a.pdf",
                "page_number": 2,
                "paragraph_number": 1,
            },
            {
                "tenant_id": "tenant-a",
                "chunk_id": "chunk-a-2",
                "document_id": "doc-a-1",
                "text": "Technical compliance certificate is mandatory.",
                "document_name": "tender-a.pdf",
                "page_number": 5,
                "paragraph_number": 2,
            },
            {
                "tenant_id": "tenant-b",
                "chunk_id": "chunk-b-1",
                "document_id": "doc-b-1",
                "text": "Financial documents are required.",
                "document_name": "tender-b.pdf",
                "page_number": 3,
                "paragraph_number": 1,
            },
        ]

    def search(
        self,
        request: VectorSearchRequest,
    ) -> VectorSearchResponse:
        tenant_documents = [
            document
            for document in self._documents
            if document["tenant_id"] == request.tenant_id
        ]

        results = [
            VectorSearchResult(
                chunk_id=document["chunk_id"],
                document_id=document["document_id"],
                text=document["text"],
                score=0.95,
                source=SourceReference(
                    document_name=document["document_name"],
                    page_number=document["page_number"],
                    paragraph_number=document["paragraph_number"],
                ),
            )
            for document in tenant_documents[: request.limit]
        ]

        return VectorSearchResponse(results=results)
