"""SQLAlchemy ORM model for user preferences."""
from __future__ import annotations

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base
from backend.models.types import UTCDateTime


class UserPreference(Base):
    """Key-value store for user preferences (e.g. approaching_deadline_threshold)."""

    __tablename__ = "user_preferences"

    key: Mapped[str] = mapped_column(String, primary_key=True)
    value: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[UTCDateTime] = mapped_column(UTCDateTime, nullable=False)

    def __repr__(self) -> str:
        return f"<UserPreference key={self.key!r} value={self.value!r}>"
