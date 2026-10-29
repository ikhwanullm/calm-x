"""Add Defer and Someday fields to tasks.

- defer_until: local date before which the task is hidden from Today (NULL = not deferred)
- is_someday:  1 = parked idea, kept out of Today until moved back (default 0)

Plain ALTER TABLE ... ADD COLUMN, so the tasks table is never rebuilt and
existing rows are untouched (defer_until NULL, is_someday 0).

Revision ID: 007
Revises: 006
Create Date: 2026-10-29
"""
from __future__ import annotations

from alembic import op

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE tasks ADD COLUMN defer_until DATE")
    op.execute("ALTER TABLE tasks ADD COLUMN is_someday INTEGER NOT NULL DEFAULT 0")


def downgrade() -> None:
    with op.batch_alter_table("tasks") as batch_op:
        batch_op.drop_column("is_someday")
        batch_op.drop_column("defer_until")
