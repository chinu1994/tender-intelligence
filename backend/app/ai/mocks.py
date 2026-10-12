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
from app.core.config import settings


class MockLLMProvider(LLMProviderInterface):
    """Deterministic LLM mock. No network."""

    def extract(self, request: ExtractionRequest) -> ExtractionResult:
        requirements = []

        for chunk in request.chunks:
            if not chunk.text.strip():
                continue

            requirements.append(
                ExtractedRequirement(
                    requirement=chunk.text.strip(),
                    category="mock",
                    mandatory=True,
                    confidence=0.90,
                    source_chunk_id=chunk.chunk_id,
                    source_document=chunk.document_name,
                    source_page=chunk.page_number,
                    source_paragraph=chunk.paragraph_number,
                )
            )

        return ExtractionResult(requirements=requirements)


_TOKEN = re.compile(r"[a-z0-9]+")


class MockEmbeddingProvider(EmbeddingProviderInterface):
    """
    Deterministic embedding mock (hashed bag-of-words).

    - Same text -> same vector.
    - Texts that share words -> similar vectors, so similarity search
      gives believable results in tests without any model download.
    - Vector size = settings.EMBEDDING_DIM, so it fits the pgvector column.
    """

    def __init__(self, dimension: int | None = None) -> None:
        self.dimension = dimension or settings.EMBEDDING_DIM

    def embed(self, request: EmbeddingRequest) -> EmbeddingResult:
        return EmbeddingResult(
            embeddings=[self._embed_one(t) for t in request.texts]
        )

    def _embed_one(self, text: str) -> list[float]:
        vector = [0.0] * self.dimension

        for token in _TOKEN.findall(text.lower()):
            digest = hashlib.sha256(token.encode("utf-8")).digest()
            index = int.from_bytes(digest[:4], "big") % self.dimension
            sign = 1.0 if digest[4] % 2 == 0 else -1.0
            vector[index] += sign

        magnitude = math.sqrt(sum(v * v for v in vector))
        if magnitude == 0:
            return vector
        return [v / magnitude for v in vector]


class MockVectorRetriever(VectorRetrieverInterface):
    """In-memory retriever for tests. Always respects tenant_id."""

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

    def search(self, request: VectorSearchRequest) -> VectorSearchResponse:
        tenant_documents = [
            d for d in self._documents if d["tenant_id"] == request.tenant_id
        ]

        results = [
            VectorSearchResult(
                chunk_id=d["chunk_id"],
                document_id=d["document_id"],
                text=d["text"],
                score=0.95,
                source=SourceReference(
                    document_name=d["document_name"],
                    page_number=d["page_number"],
                    paragraph_number=d["paragraph_number"],
                ),
            )
            for d in tenant_documents[: request.limit]
        ]

        return VectorSearchResponse(results=results)
