"""FastAPI router for Tasks."""
from __future__ import annotations

from datetime import date
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.api.deps import get_db_session
from pydantic import BaseModel, Field, field_validator
from backend.schemas.task import (
    TaskCreate,
    TaskMovePayload,
    TaskReorderPayload,
    TaskResponse,
    TaskUpdate,
    TodayResponse,
)
from backend.services import task_service, undo_service
from backend.services.filter_service import filter_tasks

class QuickCapturePayload(BaseModel):
    title: str = Field(..., max_length=200)

    @field_validator('title', mode='before')
    @classmethod
    def strip_title(cls, v: object) -> object:
        if isinstance(v, str):
            stripped = v.strip()
            if not stripped:
                raise ValueError('title must not be empty or whitespace')
            return stripped
        return v


router = APIRouter(tags=["tasks"])
SessionDep = Annotated[Session, Depends(get_db_session)]


@router.get("/tasks", response_model=list[TaskResponse])
def list_all_tasks(
    session: SessionDep,
    item_id: Optional[int] = Query(default=None),
    include_complete: bool = Query(default=True),
    tags: Optional[str] = Query(default=None, description="Comma-separated tag IDs"),
    priorities: Optional[str] = Query(default=None, description="Comma-separated priorities"),
    due_start: Optional[str] = Query(default=None, description="YYYY-MM-DD"),
    due_end: Optional[str] = Query(default=None, description="YYYY-MM-DD"),
    category: Optional[str] = Query(default=None, description="project|area|inbox"),
    scope: Optional[str] = Query(default=None, description="all: return Inbox + all non-archived items"),
    q: Optional[str] = Query(default=None, max_length=200, description="Search title, description and notes"),
    status: Optional[str] = Query(default=None, description="open|completed|all (replaces include_complete)"),
    waiting: Optional[bool] = Query(default=None, description="true: only waiting-for tasks; false: leave them out"),
    someday: Optional[bool] = Query(default=None, description="true: only Someday tasks; false: leave them out"),
    deferred: Optional[bool] = Query(default=None, description="true: only not-yet-started tasks; false: leave them out (needs today)"),
    from_meeting: Optional[bool] = Query(default=None, description="true: only tasks made from a meeting; false: leave them out"),
    today: Optional[date] = Query(default=None, description="Client local date YYYY-MM-DD, for the deferred filter"),
    sort: Optional[str] = Query(default=None, description="due|priority|project|created|updated"),
    order: str = Query(default="asc", description="asc|desc"),
):
    """List tasks with optional filters. Supports tag/priority/date/category filtering."""
    # If any filter param provided, use filter service; otherwise use simple list
    has_filters = any([
        tags, priorities, due_start, due_end, category,
        item_id is not None, scope == "all", q, status, sort,
        waiting is not None, someday is not None, deferred is not None, from_meeting is not None,
    ])
    if has_filters:
        if tags:
            try:
                tag_ids = [int(t.strip()) for t in tags.split(",") if t.strip()]
            except ValueError:
                from backend.exceptions import ValidationError as _VE
                raise _VE("tags must be comma-separated integers", detail="e.g. tags=1,2,3")
        else:
            tag_ids = None
        priority_list = [p.strip() for p in priorities.split(",") if p.strip()] if priorities else None
        return filter_tasks(
            session,
            tags=tag_ids,
            priorities=priority_list,
            due_start=due_start,
            due_end=due_end,
            category=category,
            item_id=item_id,
            include_complete=include_complete,
            q=q,
            status=status,
            waiting=waiting,
            someday=someday,
            deferred=deferred,
            from_meeting=from_meeting,
            today=today,
            sort=sort,
            order=order,
        )
    return task_service.list_tasks(session, item_id=item_id, include_complete=include_complete)


@router.get("/tasks/inbox", response_model=list[TaskResponse])
def get_inbox(session: SessionDep):
    """Get all Inbox tasks (item_id=None)."""
    return task_service.get_inbox_tasks(session)


@router.get("/tasks/today", response_model=TodayResponse)
def get_today(
    session: SessionDep,
    today: date = Query(..., description="Client local date YYYY-MM-DD"),
):
    """Overdue, due-today, focused and waiting tasks for the Today view."""
    return task_service.get_today(session, today)


@router.get("/tasks/someday", response_model=list[TaskResponse])
def get_someday(session: SessionDep):
    """Open tasks parked as Someday."""
    return task_service.list_someday(session)


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


@router.post("/tasks/{task_id}/restore", response_model=TaskResponse, status_code=201)
def restore_task(task_id: int, session: SessionDep):
    """Undo the deletion of a task, with its subtasks and tags."""
    task = undo_service.restore_task(session, task_id)
    session.commit()
    return task


@router.post("/tasks/{task_id}/follow-up", response_model=TaskResponse)
def follow_up_task(task_id: int, session: SessionDep):
    """Mark that you followed up on a waiting task today (the wait is counted from now)."""
    task = task_service.follow_up(session, task_id)
    session.commit()
    return task


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
