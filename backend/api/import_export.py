"""FastAPI router for JSON export and import."""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, Response
from sqlalchemy.orm import Session

from backend.api.deps import get_db_session
from backend.config import load_config
from backend.exceptions import ImportFailedError, ImportValidationError
from backend.services.import_export_service import export_data, import_data

router = APIRouter(tags=["import-export"])
SessionDep = Annotated[Session, Depends(get_db_session)]
logger = logging.getLogger(__name__)

_MAX_IMPORT_BYTES = 10 * 1024 * 1024  # 10 MB


@router.get("/export")
def export_json(session: SessionDep) -> Response:
    """Export all data as a downloadable JSON file."""
    data = export_data(session)
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    filename = f"calmx_export_{today}.json"
    content = json.dumps(data, ensure_ascii=False, indent=2)
    return Response(
        content=content,
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@router.post("/import")
async def import_json(request: Request, session: SessionDep) -> dict:
    """Import data from a JSON payload.

    Query params:
        mode: "merge" (default) or "replace"

    Body: raw JSON bytes (the export file content).
    Max body size: 10 MB.
    """
    mode = request.query_params.get("mode", "merge")

    # Read body with size limit
    body = await request.body()
    if len(body) > _MAX_IMPORT_BYTES:
        raise ImportValidationError(
            f"Import file too large ({len(body)} bytes). Maximum is {_MAX_IMPORT_BYTES} bytes."
        )

    try:
        data = json.loads(body)
    except json.JSONDecodeError as exc:
        raise ImportValidationError(f"Invalid JSON: {exc}") from exc

    config = load_config()

    # import_data validates first, then writes — all in the session's transaction
    counts = import_data(
        session,
        data,
        mode=mode,
        db_path=str(config.absolute_db_path),
        backup_dir=str(config.absolute_backup_dir),
    )
    session.commit()
    return {"mode": mode, "counts": counts}
