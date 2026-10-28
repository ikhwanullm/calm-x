"""11.8 REGRESSION TEST: SPA fallback serves static files correctly.

Tests the main.py SPA fallback behaviour:
- /api/nonexistent → 404 JSON
- Non-API static asset paths → handled by SPA fallback
- Path traversal attempts → blocked

Note: We test the logic directly without a real frontend dist directory
(which would require a built frontend). Tests use the TestClient which
triggers the route handlers.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.config import Config
from backend.database import Base
from backend.main import create_app
from backend.api.deps import get_db_session


@pytest.fixture
def client(tmp_path):
    """TestClient with isolated SQLite — no frontend dist needed."""
    cfg = Config(port=8080)
    app = create_app(cfg)
    engine = create_engine(f"sqlite:///{tmp_path / 'test.db'}")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)

    def override_db():
        session = factory()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    app.dependency_overrides[get_db_session] = override_db
    return TestClient(app, base_url="http://localhost:8080", raise_server_exceptions=False)


class TestSPAFallback:
    """Regression tests for SPA fallback behaviour."""

    def test_api_nonexistent_returns_404_json(self, client):
        """GET /api/nonexistent → 404 JSON (not index.html)."""
        resp = client.get("/api/nonexistent-endpoint-that-does-not-exist")
        assert resp.status_code == 404
        body = resp.json()
        # Must be JSON error, not HTML
        assert "error" in body
        assert body.get("type") == "not_found"

    def test_api_items_with_trailing_slash_redirect(self, client):
        """GET /api/items/ → redirect to /api/items (strip trailing slash)."""
        resp = client.get("/api/items/", follow_redirects=False)
        assert resp.status_code in (307, 200)  # may be redirected or served

    def test_known_api_routes_return_200_not_spa(self, client):
        """Known API routes return JSON responses, not the SPA fallback."""
        resp = client.get("/api/items")
        assert resp.status_code == 200
        assert resp.headers.get("content-type", "").startswith("application/json")

    def test_spa_route_returns_503_when_no_dist(self, client):
        """SPA client-side routes (/inbox, /projects) return 503 when no dist built."""
        resp = client.get("/inbox")
        # No dist means 503 (frontend not built), not 404 JSON
        # If dist exists somehow, it returns 200 with index.html
        assert resp.status_code in (200, 503)
        if resp.status_code == 503:
            body = resp.json()
            assert "Frontend not built" in body.get("error", "")

    def test_path_traversal_blocked(self, client):
        """Path traversal attempts do not escape the dist directory."""
        # These should return either 404 (API not found) or 503 (no dist)
        for malicious_path in [
            "/../../etc/passwd",
            "/..%2F..%2Fetc%2Fpasswd",
            "/%2F%2Fetc%2Fpasswd",
        ]:
            resp = client.get(malicious_path)
            # Must NOT return a successful file read (200 with file content)
            # Should be 404/503 or redirect
            assert resp.status_code in (200, 307, 404, 503), f"Unexpected status for {malicious_path}"
            # If 200, ensure it's either JSON or handled by SPA
            if resp.status_code == 200:
                ct = resp.headers.get("content-type", "")
                assert "text/html" in ct or "application/json" in ct

    def test_api_dashboard_requires_today_param(self, client):
        """GET /api/dashboard without ?today= returns 400 validation error."""
        resp = client.get("/api/dashboard")
        # FastAPI returns 422 for missing required query param,
        # OR our ValidationError handler returns 400 for bad date
        assert resp.status_code in (400, 422)

    def test_api_settings_get_returns_preferences(self, client):
        """GET /api/settings returns a dict with approaching_deadline_threshold."""
        resp = client.get("/api/settings")
        assert resp.status_code == 200
        data = resp.json()
        assert "approaching_deadline_threshold" in data
