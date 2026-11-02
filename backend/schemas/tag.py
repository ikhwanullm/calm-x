"""Pydantic schemas for Tags."""
from __future__ import annotations

import datetime

from pydantic import ConfigDict, Field, field_validator

from backend.schemas.base import ApiModel


class TagCreate(ApiModel):
    name: str = Field(..., min_length=1, max_length=50)

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, v: object) -> object:
        v = str(v).strip() if v is not None else ""
        if not v:
            raise ValueError("Tag name must not be empty")
        return v


class TagRename(ApiModel):
    name: str = Field(..., min_length=1, max_length=50)

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, v: object) -> object:
        v = str(v).strip() if v is not None else ""
        if not v:
            raise ValueError("Tag name must not be empty")
        return v


class TagResponse(ApiModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    created_at: datetime.datetime
