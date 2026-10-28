"""Property tests P17 (Backup Retention), P18 (Import Merge IDs),
P24 (UTCDateTime Round-Trip), P25 (CSRF Protection)."""
from __future__ import annotations

import json
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from backend.config import Config
from backend.database import Base
from backend.main import create_app
from backend.api.deps import get_db_session
from backend.models.types import UTCDateTime
from backend.services.backup_service import (
    cleanup_old_backups,
    create_backup,
    list_backups,
)
from backend.services.import_export_service import export_data, import_data


HEADERS = {"X-Calm-X": "1"}


@pytest.fixture
def client(tmp_path):
    """TestClient with an isolated SQLite database."""
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


# ---------------------------------------------------------------------------
# P17: Backup Retention Policy
# ---------------------------------------------------------------------------

class TestP17BackupRetention:
    """Property 17: cleanup_old_backups keeps ≤7 files, removes oldest first."""

    def test_creates_backup_and_lists_it(self, tmp_path):
        """Creating a backup results in a listable file."""
        db_path = tmp_path / "data.db"
        # Create a minimal SQLite database
        conn = sqlite3.connect(str(db_path))
        conn.execute("CREATE TABLE t (id INTEGER PRIMARY KEY)")
        conn.commit()
        conn.close()

        backup_dir = tmp_path / "backups"
        path = create_backup(db_path, backup_dir, trigger="test")

        assert path.exists()
        assert path.stat().st_size > 0

        entries = list_backups(backup_dir)
        assert len(entries) == 1
        assert entries[0]["filename"] == path.name

    def test_cleanup_keeps_7_most_recent(self, tmp_path):
        """After creating 9 backups, only the 7 most recent remain."""
        db_path = tmp_path / "data.db"
        conn = sqlite3.connect(str(db_path))
        conn.execute("CREATE TABLE t (id INTEGER PRIMARY KEY)")
        conn.commit()
        conn.close()

        backup_dir = tmp_path / "backups"
        backup_dir.mkdir()

        # Create 9 backup files with slightly different timestamps
        created = []
        for i in range(9):
            path = create_backup(db_path, backup_dir, trigger=f"test-{i}")
            created.append(path.name)
            time.sleep(0.002)  # ensure unique ms timestamp

        entries = list_backups(backup_dir)
        # cleanup_old_backups is called inside create_backup, keeping max 7
        assert len(entries) <= 7

        # Verify oldest files were removed (newest 7 remain)
        remaining_names = {e["filename"] for e in entries}
        # The 7 most recent should still exist
        for name in created[-7:]:
            assert name in remaining_names, f"{name} should still exist"

    def test_cleanup_only_deletes_matching_pattern(self, tmp_path):
        """cleanup_old_backups never deletes files not matching the pattern."""
        backup_dir = tmp_path / "backups"
        backup_dir.mkdir()

        # Create a non-backup file
        other_file = backup_dir / "important_data.db"
        other_file.write_text("do not delete me")

        # Cleanup should not remove the non-matching file
        deleted = cleanup_old_backups(backup_dir, keep=0)
        assert other_file.exists(), "Non-pattern file must not be deleted"
        assert "important_data.db" not in deleted

    def test_list_backups_sorted_newest_first(self, tmp_path):
        """list_backups returns entries with newest first."""
        db_path = tmp_path / "data.db"
        conn = sqlite3.connect(str(db_path))
        conn.execute("CREATE TABLE t (id INTEGER PRIMARY KEY)")
        conn.commit()
        conn.close()

        backup_dir = tmp_path / "backups"
        backup_dir.mkdir()

        b1 = create_backup(db_path, backup_dir, trigger="first")
        time.sleep(0.002)
        b2 = create_backup(db_path, backup_dir, trigger="second")

        entries = list_backups(backup_dir)
        names = [e["filename"] for e in entries]
        # b2 (newest) should appear before b1
        assert names.index(b2.name) < names.index(b1.name)


# ---------------------------------------------------------------------------
# P18: Import Merge Generates New IDs
# ---------------------------------------------------------------------------

class TestP18ImportMergeNewIDs:
    """Property 18: import merge mode gives all records new IDs."""

    def test_merged_items_get_new_ids(self, tmp_path):
        """After merging, items in the DB have IDs different from the export."""
        db_path = tmp_path / "data.db"
        engine = create_engine(f"sqlite:///{db_path}")
        Base.metadata.create_all(engine)
        factory = sessionmaker(bind=engine)

        with factory() as session:
            # Create some data
            from backend.models.item import Item
            from datetime import datetime, timezone
            now = datetime.now(timezone.utc)
            item = Item(
                type="project", title="Original",
                description="", notes="",
                archived_at=None,
                created_at=now, updated_at=now,
                project_status="active",
            )
            session.add(item)
            session.flush()
            original_id = item.id

            # Export
            exported = export_data(session)
            session.commit()

        with factory() as session:
            # Merge — should generate new IDs
            counts = import_data(session, exported, mode="merge")
            session.commit()

        with factory() as session:
            from sqlalchemy import select
            from backend.models.item import Item as ItemModel
            items = list(session.execute(select(ItemModel)).scalars().all())
            # Should have 2 items (original + merged copy)
            assert len(items) == 2
            ids = {i.id for i in items}
            # The merged item must have gotten a new ID
            assert len(ids) == 2  # No duplicate IDs

    def test_merge_does_not_conflict_with_existing(self, tmp_path):
        """Merging data never overwrites existing records."""
        db_path = tmp_path / "data.db"
        engine = create_engine(f"sqlite:///{db_path}")
        Base.metadata.create_all(engine)
        factory = sessionmaker(bind=engine)

        with factory() as session:
            from backend.models.item import Item
            from datetime import datetime, timezone
            now = datetime.now(timezone.utc)
            item = Item(
                type="area", title="Work Area",
                description="original", notes="",
                archived_at=None,
                created_at=now, updated_at=now,
            )
            session.add(item)
            session.flush()
            original_id = item.id
            exported = export_data(session)
            session.commit()

        with factory() as session:
            counts = import_data(session, exported, mode="merge")
            session.commit()

        with factory() as session:
            # Original must still be intact
            from backend.models.item import Item as ItemModel
            original = session.get(ItemModel, original_id)
            assert original is not None
            assert original.title == "Work Area"
            assert original.description == "original"

    def test_merge_deduplicates_tags_by_name(self, tmp_path):
        """Merging imports with existing tags merges by name (case-insensitive)."""
        db_path = tmp_path / "data.db"
        engine = create_engine(f"sqlite:///{db_path}")
        Base.metadata.create_all(engine)
        factory = sessionmaker(bind=engine)

        with factory() as session:
            from backend.models.item import Tag
            from datetime import datetime, timezone
            now = datetime.now(timezone.utc)
            tag = Tag(name="work", created_at=now)
            session.add(tag)
            session.flush()
            original_tag_id = tag.id
            session.commit()

        # Export data with same "work" tag
        with factory() as session:
            exported = export_data(session)
            session.commit()

        with factory() as session:
            # Merge back — the "work" tag should not be duplicated
            import_data(session, exported, mode="merge")
            session.commit()

        with factory() as session:
            from backend.models.item import Tag as TagModel
            tags = list(session.execute(select(TagModel)).scalars().all())
            work_tags = [t for t in tags if t.name.lower() == "work"]
            assert len(work_tags) == 1, f"Expected 1 'work' tag, got {len(work_tags)}"


# ---------------------------------------------------------------------------
# P24: UTCDateTime Round-Trip Consistency
# ---------------------------------------------------------------------------

class TestP24UTCDatetimeRoundTrip:
    """Property 24: datetimes stored and reloaded are UTC-aware with same instant."""

    def test_item_timestamps_round_trip(self, tmp_path):
        """Item.created_at and updated_at round-trip correctly."""
        db_path = tmp_path / "data.db"
        engine = create_engine(f"sqlite:///{db_path}")
        Base.metadata.create_all(engine)
        factory = sessionmaker(bind=engine)

        original_dt = datetime(2026, 10, 28, 15, 30, 45, 123456, tzinfo=timezone.utc)

        with factory() as session:
            from backend.models.item import Item
            item = Item(
                type="resource", title="Test Item",
                description="", notes="",
                archived_at=None,
                created_at=original_dt, updated_at=original_dt,
            )
            session.add(item)
            session.flush()
            item_id = item.id
            session.commit()

        with factory() as session:
            from backend.models.item import Item as ItemModel
            reloaded = session.get(ItemModel, item_id)
            assert reloaded is not None

            # Must be timezone-aware with UTC tzinfo
            assert reloaded.created_at.tzinfo is not None
            assert reloaded.updated_at.tzinfo is not None

            # Must represent the same instant
            assert reloaded.created_at == original_dt
            assert reloaded.updated_at == original_dt

    def test_utcdatetime_strips_tzinfo_on_write(self, tmp_path):
        """UTCDateTime converts tz-aware to naive UTC for storage."""
        # This tests the TypeDecorator process_bind_param
        db_path = tmp_path / "data.db"
        engine = create_engine(f"sqlite:///{db_path}")
        Base.metadata.create_all(engine)
        factory = sessionmaker(bind=engine)

        # Write with timezone-aware datetime (e.g. +07:00)
        from datetime import timedelta
        tz_plus7 = timezone(timedelta(hours=7))
        dt_local = datetime(2026, 10, 28, 22, 0, 0, tzinfo=tz_plus7)  # = 15:00 UTC

        with factory() as session:
            from backend.models.item import Item
            item = Item(
                type="resource", title="TZ Test",
                description="", notes="",
                archived_at=None,
                created_at=dt_local, updated_at=dt_local,
            )
            session.add(item)
            session.flush()
            item_id = item.id
            session.commit()

        with factory() as session:
            from backend.models.item import Item as ItemModel
            reloaded = session.get(ItemModel, item_id)
            assert reloaded is not None

            # Must be UTC-aware and represent same instant
            assert reloaded.created_at.tzinfo == timezone.utc
            expected_utc = datetime(2026, 10, 28, 15, 0, 0, tzinfo=timezone.utc)
            assert reloaded.created_at == expected_utc

    def test_weekly_review_completed_at_round_trip(self, tmp_path):
        """WeeklyReview.completed_at round-trips correctly."""
        db_path = tmp_path / "data.db"
        engine = create_engine(f"sqlite:///{db_path}")
        Base.metadata.create_all(engine)
        factory = sessionmaker(bind=engine)

        original_dt = datetime(2026, 10, 27, 20, 0, 0, tzinfo=timezone.utc)

        with factory() as session:
            from backend.models.weekly_review import WeeklyReview
            review = WeeklyReview(completed_at=original_dt, notes="test")
            session.add(review)
            session.flush()
            review_id = review.id
            session.commit()

        with factory() as session:
            from backend.models.weekly_review import WeeklyReview as WR
            reloaded = session.get(WR, review_id)
            assert reloaded is not None
            assert reloaded.completed_at.tzinfo is not None
            assert reloaded.completed_at == original_dt


# ---------------------------------------------------------------------------
# P25: CSRF Protection Enforced
# ---------------------------------------------------------------------------

class TestP25CSRFProtection:
    """Property 25: Non-GET requests without X-Calm-X: 1 header return 403."""

    def test_post_without_csrf_header_returns_403(self, client):
        """POST without X-Calm-X: 1 header returns 403."""
        resp = client.post("/api/items", json={"type": "project", "title": "Test"})
        assert resp.status_code == 403

    def test_put_without_csrf_header_returns_403(self, client):
        """PUT without X-Calm-X: 1 header returns 403."""
        resp = client.put("/api/items/1", json={"title": "Updated"})
        assert resp.status_code == 403

    def test_delete_without_csrf_header_returns_403(self, client):
        """DELETE without X-Calm-X: 1 header returns 403."""
        resp = client.delete("/api/items/1")
        assert resp.status_code == 403

    def test_get_without_csrf_header_succeeds(self, client):
        """GET requests don't require the CSRF header."""
        # GET /api/items should work without header
        resp = client.get("/api/items")
        assert resp.status_code == 200

    def test_post_with_csrf_header_passes_csrf_check(self, client):
        """POST with X-Calm-X: 1 passes CSRF validation (may fail for other reasons)."""
        resp = client.post("/api/items", json={"type": "project", "title": "Test"}, headers=HEADERS)
        # CSRF passes — may succeed or fail for business logic reasons, but NOT 403
        assert resp.status_code != 403

    def test_origin_spoofing_blocked(self, client):
        """Non-localhost Origin is rejected for non-GET requests."""
        resp = client.post(
            "/api/items",
            json={"type": "project", "title": "Test"},
            headers={"X-Calm-X": "1", "Origin": "https://evil.example.com"},
        )
        assert resp.status_code == 403
