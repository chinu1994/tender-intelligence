import hashlib
import math
import re

from app.ai.interfaces import (
    EmbeddingProviderInterface,
    LLMProviderInterface,
    VectorRetrieverInterface,
)
from app.ai.schemas import (
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


class MockLLMProvider(LLMProviderInterface):
    """
    Deterministic LLM mock for local development and testing.

    No external API or network request is used.
    """

    def extract(
        self,
        request: ExtractionRequest,
    ) -> ExtractionResult:
        requirements = []

        for chunk in request.chunks:
            if not chunk.text.strip():
                continue

            text = chunk.text.strip()
            lowered = text.lower()
            if any(word in lowered for word in ("deadline", "due date", "submit by", "closing date")):
                category = "deadline"
            elif any(word in lowered for word in ("evaluation", "scoring", "weighting", "criterion", "criteria")):
                category = "evaluation"
            elif any(word in lowered for word in ("lot ", "bundle", "package")):
                category = "lots"
            elif any(word in lowered for word in ("evidence", "certificate", "insurance", "registration", "proof", "attach")):
                category = "evidence"
            else:
                category = "mandatory" if any(word in lowered for word in ("must", "shall", "required", "mandatory", "requirement")) else "general"
            deadline_match = re.search(r"(?:deadline|due date|closing date|submit by)[:\s-]{0,12}([^.;\n]{3,80})", text, re.IGNORECASE)
            lot_match = re.search(r"\b(?:lot|bundle|package)\s+(?:no\.?\s*)?([A-Za-z0-9][A-Za-z0-9 ._-]{0,50})", text, re.IGNORECASE)
            evidence = [text[:500]] if category == "evidence" else []
            requirement = ExtractedRequirement(
                requirement=text,
                category=category,
                mandatory=category in {"mandatory", "evidence", "deadline"} or any(word in lowered for word in ("must", "shall", "mandatory")),
                deadline_value=deadline_match.group(1).strip() if deadline_match else None,
                lot_bundle=lot_match.group(0).strip() if lot_match else None,
                evaluation_criteria=text if category == "evaluation" else None,
                required_evidence=evidence,
                confidence=0.75 if category == "general" else 0.90,
                source_chunk_id=chunk.chunk_id,
                source_document=chunk.document_name,
                source_page=chunk.page_number,
                source_paragraph=chunk.paragraph_number,
            )

            requirements.append(requirement)

        return ExtractionResult(
            requirements=requirements,
        )


class MockEmbeddingProvider(EmbeddingProviderInterface):
    """
    Deterministic embedding mock.

    The same text always produces the same vector.
    No external API is used.
    """

    DIMENSION = 8

    def embed(
        self,
        request: EmbeddingRequest,
    ) -> EmbeddingResult:
        embeddings = []

        for text in request.texts:
            digest = hashlib.sha256(
                text.encode("utf-8")
            ).digest()

            vector = [
                (digest[index] / 255.0) * 2.0 - 1.0
                for index in range(self.DIMENSION)
            ]

            magnitude = math.sqrt(
                sum(value * value for value in vector)
            )

            if magnitude == 0:
                normalized = [0.0] * self.DIMENSION
            else:
                normalized = [
                    value / magnitude
                    for value in vector
                ]

            embeddings.append(normalized)

        return EmbeddingResult(
            embeddings=embeddings,
        )


class MockVectorRetriever(VectorRetrieverInterface):
    """
    In-memory vector retriever for local development and tests.

    This mock keeps a small fixed dataset and respects tenant_id.
    """

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

        results = []

        for document in tenant_documents[:request.limit]:
            results.append(
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
            )

        return VectorSearchResponse(
            results=results,
        )
