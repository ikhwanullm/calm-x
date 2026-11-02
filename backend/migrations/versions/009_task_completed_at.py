"""Add tasks.completed_at.

- completed_at: when the task was marked complete (NULL = open, or completed before this column existed)

Plain ALTER TABLE ... ADD COLUMN, so the tasks table is never rebuilt. There is no backfill: tasks that
were already complete keep NULL ("completed, date unknown"); the date is not guessed from updated_at.

Revision ID: 009
Revises: 008
Create Date: 2026-11-02
"""
from __future__ import annotations

from alembic import op

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE tasks ADD COLUMN completed_at DATETIME")


def downgrade() -> None:
    with op.batch_alter_table("tasks") as batch_op:
        batch_op.drop_column("completed_at")
