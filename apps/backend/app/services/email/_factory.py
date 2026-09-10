from __future__ import annotations

from functools import lru_cache

from app.services.email._base import EmailProvider
from app.services.email._providers.local_smtp import LocalSmtpProvider
from app.services.email._providers.ses import SesProvider
from app.services.email._providers.zeptomail import ZeptoMailProvider


@lru_cache(maxsize=1)
def get_platform_provider() -> EmailProvider:
    """
    Select the platform-level email provider based on available credentials.

    Selection order:
    1. ZeptoMail — if ZEPTOMAIL_API_KEY + ZEPTOMAIL_FROM_EMAIL are set
    2. SES       — if AWS credentials + SES transactional From are resolvable (see Settings.ses_effective_*)
    3. Neither   — raises RuntimeError with actionable message

    Exactly one provider is active at a time.
    Result is cached after first call; clear with get_platform_provider.cache_clear() in tests.
    """
    local = LocalSmtpProvider()
    if local.is_configured():
        return local

    zepto = ZeptoMailProvider()
    if zepto.is_configured():
        return zepto

    ses = SesProvider()
    if ses.is_configured():
        return ses

    raise RuntimeError(
        "No platform email provider configured. "
        "Set ZEPTOMAIL_API_KEY + ZEPTOMAIL_FROM_EMAIL to use ZeptoMail, "
        "or set AWS credentials + AWS_S3_REGION and SES_TRANSACTIONAL_FROM_EMAIL (or legacy SES_FROM_EMAIL) for SES."
    )
