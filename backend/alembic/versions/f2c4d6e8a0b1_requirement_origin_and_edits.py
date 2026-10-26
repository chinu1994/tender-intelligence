"""Track requirement origin and human edits.

Re-running extraction must only replace untouched machine output; requirements
added manually or edited by a reviewer are preserved even while pending.
"""
from alembic import op
import sqlalchemy as sa

revision = "f2c4d6e8a0b1"
down_revision = "e7b1c2d3f4a5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "extracted_requirements",
        sa.Column("origin", sa.String(20), nullable=False, server_default="extracted"),
    )
    op.add_column(
        "extracted_requirements",
        sa.Column("edited_at", sa.DateTime(timezone=True), nullable=True),
    )
    # Existing manual entries were tagged with this note by the API.
    op.execute(
        "UPDATE extracted_requirements SET origin = 'manual' WHERE review_note = 'Added manually'"
    )
    op.execute(
        "UPDATE extracted_requirements SET edited_at = updated_at "
        "WHERE corrected_requirement IS NOT NULL OR review_note IS NOT NULL"
    )


def downgrade() -> None:
    op.drop_column("extracted_requirements", "edited_at")
    op.drop_column("extracted_requirements", "origin")
