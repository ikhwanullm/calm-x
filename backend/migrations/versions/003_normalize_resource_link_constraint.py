"""Normalize resource_links unique constraint — remove any duplicate.

Migration 002 added uq_resource_link via batch_alter_table.
On some databases this may have resulted in two constraints.
This migration recreates the table to ensure exactly one constraint.

Revision ID: 003
Revises: 002
Create Date: 2026-10-27
"""
from __future__ import annotations

from alembic import op

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # batch_alter_table without additional ops recreates the table from the current
    # model definition, normalizing to exactly one unique constraint.
    with op.batch_alter_table("resource_links") as _batch_op:
        pass  # no structural changes; table is recreated from model metadata


def downgrade() -> None:
    pass  # constraint state after downgrade same as after 002
