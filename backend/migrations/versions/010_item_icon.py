"""Add items.icon and items.color: an optional icon and soft tint to recognise a Project or Area.

- icon: a key such as "database" (the frontend owns the list and shows a fallback for keys it does not know)
- color: one of purple, blue, teal, pink, slate

Plain ALTER TABLE ... ADD COLUMN, so the items table is never rebuilt. Existing rows keep NULL.

Revision ID: 010
Revises: 009
Create Date: 2026-11-03
"""
from __future__ import annotations

from alembic import op

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE items ADD COLUMN icon TEXT")
    op.execute("ALTER TABLE items ADD COLUMN color TEXT")


def downgrade() -> None:
    with op.batch_alter_table("items") as batch_op:
        batch_op.drop_column("color")
        batch_op.drop_column("icon")
