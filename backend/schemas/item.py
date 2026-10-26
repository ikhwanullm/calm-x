"""Pydantic schemas for Items (Projects, Areas, Resources)."""
from __future__ import annotations

from datetime import date, datetime
from typing import Annotated, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _calculate_progress(completed: int, total: int) -> int:
    """Round-half-up progress percentage: (200*m + n) // (2*n)."""
    if total == 0:
        return 0
    return (200 * completed + total) // (2 * total)


# ---------------------------------------------------------------------------
# Create schemas
# ---------------------------------------------------------------------------

class ProjectCreate(BaseModel):
    type: Literal["project"]
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(default="", max_length=5000)
    notes: str = Field(default="", max_length=10000)
    project_goal: Optional[str] = Field(default=None, max_length=500)
    project_deadline: Optional[date] = None

    @field_validator("title", mode="before")
    @classmethod
    def strip_title(cls, v: object) -> object:
        return v.strip() if isinstance(v, str) else v


class AreaCreate(BaseModel):
    type: Literal["area"]
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(default="", max_length=5000)
    notes: str = Field(default="", max_length=10000)
    area_maintenance_notes: Optional[str] = Field(default=None, max_length=1000)

    @field_validator("title", mode="before")
    @classmethod
    def strip_title(cls, v: object) -> object:
        return v.strip() if isinstance(v, str) else v


class ResourceCreate(BaseModel):
    type: Literal["resource"]
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(default="", max_length=5000)
    notes: str = Field(default="", max_length=10000)

    @field_validator("title", mode="before")
    @classmethod
    def strip_title(cls, v: object) -> object:
        return v.strip() if isinstance(v, str) else v


# Discriminated union used by the create endpoint
ItemCreateUnion = Annotated[
    Union[ProjectCreate, AreaCreate, ResourceCreate],
    Field(discriminator="type"),
]


# ---------------------------------------------------------------------------
# Update schema
# ---------------------------------------------------------------------------

class ItemUpdate(BaseModel):
    """Partial update schema — all fields are optional."""

    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=5000)
    notes: Optional[str] = Field(default=None, max_length=10000)
    project_goal: Optional[str] = Field(default=None, max_length=500)
    project_deadline: Optional[date] = None
    area_maintenance_notes: Optional[str] = Field(default=None, max_length=1000)

    @field_validator("title", mode="before")
    @classmethod
    def strip_title(cls, v: object) -> object:
        if v is None:
            return v
        return v.strip() if isinstance(v, str) else v


# ---------------------------------------------------------------------------
# Type-specific response schemas
# ---------------------------------------------------------------------------

class ProjectResponse(BaseModel):
    """Response schema for Project items."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    type: Literal["project"]
    title: str
    description: str
    notes: str
    archived_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    project_goal: Optional[str] = None
    project_deadline: Optional[date] = None
    project_status: Optional[str] = None
    project_completed_at: Optional[datetime] = None
    task_count: int = 0
    completed_task_count: int = 0
    progress_percentage: int = 0


class AreaResponse(BaseModel):
    """Response schema for Area items."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    type: Literal["area"]
    title: str
    description: str
    notes: str
    archived_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    area_maintenance_notes: Optional[str] = None
    task_count: int = 0
    completed_task_count: int = 0


class ResourceResponse(BaseModel):
    """Response schema for Resource items."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    type: Literal["resource"]
    title: str
    description: str
    notes: str
    archived_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    reference_link_count: int = 0
    linked_item_count: int = 0


# ---------------------------------------------------------------------------
# Flat response used by the router (covers all item types in one schema)
# ---------------------------------------------------------------------------

class ItemResponse(BaseModel):
    """Flat response schema covering all item types. Used by the API router."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    type: str
    title: str
    description: str
    notes: str
    archived_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    # Project-specific (None for non-projects)
    project_goal: Optional[str] = None
    project_deadline: Optional[date] = None
    project_status: Optional[str] = None
    project_completed_at: Optional[datetime] = None

    # Area-specific (None for non-areas)
    area_maintenance_notes: Optional[str] = None

    # Computed task counts (derived from ORM relationship in model_validator)
    task_count: int = 0
    completed_task_count: int = 0
    progress_percentage: int = 0

    @model_validator(mode="before")
    @classmethod
    def _compute_task_counts(cls, data: object) -> object:
        """When given an ORM Item instance, derive task count fields."""
        if isinstance(data, dict):
            return data
        # SQLAlchemy ORM instance — extract via getattr
        tasks = getattr(data, "tasks", [])
        total = len(tasks)
        completed = sum(1 for t in tasks if t.is_complete)
        progress = _calculate_progress(completed, total)
        return {
            "id": data.id,
            "type": data.type,
            "title": data.title,
            "description": data.description,
            "notes": data.notes,
            "archived_at": data.archived_at,
            "created_at": data.created_at,
            "updated_at": data.updated_at,
            "project_goal": data.project_goal,
            "project_deadline": data.project_deadline,
            "project_status": data.project_status,
            "project_completed_at": data.project_completed_at,
            "area_maintenance_notes": data.area_maintenance_notes,
            "task_count": total,
            "completed_task_count": completed,
            "progress_percentage": progress,
        }


# ---------------------------------------------------------------------------
# Conversion helper (used by service layer and tests)
# ---------------------------------------------------------------------------

def item_to_response(
    item: object,
    task_count: int = 0,
    completed_task_count: int = 0,
) -> ProjectResponse | AreaResponse | ResourceResponse:
    """Convert an ORM Item instance to the appropriate typed response schema."""
    progress = _calculate_progress(completed_task_count, task_count)
    item_type = getattr(item, "type")

    if item_type == "project":
        return ProjectResponse(
            id=item.id,  # type: ignore[attr-defined]
            type="project",
            title=item.title,  # type: ignore[attr-defined]
            description=item.description,  # type: ignore[attr-defined]
            notes=item.notes,  # type: ignore[attr-defined]
            archived_at=item.archived_at,  # type: ignore[attr-defined]
            created_at=item.created_at,  # type: ignore[attr-defined]
            updated_at=item.updated_at,  # type: ignore[attr-defined]
            project_goal=item.project_goal,  # type: ignore[attr-defined]
            project_deadline=item.project_deadline,  # type: ignore[attr-defined]
            project_status=item.project_status,  # type: ignore[attr-defined]
            project_completed_at=item.project_completed_at,  # type: ignore[attr-defined]
            task_count=task_count,
            completed_task_count=completed_task_count,
            progress_percentage=progress,
        )
    if item_type == "area":
        return AreaResponse(
            id=item.id,  # type: ignore[attr-defined]
            type="area",
            title=item.title,  # type: ignore[attr-defined]
            description=item.description,  # type: ignore[attr-defined]
            notes=item.notes,  # type: ignore[attr-defined]
            archived_at=item.archived_at,  # type: ignore[attr-defined]
            created_at=item.created_at,  # type: ignore[attr-defined]
            updated_at=item.updated_at,  # type: ignore[attr-defined]
            area_maintenance_notes=item.area_maintenance_notes,  # type: ignore[attr-defined]
            task_count=task_count,
            completed_task_count=completed_task_count,
        )
    # resource
    return ResourceResponse(
        id=item.id,  # type: ignore[attr-defined]
        type="resource",
        title=item.title,  # type: ignore[attr-defined]
        description=item.description,  # type: ignore[attr-defined]
        notes=item.notes,  # type: ignore[attr-defined]
        archived_at=item.archived_at,  # type: ignore[attr-defined]
        created_at=item.created_at,  # type: ignore[attr-defined]
        updated_at=item.updated_at,  # type: ignore[attr-defined]
    )
