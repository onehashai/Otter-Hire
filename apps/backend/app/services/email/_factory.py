from __future__ import annotations

from functools import lru_cache

from app.core.config import settings
from app.services.email._base import EmailProvider
from app.services.email._providers.local_smtp import LocalSmtpProvider
from app.services.email._providers.ses import SesProvider
from app.services.email._providers.zeptomail import ZeptoMailProvider


@lru_cache(maxsize=1)
def get_platform_provider() -> EmailProvider:
    """
    Select the platform-level email provider based on available credentials.

    ``EMAIL_PROVIDER`` can explicitly select a provider in deployed environments.
    ``auto`` preserves the local-development fallback order.

    Exactly one provider is active at a time.
    Result is cached after first call; clear with get_platform_provider.cache_clear() in tests.
    """
    providers = {
        "local_smtp": LocalSmtpProvider(),
        "zeptomail": ZeptoMailProvider(),
        "ses": SesProvider(),
    }
    requested = settings.email_provider
    if requested != "auto":
        provider = providers[requested]
        if not provider.is_configured():
            raise RuntimeError(f"EMAIL_PROVIDER={requested} is not fully configured")
        return provider

    for name in ("local_smtp", "zeptomail", "ses"):
        provider = providers[name]
        if provider.is_configured():
            return provider

    raise RuntimeError(
        "No platform email provider configured. "
        "Set ZEPTOMAIL_API_KEY + ZEPTOMAIL_FROM_EMAIL to use ZeptoMail, "
        "or set AWS credentials + AWS_S3_REGION and SES_TRANSACTIONAL_FROM_EMAIL (or legacy SES_FROM_EMAIL) for SES."
    )
