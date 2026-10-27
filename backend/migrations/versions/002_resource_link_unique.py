"""Add unique constraint to resource_links(resource_id, linked_item_id).

Uses batch mode for SQLite compatibility.

Revision ID: 002
Revises: 001
Create Date: 2026-10-27
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("resource_links") as batch_op:
        batch_op.create_unique_constraint(
            "uq_resource_link",
            ["resource_id", "linked_item_id"],
        )


def downgrade() -> None:
    with op.batch_alter_table("resource_links") as batch_op:
        batch_op.drop_constraint("uq_resource_link", type_="unique")
