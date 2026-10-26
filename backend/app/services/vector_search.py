"""Tenant-isolated similarity search over historical knowledge (via the SPI)."""
from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.ai.schemas import EmbeddingRequest, VectorSearchRequest
from app.ai.service import AIService
from app.schemas.knowledge_base import KnowledgeSearchHit


def search_historical_chunks(
    db: Session,
    *,
    tenant_id: uuid.UUID,
    query: str,
    limit: int = 10,
    source_type: str | None = None,
    min_score: float = 0.0,
) -> list[KnowledgeSearchHit]:
    """Embed ``query`` and return the closest historical chunks of ``tenant_id``.

    ``tenant_id`` must come from the authenticated user, never from input.
    """
    ai = AIService(db)
    query_vector = ai.generate_embeddings(EmbeddingRequest(texts=[query])).embeddings[0]
    response = ai.search_similar(
        VectorSearchRequest(
            tenant_id=str(tenant_id),
            query_vector=query_vector,
            limit=limit,
            source_type=source_type,
            min_score=min_score,
        )
    )
    return [
        KnowledgeSearchHit(
            chunk_id=hit.chunk_id,
            document_id=hit.document_id,
            document_name=hit.source.document_name,
            text=hit.text,
            score=hit.score,
            source_type=hit.source.source_type,
            outcome=hit.source.outcome,
            page_number=hit.source.page_number,
            paragraph_number=hit.source.paragraph_number,
        )
        for hit in response.results
    ]
