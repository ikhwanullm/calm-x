"""FastAPI router for Subtasks."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.api.deps import get_db_session
from backend.schemas.task import SubtaskCreate, SubtaskResponse, SubtaskUpdate
from backend.services import subtask_service

router = APIRouter(tags=["subtasks"])
SessionDep = Annotated[Session, Depends(get_db_session)]


@router.get("/tasks/{task_id}/subtasks", response_model=list[SubtaskResponse])
def list_subtasks(task_id: int, session: SessionDep):
    return subtask_service.list_subtasks(session, task_id)


@router.post("/tasks/{task_id}/subtasks", response_model=SubtaskResponse, status_code=201)
def create_subtask(task_id: int, data: SubtaskCreate, session: SessionDep):
    subtask = subtask_service.create_subtask(session, task_id, data)
    session.commit()
    return subtask


@router.put("/subtasks/{subtask_id}", response_model=SubtaskResponse)
def update_subtask(subtask_id: int, data: SubtaskUpdate, session: SessionDep):
    subtask = subtask_service.update_subtask(session, subtask_id, data)
    session.commit()
    return subtask


@router.delete("/subtasks/{subtask_id}", status_code=204)
def delete_subtask(subtask_id: int, session: SessionDep):
    subtask_service.delete_subtask(session, subtask_id)
    session.commit()


@router.post("/subtasks/{subtask_id}/complete", response_model=SubtaskResponse)
def mark_subtask_complete(subtask_id: int, session: SessionDep):
    subtask = subtask_service.mark_subtask_complete(session, subtask_id)
    session.commit()
    return subtask


@router.post("/subtasks/{subtask_id}/incomplete", response_model=SubtaskResponse)
def mark_subtask_incomplete(subtask_id: int, session: SessionDep):
    subtask = subtask_service.mark_subtask_incomplete(session, subtask_id)
    session.commit()
    return subtask
