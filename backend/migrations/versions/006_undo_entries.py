"""Add undo_entries: snapshots of deleted tasks/subtasks for Undo.

Only creates a new table; no existing table is altered.

Revision ID: 006
Revises: 005
Create Date: 2026-10-28
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "undo_entries",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("kind", sa.Text, nullable=False),
        sa.Column("entity_id", sa.Integer, nullable=False),
        sa.Column("payload", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime, nullable=False),
    )
    op.create_index("ix_undo_entries_kind_entity", "undo_entries", ["kind", "entity_id"])


def downgrade() -> None:
    op.drop_index("ix_undo_entries_kind_entity", table_name="undo_entries")
    op.drop_table("undo_entries")
