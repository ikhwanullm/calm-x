"""Normalize resource_links to exactly one unique constraint.

Migration 002 added uq_resource_link via batch_alter_table.
This migration uses recreate="always" to rebuild the table from
current model metadata (uq_resource_links with s), removing any
duplicate or differently-named constraints.

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
    # recreate="always" rebuilds the table from model metadata,
    # ensuring exactly the one constraint defined in __table_args__.
    with op.batch_alter_table("resource_links", recreate="always") as batch_op:
        pass


def downgrade() -> None:
    with op.batch_alter_table("resource_links", recreate="always") as batch_op:
        pass
