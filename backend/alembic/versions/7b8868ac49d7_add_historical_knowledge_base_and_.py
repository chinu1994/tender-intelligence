"""Add historical knowledge base and vector embeddings."""

from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector


revision = "7b8868ac49d7"
down_revision = "889b149a5f89"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.add_column(
        "document_chunks",
        sa.Column("embedding", Vector(8), nullable=True),
    )

    op.create_index(
        "ix_document_chunks_embedding_hnsw",
        "document_chunks",
        ["embedding"],
        unique=False,
        postgresql_using="hnsw",
        postgresql_ops={"embedding": "vector_cosine_ops"},
    )

    op.create_table(
        "historical_documents",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("file_path", sa.String(1000), nullable=False),
        sa.Column("file_type", sa.String(50), nullable=False),
        sa.Column(
            "source_type",
            sa.String(50),
            server_default="past_tender",
            nullable=False,
        ),
        sa.Column("outcome", sa.String(50), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.String(20),
            server_default="pending",
            nullable=False,
        ),
        sa.Column("processing_error", sa.String(2000), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_historical_documents_tenant_id",
        "historical_documents",
        ["tenant_id"],
    )
    op.create_index(
        "ix_historical_documents_status",
        "historical_documents",
        ["status"],
    )

    op.create_table(
        "historical_document_chunks",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column(
            "historical_document_id",
            sa.UUID(),
            nullable=False,
        ),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("page_number", sa.Integer(), nullable=True),
        sa.Column("paragraph_number", sa.Integer(), nullable=True),
        sa.Column("embedding", Vector(8), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["historical_document_id"],
            ["historical_documents.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_historical_document_chunks_tenant_id",
        "historical_document_chunks",
        ["tenant_id"],
    )
    op.create_index(
        "ix_historical_document_chunks_historical_document_id",
        "historical_document_chunks",
        ["historical_document_id"],
    )
    op.create_index(
        "ix_historical_document_chunks_embedding_hnsw",
        "historical_document_chunks",
        ["embedding"],
        unique=False,
        postgresql_using="hnsw",
        postgresql_ops={"embedding": "vector_cosine_ops"},
    )


def downgrade() -> None:
    op.drop_index(
        "ix_historical_document_chunks_embedding_hnsw",
        table_name="historical_document_chunks",
    )
    op.drop_index(
        "ix_historical_document_chunks_historical_document_id",
        table_name="historical_document_chunks",
    )
    op.drop_index(
        "ix_historical_document_chunks_tenant_id",
        table_name="historical_document_chunks",
    )
    op.drop_table("historical_document_chunks")

    op.drop_index(
        "ix_historical_documents_status",
        table_name="historical_documents",
    )
    op.drop_index(
        "ix_historical_documents_tenant_id",
        table_name="historical_documents",
    )
    op.drop_table("historical_documents")

    op.drop_index(
        "ix_document_chunks_embedding_hnsw",
        table_name="document_chunks",
    )
    op.drop_column("document_chunks", "embedding")

    # Keep the vector extension installed; other tables may use it.