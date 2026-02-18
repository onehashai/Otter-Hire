import json

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    database_url: str = Field(validation_alias="DATABASE_URL")
    is_production: bool = Field(default=False, validation_alias="IS_PRODUCTION")
    cors_origins_raw: str = Field(default="", validation_alias="CORS_ORIGINS")
    jwt_secret_key: str = Field(validation_alias="JWT_SECRET_KEY")
    jwt_algorithm: str = Field(default="HS256", validation_alias="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(default=60 * 24 * 7, validation_alias="ACCESS_TOKEN_EXPIRE_MINUTES")
    log_level: str = "INFO"

    # Frontend URL
    frontend_base_url: str = Field(default="http://localhost:3000", validation_alias="FRONTEND_BASE_URL")

    # Mailtrap (dev)
    mailtrap_host: str | None = Field(default=None, validation_alias="MAILTRAP_HOST")
    mailtrap_port: int | None = Field(default=None, validation_alias="MAILTRAP_PORT")
    mailtrap_username: str | None = Field(default=None, validation_alias="MAILTRAP_USERNAME")
    mailtrap_password: str | None = Field(default=None, validation_alias="MAILTRAP_PASSWORD")
    mailtrap_from_email: str | None = Field(default=None, validation_alias="MAILTRAP_FROM_EMAIL")

    # ZeptoMail (prod)
    zeptomail_api_key: str | None = Field(default=None, validation_alias="ZEPTOMAIL_API_KEY")
    zeptomail_from_email: str | None = Field(default=None, validation_alias="ZEPTOMAIL_FROM_EMAIL")
    zeptomail_from_name: str | None = Field(default=None, validation_alias="ZEPTOMAIL_FROM_NAME")

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
