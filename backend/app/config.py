"""Application settings, loaded from the environment / .env and validated at startup."""

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    env: Literal["development", "test", "production"] = "development"
    database_url: str = "sqlite:///./dev.db"
    run_migrations_on_startup: bool = True

    # Supabase. Empty values are allowed in development/test (SQLite, no auth server).
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    # Legacy HS256 secret. When set, tokens signed with it are accepted (tests use this).
    supabase_jwt_secret: str = ""
    jwt_audience: str = "authenticated"

    internal_email_domain: str = "users.ariba-hr.internal"
    storage_bucket: str = "hr-private"

    # Comma-separated list of allowed origins.
    cors_origins: str = "http://localhost:3000"

    # Login rate limits (attempts per window).
    login_window_seconds: int = 300
    login_max_per_username: int = 5
    login_max_per_ip: int = 20

    max_upload_bytes: int = Field(default=12 * 1024 * 1024)

    @field_validator("supabase_url")
    @classmethod
    def _strip_slash(cls, v: str) -> str:
        return v.rstrip("/")

    @model_validator(mode="after")
    def _require_supabase_in_production(self) -> "Settings":
        if self.env == "production":
            missing = [
                name
                for name in ("supabase_url", "supabase_anon_key", "supabase_service_role_key")
                if not getattr(self, name)
            ]
            if missing:
                raise ValueError(f"Missing required settings in production: {', '.join(missing)}")
            if self.database_url.startswith("sqlite"):
                raise ValueError("SQLite is not allowed in production")
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_dev(self) -> bool:
        return self.env == "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()
