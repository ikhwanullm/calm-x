"""Add Today focus and Waiting-for fields to tasks.

- focus_date:    local date the task was added to Today (NULL = not on Today)
- waiting_for:   who or what the task is waiting on (NULL = not waiting)
- waiting_since: when waiting_for was set (UTC)

Plain ALTER TABLE ... ADD COLUMN, so the tasks table is never rebuilt and
existing rows are untouched; every new column is NULL for existing tasks.

Revision ID: 005
Revises: 004
Create Date: 2026-10-28
"""
from __future__ import annotations

from alembic import op

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE tasks ADD COLUMN focus_date DATE")
    op.execute("ALTER TABLE tasks ADD COLUMN waiting_for TEXT")
    op.execute("ALTER TABLE tasks ADD COLUMN waiting_since DATETIME")


def downgrade() -> None:
    with op.batch_alter_table("tasks") as batch_op:
        batch_op.drop_column("waiting_since")
        batch_op.drop_column("waiting_for")
        batch_op.drop_column("focus_date")
