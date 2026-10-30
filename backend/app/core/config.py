"""
CiteCheck AI — Application Configuration.

Loads environment variables and provides a validated Settings singleton
via Pydantic's BaseSettings.
"""

from functools import lru_cache
import json
from typing import List, Optional, Union

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment / .env file."""

    # Supabase Configuration
    supabase_url: str = Field(default="", validation_alias="SUPABASE_URL")
    supabase_service_key: str = Field(default="", validation_alias="SUPABASE_SERVICE_KEY")
    supabase_service_role_key: str = Field(default="", validation_alias="SUPABASE_SERVICE_ROLE_KEY")
    supabase_anon_key: str = Field(default="", validation_alias="SUPABASE_ANON_KEY")
    supabase_jwt_secret: str = Field(default="", validation_alias="SUPABASE_JWT_SECRET")

    # Default Brand Kit ID (seeded in schema.sql)
    default_brand_kit_id: str = Field(
        default="a1b2c3d4-e5f6-7890-abcd-111111111111",
        validation_alias="DEFAULT_BRAND_KIT_ID",
    )

    # CORS
    cors_origins: Union[List[str], str] = Field(
        default=[
            "http://localhost:3000",
            "http://localhost:5173",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:5173",
            "http://localhost:8000",
            "http://127.0.0.1:8000",
        ],
        validation_alias="CORS_ORIGINS",
    )

    # Server Info
    app_name: str = "CiteCheck AI"
    debug: bool = False
    sentry_dsn: Optional[str] = Field(default=None, validation_alias="SENTRY_DSN")

    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def service_role_key(self) -> str:
        """
        Unified service key accessor.
        Prefers SUPABASE_SERVICE_KEY, falls back to SUPABASE_SERVICE_ROLE_KEY.
        """
        key = self.supabase_service_key or self.supabase_service_role_key
        return key

    @property
    def cors_origins_list(self) -> List[str]:
        """Return CORS origins as a sanitized list of strings."""
        if isinstance(self.cors_origins, list):
            return self.cors_origins
        if isinstance(self.cors_origins, str):
            # Try parsing as JSON array first, e.g. '["http://localhost:3000"]'
            cleaned = self.cors_origins.strip()
            if cleaned.startswith("[") and cleaned.endswith("]"):
                try:
                    parsed = json.loads(cleaned)
                    if isinstance(parsed, list):
                        return [str(item).strip() for item in parsed if str(item).strip()]
                except Exception:
                    pass
            # Comma-separated fallback, e.g. "http://localhost:3000,http://localhost:5173"
            return [item.strip() for item in cleaned.split(",") if item.strip()]
        return ["*"]


@lru_cache()
def get_settings() -> Settings:
    """Return a cached Settings instance (singleton)."""
    return Settings()
