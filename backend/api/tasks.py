"""FastAPI router for Tasks."""
from __future__ import annotations

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.api.deps import get_db_session
from pydantic import BaseModel
from backend.schemas.task import (
    TaskCreate,
    TaskMovePayload,
    TaskReorderPayload,
    TaskResponse,
    TaskUpdate,
)
from backend.services import task_service

class QuickCapturePayload(BaseModel):
    title: str


router = APIRouter(tags=["tasks"])
SessionDep = Annotated[Session, Depends(get_db_session)]


@router.get("/tasks", response_model=list[TaskResponse])
def list_all_tasks(
    session: SessionDep,
    item_id: Optional[int] = Query(default=None),
    include_complete: bool = Query(default=True),
):
    """List tasks. Pass item_id to filter by item, or omit for Inbox."""
    return task_service.list_tasks(session, item_id=item_id, include_complete=include_complete)


@router.get("/tasks/inbox", response_model=list[TaskResponse])
def get_inbox(session: SessionDep):
    """Get all Inbox tasks (item_id=None)."""
    return task_service.get_inbox_tasks(session)


@router.get("/items/{item_id}/tasks", response_model=list[TaskResponse])
def list_item_tasks(item_id: int, session: SessionDep, include_complete: bool = Query(default=True)):
    """Get tasks for a specific item."""
    return task_service.list_tasks(session, item_id=item_id, include_complete=include_complete)


@router.get("/tasks/{task_id}", response_model=TaskResponse)
def get_task(task_id: int, session: SessionDep):
    return task_service.get_task(session, task_id)


@router.post("/tasks", response_model=TaskResponse, status_code=201)
def create_task(data: TaskCreate, session: SessionDep):
    task = task_service.create_task(session, data)
    session.commit()
    return task


@router.post("/tasks/quick-capture", response_model=TaskResponse, status_code=201)
def quick_capture(data: QuickCapturePayload, session: SessionDep):
    """Quick capture: create a task in the Inbox with Medium priority."""
    task_data = TaskCreate(title=data.title, priority="medium")
    task = task_service.create_task(session, task_data)
    session.commit()
    return task

@router.put("/tasks/{task_id}", response_model=TaskResponse)
def update_task(task_id: int, data: TaskUpdate, session: SessionDep):
    task = task_service.update_task(session, task_id, data)
    session.commit()
    return task


@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(task_id: int, session: SessionDep):
    task_service.delete_task(session, task_id)
    session.commit()


@router.post("/tasks/{task_id}/move", response_model=TaskResponse)
def move_task(task_id: int, payload: TaskMovePayload, session: SessionDep):
    task = task_service.move_task(session, task_id, payload.item_id)
    session.commit()
    return task


@router.post("/tasks/{task_id}/complete", response_model=TaskResponse)
def mark_complete(task_id: int, session: SessionDep):
    task = task_service.mark_complete(session, task_id)
    session.commit()
    return task


@router.post("/tasks/{task_id}/incomplete", response_model=TaskResponse)
def mark_incomplete(task_id: int, session: SessionDep):
    task = task_service.mark_incomplete(session, task_id)
    session.commit()
    return task


@router.put("/items/{item_id}/tasks/reorder", response_model=list[TaskResponse])
def reorder_tasks(item_id: int, payload: TaskReorderPayload, session: SessionDep):
    result = task_service.reorder_tasks(session, item_id, payload.task_ids)
    session.commit()
    return result
