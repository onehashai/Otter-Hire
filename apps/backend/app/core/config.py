import json

from pydantic import Field, model_validator
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
    platform_name: str = Field(default="Otter Hire", validation_alias="PLATFORM_NAME")
    support_email: str = Field(default="support@otter.bz", validation_alias="SUPPORT_EMAIL")

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
        default=15, validation_alias="ACCESS_TOKEN_EXPIRE_MINUTES"
    )
    refresh_token_expire_days: int = Field(default=30, validation_alias="REFRESH_TOKEN_EXPIRE_DAYS")
    log_level: str = "INFO"

    # Domain configuration
    # APP_DOMAIN     — root domain, e.g. "localhost.com" (dev) or "onehash.ai" (prod)
    # APP_SUBDOMAIN  — main app subdomain,      e.g. "app"
    # JOBS_SUBDOMAIN — public job portal (careers) subdomain, e.g. "jobs"
    app_domain: str = Field(default="localhost.com", validation_alias="APP_DOMAIN")
    app_subdomain: str = Field(default="app", validation_alias="APP_SUBDOMAIN")
    jobs_subdomain: str = Field(default="jobs", validation_alias="JOBS_SUBDOMAIN")

    # Frontend URL — if FRONTEND_BASE_URL is unset/empty, derived at load time from
    # APP_SUBDOMAIN, APP_DOMAIN, and IS_PRODUCTION.
    frontend_base_url: str = Field(default="", validation_alias="FRONTEND_BASE_URL")

    # Optional absolute URL to PNG (or https) logo for transactional emails. If empty,
    # logo URL defaults to {FRONTEND_BASE_URL}/brand/logo.png when FRONTEND_BASE_URL is set.
    email_logo_url: str = Field(default="", validation_alias="EMAIL_LOGO_URL")

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

    # Unified encryption key (Fernet, base64-encoded 32 bytes).
    # Used for: google_id (users table), encrypted_credentials (integration_credentials table).
    # Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    encryption_key: str | None = Field(default=None, validation_alias="ENCRYPTION_KEY")

    # SES outbound configuration set name — when set, X-SES-Configuration-Set is added to every
    # outbound email so SES publishes Delivery/Open/Bounce events to the SNS topic below.
    ses_configuration_set: str | None = Field(
        default=None, validation_alias="SES_CONFIGURATION_SET"
    )
    # Comma-separated SNS topic ARN(s) allowed to post SES event notifications.
    ses_events_sns_topic_arns: str = Field(default="", validation_alias="SES_EVENTS_SNS_TOPIC_ARNS")

    # Cookie domain (empty for localhost, .domain.com for production)
    cookie_domain: str = Field(default="", validation_alias="COOKIE_DOMAIN")

    # Token expiry (configurable)
    verification_token_expire_hours: int = Field(
        default=24, validation_alias="VERIFICATION_TOKEN_EXPIRE_HOURS"
    )
    invite_token_expire_days: int = Field(default=7, validation_alias="INVITE_TOKEN_EXPIRE_DAYS")
    password_reset_token_expire_hours: int = Field(
        default=1, validation_alias="PASSWORD_RESET_TOKEN_EXPIRE_HOURS"
    )

    # ZeptoMail — used when ZEPTOMAIL_API_KEY + ZEPTOMAIL_FROM_EMAIL are present
    zeptomail_api_key: str | None = Field(default=None, validation_alias="ZEPTOMAIL_API_KEY")
    zeptomail_from_email: str | None = Field(default=None, validation_alias="ZEPTOMAIL_FROM_EMAIL")
    zeptomail_from_name: str | None = Field(default=None, validation_alias="ZEPTOMAIL_FROM_NAME")

    # SES — transactional From (verification, invites, platform email). ZeptoMail path is unchanged.
    # Conversational SES mail uses From = reply+...@<SES_MAIL_DOMAIN> (not these vars).
    ses_transactional_from_email: str = Field(
        default="",
        validation_alias="SES_TRANSACTIONAL_FROM_EMAIL",
    )
    ses_transactional_from_name: str | None = Field(
        default=None,
        validation_alias="SES_TRANSACTIONAL_FROM_NAME",
    )
    # Legacy single sender before SES_TRANSACTIONAL_* — used if transactional email is empty.
    ses_from_email: str | None = Field(default=None, validation_alias="SES_FROM_EMAIL")
    ses_from_name: str | None = Field(default=None, validation_alias="SES_FROM_NAME")

    # Storage
    local_storage_root: str = Field(default="storage/local", validation_alias="LOCAL_STORAGE_ROOT")
    max_upload_bytes: int = Field(default=1024 * 1024, validation_alias="MAX_UPLOAD_BYTES")
    avatar_max_upload_bytes: int = Field(
        default=1024 * 1024,
        validation_alias="AVATAR_MAX_UPLOAD_BYTES",
    )
    public_job_apply_max_upload_bytes: int = Field(
        default=1024 * 1024,
        validation_alias="PUBLIC_JOB_APPLY_MAX_UPLOAD_BYTES",
    )
    aws_s3_bucket: str | None = Field(default=None, validation_alias="AWS_S3_BUCKET")
    aws_s3_region: str | None = Field(default=None, validation_alias="AWS_S3_REGION")
    aws_ses_region: str | None = Field(default=None, validation_alias="AWS_SES_REGION")
    s3_endpoint_url: str | None = Field(default=None, validation_alias="S3_ENDPOINT_URL")
    s3_root_prefix_raw: str = Field(default="", validation_alias="S3_ROOT_PREFIX")
    aws_access_key_id: str | None = Field(default=None, validation_alias="AWS_ACCESS_KEY_ID")
    aws_secret_access_key: str | None = Field(
        default=None, validation_alias="AWS_SECRET_ACCESS_KEY"
    )
    aws_ses_access_key: str | None = Field(default=None, validation_alias="AWS_SES_ACCESS_KEY")
    aws_ses_secret_key: str | None = Field(default=None, validation_alias="AWS_SES_SECRET_KEY")
    # Deprecated for new flow; prefix is now derived automatically from IS_PRODUCTION.
    aws_s3_attachments_env: str = Field(
        default="staging", validation_alias="AWS_S3_ATTACHMENTS_ENV"
    )
    s3_enabled_override: bool = Field(default=True, validation_alias="S3_ENABLED")
    inbound_webhook_secret: str | None = Field(
        default=None, validation_alias="INBOUND_WEBHOOK_SECRET"
    )
    # Hostname for inbound delivery and conversational outbound reply+ addresses.
    SES_MAIL_DOMAIN: str | None = Field(
        default=None,
        validation_alias="SES_MAIL_DOMAIN",
    )
    inbound_max_attachment_bytes: int = Field(
        default=5 * 1024 * 1024, validation_alias="INBOUND_MAX_ATTACHMENT_BYTES"
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
    # Multi-job candidate assignments are permanently enabled at code level.
    candidate_jobs_enabled: bool = True

    # OpenAI key
    openai_api_key: str | None = Field(default=None, validation_alias="OPENAI_API_KEY")

    # Resume parsing tuning
    resume_parse_max_tokens: int = Field(default=6000, validation_alias="RESUME_PARSE_MAX_TOKENS")
    resume_parse_cache_ttl_days: int = Field(
        default=30, validation_alias="RESUME_PARSE_CACHE_TTL_DAYS"
    )

    # Sentry observability
    sentry_dsn: str = Field(default="", validation_alias="SENTRY_DSN")
    sentry_environment: str = Field(default="development", validation_alias="SENTRY_ENVIRONMENT")
    sentry_release: str | None = Field(default=None, validation_alias="SENTRY_RELEASE")
    sentry_traces_sample_rate: float = Field(
        default=0.0, validation_alias="SENTRY_TRACES_SAMPLE_RATE"
    )
    sentry_profiles_sample_rate: float = Field(
        default=0.0, validation_alias="SENTRY_PROFILES_SAMPLE_RATE"
    )
    local_smtp_host: str = Field(default="localhost", validation_alias="LOCAL_SMTP_HOST")
    local_smtp_port: int = Field(default=1025, validation_alias="LOCAL_SMTP_PORT")
    local_smtp_from: str = Field(default="no-reply@localhost", validation_alias="LOCAL_SMTP_FROM")
    local_mailpit_url: str = Field(default="http://localhost:8025", validation_alias="LOCAL_MAILPIT_URL")
    local_mailpit_poll_seconds: int = Field(default=2, validation_alias="LOCAL_MAILPIT_POLL_SECONDS")
    local_mailpit_enabled: bool = Field(default=True, validation_alias="LOCAL_MAILPIT_ENABLED")
    ats_auto_import_enabled: bool = Field(default=True, validation_alias="ATS_AUTO_IMPORT_ENABLED")
    ats_migration_checkpoint_dir: str = Field(
        default="storage/migrations/checkpoints", validation_alias="ATS_MIGRATION_CHECKPOINT_DIR"
    )
    ats_migration_schedule_minutes: int = Field(
        default=15, validation_alias="ATS_MIGRATION_SCHEDULE_MINUTES"
    )
    ses_local_mock: bool = Field(default=True, validation_alias="SES_LOCAL_MOCK")
    mcp_server_enabled: bool = Field(default=True, validation_alias="MCP_SERVER_ENABLED")
    mcp_server_host: str = Field(default="127.0.0.1", validation_alias="MCP_SERVER_HOST")
    mcp_server_port: int = Field(default=8765, validation_alias="MCP_SERVER_PORT")

    @model_validator(mode="after")
    def _validate_jwt_secret_key(self) -> "Settings":
        if len(self.jwt_secret_key) < 32:
            raise ValueError(
                "JWT_SECRET_KEY must be at least 32 characters long. "
                "Generate a secure key with: "
                'python -c "import secrets; print(secrets.token_hex(32))"'
            )
        return self

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
            self.s3_enabled_override
            and (self.aws_s3_bucket or "").strip()
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

    @property
    def ses_effective_transactional_from_email(self) -> str:
        """SES platform transactional From (not used for ZeptoMail or reply+ conversation mail)."""
        t = (self.ses_transactional_from_email or "").strip()
        if t:
            return t
        leg = (self.ses_from_email or "").strip()
        if leg:
            return leg
        return "noreply@smartats.in"

    @property
    def ses_effective_transactional_from_name(self) -> str | None:
        return self.ses_transactional_from_name or self.ses_from_name


settings = Settings()
