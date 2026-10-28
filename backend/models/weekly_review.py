"""SQLAlchemy ORM model for WeeklyReview."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base
from backend.models.types import UTCDateTime


class WeeklyReview(Base):
    """A completed weekly review session."""

    __tablename__ = "weekly_reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    completed_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")

    def __repr__(self) -> str:
        return f"<WeeklyReview id={self.id} completed_at={self.completed_at!r}>"
