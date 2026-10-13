"""Tenant-isolated similarity search over historical document chunks (pgvector)."""

from __future__ import annotations

import uuid

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.ai.schemas import EmbeddingRequest
from app.ai.service import AIService
from app.schemas.knowledge_base import KnowledgeSearchHit


def search_historical_chunks(
    db: Session,
    *,
    tenant_id: uuid.UUID,
    query: str,
    limit: int = 10,
    source_type: str | None = None,
) -> list[KnowledgeSearchHit]:
    """
    Embed the query, then run cosine-distance search on historical_document_chunks
    scoped to the given tenant. Returns results with visible source metadata.
    """
    ai = AIService()
    query_vector = ai.generate_embeddings(
        EmbeddingRequest(texts=[query])
    ).embeddings[0]

    # pgvector cosine distance: smaller = more similar. Convert to score in [0,1].
    vector_literal = "[" + ",".join(str(float(x)) for x in query_vector) + "]"

    sql = """
        SELECT
            c.id AS chunk_id,
            c.historical_document_id AS document_id,
            d.name AS document_name,
            c.text AS text,
            c.page_number AS page_number,
            c.paragraph_number AS paragraph_number,
            d.source_type AS source_type,
            (1 - (c.embedding <=> CAST(:query_vector AS vector))) AS score
        FROM historical_document_chunks c
        JOIN historical_documents d ON d.id = c.historical_document_id
        WHERE c.tenant_id = :tenant_id
          AND d.tenant_id = :tenant_id
          AND c.embedding IS NOT NULL
          AND d.status = 'completed'
    """

    params: dict = {
        "tenant_id": str(tenant_id),
        "query_vector": vector_literal,
        "limit": limit,
    }

    if source_type:
        sql += " AND d.source_type = :source_type"
        params["source_type"] = source_type

    sql += """
        ORDER BY c.embedding <=> CAST(:query_vector AS vector)
        LIMIT :limit
    """

    rows = db.execute(text(sql), params).mappings().all()

    hits: list[KnowledgeSearchHit] = []
    for row in rows:
        score = float(row["score"]) if row["score"] is not None else 0.0
        # Clamp score to [0, 1] for stability with mock vectors
        score = max(0.0, min(1.0, score))
        hits.append(
            KnowledgeSearchHit(
                chunk_id=str(row["chunk_id"]),
                document_id=str(row["document_id"]),
                document_name=row["document_name"],
                text=row["text"],
                score=round(score, 4),
                source_type=row["source_type"],
                page_number=row["page_number"],
                paragraph_number=row["paragraph_number"],
            )
        )

    return hits