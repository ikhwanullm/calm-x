"""Shared test setup."""
import pytest


@pytest.fixture(autouse=True)
def _isolated_backup_dir(tmp_path, monkeypatch):
    """Point the default backup folder at a temp dir.

    Many tests build `Config(port=8080)` with default paths. Anything that makes a backup
    (e.g. deleting an item) must never write into the real `data/backups`.
    """
    monkeypatch.setenv("CALM_X_BACKUP_DIR", str(tmp_path / "backups"))
