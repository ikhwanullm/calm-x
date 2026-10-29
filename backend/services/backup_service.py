"""Backup service: SQLite VACUUM INTO backups with retention policy."""
from __future__ import annotations

import logging
import re
import sqlite3
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Callable, Optional

logger = logging.getLogger(__name__)

# Pattern: calmx_backup_YYYYMMDD_HHMMSS_mmm[_N][_kind].db
#   _N    counter, only when two backups land in the same millisecond
#   kind  only for safety copies taken right before a destructive action
_SAFETY_KINDS = ("pre-delete", "pre-import-replace")
_BACKUP_PATTERN = re.compile(
    r"^calmx_backup_(\d{8}_\d{6}_\d{3})(?:_(\d+))?(?:_(" + "|".join(_SAFETY_KINDS) + r"))?\.db$"
)
_MAX_BACKUPS = 7          # regular (startup / daily / manual) backups
_MAX_SAFETY_BACKUPS = 5   # safety copies, kept apart so they never push out the regular ones
_PERIODIC_CHECK_SECONDS = 3600


def _make_filename(ts: datetime, counter: int = 0, kind: Optional[str] = None) -> str:
    """Build a backup filename from a UTC datetime."""
    ms = str(ts.microsecond // 1000).zfill(3)
    name = f"calmx_backup_{ts.strftime('%Y%m%d_%H%M%S')}_{ms}"
    if counter:
        name += f"_{counter}"
    if kind:
        name += f"_{kind}"
    return name + ".db"


def _is_backup_file(name: str) -> bool:
    return bool(_BACKUP_PATTERN.match(name))


def list_backups(backup_dir: Path) -> list[dict]:
    """Return backup metadata sorted newest first.

    Each dict has:
        filename  – bare filename (str)
        size      – file size in bytes (int)
        created_at – datetime parsed from filename (UTC-aware datetime)
        kind      – "pre-delete" / "pre-import-replace" for safety copies, else None
    """
    if not backup_dir.exists():
        return []
    entries = []
    for f in backup_dir.iterdir():
        m = _BACKUP_PATTERN.match(f.name) if f.is_file() else None
        if not m:
            continue
        ts_str = m.group(1)   # "20261028_103045_042"
        date_part = ts_str[:8]       # "20261028"
        time_part = ts_str[9:15]     # "103045"
        ms_part   = ts_str[16:19]    # "042"
        try:
            dt = datetime(
                int(date_part[:4]), int(date_part[4:6]), int(date_part[6:8]),
                int(time_part[:2]), int(time_part[2:4]), int(time_part[4:6]),
                int(ms_part) * 1000,
                tzinfo=timezone.utc,
            )
        except ValueError:
            dt = datetime.now(timezone.utc)
        entries.append(((ts_str, int(m.group(2) or 0)), {
            "filename": f.name,
            "size": f.stat().st_size,
            "created_at": dt,
            "kind": m.group(3),
        }))
    entries.sort(key=lambda e: e[0], reverse=True)  # timestamp, then counter = chronological
    return [entry for _, entry in entries]


def create_backup(db_path: Path, backup_dir: Path, trigger: str = "manual") -> Path:
    """Create a backup using VACUUM INTO and return the backup file path.

    Args:
        db_path: Path to the source SQLite database.
        backup_dir: Directory to write the backup.
        trigger: Reason for the backup (e.g. "manual", "startup"). "pre-delete" and
            "pre-import-replace" mark safety copies, which have their own retention.

    Returns:
        Path of the newly created backup file.

    Raises:
        RuntimeError: if VACUUM INTO fails.
    """
    if not Path(db_path).is_file():
        # sqlite3.connect would silently create an empty database here and "back it up"
        raise RuntimeError(f"Database file not found: {db_path}")
    backup_dir.mkdir(parents=True, exist_ok=True)

    now = datetime.now(timezone.utc)
    kind = trigger if trigger in _SAFETY_KINDS else None
    backup_path = backup_dir / _make_filename(now, kind=kind)

    # Ensure uniqueness within the same millisecond by appending a counter
    counter = 0
    while backup_path.exists():
        counter += 1
        backup_path = backup_dir / _make_filename(now, counter, kind)

    try:
        conn = sqlite3.connect(str(db_path))
        try:
            conn.execute(f"VACUUM INTO '{backup_path}'")
        finally:
            conn.close()
    except Exception as exc:
        # Remove partially-created file if it exists
        if backup_path.exists():
            try:
                backup_path.unlink()
            except OSError:
                pass
        raise RuntimeError(f"VACUUM INTO failed: {exc}") from exc

    logger.info("Backup created: %s (trigger=%s)", backup_path.name, trigger)
    cleanup_old_backups(backup_dir)
    return backup_path


def cleanup_old_backups(
    backup_dir: Path, keep: int = _MAX_BACKUPS, keep_safety: int = _MAX_SAFETY_BACKUPS
) -> list[str]:
    """Delete oldest backups: at most `keep` regular files and `keep_safety` safety copies stay.

    Only deletes files matching the backup naming pattern — never other files.
    Returns list of deleted filenames.
    """
    backups = list_backups(backup_dir)  # newest first
    regular = [b for b in backups if b["kind"] is None]
    safety = [b for b in backups if b["kind"] is not None]

    deleted: list[str] = []
    for entry in regular[keep:] + safety[keep_safety:]:
        path = backup_dir / entry["filename"]
        try:
            path.unlink()
            deleted.append(entry["filename"])
            logger.info("Deleted old backup: %s", entry["filename"])
        except OSError as exc:
            logger.warning("Could not delete backup %s: %s", entry["filename"], exc)
    return deleted


def check_startup_backup(
    db_path: Path,
    backup_dir: Path,
    now: Optional[Callable[[], datetime]] = None,
    trigger: str = "startup",
) -> bool:
    """Create a backup if the most recent regular backup is older than 24 hours.

    Safety copies (pre-delete etc.) don't count, so they can't postpone the daily backup.
    `now` is injectable for tests. Returns True if a backup was created, False otherwise.
    Logs warnings on failure but does NOT raise (startup must not fail).
    """
    try:
        regular = [b for b in list_backups(backup_dir) if b["kind"] is None]
        if regular:
            current = now() if now else datetime.now(timezone.utc)
            if current - regular[0]["created_at"] < timedelta(hours=24):
                return False  # Recent enough, skip

        create_backup(db_path, backup_dir, trigger=trigger)
        return True
    except Exception as exc:
        logger.warning("Scheduled backup failed (non-fatal): %s", exc)
        return False


def run_periodic(check: Callable[[], object], interval_seconds: float, stop: threading.Event) -> None:
    """Call `check` every `interval_seconds` until `stop` is set. A failing check is logged, never raised."""
    while not stop.wait(interval_seconds):
        try:
            check()
        except Exception as exc:
            logger.warning("Periodic backup check raised unexpectedly: %s", exc)


def start_periodic_backups(
    db_path: Path,
    backup_dir: Path,
    interval_seconds: float = _PERIODIC_CHECK_SECONDS,
) -> tuple[threading.Thread, threading.Event]:
    """Keep making a daily backup while the app stays running.

    Every `interval_seconds` the same "newest backup older than 24 h?" check as at startup runs.
    Returns the daemon thread and the event that stops it.
    """
    stop = threading.Event()
    thread = threading.Thread(
        target=run_periodic,
        args=(lambda: check_startup_backup(db_path, backup_dir, trigger="daily"), interval_seconds, stop),
        name="calmx-periodic-backup",
        daemon=True,
    )
    thread.start()
    return thread, stop


def backup_before_delete(session, backup_dir: Path) -> Optional[Path]:
    """Take a safety copy of the database `session` is connected to, before a permanent delete.

    The source is the session's own database file, so the copy is always of the data about to
    change. In-memory databases (tests) can't be copied this way and are skipped.
    Raises RuntimeError if the copy fails, so the caller can refuse the delete.
    """
    db_file = session.get_bind().url.database
    if not db_file or db_file == ":memory:":
        logger.debug("Pre-delete backup skipped: database is not a file")
        return None
    return create_backup(Path(db_file), backup_dir, trigger="pre-delete")
