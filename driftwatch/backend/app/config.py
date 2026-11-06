"""Runtime settings, overridable with environment variables."""
from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="DRIFTWATCH_")

    db_path: Path = ROOT / "backend" / "data" / "driftwatch.db"
    benchmark_path: Path = ROOT / "research" / "results" / "benchmark.json"
    frontend_dist: Path = ROOT / "frontend" / "dist"
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    warm_start: bool = True  # precompute the three default scenarios in the background


settings = Settings()
