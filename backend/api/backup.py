"""FastAPI router for Backup management."""
from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from backend.api.deps import get_db_session
from backend.config import load_config

router = APIRouter(prefix="/backup", tags=["backup"])
SessionDep = Annotated[Session, Depends(get_db_session)]


class BackupEntry(BaseModel):
    """Metadata for one backup file."""

    model_config = ConfigDict(from_attributes=False)

    filename: str
    size: int       # bytes
    created_at: datetime


class BackupListResponse(BaseModel):
    backups: list[BackupEntry]
    total: int


class BackupCreateResponse(BaseModel):
    filename: str
    size: int
    created_at: datetime


@router.get("/list", response_model=BackupListResponse)
def list_backups(session: SessionDep) -> BackupListResponse:
    """List all backup files (newest first)."""
    from backend.services.backup_service import list_backups as _list_backups

    config = load_config()
    entries = _list_backups(config.absolute_backup_dir)
    backups = [
        BackupEntry(
            filename=e["filename"],
            size=e["size"],
            created_at=e["created_at"],
        )
        for e in entries
    ]
    return BackupListResponse(backups=backups, total=len(backups))


@router.post("/create", response_model=BackupCreateResponse, status_code=201)
def create_backup(session: SessionDep) -> BackupCreateResponse:
    """Create a manual backup now."""
    from backend.services.backup_service import create_backup as _create_backup
    from backend.exceptions import ValidationError

    config = load_config()
    try:
        path = _create_backup(
            db_path=config.absolute_db_path,
            backup_dir=config.absolute_backup_dir,
            trigger="manual",
        )
    except RuntimeError as exc:
        raise ValidationError(str(exc)) from exc

    return BackupCreateResponse(
        filename=path.name,
        size=path.stat().st_size,
        created_at=datetime.fromtimestamp(path.stat().st_mtime),
    )
