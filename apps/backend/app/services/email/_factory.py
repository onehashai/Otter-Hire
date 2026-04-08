from __future__ import annotations

from functools import lru_cache

from app.services.email._base import EmailProvider
from app.services.email._providers.ses import SesProvider
from app.services.email._providers.zeptomail import ZeptoMailProvider


@lru_cache(maxsize=1)
def get_platform_provider() -> EmailProvider:
    """
    Select the platform-level email provider based on available credentials.

    Selection order:
    1. ZeptoMail — if ZEPTOMAIL_API_KEY + ZEPTOMAIL_FROM_EMAIL are set
    2. SES       — if AWS credentials + SES_FROM_EMAIL are set
    3. Neither   — raises RuntimeError with actionable message

    Exactly one provider is active at a time.
    Result is cached after first call; clear with get_platform_provider.cache_clear() in tests.
    """
    zepto = ZeptoMailProvider()
    if zepto.is_configured():
        return zepto

    ses = SesProvider()
    if ses.is_configured():
        return ses

    raise RuntimeError(
        "No platform email provider configured. "
        "Set ZEPTOMAIL_API_KEY + ZEPTOMAIL_FROM_EMAIL to use ZeptoMail, "
        "or set AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY + AWS_S3_REGION + SES_FROM_EMAIL to use SES."
    )
