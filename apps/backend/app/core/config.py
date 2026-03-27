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

    # Product branding (emails, UI copy, API metadata)
    platform_name: str = Field(default="OneHash ATS", validation_alias="PLATFORM_NAME")
    support_email: str = Field(default="support@onehash.ai", validation_alias="SUPPORT_EMAIL")

    # SQLAdmin (local development only — ignored in production)
    sqladmin_username: str = Field(default="admin", validation_alias="SQLADMIN_USERNAME")
    sqladmin_password: str = Field(default="admin", validation_alias="SQLADMIN_PASSWORD")
    sqladmin_secret_key: str = Field(
        default="sqladmin-dev-secret-change-me", validation_alias="SQLADMIN_SECRET_KEY"
    )
    cors_origins_raw: str = Field(default="", validation_alias="CORS_ORIGINS")
    jwt_secret_key: str = Field(validation_alias="JWT_SECRET_KEY")
    jwt_algorithm: str = Field(default="HS256", validation_alias="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(
        default=60 * 24 * 7, validation_alias="ACCESS_TOKEN_EXPIRE_MINUTES"
    )
    log_level: str = "INFO"

    # Domain configuration
    # APP_DOMAIN     — root domain, e.g. "localhost.com" (dev) or "onehash.ai" (prod)
    # APP_SUBDOMAIN  — main app subdomain,      e.g. "app"
    # JOBS_SUBDOMAIN — public job board subdomain, e.g. "jobs"
    app_domain: str = Field(default="localhost.com", validation_alias="APP_DOMAIN")
    app_subdomain: str = Field(default="app", validation_alias="APP_SUBDOMAIN")
    jobs_subdomain: str = Field(default="jobs", validation_alias="JOBS_SUBDOMAIN")

    # Frontend URL — if FRONTEND_BASE_URL is unset/empty, derived at load time from
    # APP_SUBDOMAIN, APP_DOMAIN, and IS_PRODUCTION.
    frontend_base_url: str = Field(default="", validation_alias="FRONTEND_BASE_URL")

    # Public API base URL (OAuth callbacks, etc.). If API_BASE_URL is unset/empty, derived at
    # load time from APP_SUBDOMAIN, APP_DOMAIN, and IS_PRODUCTION (port :8000 in non-prod).
    api_base_url: str = Field(default="", validation_alias="API_BASE_URL")

    # Google OAuth
    google_client_id: str | None = Field(default=None, validation_alias="GOOGLE_CLIENT_ID")
    google_client_secret: str | None = Field(default=None, validation_alias="GOOGLE_CLIENT_SECRET")

    # LinkedIn OAuth
    linkedin_client_id: str | None = Field(default=None, validation_alias="LINKEDIN_CLIENT_ID")
    linkedin_client_secret: str | None = Field(
        default=None, validation_alias="LINKEDIN_CLIENT_SECRET"
    )
    linkedin_webhook_secret: str | None = Field(
        default=None, validation_alias="LINKEDIN_WEBHOOK_SECRET"
    )
    feature_linkedin_distribution: bool = Field(
        default=False, validation_alias="FEATURE_LINKEDIN_DISTRIBUTION"
    )
    feature_linkedin_applicant_ingestion: bool = Field(
        default=False, validation_alias="FEATURE_LINKEDIN_APPLICANT_INGESTION"
    )

    # SMTP credential encryption (Fernet key, base64-encoded 32 bytes)
    # Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    smtp_encryption_key: str | None = Field(default=None, validation_alias="SMTP_ENCRYPTION_KEY")

    # SES outbound configuration set name — when set, X-SES-Configuration-Set is added to every
    # outbound email so SES publishes Delivery/Open/Bounce events to the SNS topic below.
    ses_configuration_set: str | None = Field(
        default=None, validation_alias="SES_CONFIGURATION_SET"
    )
    # Comma-separated SNS topic ARN(s) allowed to post SES event notifications.
    ses_events_sns_topic_arns: str = Field(default="", validation_alias="SES_EVENTS_SNS_TOPIC_ARNS")

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
    s3_root_prefix_raw: str = Field(default="", validation_alias="S3_ROOT_PREFIX")
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
    inbound_email_domain: str | None = Field(default=None, validation_alias="INBOUND_EMAIL_DOMAIN")
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
    ses_raw_bridge_prefix: str = Field(default="", validation_alias="SES_RAW_BRIDGE_PREFIX")
    ses_raw_bridge_poll_seconds: int = Field(
        default=30, validation_alias="SES_RAW_BRIDGE_POLL_SECONDS"
    )
    ses_raw_bridge_max_keys: int = Field(default=20, validation_alias="SES_RAW_BRIDGE_MAX_KEYS")
    inbound_sns_fallback_grace_seconds: int = Field(
        default=120, validation_alias="INBOUND_SNS_FALLBACK_GRACE_SECONDS"
    )
    inbound_ignored_cleanup_enabled: bool = Field(
        default=True, validation_alias="INBOUND_IGNORED_CLEANUP_ENABLED"
    )
    inbound_ignored_retention_days: int = Field(
        default=30, validation_alias="INBOUND_IGNORED_RETENTION_DAYS"
    )
    inbound_ignored_cleanup_interval_seconds: int = Field(
        default=3600, validation_alias="INBOUND_IGNORED_CLEANUP_INTERVAL_SECONDS"
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
    inbound_events_channel: str = Field(
        default="ats:inbound:events", validation_alias="INBOUND_EVENTS_CHANNEL"
    )
    backend_url: str = Field(
        default="http://localhost:8000",
        validation_alias="BACKEND_URL",
    )
    inbound_sns_topic_arns: str = Field(default="", validation_alias="INBOUND_SNS_TOPIC_ARNS")
    inbound_sns_auto_confirm: bool = Field(
        default=True, validation_alias="INBOUND_SNS_AUTO_CONFIRM"
    )
    inbound_sns_verify_signature: bool = Field(
        default=False, validation_alias="INBOUND_SNS_VERIFY_SIGNATURE"
    )
    feature_integrations_app_store_ui: bool = Field(
        default=False, validation_alias="FEATURE_INTEGRATIONS_APP_STORE_UI"
    )
    feature_email_integration_module: bool = Field(
        default=False, validation_alias="FEATURE_EMAIL_INTEGRATION_MODULE"
    )
    feature_legacy_org_inbox_route_redirect: bool = Field(
        default=False, validation_alias="FEATURE_LEGACY_ORG_INBOX_ROUTE_REDIRECT"
    )

    # OpenAI key
    openai_api_key: str | None = Field(default=None, validation_alias="OPENAI_API_KEY")

    @property
    def _scheme(self) -> str:
        return "https" if self.is_production else "http"

    @property
    def google_oauth_enabled(self) -> bool:
        return bool(self.google_client_id and self.google_client_secret)

    @property
    def linkedin_oauth_enabled(self) -> bool:
        return bool(self.linkedin_client_id and self.linkedin_client_secret)

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
        value = self.s3_root_prefix_raw.strip().strip("/")
        if value:
            return value
        return "ats-production" if self.is_production else "ats-staging"


settings = Settings()
