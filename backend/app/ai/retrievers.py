"""pgvector implementation of ``VectorRetrieverInterface``."""
from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.ai.interfaces import VectorRetrieverInterface
from app.ai.schemas import (
    SourceReference,
    VectorSearchRequest,
    VectorSearchResponse,
    VectorSearchResult,
)


_ITERATIVE_SCAN: bool | None = None


def iterative_scan_supported(db: Session) -> bool:
    """pgvector >= 0.8 can continue an HNSW scan until LIMIT rows pass filters."""
    global _ITERATIVE_SCAN
    if _ITERATIVE_SCAN is None:
        version = db.execute(
            text("SELECT extversion FROM pg_extension WHERE extname = 'vector'")
        ).scalar() or "0"
        parts = tuple(int(p) for p in version.split(".")[:2] if p.isdigit())
        _ITERATIVE_SCAN = parts >= (0, 8)
    return _ITERATIVE_SCAN


class PgVectorRetriever(VectorRetrieverInterface):
    """Cosine-similarity search over historical knowledge-base chunks.

    The tenant predicate is applied to both the chunk and its parent document
    *before* ordering by distance, so another tenant's vectors are never
    candidates. Row-level security adds a second, database-enforced guard.
    """

    def __init__(self, db: Session) -> None:
        self._db = db

    def search(self, request: VectorSearchRequest) -> VectorSearchResponse:
        vector_literal = "[" + ",".join(repr(float(x)) for x in request.query_vector) + "]"
        sql = """
            SELECT
                c.id AS chunk_id,
                c.historical_document_id AS document_id,
                d.name AS document_name,
                c.text AS text,
                c.page_number AS page_number,
                c.paragraph_number AS paragraph_number,
                d.source_type AS source_type,
                d.outcome AS outcome,
                (1 - (c.embedding <=> CAST(:query_vector AS vector))) AS score
            FROM historical_document_chunks c
            JOIN historical_documents d ON d.id = c.historical_document_id
            WHERE c.tenant_id = CAST(:tenant_id AS uuid)
              AND d.tenant_id = CAST(:tenant_id AS uuid)
              AND c.embedding IS NOT NULL
              AND d.status = 'completed'
        """
        params: dict = {
            "tenant_id": request.tenant_id,
            "query_vector": vector_literal,
            "limit": request.limit,
        }
        if request.source_type:
            sql += " AND d.source_type = :source_type"
            params["source_type"] = request.source_type
        sql += """
            ORDER BY c.embedding <=> CAST(:query_vector AS vector)
            LIMIT :limit
        """

        # HNSW returns a fixed candidate list (ef_search) across *all* tenants
        # before the tenant filter applies; without these settings a small
        # tenant could get few or no results once another tenant dominates
        # the index. Both settings are transaction-local.
        ef_search = max(100, request.limit * 10)
        self._db.execute(text(f"SET LOCAL hnsw.ef_search = {int(ef_search)}"))
        if iterative_scan_supported(self._db):
            self._db.execute(text("SET LOCAL hnsw.iterative_scan = relaxed_order"))

        rows = self._db.execute(text(sql), params).mappings().all()
        results: list[VectorSearchResult] = []
        for row in rows:
            score = float(row["score"]) if row["score"] is not None else 0.0
            score = max(0.0, min(1.0, score))
            if score < request.min_score:
                continue
            results.append(
                VectorSearchResult(
                    chunk_id=str(row["chunk_id"]),
                    document_id=str(row["document_id"]),
                    text=row["text"],
                    score=round(score, 4),
                    source=SourceReference(
                        document_name=row["document_name"],
                        page_number=row["page_number"],
                        paragraph_number=row["paragraph_number"],
                        source_type=row["source_type"],
                        outcome=row["outcome"],
                    ),
                )
            )
        # relaxed_order may return slightly out-of-order rows; sort exactly.
        results.sort(key=lambda hit: hit.score, reverse=True)
        return VectorSearchResponse(results=results)
