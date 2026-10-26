"""ZIP parent links, document references, 384-dimension embeddings.

- documents.parent_document_id / historical_documents.parent_document_id link
  files extracted from an uploaded ZIP archive to the archive record.
- extracted_requirements.document_reference stores cross-document references
  ("see Appendix A") found during structured extraction.
- Embedding columns move from the 8-dim prototype to EMBEDDING_DIMENSION (384).
  Existing vectors are incompatible and are cleared; run
  ``python -m app.cli reindex`` afterwards to re-embed stored chunk text.
"""
from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector

revision = "d4a8e2f1c6b3"
down_revision = "c9d7a13f2b41"
branch_labels = None
depends_on = None

NEW_DIM = 384
OLD_DIM = 8

VECTOR_INDEXES = (
    ("document_chunks", "ix_document_chunks_embedding_hnsw"),
    ("historical_document_chunks", "ix_historical_document_chunks_embedding_hnsw"),
)


def _resize_vectors(dimension: int) -> None:
    for table, index in VECTOR_INDEXES:
        op.execute(f"DROP INDEX IF EXISTS {index}")
        op.execute(f"UPDATE {table} SET embedding = NULL")
        op.alter_column(
            table,
            "embedding",
            type_=Vector(dimension),
            existing_nullable=True,
            postgresql_using=f"embedding::vector({dimension})",
        )
        op.create_index(
            index,
            table,
            ["embedding"],
            postgresql_using="hnsw",
            postgresql_ops={"embedding": "vector_cosine_ops"},
        )


def upgrade() -> None:
    op.add_column(
        "documents",
        sa.Column("parent_document_id", sa.UUID(), nullable=True),
    )
    op.create_foreign_key(
        "fk_documents_parent_document_id",
        "documents",
        "documents",
        ["parent_document_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_documents_parent_document_id", "documents", ["parent_document_id"]
    )

    op.add_column(
        "historical_documents",
        sa.Column("parent_document_id", sa.UUID(), nullable=True),
    )
    op.create_foreign_key(
        "fk_historical_documents_parent_document_id",
        "historical_documents",
        "historical_documents",
        ["parent_document_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_historical_documents_parent_document_id",
        "historical_documents",
        ["parent_document_id"],
    )

    op.add_column(
        "extracted_requirements",
        sa.Column("document_reference", sa.String(500), nullable=True),
    )
    op.create_index(
        "ix_extracted_requirements_source_chunk_id",
        "extracted_requirements",
        ["source_chunk_id"],
    )

    _resize_vectors(NEW_DIM)


def downgrade() -> None:
    _resize_vectors(OLD_DIM)
    op.drop_index("ix_extracted_requirements_source_chunk_id", table_name="extracted_requirements")
    op.drop_column("extracted_requirements", "document_reference")
    op.drop_index("ix_historical_documents_parent_document_id", table_name="historical_documents")
    op.drop_constraint("fk_historical_documents_parent_document_id", "historical_documents", type_="foreignkey")
    op.drop_column("historical_documents", "parent_document_id")
    op.drop_index("ix_documents_parent_document_id", table_name="documents")
    op.drop_constraint("fk_documents_parent_document_id", "documents", type_="foreignkey")
    op.drop_column("documents", "parent_document_id")
