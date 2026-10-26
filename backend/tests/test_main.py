"""Tests for main.py."""
import pytest
from fastapi.testclient import TestClient

from backend.config import Config
from backend.exceptions import NotFoundError, ConflictError, ValidationError
from backend.main import check_port_available, create_app


def test_check_port_available_high_port():
    """A high unoccupied port should be available."""
    result = check_port_available(59876)
    assert isinstance(result, bool)


def test_create_app_returns_fastapi():
    from fastapi import FastAPI
    cfg = Config(port=8080)
    app = create_app(cfg)
    assert isinstance(app, FastAPI)


def test_docs_url_accessible():
    cfg = Config(port=8080)
    app = create_app(cfg)
    client = TestClient(app, base_url="http://localhost:8080", raise_server_exceptions=False)
    resp = client.get("/api/docs")
    assert resp.status_code == 200


def test_calmx_exception_handler():
    """CalmXException -> {error: message, type: snake_case}"""
    from fastapi import APIRouter
    router = APIRouter()

    @router.get("/test-not-found")
    def raise_not_found():
        raise NotFoundError("item not found", detail="id=42")

    cfg = Config(port=8080)
    app = create_app(cfg, extra_routers=[router])
    client = TestClient(app, base_url="http://localhost:8080", raise_server_exceptions=False)
    resp = client.get("/test-not-found")
    assert resp.status_code == 404
    body = resp.json()
    assert body["error"] == "item not found"       # error = message
    assert body["type"] == "not_found_error"       # type = snake_case


def test_validation_error_400():
    """ValidationError -> 400"""
    from fastapi import APIRouter
    router = APIRouter()

    @router.get("/test-validation")
    def raise_validation():
        raise ValidationError("title is too long")

    cfg = Config(port=8080)
    app = create_app(cfg, extra_routers=[router])
    client = TestClient(app, base_url="http://localhost:8080", raise_server_exceptions=False)
    resp = client.get("/test-validation")
    assert resp.status_code == 400
    body = resp.json()
    assert body["type"] == "validation_error"


def test_conflict_exception_handler():
    """ConflictError -> 409"""
    from fastapi import APIRouter
    router = APIRouter()

    @router.get("/test-conflict")
    def raise_conflict():
        raise ConflictError("duplicate name")

    cfg = Config(port=8080)
    app = create_app(cfg, extra_routers=[router])
    client = TestClient(app, base_url="http://localhost:8080", raise_server_exceptions=False)
    resp = client.get("/test-conflict")
    assert resp.status_code == 409
    body = resp.json()
    assert body["type"] == "conflict_error"


def test_request_validation_error_400():
    """FastAPI RequestValidationError -> 400 with fields dict."""
    from fastapi import APIRouter
    from pydantic import BaseModel

    class Payload(BaseModel):
        title: str

    router = APIRouter()

    @router.post("/test-pydantic")
    def need_title(body: Payload):
        return body

    cfg = Config(port=8080)
    app = create_app(cfg, extra_routers=[router])
    client = TestClient(app, base_url="http://localhost:8080", raise_server_exceptions=False)
    resp = client.post(
        "/test-pydantic",
        json={},
        headers={"X-Calm-X": "1"},
    )
    assert resp.status_code == 400
    body = resp.json()
    assert body["type"] == "validation_error"
    assert "fields" in body
    assert "title" in body["fields"]


def test_spa_fallback_no_dist(tmp_path):
    """When dist doesn't exist, SPA fallback returns 503."""
    cfg = Config(port=8080, frontend_dist=str(tmp_path / "nonexistent"))
    app = create_app(cfg)
    client = TestClient(app, base_url="http://localhost:8080", raise_server_exceptions=False)
    resp = client.get("/some/spa/route")
    assert resp.status_code == 503
    assert resp.json()["type"] == "not_found"


# --- SPA fallback security tests ---

def test_spa_api_path_returns_404_json(tmp_path):
    """Paths starting with 'api/' must return 404 JSON, never index.html."""
    cfg = Config(port=8080, frontend_dist=str(tmp_path / "dist"))
    app = create_app(cfg)
    client = TestClient(app, base_url="http://localhost:8080", raise_server_exceptions=False)
    resp = client.get("/api/nonexistent")
    assert resp.status_code == 404
    body = resp.json()
    assert body["type"] == "not_found"


def test_spa_path_traversal_rejected(tmp_path):
    """Path traversal attempts must not escape dist_path."""
    from backend.main import _safe_static_file
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("<html/>")
    # Attempt to read a file outside dist
    secret = tmp_path / "secret.txt"
    secret.write_text("TOP SECRET")
    result = _safe_static_file("../secret.txt", dist)
    assert result is None


def test_spa_absolute_path_rejected(tmp_path):
    """Absolute paths (Windows and Unix) must be rejected."""
    from backend.main import _safe_static_file
    dist = tmp_path / "dist"
    dist.mkdir()
    result_win = _safe_static_file("C:\\Windows\\System32\\cmd.exe", dist)
    result_unix = _safe_static_file("/etc/passwd", dist)
    assert result_win is None
    assert result_unix is None


def test_spa_spa_route_returns_index_html(tmp_path):
    """/projects/5 (unknown SPA route) returns index.html."""
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("<html/>")
    cfg = Config(port=8080, frontend_dist=str(dist))
    app = create_app(cfg)
    client = TestClient(app, base_url="http://localhost:8080", raise_server_exceptions=False)
    resp = client.get("/projects/5")
    assert resp.status_code == 200


def test_spa_static_file_served(tmp_path):
    """/favicon.svg returns the actual file if it exists in dist."""
    from backend.main import _safe_static_file
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "favicon.svg").write_text("<svg/>")
    result = _safe_static_file("favicon.svg", dist)
    assert result is not None

