"""FastAPI router for Templates."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.api.deps import get_db_session
from backend.schemas.item import ProjectResponse
from backend.schemas.template import (
    CreateProjectFromTemplatePayload,
    TemplateCreate,
    TemplateDetailResponse,
    TemplateResponse,
    TemplateTaskCreate,
    TemplateTaskReorderPayload,
    TemplateTaskResponse,
    TemplateTaskUpdate,
    TemplateUpdate,
)
from backend.services import template_service

router = APIRouter(prefix="/templates", tags=["templates"])
SessionDep = Annotated[Session, Depends(get_db_session)]


# ---------------------------------------------------------------------------
# Template CRUD
# ---------------------------------------------------------------------------

@router.get("", response_model=list[TemplateResponse])
def list_templates(session: SessionDep):
    """List all templates."""
    return template_service.list_templates(session)


@router.get("/{template_id}", response_model=TemplateDetailResponse)
def get_template(template_id: int, session: SessionDep):
    """Get a template with its tasks."""
    return template_service.get_template(session, template_id)


@router.post("", response_model=TemplateDetailResponse, status_code=201)
def create_template(data: TemplateCreate, session: SessionDep):
    """Create a new template with optional tasks."""
    template = template_service.create_template(session, data)
    session.commit()
    session.refresh(template)
    return template


@router.put("/{template_id}", response_model=TemplateDetailResponse)
def update_template(template_id: int, data: TemplateUpdate, session: SessionDep):
    """Update a template's title or description."""
    template = template_service.update_template(session, template_id, data)
    session.commit()
    session.refresh(template)
    return template


@router.delete("/{template_id}", status_code=204)
def delete_template(template_id: int, session: SessionDep):
    """Delete a template and its tasks."""
    template_service.delete_template(session, template_id)
    session.commit()


# ---------------------------------------------------------------------------
# Create project from template
# ---------------------------------------------------------------------------

@router.post(
    "/{template_id}/create-project",
    response_model=ProjectResponse,
    status_code=201,
)
def create_project_from_template(
    template_id: int,
    data: CreateProjectFromTemplatePayload,
    session: SessionDep,
):
    """Create a project from a template with calculated due dates."""
    project = template_service.create_project_from_template(session, template_id, data)
    session.commit()
    session.refresh(project)
    return project


# ---------------------------------------------------------------------------
# Template Task CRUD
# ---------------------------------------------------------------------------

@router.post(
    "/{template_id}/tasks",
    response_model=TemplateTaskResponse,
    status_code=201,
)
def create_template_task(
    template_id: int,
    data: TemplateTaskCreate,
    session: SessionDep,
):
    """Add a task to a template."""
    task = template_service.create_template_task(session, template_id, data)
    session.commit()
    session.refresh(task)
    return task


@router.put("/tasks/{task_id}", response_model=TemplateTaskResponse)
def update_template_task(
    task_id: int,
    data: TemplateTaskUpdate,
    session: SessionDep,
):
    """Update a template task."""
    task = template_service.update_template_task(session, task_id, data)
    session.commit()
    session.refresh(task)
    return task


@router.delete("/tasks/{task_id}", status_code=204)
def delete_template_task(task_id: int, session: SessionDep):
    """Delete a template task."""
    template_service.delete_template_task(session, task_id)
    session.commit()


@router.put(
    "/{template_id}/tasks/reorder",
    response_model=list[TemplateTaskResponse],
)
def reorder_template_tasks(
    template_id: int,
    data: TemplateTaskReorderPayload,
    session: SessionDep,
):
    """Reorder template tasks."""
    tasks = template_service.reorder_template_tasks(session, template_id, data.task_ids)
    session.commit()
    return tasks
