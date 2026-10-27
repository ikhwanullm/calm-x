"""Pydantic schemas for Reference Links and Resource Links."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ---------------------------------------------------------------------------
# URL validator (shared)
# ---------------------------------------------------------------------------

def _validate_url(v: object) -> object:
    """Allow only http:// and https:// URLs (blocks javascript:, data:, etc.)."""
    if not isinstance(v, str):
        return v
    url = v.strip()
    if not (url.startswith("http://") or url.startswith("https://")):
        raise ValueError("URL must start with http:// or https://")
    return url


# ---------------------------------------------------------------------------
# Reference Link schemas
# ---------------------------------------------------------------------------

class ReferenceLinkCreate(BaseModel):
    url: str = Field(..., max_length=2000, description="http/https URL, max 2000 chars")

    @field_validator("url", mode="before")
    @classmethod
    def validate_url(cls, v: object) -> object:
        return _validate_url(v)


class ReferenceLinkResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    item_id: int
    url: str
    sort_order: int
    created_at: datetime


class ReferenceLinkReorder(BaseModel):
    link_ids: list[int]


# ---------------------------------------------------------------------------
# Resource Link schemas
# ---------------------------------------------------------------------------

class ResourceLinkResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    resource_id: int
    linked_item_id: int
    created_at: datetime


class LinkedItemSummary(BaseModel):
    """Summary of an item that is linked from a Resource."""
    id: int
    type: str
    title: str
    archived_at: Optional[datetime]


# ---------------------------------------------------------------------------
# Type Conversion schemas
# ---------------------------------------------------------------------------

class TypeConversionPayload(BaseModel):
    target_type: str = Field(..., description="project | area | resource")
    # Optional fields for target-type-specific data
    project_goal: Optional[str] = Field(default=None, max_length=500)
    project_deadline: Optional[str] = None   # YYYY-MM-DD
    area_maintenance_notes: Optional[str] = Field(default=None, max_length=1000)


class TypeConversionPreview(BaseModel):
    """Preview data returned before confirming a conversion."""
    current_type: str
    target_type: str
    task_count: int            # total tasks to move (to Resource) or keep
    open_task_count: int
    resource_link_count: int   # links to be removed
