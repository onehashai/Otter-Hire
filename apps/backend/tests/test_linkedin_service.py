from app.core.config import settings
from app.integrations.linkedin.service import verify_linkedin_webhook_signature


def test_verify_linkedin_webhook_signature_with_secret() -> None:
    payload = b'{"hello":"world"}'
    old_secret = settings.linkedin_webhook_secret
    old_prod = settings.is_production
    try:
        settings.linkedin_webhook_secret = "test-secret"
        settings.is_production = True

        import hashlib

        good_sig = hashlib.sha256(b"test-secret" + payload).hexdigest()
        assert verify_linkedin_webhook_signature(payload, good_sig) is True
        assert verify_linkedin_webhook_signature(payload, "bad") is False
    finally:
        settings.linkedin_webhook_secret = old_secret
        settings.is_production = old_prod
