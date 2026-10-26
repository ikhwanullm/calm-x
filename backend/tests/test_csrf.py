"""Tests for CSRF middleware."""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.middleware.csrf import CSRFProtectionMiddleware


def make_app(port: int = 8080, dev_origins: list | None = None) -> FastAPI:
    app = FastAPI()
    app.add_middleware(CSRFProtectionMiddleware, port=port, dev_origins=dev_origins)

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


def test_dev_origins_passed_via_constructor():
    """dev_origins from config accepted via constructor (not os.environ)."""
    client = TestClient(
        make_app(dev_origins=["http://localhost:5173"]),
        raise_server_exceptions=False,
    )
    resp = client.post(
        "/data",
        headers={"X-Calm-X": "1", "Origin": "http://localhost:5173"},
    )
    assert resp.status_code == 200


def test_dev_origin_rejected_when_not_configured(client):
    """A dev origin NOT in the allowed list is rejected even with X-Calm-X header."""
    resp = client.post(
        "/data",
        headers={"X-Calm-X": "1", "Origin": "http://localhost:5173"},
    )
    assert resp.status_code == 403


def test_options_allowed_without_header(client):
    resp = client.options("/data")
    assert resp.status_code in (200, 405)
