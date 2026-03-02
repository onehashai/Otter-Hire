import json

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    database_url_raw: str = Field(validation_alias="DATABASE_URL")

    @property
    def database_url(self) -> str:
        url = self.database_url_raw
        if url.startswith("postgres://"):
            url = "postgresql+psycopg://" + url[len("postgres://") :]
        elif url.startswith("postgresql://"):
            url = "postgresql+psycopg://" + url[len("postgresql://") :]
        return url

    is_production: bool = Field(default=False, validation_alias="IS_PRODUCTION")
    cors_origins_raw: str = Field(default="", validation_alias="CORS_ORIGINS")
    jwt_secret_key: str = Field(validation_alias="JWT_SECRET_KEY")
    jwt_algorithm: str = Field(default="HS256", validation_alias="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(
        default=60 * 24 * 7, validation_alias="ACCESS_TOKEN_EXPIRE_MINUTES"
    )
    log_level: str = "INFO"

    # Frontend URL
    frontend_base_url: str = Field(
        default="http://localhost:3000", validation_alias="FRONTEND_BASE_URL"
    )

    # Cookie domain (empty for localhost, .domain.com for production)
    cookie_domain: str = Field(default="", validation_alias="COOKIE_DOMAIN")

    # Mailtrap (dev)
    mailtrap_host: str | None = Field(default=None, validation_alias="MAILTRAP_HOST")
    mailtrap_port: int | None = Field(default=None, validation_alias="MAILTRAP_PORT")
    mailtrap_username: str | None = Field(default=None, validation_alias="MAILTRAP_USERNAME")
    mailtrap_password: str | None = Field(default=None, validation_alias="MAILTRAP_PASSWORD")
    mailtrap_from_email: str | None = Field(default=None, validation_alias="MAILTRAP_FROM_EMAIL")

    # Token expiry (configurable)
    verification_token_expire_hours: int = Field(
        default=24, validation_alias="VERIFICATION_TOKEN_EXPIRE_HOURS"
    )
    invite_token_expire_days: int = Field(default=7, validation_alias="INVITE_TOKEN_EXPIRE_DAYS")

    # ZeptoMail (prod)
    zeptomail_api_key: str | None = Field(default=None, validation_alias="ZEPTOMAIL_API_KEY")
    zeptomail_from_email: str | None = Field(default=None, validation_alias="ZEPTOMAIL_FROM_EMAIL")
    zeptomail_from_name: str | None = Field(default=None, validation_alias="ZEPTOMAIL_FROM_NAME")

    # Storage
    local_storage_root: str = Field(default="storage/local", validation_alias="LOCAL_STORAGE_ROOT")
    max_upload_bytes: int = Field(default=1024 * 1024, validation_alias="MAX_UPLOAD_BYTES")
    aws_s3_bucket: str | None = Field(default=None, validation_alias="AWS_S3_BUCKET")
    aws_s3_region: str | None = Field(default=None, validation_alias="AWS_S3_REGION")
    aws_access_key_id: str | None = Field(default=None, validation_alias="AWS_ACCESS_KEY_ID")
    aws_secret_access_key: str | None = Field(
        default=None, validation_alias="AWS_SECRET_ACCESS_KEY"
    )
    # Deprecated for new flow; prefix is now derived automatically from IS_PRODUCTION.
    aws_s3_attachments_env: str = Field(
        default="staging", validation_alias="AWS_S3_ATTACHMENTS_ENV"
    )
    inbound_webhook_secret: str | None = Field(
        default=None, validation_alias="INBOUND_WEBHOOK_SECRET"
    )
    inbound_max_attachment_bytes: int = Field(
        default=10 * 1024 * 1024, validation_alias="INBOUND_MAX_ATTACHMENT_BYTES"
    )
    inbound_resume_min_confidence: int = Field(
        default=6, validation_alias="INBOUND_RESUME_MIN_CONFIDENCE"
    )
    ses_raw_bridge_enabled: bool = Field(default=False, validation_alias="SES_RAW_BRIDGE_ENABLED")
    ses_raw_bridge_bucket: str | None = Field(
        default=None, validation_alias="SES_RAW_BRIDGE_BUCKET"
    )
    ses_raw_bridge_prefix: str = Field(
        default="", validation_alias="SES_RAW_BRIDGE_PREFIX"
    )
    ses_raw_bridge_poll_seconds: int = Field(
        default=30, validation_alias="SES_RAW_BRIDGE_POLL_SECONDS"
    )
    ses_raw_bridge_max_keys: int = Field(default=20, validation_alias="SES_RAW_BRIDGE_MAX_KEYS")
    inbound_ignored_cleanup_enabled: bool = Field(
        default=True, validation_alias="INBOUND_IGNORED_CLEANUP_ENABLED"
    )
    inbound_ignored_retention_days: int = Field(
        default=30, validation_alias="INBOUND_IGNORED_RETENTION_DAYS"
    )
    inbound_ignored_cleanup_interval_seconds: int = Field(
        default=3600, validation_alias="INBOUND_IGNORED_CLEANUP_INTERVAL_SECONDS"
    )
    inbound_async_pipeline_enabled: bool = Field(
        default=False, validation_alias="INBOUND_ASYNC_PIPELINE_ENABLED"
    )
    inbound_async_enqueue_via_http: bool = Field(
        default=False, validation_alias="INBOUND_ASYNC_ENQUEUE_VIA_HTTP"
    )
    redis_url: str = Field(
        default="redis://redis:6379/0",
        validation_alias="REDIS_URL",
    )
    temporal_server_url: str = Field(
        default="temporal:7233",
        validation_alias="TEMPORAL_SERVER_URL",
    )
    temporal_namespace: str = Field(
        default="default",
        validation_alias="TEMPORAL_NAMESPACE",
    )
    temporal_task_queue: str = Field(
        default="inbound",
        validation_alias="TEMPORAL_TASK_QUEUE",
    )
    inbound_events_channel: str = Field(
        default="ats:inbound:events", validation_alias="INBOUND_EVENTS_CHANNEL"
    )
    inbound_internal_api_base_url: str = Field(
        default="http://localhost:8000", validation_alias="INBOUND_INTERNAL_API_BASE_URL"
    )

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

    @property
    def s3_enabled(self) -> bool:
        return bool(
            (self.aws_s3_bucket or "").strip()
            and (self.aws_s3_region or "").strip()
            and (self.aws_access_key_id or "").strip()
            and (self.aws_secret_access_key or "").strip()
        )

    @property
    def s3_root_prefix(self) -> str:
        return "ats-production" if self.is_production else "ats-staging"

    @property
    def effective_ses_raw_bridge_bucket(self) -> str:
        value = (self.ses_raw_bridge_bucket or "").strip()
        if value:
            return value
        return (self.aws_s3_bucket or "").strip()

    @property
    def effective_ses_raw_bridge_prefix(self) -> str:
        value = (self.ses_raw_bridge_prefix or "").strip().lstrip("/")
        if value:
            return value
        return f"{self.s3_root_prefix}/ses-inbound/raw/"


settings = Settings()
