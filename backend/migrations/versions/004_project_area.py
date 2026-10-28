"""Add items.area_id: optional parent Area of a Project.

Uses a plain ALTER TABLE ... ADD COLUMN so the items table is never
recreated: existing rows, and the tasks/links that cascade from them,
are left untouched. The column is NULL for every existing item.

Revision ID: 004
Revises: 003
Create Date: 2026-10-28
"""
from __future__ import annotations

from alembic import op

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE items ADD COLUMN area_id INTEGER "
        "REFERENCES items (id) ON DELETE SET NULL"
    )
    op.create_index("ix_items_area_id", "items", ["area_id"])


def downgrade() -> None:
    op.drop_index("ix_items_area_id", table_name="items")
    # Dropping a column with a foreign key needs a table rebuild in SQLite.
    # Migrations run without PRAGMA foreign_keys, so the rebuild does not cascade.
    with op.batch_alter_table("items") as batch_op:
        batch_op.drop_column("area_id")
