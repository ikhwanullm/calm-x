"""FastAPI router for meeting notes."""
from __future__ import annotations

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.api.deps import get_db_session
from backend.schemas.meeting import (
    ActionsResponse,
    CarryOverResponse,
    MeetingCreate,
    MeetingResponse,
    MeetingSummary,
    MeetingUpdate,
    ProcessPayload,
    ProcessResponse,
)
from backend.services import meeting_service, undo_service

router = APIRouter(tags=["meetings"])
SessionDep = Annotated[Session, Depends(get_db_session)]


@router.get("/meetings", response_model=list[MeetingSummary])
def list_all_meetings(
    session: SessionDep,
    q: Optional[str] = Query(default=None, description="Search title, attendees and notes"),
):
    """All meetings, newest first."""
    return meeting_service.list_meetings(session, q=q)


@router.get("/items/{item_id}/meetings", response_model=list[MeetingSummary])
def list_item_meetings(item_id: int, session: SessionDep):
    return meeting_service.list_meetings(session, item_id=item_id)


@router.get("/items/{item_id}/meetings/carry-over", response_model=Optional[CarryOverResponse])
def get_carry_over(item_id: int, session: SessionDep):
    """Open questions and open tasks of the item's newest meeting (null when it has none)."""
    return meeting_service.get_carry_over(session, item_id)


@router.post("/items/{item_id}/meetings", response_model=MeetingResponse, status_code=201)
def create_meeting(item_id: int, data: MeetingCreate, session: SessionDep):
    meeting = meeting_service.create_meeting(session, item_id, data)
    session.commit()
    return meeting


@router.get("/meetings/{meeting_id}", response_model=MeetingResponse)
def get_meeting(meeting_id: int, session: SessionDep):
    return meeting_service.get_meeting(session, meeting_id)


@router.put("/meetings/{meeting_id}", response_model=MeetingResponse)
def update_meeting(meeting_id: int, data: MeetingUpdate, session: SessionDep):
    meeting = meeting_service.update_meeting(session, meeting_id, data)
    session.commit()
    return meeting


@router.delete("/meetings/{meeting_id}", status_code=204)
def delete_meeting(meeting_id: int, session: SessionDep):
    meeting_service.delete_meeting(session, meeting_id)
    session.commit()


@router.post("/meetings/{meeting_id}/restore", response_model=MeetingResponse, status_code=201)
def restore_meeting(meeting_id: int, session: SessionDep):
    meeting = undo_service.restore_meeting(session, meeting_id)
    session.commit()
    return meeting


@router.get("/meetings/{meeting_id}/actions", response_model=ActionsResponse)
def get_actions(meeting_id: int, session: SessionDep):
    """Action lines, questions and decisions found in the notes right now."""
    return meeting_service.get_actions(session, meeting_id)


@router.post("/meetings/{meeting_id}/process", response_model=ProcessResponse)
def process_meeting(meeting_id: int, payload: ProcessPayload, session: SessionDep):
    """Turn the chosen action lines into tasks (all or nothing)."""
    result = meeting_service.process_meeting(session, meeting_id, payload)
    session.commit()
    return result
