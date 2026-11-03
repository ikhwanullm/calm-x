"""Add meetings.actions_closed_at: the owner said there is nothing more to process in this meeting.

A meeting with this set is never "to process" (Weekly Review, open-action counts), whatever its lines say.
Plain ALTER TABLE ... ADD COLUMN; existing rows keep NULL.

Revision ID: 011
Revises: 010
Create Date: 2026-11-03
"""
from __future__ import annotations

from alembic import op

revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE meetings ADD COLUMN actions_closed_at DATETIME")


def downgrade() -> None:
    with op.batch_alter_table("meetings") as batch_op:
        batch_op.drop_column("actions_closed_at")
