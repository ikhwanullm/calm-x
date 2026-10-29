"""Add meetings and tasks.meeting_id.

- meetings:        Markdown meeting notes, each belonging to one Project or Area
                   (ON DELETE CASCADE with the item)
- tasks.meeting_id: the meeting a task was created from (NULL = not from a meeting;
                   ON DELETE SET NULL)

New table plus a plain ALTER TABLE ... ADD COLUMN, so the tasks table is never
rebuilt and existing rows are untouched (meeting_id NULL).

Revision ID: 008
Revises: 007
Create Date: 2026-10-29
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "meetings",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("item_id", sa.Integer, sa.ForeignKey("items.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("held_at", sa.DateTime, nullable=False),
        sa.Column("attendees", sa.Text, nullable=False, server_default=""),
        sa.Column("body", sa.Text, nullable=False, server_default=""),
        sa.Column("processed_at", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
    )
    op.create_index("ix_meetings_item_id", "meetings", ["item_id"])
    op.execute(
        "ALTER TABLE tasks ADD COLUMN meeting_id INTEGER REFERENCES meetings(id) ON DELETE SET NULL"
    )


def downgrade() -> None:
    with op.batch_alter_table("tasks") as batch_op:
        batch_op.drop_column("meeting_id")
    op.drop_index("ix_meetings_item_id", table_name="meetings")
    op.drop_table("meetings")
