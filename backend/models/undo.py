"""Undo buffer for deletions that can be reverted from the UI."""
from __future__ import annotations

from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base
from backend.models.types import UTCDateTime


class UndoEntry(Base):
    """A JSON snapshot of a deleted task or subtask, kept for a limited time."""

    __tablename__ = "undo_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    kind: Mapped[str] = mapped_column(String, nullable=False)  # "task" | "subtask"
    entity_id: Mapped[int] = mapped_column(Integer, nullable=False)
    payload: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[UTCDateTime] = mapped_column(UTCDateTime, nullable=False)
