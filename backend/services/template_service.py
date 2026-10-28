"""Service layer for Templates."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.exceptions import LimitExceededError, NotFoundError
from backend.models.item import Item, Task
from backend.models.template import Template, TemplateTask
from backend.schemas.template import (
    CreateProjectFromTemplatePayload,
    TemplateCreate,
    TemplateTaskCreate,
    TemplateTaskUpdate,
    TemplateUpdate,
)


MAX_TASKS_PER_TEMPLATE = 50


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _get_or_404(session: Session, template_id: int) -> Template:
    template = session.get(Template, template_id)
    if template is None:
        raise NotFoundError(f"Template {template_id} not found")
    return template


def _get_template_task_or_404(session: Session, task_id: int) -> TemplateTask:
    task = session.get(TemplateTask, task_id)
    if task is None:
        raise NotFoundError(f"TemplateTask {task_id} not found")
    return task


def list_templates(session: Session) -> list[Template]:
    """Return all templates ordered by title."""
    q = select(Template).order_by(Template.title)
    return list(session.execute(q).scalars().all())


def get_template(session: Session, template_id: int) -> Template:
    """Return a single template by id or raise NotFoundError."""
    return _get_or_404(session, template_id)


def create_template(session: Session, data: TemplateCreate) -> Template:
    """Create a new template with optional tasks."""
    now = _now_utc()

    if len(data.tasks) > MAX_TASKS_PER_TEMPLATE:
        raise LimitExceededError(
            f"A template can have at most {MAX_TASKS_PER_TEMPLATE} tasks"
        )

    template = Template(
        title=data.title,
        description=data.description,
        created_at=now,
        updated_at=now,
    )
    session.add(template)
    session.flush()  # Get template.id

    # Create tasks
    for i, task_data in enumerate(data.tasks):
        task = TemplateTask(
            template_id=template.id,
            title=task_data.title,
            description=task_data.description,
            priority=task_data.priority,
            relative_days=task_data.relative_days,
            sort_order=i,
        )
        session.add(task)

    session.flush()
    session.refresh(template)
    return template


def update_template(session: Session, template_id: int, data: TemplateUpdate) -> Template:
    """Update an existing template."""
    template = _get_or_404(session, template_id)

    if data.title is not None:
        template.title = data.title
    if data.description is not None:
        template.description = data.description

    template.updated_at = _now_utc()
    session.flush()
    session.refresh(template)
    return template


def delete_template(session: Session, template_id: int) -> None:
    """Delete a template and its tasks (cascade)."""
    template = _get_or_404(session, template_id)
    session.delete(template)
    session.flush()


# ---------------------------------------------------------------------------
# Template Task operations
# ---------------------------------------------------------------------------

def create_template_task(
    session: Session, template_id: int, data: TemplateTaskCreate
) -> TemplateTask:
    """Add a task to a template."""
    template = _get_or_404(session, template_id)

    if len(template.tasks) >= MAX_TASKS_PER_TEMPLATE:
        raise LimitExceededError(
            f"A template can have at most {MAX_TASKS_PER_TEMPLATE} tasks"
        )

    # Get next sort_order
    max_order = max((t.sort_order for t in template.tasks), default=-1)

    task = TemplateTask(
        template_id=template_id,
        title=data.title,
        description=data.description,
        priority=data.priority,
        relative_days=data.relative_days,
        sort_order=max_order + 1,
    )
    session.add(task)

    template.updated_at = _now_utc()
    session.flush()
    session.refresh(task)
    return task


def update_template_task(
    session: Session, task_id: int, data: TemplateTaskUpdate
) -> TemplateTask:
    """Update a template task."""
    task = _get_template_task_or_404(session, task_id)
    template = task.template

    if data.title is not None:
        task.title = data.title
    if data.description is not None:
        task.description = data.description
    if data.priority is not None:
        task.priority = data.priority
    if data.relative_days is not None:
        task.relative_days = data.relative_days

    template.updated_at = _now_utc()
    session.flush()
    session.refresh(task)
    return task


def delete_template_task(session: Session, task_id: int) -> None:
    """Delete a template task."""
    task = _get_template_task_or_404(session, task_id)
    template = task.template

    session.delete(task)
    template.updated_at = _now_utc()
    session.flush()


def reorder_template_tasks(
    session: Session, template_id: int, task_ids: list[int]
) -> list[TemplateTask]:
    """Reorder template tasks."""
    template = _get_or_404(session, template_id)

    # Build a map of task_id -> task
    task_map = {task.id: task for task in template.tasks}

    # Validate all task_ids belong to this template
    for task_id in task_ids:
        if task_id not in task_map:
            raise NotFoundError(
                f"TemplateTask {task_id} not found in template {template_id}"
            )

    # Update sort orders
    for i, task_id in enumerate(task_ids):
        task_map[task_id].sort_order = i

    template.updated_at = _now_utc()
    session.flush()

    # Reload to get updated sort_order
    session.refresh(template)
    return list(template.tasks)


# ---------------------------------------------------------------------------
# Create Project from Template
# ---------------------------------------------------------------------------

def create_project_from_template(
    session: Session,
    template_id: int,
    data: CreateProjectFromTemplatePayload,
) -> Item:
    """Create a project from a template, calculating due dates from start_date."""
    template = _get_or_404(session, template_id)
    now = _now_utc()

    # Default start_date to today if not provided
    start_date = data.start_date or date.today()

    if data.area_id is not None:
        from backend.services.item_service import _validate_parent_area
        _validate_parent_area(session, data.area_id)

    # Create the project
    project = Item(
        type="project",
        title=data.title,
        description=template.description,  # Copy template description
        notes="",
        archived_at=None,
        created_at=now,
        updated_at=now,
        project_goal=data.project_goal,
        project_deadline=data.project_deadline,
        project_status="active",
        project_completed_at=None,
        area_maintenance_notes=None,
        area_id=data.area_id,
    )
    session.add(project)
    session.flush()  # Get project.id

    # Create tasks from template, calculating due dates
    for i, template_task in enumerate(template.tasks):
        task_due_date = start_date + timedelta(days=template_task.relative_days)

        task = Task(
            item_id=project.id,
            title=template_task.title,
            description=template_task.description,
            notes="",
            due_date=task_due_date,
            priority=template_task.priority,
            is_complete=0,
            sort_order=i,
            created_at=now,
            updated_at=now,
        )
        session.add(task)

    session.flush()
    session.refresh(project)
    return project
