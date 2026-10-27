"""Calm-X application entry point."""
from __future__ import annotations

import logging
import socket
import sys
from pathlib import Path

import uvicorn
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
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


def _safe_static_file(full_path: str, dist_path: Path) -> FileResponse | None:
    """Return a FileResponse only if the resolved path is inside dist_path.

    Guards against:
    - Path traversal (../../etc/passwd, ..%2f..)
    - Absolute paths on Windows (C:\\...)
    - Any path that resolves outside dist_path
    """
    if not dist_path.exists():
        return None
    # Reject obviously dangerous patterns early
    if full_path.startswith("/") or (len(full_path) > 1 and full_path[1] == ":"):
        return None
    candidate = (dist_path / full_path).resolve()
    try:
        candidate.relative_to(dist_path.resolve())
    except ValueError:
        return None
    if candidate.exists() and candidate.is_file():
        return FileResponse(str(candidate))
    return None


def create_app(config=None, extra_routers=None) -> FastAPI:
    """Application factory."""
    if config is None:
        config = load_config()

    app = FastAPI(title="Calm-X", version="0.1.0", docs_url="/api/docs")

    # --- Middleware ---
    # Strip trailing slashes from /api/... paths for all HTTP methods.
    # FastAPI's redirect_slashes only works for routes it knows about;
    # the SPA catch-all blocks it. This middleware fires before routing.
    @app.middleware("http")
    async def strip_api_trailing_slash(request: Request, call_next):
        path = request.url.path
        if path.startswith("/api/") and path.endswith("/") and len(path) > 5:
            target = path.rstrip("/")
            qs = request.url.query
            if qs:
                target += "?" + qs
            return RedirectResponse(url=target, status_code=307)
        return await call_next(request)

    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=["localhost", "127.0.0.1"],
    )
    app.add_middleware(CSRFProtectionMiddleware, port=config.port, dev_origins=config.dev_origins)

    # --- Exception handlers (design.md error contract) ---
    @app.exception_handler(RequestValidationError)
    async def request_validation_handler(request: Request, exc: RequestValidationError):
        fields: dict[str, list[str]] = {}
        for error in exc.errors():
            loc = ".".join(str(p) for p in error.get("loc", []) if p != "body")
            fields.setdefault(loc, []).append(error.get("msg", "invalid"))
        return JSONResponse(
            status_code=400,
            content={
                "error": "Validation failed",
                "type": "validation_error",
                "fields": fields,
            },
        )

    @app.exception_handler(IntegrityError)
    async def integrity_error_handler(request: Request, exc: IntegrityError):
        return JSONResponse(
            status_code=409,
            content={"error": str(exc.orig), "type": "conflict"},
        )

    @app.exception_handler(CalmXException)
    async def calmx_exception_handler(request: Request, exc: CalmXException):
        status_code = EXCEPTION_STATUS_MAP.get(type(exc), 500)
        return JSONResponse(
            status_code=status_code,
            content={"error": exc.message, "type": get_exception_type_name(exc)},
        )

    # --- Static files ---
    dist_path: Path = config.absolute_frontend_dist
    assets_path = dist_path / "assets"

    if assets_path.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_path)), name="assets")

    # --- Built-in API routers ---
    from backend.api.links import router as links_router
    app.include_router(links_router, prefix="/api")
    from backend.api.links import router as links_router
    app.include_router(links_router, prefix="/api")
    from backend.api.dashboard import router as dashboard_router
    app.include_router(dashboard_router, prefix="/api")
    from backend.api.items import router as items_router
    app.include_router(items_router, prefix="/api")
    from backend.api.tags import router as tags_router
    app.include_router(tags_router, prefix="/api")
    from backend.api.settings import router as settings_router
    app.include_router(settings_router, prefix="/api")
    from backend.api.tasks import router as tasks_router
    app.include_router(tasks_router, prefix="/api")
    from backend.api.subtasks import router as subtasks_router
    app.include_router(subtasks_router, prefix="/api")

    # --- Extra routers (registered before SPA fallback) ---
    if extra_routers:
        for router in extra_routers:
            app.include_router(router)

    # --- SPA fallback ---
    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(request: Request, full_path: str):
        # Paths beginning with "api" or "api/" are API routes that were not found.
        # Return 404 JSON — never serve index.html for API paths.
        if full_path == "api" or full_path.startswith("api/"):
            # Redirect trailing-slash API paths (/api/items/ -> /api/items).
            # FastAPI redirect_slashes cannot fire because this catch-all matches first.
            # Trailing slash: already handled by strip_api_trailing_slash middleware.
            # If we still reach here the path truly does not exist.
            return JSONResponse(
                status_code=404,
                content={"error": f"API route not found: /{full_path}", "type": "not_found"},
            )

        # Try to serve a specific static file (with path traversal protection)
        file_resp = _safe_static_file(full_path, dist_path)
        if file_resp is not None:
            return file_resp

        # Fallback to index.html for SPA client-side routing
        index_html = dist_path / "index.html"
        if index_html.exists():
            return FileResponse(str(index_html))

        return JSONResponse(
            status_code=503,
            content={
                "error": "Frontend not built. Run `npm run build` in frontend/.",
                "type": "not_found",
            },
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
