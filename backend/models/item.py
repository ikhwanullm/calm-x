"""SQLAlchemy ORM models for Items (Projects, Areas, Resources)."""
from __future__ import annotations

from sqlalchemy import Date, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base
from backend.models.types import UTCDateTime


class Item(Base):
    """Represents a Project, Area, or Resource in the PARA method."""

    __tablename__ = "items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    type: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    archived_at: Mapped[UTCDateTime | None] = mapped_column(UTCDateTime, nullable=True)
    created_at: Mapped[UTCDateTime] = mapped_column(UTCDateTime, nullable=False)
    updated_at: Mapped[UTCDateTime] = mapped_column(UTCDateTime, nullable=False)

    # Project-specific fields (None for non-projects)
    project_goal: Mapped[str | None] = mapped_column(String(500), nullable=True)
    project_deadline: Mapped[Date | None] = mapped_column(Date, nullable=True)
    project_status: Mapped[str | None] = mapped_column(String, nullable=True)
    project_completed_at: Mapped[UTCDateTime | None] = mapped_column(UTCDateTime, nullable=True)

    # Area-specific fields (None for non-areas)
    area_maintenance_notes: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    # Optional parent Area of a Project (None for non-projects and unassigned projects)
    area_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("items.id", ondelete="SET NULL"), nullable=True, index=True
    )
    area: Mapped[Item | None] = relationship(
        "Item", remote_side="Item.id", foreign_keys="Item.area_id"
    )

    # Relationships — all with cascade delete-orphan + passive_deletes for DB cascade
    tasks: Mapped[list[Task]] = relationship(
        "Task",
        back_populates="item",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    reference_links: Mapped[list[ReferenceLink]] = relationship(
        "ReferenceLink",
        back_populates="item",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    # ResourceLink: this item AS the resource (points to linked items)
    resource_links_as_resource: Mapped[list[ResourceLink]] = relationship(
        "ResourceLink",
        foreign_keys="ResourceLink.resource_id",
        back_populates="resource",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    # ResourceLink: this item IS the linked item (referenced by a resource)
    resource_links_as_linked: Mapped[list[ResourceLink]] = relationship(
        "ResourceLink",
        foreign_keys="ResourceLink.linked_item_id",
        back_populates="linked_item",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    @property
    def task_count(self) -> int:
        return len(self.tasks)

    @property
    def completed_task_count(self) -> int:
        return sum(1 for t in self.tasks if t.is_complete)

    @property
    def progress_percentage(self) -> int:
        total = len(self.tasks)
        if total == 0:
            return 0
        completed = sum(1 for t in self.tasks if t.is_complete)
        return (200 * completed + total) // (2 * total)

    def __repr__(self) -> str:
        return f"<Item id={self.id} type={self.type!r} title={self.title!r}>"


class Task(Base):
    """A task belonging to an Item (or to the Inbox when item_id is None)."""

    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    item_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("items.id", ondelete="CASCADE"),
        nullable=True,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    due_date: Mapped[Date | None] = mapped_column(Date, nullable=True)
    priority: Mapped[str] = mapped_column(String, nullable=False, default="medium")
    is_complete: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[UTCDateTime] = mapped_column(UTCDateTime, nullable=False)
    updated_at: Mapped[UTCDateTime] = mapped_column(UTCDateTime, nullable=False)
    # Local date the task was put on Today (None = not on Today)
    focus_date: Mapped[Date | None] = mapped_column(Date, nullable=True)
    # Who or what the task is waiting on (None = not waiting)
    waiting_for: Mapped[str | None] = mapped_column(Text, nullable=True)
    waiting_since: Mapped[UTCDateTime | None] = mapped_column(UTCDateTime, nullable=True)
    # Hidden from Today until this local date (None = not deferred)
    defer_until: Mapped[Date | None] = mapped_column(Date, nullable=True)
    # Parked idea, kept out of Today (0/1)
    is_someday: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    # Relationships
    item: Mapped[Item | None] = relationship("Item", back_populates="tasks")
    subtasks: Mapped[list[Subtask]] = relationship(
        "Subtask",
        back_populates="task",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    task_tags: Mapped[list[TaskTag]] = relationship(
        "TaskTag",
        back_populates="task",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    def __repr__(self) -> str:
        return f"<Task id={self.id} title={self.title!r}>"


class Subtask(Base):
    """A subtask belonging to a Task."""

    __tablename__ = "subtasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    task_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    is_complete: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[UTCDateTime] = mapped_column(UTCDateTime, nullable=False)
    updated_at: Mapped[UTCDateTime] = mapped_column(UTCDateTime, nullable=False)

    task: Mapped[Task] = relationship("Task", back_populates="subtasks")


class Tag(Base):
    """A tag that can be applied to multiple tasks."""

    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    created_at: Mapped[UTCDateTime] = mapped_column(UTCDateTime, nullable=False)

    task_tags: Mapped[list[TaskTag]] = relationship(
        "TaskTag",
        back_populates="tag",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class TaskTag(Base):
    """Junction table linking Tasks to Tags."""

    __tablename__ = "task_tags"

    task_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("tasks.id", ondelete="CASCADE"),
        primary_key=True,
    )
    tag_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("tags.id", ondelete="CASCADE"),
        primary_key=True,
    )

    task: Mapped[Task] = relationship("Task", back_populates="task_tags")
    tag: Mapped[Tag] = relationship("Tag", back_populates="task_tags")


class ReferenceLink(Base):
    """A reference URL link attached to an Item."""

    __tablename__ = "reference_links"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    item_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("items.id", ondelete="CASCADE"),
        nullable=False,
    )
    url: Mapped[str] = mapped_column(String(2000), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[UTCDateTime] = mapped_column(UTCDateTime, nullable=False)

    item: Mapped[Item] = relationship("Item", back_populates="reference_links")


class ResourceLink(Base):
    """A link from a Resource item to a Project or Area."""

    __tablename__ = "resource_links"
    __table_args__ = (
        UniqueConstraint("resource_id", "linked_item_id", name="uq_resource_links"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    resource_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("items.id", ondelete="CASCADE"),
        nullable=False,
    )
    linked_item_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("items.id", ondelete="CASCADE"),
        nullable=False,
    )
    created_at: Mapped[UTCDateTime] = mapped_column(UTCDateTime, nullable=False)

    resource: Mapped[Item] = relationship(
        "Item",
        foreign_keys=[resource_id],
        back_populates="resource_links_as_resource",
    )
    linked_item: Mapped[Item] = relationship(
        "Item",
        foreign_keys=[linked_item_id],
        back_populates="resource_links_as_linked",
    )
