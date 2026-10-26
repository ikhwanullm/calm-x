"""CSRF protection middleware for Calm-X.

Strategy:
- All non-GET/HEAD/OPTIONS requests must include ``X-Calm-X: 1`` header.
- The ``Origin`` header (if present) must match allowed origins:
  localhost:<port>, 127.0.0.1:<port>, plus dev_origins from config.
- Returns 403 JSON on failure.
"""
from __future__ import annotations

import json
import logging

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger(__name__)

SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


class CSRFProtectionMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, port: int = 8080, dev_origins: list[str] | None = None) -> None:
        super().__init__(app)
        self.port = port
        self._allowed_origins: set[str] = self._build_allowed_origins(port, dev_origins or [])

    def _build_allowed_origins(self, port: int, dev_origins: list[str]) -> set[str]:
        origins = {
            f"http://localhost:{port}",
            f"http://127.0.0.1:{port}",
        }
        for origin in dev_origins:
            origin = origin.strip()
            if origin:
                origins.add(origin)
        return origins

    async def dispatch(self, request: Request, call_next) -> Response:
        if request.method in SAFE_METHODS:
            return await call_next(request)

        # Check X-Calm-X header
        if request.headers.get("X-Calm-X") != "1":
            logger.warning("CSRF: missing X-Calm-X header from %s %s", request.method, request.url.path)
            return self._forbidden("Missing X-Calm-X header")

        # Check Origin header (only if present)
        origin = request.headers.get("Origin")
        if origin is not None and origin not in self._allowed_origins:
            logger.warning("CSRF: disallowed origin %r for %s %s", origin, request.method, request.url.path)
            return self._forbidden(f"Origin not allowed: {origin}")

        return await call_next(request)

    @staticmethod
    def _forbidden(reason: str) -> Response:
        body = json.dumps({"error": "forbidden", "detail": reason})
        return Response(content=body, status_code=403, media_type="application/json")
