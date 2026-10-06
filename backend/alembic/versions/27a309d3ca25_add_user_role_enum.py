"""add user role enum

Revision ID: 27a309d3ca25
Revises: 2a651759edb3
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "27a309d3ca25"
down_revision: Union[str, Sequence[str], None] = "2a651759edb3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    user_role = sa.Enum(
        "admin",
        "editor",
        "reviewer",
        name="user_role",
    )

    user_role.create(op.get_bind(), checkfirst=True)

    op.alter_column(
        "users",
        "role",
        existing_type=sa.String(length=50),
        type_=user_role,
        postgresql_using="role::user_role",
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "users",
        "role",
        existing_type=sa.Enum(
            "admin",
            "editor",
            "reviewer",
            name="user_role",
        ),
        type_=sa.String(length=50),
        postgresql_using="role::text",
        existing_nullable=False,
    )

    sa.Enum(
        "admin",
        "editor",
        "reviewer",
        name="user_role",
    ).drop(op.get_bind(), checkfirst=True)