"""Initial schema: all tables, indexes and default preferences.

Revision ID: 001
Revises:
Create Date: 2025-01-01 00:00:00.000000
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # items
    # ------------------------------------------------------------------
    op.create_table(
        "items",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "type",
            sa.Text,
            nullable=False,
        ),
        sa.Column("title", sa.Text, nullable=False),
        sa.Column("description", sa.Text, nullable=False, server_default=""),
        sa.Column("notes", sa.Text, nullable=False, server_default=""),
        sa.Column("archived_at", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
        sa.Column("project_goal", sa.Text, nullable=True),
        sa.Column("project_deadline", sa.Date, nullable=True),
        sa.Column("project_status", sa.Text, nullable=True),
        sa.Column("project_completed_at", sa.DateTime, nullable=True),
        sa.Column("area_maintenance_notes", sa.Text, nullable=True),
        sa.CheckConstraint("type IN ('project', 'area', 'resource')", name="ck_items_type"),
        sa.CheckConstraint(
            "length(trim(title)) >= 1 AND length(title) <= 200",
            name="ck_items_title_length",
        ),
        sa.CheckConstraint(
            "length(description) <= 5000",
            name="ck_items_description_length",
        ),
        sa.CheckConstraint("length(notes) <= 10000", name="ck_items_notes_length"),
        sa.CheckConstraint(
            "project_goal IS NULL OR length(project_goal) <= 500",
            name="ck_items_project_goal_length",
        ),
        sa.CheckConstraint(
            "project_status IS NULL OR project_status IN ('active', 'completed')",
            name="ck_items_project_status",
        ),
        sa.CheckConstraint(
            "area_maintenance_notes IS NULL OR length(area_maintenance_notes) <= 1000",
            name="ck_items_area_notes_length",
        ),
    )

    # ------------------------------------------------------------------
    # tasks
    # ------------------------------------------------------------------
    op.create_table(
        "tasks",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "item_id",
            sa.Integer,
            sa.ForeignKey("items.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("title", sa.Text, nullable=False),
        sa.Column("description", sa.Text, nullable=False, server_default=""),
        sa.Column("notes", sa.Text, nullable=False, server_default=""),
        sa.Column("due_date", sa.Date, nullable=True),
        sa.Column(
            "priority",
            sa.Text,
            nullable=False,
            server_default="medium",
        ),
        sa.Column(
            "is_complete",
            sa.Integer,
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "sort_order",
            sa.Integer,
            nullable=False,
            server_default="0",
        ),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
        sa.CheckConstraint(
            "length(trim(title)) >= 1 AND length(title) <= 200",
            name="ck_tasks_title_length",
        ),
        sa.CheckConstraint(
            "length(description) <= 5000",
            name="ck_tasks_description_length",
        ),
        sa.CheckConstraint("length(notes) <= 10000", name="ck_tasks_notes_length"),
        sa.CheckConstraint(
            "priority IN ('high', 'medium', 'low')",
            name="ck_tasks_priority",
        ),
        sa.CheckConstraint("is_complete IN (0, 1)", name="ck_tasks_is_complete"),
    )

    # ------------------------------------------------------------------
    # subtasks
    # ------------------------------------------------------------------
    op.create_table(
        "subtasks",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "task_id",
            sa.Integer,
            sa.ForeignKey("tasks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.Text, nullable=False),
        sa.Column(
            "is_complete",
            sa.Integer,
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "sort_order",
            sa.Integer,
            nullable=False,
            server_default="0",
        ),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
        sa.CheckConstraint(
            "length(trim(title)) >= 1 AND length(title) <= 200",
            name="ck_subtasks_title_length",
        ),
        sa.CheckConstraint("is_complete IN (0, 1)", name="ck_subtasks_is_complete"),
    )

    # ------------------------------------------------------------------
    # tags  (COLLATE NOCASE handled in raw DDL for SQLite)
    # ------------------------------------------------------------------
    op.create_table(
        "tags",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.Text, nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.CheckConstraint(
            "length(trim(name)) >= 1 AND length(name) <= 50",
            name="ck_tags_name_length",
        ),
    )
    # Add COLLATE NOCASE for case-insensitive uniqueness in SQLite
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_tags_name_nocase ON tags(name COLLATE NOCASE)")

    # ------------------------------------------------------------------
    # task_tags
    # ------------------------------------------------------------------
    op.create_table(
        "task_tags",
        sa.Column(
            "task_id",
            sa.Integer,
            sa.ForeignKey("tasks.id", ondelete="CASCADE"),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "tag_id",
            sa.Integer,
            sa.ForeignKey("tags.id", ondelete="CASCADE"),
            primary_key=True,
            nullable=False,
        ),
    )

    # ------------------------------------------------------------------
    # reference_links
    # ------------------------------------------------------------------
    op.create_table(
        "reference_links",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "item_id",
            sa.Integer,
            sa.ForeignKey("items.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("url", sa.Text, nullable=False),
        sa.Column(
            "sort_order",
            sa.Integer,
            nullable=False,
            server_default="0",
        ),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.CheckConstraint(
            "length(url) >= 1 AND length(url) <= 2000",
            name="ck_reference_links_url_length",
        ),
    )

    # ------------------------------------------------------------------
    # resource_links
    # ------------------------------------------------------------------
    op.create_table(
        "resource_links",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "resource_id",
            sa.Integer,
            sa.ForeignKey("items.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "linked_item_id",
            sa.Integer,
            sa.ForeignKey("items.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.UniqueConstraint("resource_id", "linked_item_id", name="uq_resource_links"),
    )

    # ------------------------------------------------------------------
    # templates
    # ------------------------------------------------------------------
    op.create_table(
        "templates",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("title", sa.Text, nullable=False),
        sa.Column("description", sa.Text, nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
        sa.CheckConstraint(
            "length(trim(title)) >= 1 AND length(title) <= 100",
            name="ck_templates_title_length",
        ),
        sa.CheckConstraint(
            "length(description) <= 500",
            name="ck_templates_description_length",
        ),
    )

    # ------------------------------------------------------------------
    # template_tasks
    # ------------------------------------------------------------------
    op.create_table(
        "template_tasks",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "template_id",
            sa.Integer,
            sa.ForeignKey("templates.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.Text, nullable=False),
        sa.Column("description", sa.Text, nullable=False, server_default=""),
        sa.Column(
            "priority",
            sa.Text,
            nullable=False,
            server_default="medium",
        ),
        sa.Column(
            "relative_days",
            sa.Integer,
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "sort_order",
            sa.Integer,
            nullable=False,
            server_default="0",
        ),
        sa.CheckConstraint(
            "length(trim(title)) >= 1 AND length(title) <= 200",
            name="ck_template_tasks_title_length",
        ),
        sa.CheckConstraint(
            "length(description) <= 5000",
            name="ck_template_tasks_description_length",
        ),
        sa.CheckConstraint(
            "priority IN ('high', 'medium', 'low')",
            name="ck_template_tasks_priority",
        ),
        sa.CheckConstraint(
            "relative_days >= 0 AND relative_days <= 365",
            name="ck_template_tasks_relative_days",
        ),
    )

    # ------------------------------------------------------------------
    # weekly_reviews
    # ------------------------------------------------------------------
    op.create_table(
        "weekly_reviews",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("completed_at", sa.DateTime, nullable=False),
        sa.Column("notes", sa.Text, nullable=False, server_default=""),
        sa.CheckConstraint("length(notes) <= 500", name="ck_weekly_reviews_notes_length"),
    )

    # ------------------------------------------------------------------
    # user_preferences
    # ------------------------------------------------------------------
    op.create_table(
        "user_preferences",
        sa.Column("key", sa.Text, primary_key=True),
        sa.Column("value", sa.Text, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
    )

    # ------------------------------------------------------------------
    # Indexes
    # ------------------------------------------------------------------
    op.create_index("idx_items_type", "items", ["type"])
    op.create_index("idx_items_archived_at", "items", ["archived_at"])
    op.create_index("idx_items_updated_at", "items", ["updated_at"])
    op.create_index("idx_tasks_item_id", "tasks", ["item_id"])
    op.create_index("idx_tasks_due_date", "tasks", ["due_date"])
    op.create_index("idx_tasks_priority", "tasks", ["priority"])
    op.create_index("idx_tasks_is_complete", "tasks", ["is_complete"])
    op.create_index("idx_subtasks_task_id", "subtasks", ["task_id"])
    op.create_index("idx_reference_links_item_id", "reference_links", ["item_id"])
    op.create_index("idx_resource_links_resource_id", "resource_links", ["resource_id"])
    op.create_index("idx_resource_links_linked_item_id", "resource_links", ["linked_item_id"])
    op.create_index("idx_template_tasks_template_id", "template_tasks", ["template_id"])

    # ------------------------------------------------------------------
    # Default data: approaching_deadline_threshold = 3
    # ------------------------------------------------------------------
    now = datetime.now(timezone.utc).replace(tzinfo=None)  # naive UTC for SQLite
    op.execute(
        sa.text(
            "INSERT INTO user_preferences (key, value, updated_at) VALUES (:key, :value, :updated_at)"
        ).bindparams(key="approaching_deadline_threshold", value="3", updated_at=now)
    )


def downgrade() -> None:
    op.drop_table("user_preferences")
    op.drop_table("weekly_reviews")
    op.drop_table("template_tasks")
    op.drop_table("templates")
    op.drop_table("resource_links")
    op.drop_table("reference_links")
    op.drop_table("task_tags")
    op.drop_table("tags")
    op.drop_table("subtasks")
    op.drop_table("tasks")
    op.drop_table("items")
