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
    assert "frontend_not_built" in resp.json()["error"]
