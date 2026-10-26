"""Tests for backend/config.py."""
import pytest
from backend.config import Config, load_config


def test_default_port():
    cfg = Config()
    assert cfg.port == 8080


def test_project_root_is_directory():
    from pathlib import Path
    cfg = Config()
    assert cfg.project_root.is_dir()


def test_absolute_db_path_contains_data():
    cfg = Config()
    assert "data" in str(cfg.absolute_db_path)
    assert str(cfg.absolute_db_path).endswith("calm_x.db")


def test_absolute_backup_dir():
    cfg = Config()
    assert "backups" in str(cfg.absolute_backup_dir)


def test_custom_port_via_constructor():
    cfg = Config(port=9090)
    assert cfg.port == 9090


def test_invalid_port_raises():
    with pytest.raises(Exception):
        Config(port=80)  # below 1024


def test_load_config_returns_config():
    cfg = load_config()
    assert isinstance(cfg, Config)
    assert cfg.port == 8080
