"""Add unique constraint to resource_links(resource_id, linked_item_id).

Revision ID: 002
Revises: 001
Create Date: 2026-10-27
"""
from __future__ import annotations

from alembic import op

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_resource_link",
        "resource_links",
        ["resource_id", "linked_item_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_resource_link", "resource_links", type_="unique")
