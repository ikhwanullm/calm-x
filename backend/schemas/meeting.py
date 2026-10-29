"""Pydantic schemas for meeting notes."""
from __future__ import annotations

from datetime import date, datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from backend.schemas.task import TaskResponse

MAX_BODY = 50_000


def _strip_title(v: object) -> object:
    if not isinstance(v, str):
        return v
    stripped = v.strip()
    if not stripped:
        raise ValueError("title must not be empty or whitespace")
    return stripped


class MeetingCreate(BaseModel):
    title: str = Field(..., max_length=200)
    held_at: datetime
    attendees: str = Field(default="", max_length=500)
    body: str = Field(default="", max_length=MAX_BODY)

    @field_validator("title", mode="before")
    @classmethod
    def strip_title(cls, v: object) -> object:
        return _strip_title(v)


class MeetingUpdate(BaseModel):
    """Partial update: only provided fields are applied."""

    model_config = ConfigDict(extra="ignore")

    title: Optional[str] = Field(default=None, max_length=200)
    held_at: Optional[datetime] = None
    attendees: Optional[str] = Field(default=None, max_length=500)
    body: Optional[str] = Field(default=None, max_length=MAX_BODY)

    @field_validator("title", mode="before")
    @classmethod
    def strip_title(cls, v: object) -> object:
        return None if v is None else _strip_title(v)


class MeetingSummary(BaseModel):
    """A meeting without its body, for lists."""

    id: int
    item_id: int
    item_title: str
    item_type: str
    item_archived: bool
    title: str
    held_at: datetime
    attendees: str
    processed_at: Optional[datetime] = None
    updated_at: datetime
    open_action_count: int = 0


class MeetingResponse(MeetingSummary):
    body: str
    created_at: datetime


class ActionLine(BaseModel):
    line: int
    kind: Literal["mine", "waiting"]
    text: str
    who: Optional[str] = None


class TextLine(BaseModel):
    line: int
    text: str


class ActionsResponse(BaseModel):
    actions: List[ActionLine]
    questions: List[TextLine]
    decisions: List[TextLine]
    converted: int


class ProcessAction(BaseModel):
    line: int = Field(..., ge=0)
    text: str = Field(..., description="The line's text as the user saw it; a mismatch means the notes changed")
    due_date: Optional[date] = None
    priority: Literal["high", "medium", "low"] = "medium"


class ProcessPayload(BaseModel):
    actions: List[ProcessAction] = Field(..., min_length=1, max_length=100)


class ProcessResponse(BaseModel):
    created: List[TaskResponse]
    meeting: MeetingResponse


class CarryOverTask(BaseModel):
    id: int
    title: str
    waiting_for: Optional[str] = None


class CarryOverResponse(BaseModel):
    """What to bring into a new meeting of the same item from the previous one."""

    meeting_id: int
    title: str
    held_at: datetime
    questions: List[str]
    open_tasks: List[CarryOverTask]
