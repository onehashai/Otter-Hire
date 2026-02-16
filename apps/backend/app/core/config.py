import json

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    database_url: str = Field(validation_alias="DATABASE_URL")
    is_production: bool = Field(default=False, validation_alias="IS_PRODUCTION")
    cors_origins_raw: str = Field(default="", validation_alias="CORS_ORIGINS")
    log_level: str = "INFO"

    @property
    def cors_origins(self) -> list[str]:
        raw = self.cors_origins_raw.strip()
        if not raw:
            return []

        if raw.startswith("["):
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, list):
                    return [str(origin).strip() for origin in parsed if str(origin).strip()]
            except json.JSONDecodeError:
                return []

        return [origin.strip() for origin in raw.split(",") if origin.strip()]


settings = Settings()
