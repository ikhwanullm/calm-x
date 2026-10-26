"""Application configuration via pydantic-settings."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Config(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="CALM_X_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    db_path: str = "data/calm_x.db"
    backup_dir: str = "data/backups"
    frontend_dist: str = "frontend/dist"
    port: int = 8080
    dev_origins: Annotated[list[str], NoDecode] = []

    @property
    def project_root(self) -> Path:
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

    @field_validator("dev_origins", mode="before")
    @classmethod
    def parse_dev_origins(cls, v: object) -> list[str]:
        """Accept comma-separated string or list. NoDecode prevents JSON-parsing."""
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        if isinstance(v, list):
            return [str(o).strip() for o in v if str(o).strip()]
        return []


def load_config() -> Config:
    """Load config, with optional CLI --port override."""
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--port", type=int, default=None)
    known, _ = parser.parse_known_args(sys.argv[1:])
    config = Config()
    if known.port is not None:
        config = Config(port=known.port)
    return config
