"""Typed application settings, loaded from env vars / .env."""
from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration. One instance per process; cache via `get_settings`."""

    model_config = SettingsConfigDict(env_file=".env", env_prefix="APP_", extra="ignore")

    env: str = Field(default="dev")
    host: str = Field(default="0.0.0.0")
    port: int = Field(default=8000)
    log_level: str = Field(default="info")

    data_json_path: str = Field(
        default="data/demo.json",
        description="Relative to the process working directory (run uvicorn from backend/).",
    )

    ghost_murmur_api_base: str | None = None
    satellite_api_base: str | None = None
    drone_api_base: str | None = None


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the cached singleton settings instance."""
    return Settings()
