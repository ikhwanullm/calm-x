"""API tests for backup and import/export endpoints.

All tests use tmp_path config — verified to NEVER touch data/calm_x.db
or data/backups (app.state.config set from Config with tmp_path).
"""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.config import Config
from backend.database import Base
from backend.main import create_app
from backend.api.deps import get_db_session

HEADERS = {"X-Calm-X": "1"}


@pytest.fixture
def tmp_config(tmp_path):
    """Config pointing entirely to tmp_path — never touches production data."""
    db_file = tmp_path / "test.db"
    backup_dir = tmp_path / "backups"
    backup_dir.mkdir()
    return Config(
        port=8080,
        db_path=str(db_file),
        backup_dir=str(backup_dir),
    )


@pytest.fixture
def client(tmp_path, tmp_config):
    """TestClient wired with tmp_path config and isolated SQLite DB."""
    app = create_app(tmp_config)

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


# ---------------------------------------------------------------------------
# Backup API
# ---------------------------------------------------------------------------

class TestBackupList:
    def test_list_returns_empty_when_no_backups(self, client, tmp_config):
        """GET /api/backup/list returns empty list when backup dir is empty."""
        resp = client.get("/api/backup/list")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0
        assert data["backups"] == []

    def test_backup_dir_is_tmp_not_production(self, client, tmp_config):
        """Sanity check: the config used is tmp_path, not production path."""
        assert "calm_x.db" not in str(tmp_config.absolute_db_path)
        assert "data/backups" not in str(tmp_config.absolute_backup_dir).replace("\\", "/")


class TestBackupCreate:
    def test_create_backup_returns_201(self, client, tmp_path, tmp_config):
        """POST /api/backup/create creates backup in tmp_path backup_dir."""
        # Create a real SQLite DB at the config path so VACUUM INTO works
        db_path = tmp_config.absolute_db_path
        conn = sqlite3.connect(str(db_path))
        conn.execute("CREATE TABLE t (id INTEGER PRIMARY KEY)")
        conn.commit()
        conn.close()

        resp = client.post("/api/backup/create", headers=HEADERS)
        assert resp.status_code == 201
        data = resp.json()
        assert data["filename"].startswith("calmx_backup_")
        assert data["filename"].endswith(".db")
        assert data["size"] > 0
        assert "created_at" in data

    def test_backup_file_created_in_tmp_dir(self, client, tmp_path, tmp_config):
        """Backup file is created in the tmp backup_dir, not production."""
        db_path = tmp_config.absolute_db_path
        conn = sqlite3.connect(str(db_path))
        conn.execute("CREATE TABLE t (id INTEGER PRIMARY KEY)")
        conn.commit()
        conn.close()

        resp = client.post("/api/backup/create", headers=HEADERS)
        assert resp.status_code == 201
        filename = resp.json()["filename"]

        # File exists in tmp backup dir
        assert (tmp_config.absolute_backup_dir / filename).exists()
        # Sanity: NOT in production data/backups
        prod_path = Path("data/backups") / filename
        assert not prod_path.exists()

    def test_backup_appears_in_list(self, client, tmp_path, tmp_config):
        """After creating backup, it appears in GET /api/backup/list."""
        db_path = tmp_config.absolute_db_path
        conn = sqlite3.connect(str(db_path))
        conn.execute("CREATE TABLE t (id INTEGER PRIMARY KEY)")
        conn.commit()
        conn.close()

        client.post("/api/backup/create", headers=HEADERS)
        resp = client.get("/api/backup/list")
        assert resp.json()["total"] == 1


# ---------------------------------------------------------------------------
# Export API
# ---------------------------------------------------------------------------

class TestExport:
    def test_export_returns_json_attachment(self, client):
        """GET /api/export returns a JSON response with Content-Disposition."""
        resp = client.get("/api/export")
        assert resp.status_code == 200
        assert "attachment" in resp.headers.get("content-disposition", "")
        assert "calmx_export_" in resp.headers.get("content-disposition", "")

    def test_export_has_required_keys(self, client):
        """Export JSON includes schema_version and all required tables."""
        resp = client.get("/api/export")
        data = resp.json()
        for key in (
            "schema_version", "items", "tasks", "subtasks", "tags", "task_tags",
            "reference_links", "resource_links", "templates", "template_tasks",
            "weekly_reviews", "user_preferences",
        ):
            assert key in data, f"Missing key: {key}"
        assert data["schema_version"] == 1

    def test_export_includes_created_item(self, client):
        """Items created before export appear in the export data."""
        client.post(
            "/api/items",
            json={"type": "project", "title": "Export Test"},
            headers=HEADERS,
        )
        resp = client.get("/api/export")
        items = resp.json()["items"]
        assert any(i["title"] == "Export Test" for i in items)


# ---------------------------------------------------------------------------
# Import API — merge mode
# ---------------------------------------------------------------------------

class TestImportMerge:
    def _export_data(self, client) -> dict:
        return client.get("/api/export").json()

    def test_merge_empty_export_returns_200(self, client):
        """Importing an empty (fresh) export in merge mode succeeds."""
        data = self._export_data(client)
        resp = client.post(
            "/api/import?mode=merge",
            content=json.dumps(data).encode(),
            headers={**HEADERS, "Content-Type": "application/json"},
        )
        assert resp.status_code == 200
        assert resp.json()["mode"] == "merge"

    def test_merge_creates_new_ids(self, client):
        """Merging an export with existing data creates new records, not duplicates."""
        # Create one item
        client.post("/api/items", json={"type": "area", "title": "Area A"}, headers=HEADERS)

        # Export and re-import (merge)
        data = self._export_data(client)
        client.post(
            "/api/import?mode=merge",
            content=json.dumps(data).encode(),
            headers={**HEADERS, "Content-Type": "application/json"},
        )

        # Should now have 2 items
        items = client.get("/api/items?include_archived=true").json()
        titles = [i["title"] for i in items]
        assert titles.count("Area A") == 2

    def test_merge_default_mode(self, client):
        """Default mode (no ?mode=) is merge."""
        data = self._export_data(client)
        resp = client.post(
            "/api/import",
            content=json.dumps(data).encode(),
            headers={**HEADERS, "Content-Type": "application/json"},
        )
        assert resp.status_code == 200
        assert resp.json()["mode"] == "merge"


# ---------------------------------------------------------------------------
# Import API — replace mode
# ---------------------------------------------------------------------------

class TestImportReplace:
    def test_replace_requires_backup_dir(self, client, tmp_path, tmp_config):
        """Replace mode creates a backup in tmp backup_dir before replacing."""
        db_path = tmp_config.absolute_db_path
        conn = sqlite3.connect(str(db_path))
        conn.execute("CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY, type TEXT, title TEXT, description TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', created_at DATETIME, updated_at DATETIME)")
        conn.commit()
        conn.close()

        # Create an item, export, then replace
        client.post("/api/items", json={"type": "resource", "title": "R1"}, headers=HEADERS)
        data = client.get("/api/export").json()

        resp = client.post(
            "/api/import?mode=replace",
            content=json.dumps(data).encode(),
            headers={**HEADERS, "Content-Type": "application/json"},
        )
        # After replace, a backup should exist in the tmp backup_dir
        backups = list(tmp_config.absolute_backup_dir.glob("calmx_backup_*.db"))
        assert len(backups) >= 1


# ---------------------------------------------------------------------------
# Import API — validation
# ---------------------------------------------------------------------------

class TestImportValidation:
    def test_invalid_json_returns_400(self, client):
        """Non-JSON body returns 400."""
        resp = client.post(
            "/api/import",
            content=b"not json at all {{{",
            headers={**HEADERS, "Content-Type": "application/json"},
        )
        assert resp.status_code == 400
        assert "json" in resp.json()["error"].lower()

    def test_wrong_schema_version_returns_400(self, client):
        """schema_version other than 1 returns 400."""
        data = {"schema_version": 99, "items": [], "tasks": [], "subtasks": [],
                "tags": [], "task_tags": [], "reference_links": [], "resource_links": [],
                "templates": [], "template_tasks": [], "weekly_reviews": [],
                "user_preferences": []}
        resp = client.post(
            "/api/import",
            content=json.dumps(data).encode(),
            headers={**HEADERS, "Content-Type": "application/json"},
        )
        assert resp.status_code == 400
        assert "schema_version" in resp.json()["error"].lower()

    def test_missing_required_keys_returns_400(self, client):
        """Import data missing required table keys returns 400."""
        data = {"schema_version": 1, "items": []}  # missing other tables
        resp = client.post(
            "/api/import",
            content=json.dumps(data).encode(),
            headers={**HEADERS, "Content-Type": "application/json"},
        )
        assert resp.status_code == 400

    def test_payload_too_large_returns_400(self, client):
        """Import body > 10 MB returns 400."""
        big_body = b"x" * (10 * 1024 * 1024 + 1)
        resp = client.post(
            "/api/import",
            content=big_body,
            headers={**HEADERS, "Content-Type": "application/json"},
        )
        assert resp.status_code == 400
        assert "too large" in resp.json()["error"].lower()

    def test_invalid_task_reference_returns_400(self, client):
        """Import with task referencing nonexistent item_id returns 400."""
        data = {"schema_version": 1, "items": [],
                "tasks": [{"id": 1, "item_id": 999, "title": "T", "description": "",
                           "notes": "", "priority": "medium", "is_complete": 0, "sort_order": 0}],
                "subtasks": [], "tags": [], "task_tags": [], "reference_links": [],
                "resource_links": [], "templates": [], "template_tasks": [],
                "weekly_reviews": [], "user_preferences": []}
        resp = client.post(
            "/api/import",
            content=json.dumps(data).encode(),
            headers={**HEADERS, "Content-Type": "application/json"},
        )
        assert resp.status_code == 400
        assert "item_id" in resp.json()["error"].lower() or "unknown" in resp.json()["error"].lower()

    def test_import_does_not_modify_data_on_validation_failure(self, client):
        """When import validation fails, existing data is unchanged."""
        # Create an item
        client.post("/api/items", json={"type": "area", "title": "Safe Area"}, headers=HEADERS)

        # Try to import data with bad FK reference
        data = {"schema_version": 1, "items": [],
                "tasks": [{"id": 1, "item_id": 888, "title": "Bad", "description": "",
                           "notes": "", "priority": "medium", "is_complete": 0, "sort_order": 0}],
                "subtasks": [], "tags": [], "task_tags": [], "reference_links": [],
                "resource_links": [], "templates": [], "template_tasks": [],
                "weekly_reviews": [], "user_preferences": []}
        resp = client.post(
            "/api/import",
            content=json.dumps(data).encode(),
            headers={**HEADERS, "Content-Type": "application/json"},
        )
        assert resp.status_code == 400

        # Existing data still intact
        items = client.get("/api/items").json()
        assert len(items) == 1
        assert items[0]["title"] == "Safe Area"
