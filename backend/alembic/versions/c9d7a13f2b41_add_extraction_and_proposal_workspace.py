"""Add persisted extraction review and proposal workspace."""
from alembic import op
import sqlalchemy as sa

revision = "c9d7a13f2b41"
down_revision = "a3c1d9e4b7f2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "extracted_requirements",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("tenant_id", sa.UUID(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tender_case_id", sa.UUID(), sa.ForeignKey("tender_cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("document_id", sa.UUID(), sa.ForeignKey("documents.id", ondelete="SET NULL"), nullable=True),
        sa.Column("source_chunk_id", sa.UUID(), nullable=True),
        sa.Column("requirement", sa.Text(), nullable=False),
        sa.Column("category", sa.String(80), nullable=False, server_default="mandatory"),
        sa.Column("mandatory", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("deadline_value", sa.String(255)),
        sa.Column("lot_bundle", sa.String(255)),
        sa.Column("evaluation_criteria", sa.Text()),
        sa.Column("required_evidence", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("confidence", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("source_document", sa.String(255)),
        sa.Column("source_page", sa.Integer()),
        sa.Column("source_paragraph", sa.Integer()),
        sa.Column("review_status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("corrected_requirement", sa.Text()),
        sa.Column("review_note", sa.Text()),
        sa.Column("reviewed_by_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("reviewed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    for column in ("tenant_id", "tender_case_id", "document_id", "review_status"):
        op.create_index(f"ix_extracted_requirements_{column}", "extracted_requirements", [column])

    op.create_table(
        "proposal_sections",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("tenant_id", sa.UUID(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tender_case_id", sa.UUID(), sa.ForeignKey("tender_cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_by_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_proposal_sections_tenant_id", "proposal_sections", ["tenant_id"])
    op.create_index("ix_proposal_sections_tender_case_id", "proposal_sections", ["tender_case_id"])

    op.create_table(
        "proposal_issues",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("tenant_id", sa.UUID(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tender_case_id", sa.UUID(), sa.ForeignKey("tender_cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("severity", sa.String(20), nullable=False, server_default="medium"),
        sa.Column("resolved", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_by_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_proposal_issues_tenant_id", "proposal_issues", ["tenant_id"])
    op.create_index("ix_proposal_issues_tender_case_id", "proposal_issues", ["tender_case_id"])


def downgrade() -> None:
    op.drop_table("proposal_issues")
    op.drop_table("proposal_sections")
    op.drop_table("extracted_requirements")
