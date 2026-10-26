"""Tests for CSRF middleware."""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.middleware.csrf import CSRFProtectionMiddleware


def make_app(port: int = 8080) -> FastAPI:
    app = FastAPI()
    app.add_middleware(CSRFProtectionMiddleware, port=port)

    @app.get("/ping")
    def ping():
        return {"ok": True}

    @app.post("/data")
    def post_data():
        return {"ok": True}

    @app.delete("/item")
    def delete_item():
        return {"ok": True}

    return app


@pytest.fixture()
def client():
    return TestClient(make_app(), raise_server_exceptions=False)


def test_get_allowed_without_header(client):
    resp = client.get("/ping")
    assert resp.status_code == 200


def test_post_without_header_rejected(client):
    resp = client.post("/data")
    assert resp.status_code == 403
    assert "X-Calm-X" in resp.json()["detail"]


def test_post_with_header_accepted(client):
    resp = client.post("/data", headers={"X-Calm-X": "1"})
    assert resp.status_code == 200


def test_delete_with_header_accepted(client):
    resp = client.delete("/item", headers={"X-Calm-X": "1"})
    assert resp.status_code == 200


def test_post_wrong_origin_rejected(client):
    resp = client.post(
        "/data",
        headers={"X-Calm-X": "1", "Origin": "http://evil.com"},
    )
    assert resp.status_code == 403
    assert "not allowed" in resp.json()["detail"]


def test_post_correct_origin_accepted(client):
    resp = client.post(
        "/data",
        headers={"X-Calm-X": "1", "Origin": "http://localhost:8080"},
    )
    assert resp.status_code == 200


def test_post_127_origin_accepted(client):
    resp = client.post(
        "/data",
        headers={"X-Calm-X": "1", "Origin": "http://127.0.0.1:8080"},
    )
    assert resp.status_code == 200


def test_dev_origins_from_env(monkeypatch):
    monkeypatch.setenv("CALM_X_DEV_ORIGINS", "http://localhost:5173")
    client = TestClient(make_app(), raise_server_exceptions=False)
    resp = client.post(
        "/data",
        headers={"X-Calm-X": "1", "Origin": "http://localhost:5173"},
    )
    assert resp.status_code == 200


def test_options_allowed_without_header(client):
    resp = client.options("/data")
    assert resp.status_code in (200, 405)  # middleware passes, FastAPI may 405
