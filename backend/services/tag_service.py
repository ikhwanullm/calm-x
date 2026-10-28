"""Tag management service."""
from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.exceptions import ConflictError, NotFoundError
from backend.models.item import Tag
from backend.models.utils import now_utc
from backend.schemas.tag import TagCreate, TagRename, TagResponse


def _tag_response(tag: Tag) -> TagResponse:
    return TagResponse(id=tag.id, name=tag.name, created_at=tag.created_at)


def list_tags(session: Session) -> list[TagResponse]:
    """Return all tags ordered by name."""
    tags = session.execute(select(Tag).order_by(Tag.name)).scalars().all()
    return [_tag_response(t) for t in tags]


def create_tag(session: Session, data: TagCreate) -> TagResponse:
    """Create a tag. Raises ConflictError if name already exists (case-insensitive)."""
    existing = session.execute(
        select(Tag).where(func.lower(Tag.name) == func.lower(data.name))
    ).scalar_one_or_none()
    if existing is not None:
        raise ConflictError(
            f"Tag '{data.name}' already exists",
            detail=f"A tag with the name '{existing.name}' already exists. Tag names are case-insensitive.",
        )
    tag = Tag(name=data.name.strip().lower(), created_at=now_utc())
    session.add(tag)
    session.flush()
    return _tag_response(tag)


def rename_tag(session: Session, tag_id: int, data: TagRename) -> TagResponse:
    """Rename a tag. Raises NotFoundError if not found, ConflictError if name taken."""
    tag = session.get(Tag, tag_id)
    if tag is None:
        raise NotFoundError(f"Tag {tag_id} not found")
    # Check uniqueness (excluding self)
    existing = session.execute(
        select(Tag).where(
            func.lower(Tag.name) == func.lower(data.name),
            Tag.id != tag_id,
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise ConflictError(
            f"Tag '{data.name}' already exists",
            detail=f"Tag names must be unique (case-insensitive). '{existing.name}' already exists.",
        )
    tag.name = data.name.strip().lower()
    session.flush()
    return _tag_response(tag)


def delete_tag(session: Session, tag_id: int) -> None:
    """Delete a tag (cascade removes from all tasks via task_tags)."""
    tag = session.get(Tag, tag_id)
    if tag is None:
        raise NotFoundError(f"Tag {tag_id} not found")
    session.delete(tag)
    session.flush()
