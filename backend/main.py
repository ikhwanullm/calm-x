"""Calm-X application entry point."""
from __future__ import annotations

import logging
import socket
import sys
from pathlib import Path

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError as PydanticValidationError
from sqlalchemy.exc import IntegrityError

from backend.config import load_config
from backend.database import init_database
from backend.exceptions import (
    EXCEPTION_STATUS_MAP,
    CalmXException,
    get_exception_type_name,
)
from backend.middleware.csrf import CSRFProtectionMiddleware

logger = logging.getLogger(__name__)


def check_port_available(port: int) -> bool:
    """Return True if the port is available for binding."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(("127.0.0.1", port))
            return True
        except OSError:
            return False


def create_app(config=None, extra_routers=None) -> FastAPI:
    """Application factory.

    Args:
        config: Application config. Loaded from environment if not provided.
        extra_routers: Optional list of APIRouter instances to mount before the
            SPA fallback route. Routers passed here are registered first so they
            take priority over the catch-all ``/{full_path:path}`` route.
    """
    if config is None:
        config = load_config()

    app = FastAPI(title="Calm-X", version="0.1.0", docs_url="/api/docs")

    # --- Middleware (order matters: outermost added last) ---
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=["localhost", "127.0.0.1"],
    )
    app.add_middleware(CSRFProtectionMiddleware, port=config.port, dev_origins=config.dev_origins)

    # --- Exception handlers ---
    @app.exception_handler(PydanticValidationError)
    async def pydantic_validation_handler(request: Request, exc: PydanticValidationError):
        return JSONResponse(
            status_code=422,
            content={"error": "validation_error", "detail": exc.errors()},
        )

    @app.exception_handler(IntegrityError)
    async def integrity_error_handler(request: Request, exc: IntegrityError):
        return JSONResponse(
            status_code=409,
            content={"error": "conflict", "detail": str(exc.orig)},
        )

    @app.exception_handler(CalmXException)
    async def calmx_exception_handler(request: Request, exc: CalmXException):
        status_code = EXCEPTION_STATUS_MAP.get(type(exc), 500)
        return JSONResponse(
            status_code=status_code,
            content={
                "error": get_exception_type_name(exc),
                "message": exc.message,
                "detail": exc.detail,
            },
        )

    # --- Static files ---
    dist_path: Path = config.absolute_frontend_dist
    assets_path = dist_path / "assets"

    if assets_path.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_path)), name="assets")

    # --- Extra routers (registered before SPA fallback) ---
    if extra_routers:
        for router in extra_routers:
            app.include_router(router)

    # --- SPA fallback ---
    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        # API routes are not handled here â€” they must be registered before this
        index_html = dist_path / "index.html"
        # Serve specific static files if they exist
        candidate = dist_path / full_path
        if candidate.exists() and candidate.is_file():
            return FileResponse(str(candidate))
        # Fallback to index.html for SPA routing
        if index_html.exists():
            return FileResponse(str(index_html))
        return JSONResponse(
            status_code=503,
            content={"error": "frontend_not_built", "detail": "Run `npm run build` in frontend/"},
        )

    return app


def main() -> None:
    config = load_config()

    if not check_port_available(config.port):
        print(f"ERROR: Port {config.port} is already in use.", file=sys.stderr)
        sys.exit(1)

    # Create required directories
    config.absolute_db_path.parent.mkdir(parents=True, exist_ok=True)
    config.absolute_backup_dir.mkdir(parents=True, exist_ok=True)

    # Initialise database (runs migrations)
    init_database(config.absolute_db_path)

    app = create_app(config)

    uvicorn.run(
        app,
        host="127.0.0.1",
        port=config.port,
        log_level="info",
    )


if __name__ == "__main__":
    main()

