"""Backup service: SQLite VACUUM INTO backups with retention policy."""
from __future__ import annotations

import logging
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

# Pattern: calmx_backup_YYYYMMDD_HHMMSS_mmm.db
_BACKUP_PATTERN = re.compile(r"^calmx_backup_(\d{8}_\d{6}_\d{3})\.db$")
_MAX_BACKUPS = 7


def _make_filename(ts: datetime) -> str:
    """Build a backup filename from a UTC datetime."""
    ms = str(ts.microsecond // 1000).zfill(3)
    return f"calmx_backup_{ts.strftime('%Y%m%d_%H%M%S')}_{ms}.db"


def _is_backup_file(name: str) -> bool:
    return bool(_BACKUP_PATTERN.match(name))


def list_backups(backup_dir: Path) -> list[dict]:
    """Return backup metadata sorted newest first.

    Each dict has:
        filename  – bare filename (str)
        size      – file size in bytes (int)
        created_at – datetime parsed from filename (UTC-aware datetime)
    """
    if not backup_dir.exists():
        return []
    files = [f for f in backup_dir.iterdir() if f.is_file() and _is_backup_file(f.name)]
    files.sort(key=lambda f: f.name, reverse=True)  # lexicographic = chronological
    result = []
    for f in files:
        m = _BACKUP_PATTERN.match(f.name)
        if not m:
            continue
        ts_str = m.group(1)   # "20261028_103045_042"
        # Parse: YYYYMMDD_HHMMSS_mmm
        dt_str = ts_str.replace("_", "")  # "202610281030450042" — no: keep delimiters
        # Format: YYYYMMDD HHMMSS (drop ms for datetime)
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
        result.append({
            "filename": f.name,
            "size": f.stat().st_size,
            "created_at": dt,
        })
    return result


def create_backup(db_path: Path, backup_dir: Path, trigger: str = "manual") -> Path:
    """Create a backup using VACUUM INTO and return the backup file path.

    Args:
        db_path: Path to the source SQLite database.
        backup_dir: Directory to write the backup.
        trigger: Reason string for logging (e.g. "manual", "startup").

    Returns:
        Path of the newly created backup file.

    Raises:
        RuntimeError: if VACUUM INTO fails.
    """
    backup_dir.mkdir(parents=True, exist_ok=True)

    now = datetime.now(timezone.utc)
    filename = _make_filename(now)
    backup_path = backup_dir / filename

    # Ensure uniqueness within the same millisecond by appending a counter
    counter = 0
    while backup_path.exists():
        counter += 1
        base = _make_filename(now).rstrip(".db")
        backup_path = backup_dir / f"{base}_{counter}.db"

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


def cleanup_old_backups(backup_dir: Path, keep: int = _MAX_BACKUPS) -> list[str]:
    """Delete oldest backups, keeping at most `keep` files.

    Only deletes files matching the backup naming pattern — never other files.
    Returns list of deleted filenames.
    """
    backups = list_backups(backup_dir)
    if len(backups) <= keep:
        return []

    to_delete = backups[keep:]  # oldest (list is newest-first)
    deleted: list[str] = []
    for entry in to_delete:
        path = backup_dir / entry["filename"]
        try:
            path.unlink()
            deleted.append(entry["filename"])
            logger.info("Deleted old backup: %s", entry["filename"])
        except OSError as exc:
            logger.warning("Could not delete backup %s: %s", entry["filename"], exc)
    return deleted


def check_startup_backup(db_path: Path, backup_dir: Path) -> bool:
    """Create a backup if the most recent backup is older than 24 hours.

    Returns True if a backup was created, False otherwise.
    Logs warnings on failure but does NOT raise (startup must not fail).
    """
    from datetime import timedelta

    try:
        backups = list_backups(backup_dir)
        if backups:
            newest = backups[0]["created_at"]  # UTC-aware
            age = datetime.now(timezone.utc) - newest
            if age < timedelta(hours=24):
                return False  # Recent enough, skip

        create_backup(db_path, backup_dir, trigger="startup")
        return True
    except Exception as exc:
        logger.warning("Startup backup failed (non-fatal): %s", exc)
        return False
