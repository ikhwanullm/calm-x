"""FastAPI router for Tags."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.api.deps import get_db_session
from backend.schemas.tag import TagCreate, TagRename, TagResponse
from backend.services import tag_service

router = APIRouter(prefix="/tags", tags=["tags"])
SessionDep = Annotated[Session, Depends(get_db_session)]


@router.get("", response_model=list[TagResponse])
def list_tags(session: SessionDep):
    return tag_service.list_tags(session)


@router.post("", response_model=TagResponse, status_code=201)
def create_tag(data: TagCreate, session: SessionDep):
    tag = tag_service.create_tag(session, data)
    session.commit()
    return tag


@router.put("/{tag_id}", response_model=TagResponse)
def rename_tag(tag_id: int, data: TagRename, session: SessionDep):
    tag = tag_service.rename_tag(session, tag_id, data)
    session.commit()
    return tag


@router.delete("/{tag_id}", status_code=204)
def delete_tag(tag_id: int, session: SessionDep):
    tag_service.delete_tag(session, tag_id)
    session.commit()
