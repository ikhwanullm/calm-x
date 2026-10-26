"""Application configuration via pydantic-settings."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Config(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="CALM_X_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Core settings
    db_path: str = "data/calm_x.db"
    backup_dir: str = "data/backups"
    frontend_dist: str = "frontend/dist"
    port: int = 8080
    dev_origins: list[str] = []

    # ------------------------------------------------------------------ #
    # Computed absolute paths (derived from project root)                 #
    # ------------------------------------------------------------------ #
    @property
    def project_root(self) -> Path:
        """Absolute path to the project root (parent of backend/)."""
        return Path(__file__).parent.parent.resolve()

    @property
    def absolute_db_path(self) -> Path:
        return (self.project_root / self.db_path).resolve()

    @property
    def absolute_backup_dir(self) -> Path:
        return (self.project_root / self.backup_dir).resolve()

    @property
    def absolute_frontend_dist(self) -> Path:
        return (self.project_root / self.frontend_dist).resolve()

    @field_validator("port", mode="before")
    @classmethod
    def validate_port(cls, v: object) -> int:
        port = int(v)
        if not (1024 <= port <= 65535):
            raise ValueError(f"Port must be between 1024 and 65535, got {port}")
        return port


def load_config() -> Config:
    """Load config, with optional CLI --port override.

    Reads CALM_X_PORT env var via pydantic-settings automatically.
    Supports --port CLI argument which takes precedence over env var.
    """
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--port", type=int, default=None)
    known, _ = parser.parse_known_args(sys.argv[1:])

    config = Config()
    if known.port is not None:
        # CLI overrides env var
        config = Config(port=known.port)
    return config
