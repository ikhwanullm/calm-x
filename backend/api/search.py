"""FastAPI router for global search (R9.6, R9.7)."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.api.deps import get_db_session
from backend.services.search_service import search

router = APIRouter(prefix="/search", tags=["search"])
SessionDep = Annotated[Session, Depends(get_db_session)]


@router.get("")
def global_search(
    session: SessionDep,
    q: str = Query(..., description="Search query"),
) -> list[dict]:
    """Search items and tasks by title/description.

    Returns up to 100 results. Empty query returns empty list.
    Archived items are labelled "(Archived)".
    """
    return search(session, q)
