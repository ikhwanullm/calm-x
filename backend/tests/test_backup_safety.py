"""Daily backups while running, safety copies before permanent delete, and their retention.

Everything here uses tmp_path: nothing touches data/calm_x.db or data/backups.
"""
import sqlite3
import threading
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from backend.api.deps import get_db_session
from backend.config import Config
from backend.database import Base, get_engine
from backend.main import create_app
from backend.services import backup_service
from backend.services.backup_service import (
    check_startup_backup,
    cleanup_old_backups,
    list_backups,
    run_periodic,
    start_periodic_backups,
)

HEADERS = {"X-Calm-X": "1"}


def _touch(backup_dir, name):
    backup_dir.mkdir(parents=True, exist_ok=True)
    (backup_dir / name).write_bytes(b"x")


def _name(day, kind=None, counter=0):
    stem = f"calmx_backup_202610{day:02d}_120000_000"
    return stem + (f"_{counter}" if counter else "") + (f"_{kind}" if kind else "") + ".db"


@pytest.fixture
def db_file(tmp_path):
    path = tmp_path / "live.db"
    con = sqlite3.connect(path)
    con.execute("CREATE TABLE t (x)")
    con.execute("INSERT INTO t VALUES (1)")
    con.commit()
    con.close()
    return path


# ── naming and listing ───────────────────────────────────────────────────────

def test_old_style_names_are_still_listed_as_regular_backups(tmp_path):
    _touch(tmp_path, "calmx_backup_20261001_120000_000.db")
    (entry,) = list_backups(tmp_path)
    assert entry["kind"] is None
    assert entry["created_at"] == datetime(2026, 10, 1, 12, 0, tzinfo=timezone.utc)


def test_safety_copies_and_counter_files_are_listed_with_their_kind(tmp_path):
    for name in (_name(1), _name(2, "pre-delete"), _name(3, "pre-import-replace"), _name(4, counter=2)):
        _touch(tmp_path, name)
    assert [(e["filename"], e["kind"]) for e in list_backups(tmp_path)] == [
        (_name(4, counter=2), None),
        (_name(3, "pre-import-replace"), "pre-import-replace"),
        (_name(2, "pre-delete"), "pre-delete"),
        (_name(1), None),
    ]


def test_create_backup_names_safety_copies_by_trigger(tmp_path, db_file):
    safety = backup_service.create_backup(db_file, tmp_path / "bk", trigger="pre-delete")
    regular = backup_service.create_backup(db_file, tmp_path / "bk", trigger="startup")
    assert safety.name.endswith("_pre-delete.db")
    assert regular.name.endswith(".db") and "pre-" not in regular.name


def test_same_millisecond_backups_get_a_counter_and_are_still_listed(tmp_path, db_file, monkeypatch):
    fixed = datetime(2026, 10, 29, 3, 0, 0, tzinfo=timezone.utc)

    class FrozenDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            return fixed

    monkeypatch.setattr(backup_service, "datetime", FrozenDatetime)
    first = backup_service.create_backup(db_file, tmp_path / "bk")
    second = backup_service.create_backup(db_file, tmp_path / "bk")
    assert first.name != second.name
    assert {e["filename"] for e in list_backups(tmp_path / "bk")} == {first.name, second.name}


# ── retention ────────────────────────────────────────────────────────────────

def test_retention_keeps_7_regular_and_5_safety_separately(tmp_path):
    for day in range(1, 11):                      # 10 regular
        _touch(tmp_path, _name(day))
    for day in range(11, 19):                     # 8 safety, all newer than the regular ones
        _touch(tmp_path, _name(day, "pre-delete"))
    cleanup_old_backups(tmp_path)
    left = list_backups(tmp_path)
    assert sorted(e["filename"] for e in left if e["kind"] is None) == [_name(d) for d in range(4, 11)]
    assert sorted(e["filename"] for e in left if e["kind"]) == [_name(d, "pre-delete") for d in range(14, 19)]


def test_many_safety_copies_never_push_out_regular_backups(tmp_path):
    for day in range(1, 8):
        _touch(tmp_path, _name(day))
    for day in range(10, 30):
        _touch(tmp_path, _name(day, "pre-delete"))
        cleanup_old_backups(tmp_path)
    assert len([e for e in list_backups(tmp_path) if e["kind"] is None]) == 7


def test_cleanup_never_deletes_files_that_do_not_match_the_pattern(tmp_path):
    for name in ("notes.txt", "calmx_backup_bad.db", "calmx_backup_20261001_120000_000_other.db"):
        _touch(tmp_path, name)
    assert cleanup_old_backups(tmp_path, keep=0, keep_safety=0) == []
    assert len(list(tmp_path.iterdir())) == 3


# ── daily check with an injected clock ───────────────────────────────────────

def _clock(*, hours_after):
    base = datetime(2026, 10, 1, 12, 0, tzinfo=timezone.utc)
    return lambda: base + timedelta(hours=hours_after)


def test_check_skips_when_the_newest_regular_backup_is_under_24h_old(tmp_path, db_file):
    bk = tmp_path / "bk"
    _touch(bk, _name(1))
    assert check_startup_backup(db_file, bk, now=_clock(hours_after=23)) is False
    assert len(list_backups(bk)) == 1


def test_check_creates_a_daily_backup_once_it_is_24h_old(tmp_path, db_file):
    bk = tmp_path / "bk"
    _touch(bk, _name(1))
    assert check_startup_backup(db_file, bk, now=_clock(hours_after=24)) is True
    assert len(list_backups(bk)) == 2


def test_a_recent_safety_copy_does_not_postpone_the_daily_backup(tmp_path, db_file):
    bk = tmp_path / "bk"
    _touch(bk, _name(1))
    _touch(bk, "calmx_backup_20261002_110000_000_pre-delete.db")   # a day later, but only a safety copy
    assert check_startup_backup(db_file, bk, now=_clock(hours_after=30)) is True


def test_check_logs_and_returns_false_when_the_backup_fails(tmp_path):
    assert check_startup_backup(tmp_path / "missing.db", tmp_path / "bk") is False


# ── periodic loop ────────────────────────────────────────────────────────────

def test_periodic_loop_runs_the_check_until_stopped_and_survives_errors():
    stop = threading.Event()
    calls = []

    def check():
        calls.append(1)
        if len(calls) == 1:
            raise RuntimeError("first check blows up")
        if len(calls) == 3:
            stop.set()

    run_periodic(check, 0.001, stop)
    assert len(calls) == 3


def test_start_periodic_backups_makes_a_daily_backup_in_the_background(tmp_path, db_file):
    bk = tmp_path / "bk"
    thread, stop = start_periodic_backups(db_file, bk, interval_seconds=0.01)
    try:
        for _ in range(200):
            if list_backups(bk):
                break
            stop.wait(0.02)
    finally:
        stop.set()
        thread.join(timeout=2)
    assert not thread.is_alive() and thread.daemon
    assert len(list_backups(bk)) == 1


# ── pre-delete backup through the API ────────────────────────────────────────

@pytest.fixture
def api(tmp_path):
    db = tmp_path / "app.db"
    config = Config(port=8080, db_path=str(db), backup_dir=str(tmp_path / "backups"))
    app = create_app(config)
    engine = get_engine(f"sqlite:///{db}")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)

    def override():
        s = factory()
        try:
            yield s
            s.commit()
        except Exception:
            s.rollback()
            raise
        finally:
            s.close()

    app.dependency_overrides[get_db_session] = override
    return TestClient(app, base_url="http://localhost:8080", raise_server_exceptions=False)


def _project(api, title="P"):
    r = api.post("/api/items", json={"type": "project", "title": title}, headers=HEADERS)
    assert r.status_code == 201, r.json()
    return r.json()["id"]


def test_permanent_delete_makes_a_pre_delete_backup_that_still_holds_the_item(api, tmp_path):
    item = _project(api, "Precious")
    assert api.delete(f"/api/items/{item}", headers=HEADERS).status_code == 204
    assert api.get(f"/api/items/{item}").status_code == 404
    (entry,) = list_backups(tmp_path / "backups")
    assert entry["kind"] == "pre-delete"
    con = sqlite3.connect(tmp_path / "backups" / entry["filename"])
    assert con.execute("SELECT title FROM items").fetchall() == [("Precious",)]
    con.close()


def test_delete_is_refused_when_the_backup_fails(api, tmp_path, monkeypatch):
    item = _project(api)

    def boom(*args, **kwargs):
        raise RuntimeError("disk full")

    monkeypatch.setattr(backup_service, "create_backup", boom)
    r = api.delete(f"/api/items/{item}", headers=HEADERS)
    assert r.status_code == 500
    assert r.json()["type"] == "backup_failed_error" and "nothing was deleted" in r.json()["error"]
    assert api.get(f"/api/items/{item}").status_code == 200


def test_deleting_a_missing_item_is_404_and_makes_no_backup(api, tmp_path):
    assert api.delete("/api/items/9999", headers=HEADERS).status_code == 404
    assert list_backups(tmp_path / "backups") == []


def test_pre_delete_backups_do_not_push_out_the_regular_ones(api, tmp_path):
    bk = tmp_path / "backups"
    for day in range(1, 8):
        _touch(bk, _name(day))
    for i in range(8):
        assert api.delete(f"/api/items/{_project(api, f'P{i}')}", headers=HEADERS).status_code == 204
    kinds = [e["kind"] for e in list_backups(bk)]
    assert kinds.count(None) == 7 and kinds.count("pre-delete") == 5
