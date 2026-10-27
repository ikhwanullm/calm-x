"""Pydantic schemas for Tags."""
from __future__ import annotations

import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class TagCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, v: object) -> object:
        v = str(v).strip() if v is not None else ""
        if not v:
            raise ValueError("Tag name must not be empty")
        return v


class TagRename(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, v: object) -> object:
        v = str(v).strip() if v is not None else ""
        if not v:
            raise ValueError("Tag name must not be empty")
        return v


class TagResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    created_at: datetime.datetime
