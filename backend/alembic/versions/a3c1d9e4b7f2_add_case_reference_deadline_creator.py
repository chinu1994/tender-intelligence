"""Add reference, submission deadline and creator to tender cases."""

from alembic import op
import sqlalchemy as sa


revision = "a3c1d9e4b7f2"
down_revision = "7b8868ac49d7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tender_cases",
        sa.Column("reference", sa.String(length=100), nullable=True),
    )
    op.add_column(
        "tender_cases",
        sa.Column("submission_deadline", sa.Date(), nullable=True),
    )
    op.add_column(
        "tender_cases",
        sa.Column("created_by_id", sa.UUID(), nullable=True),
    )
    op.create_index(
        op.f("ix_tender_cases_created_by_id"),
        "tender_cases",
        ["created_by_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_tender_cases_created_by_id_users",
        "tender_cases",
        "users",
        ["created_by_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_tender_cases_created_by_id_users",
        "tender_cases",
        type_="foreignkey",
    )
    op.drop_index(
        op.f("ix_tender_cases_created_by_id"),
        table_name="tender_cases",
    )
    op.drop_column("tender_cases", "created_by_id")
    op.drop_column("tender_cases", "submission_deadline")
    op.drop_column("tender_cases", "reference")