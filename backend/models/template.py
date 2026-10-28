"""SQLAlchemy ORM models for Templates and TemplateTasks."""
from __future__ import annotations

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base
from backend.models.types import UTCDateTime


class Template(Base):
    """A reusable project template with predefined tasks."""

    __tablename__ = "templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[UTCDateTime] = mapped_column(UTCDateTime, nullable=False)
    updated_at: Mapped[UTCDateTime] = mapped_column(UTCDateTime, nullable=False)

    # Relationships
    tasks: Mapped[list[TemplateTask]] = relationship(
        "TemplateTask",
        back_populates="template",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="TemplateTask.sort_order",
    )

    @property
    def task_count(self) -> int:
        return len(self.tasks)

    def __repr__(self) -> str:
        return f"<Template id={self.id} title={self.title!r}>"


class TemplateTask(Base):
    """A task definition within a Template."""

    __tablename__ = "template_tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    template_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("templates.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    priority: Mapped[str] = mapped_column(String, nullable=False, default="medium")
    relative_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Relationships
    template: Mapped[Template] = relationship("Template", back_populates="tasks")

    def __repr__(self) -> str:
        return f"<TemplateTask id={self.id} title={self.title!r} relative_days={self.relative_days}>"
