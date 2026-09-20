import hashlib
import hmac
from unittest.mock import patch

from app.core.config import settings
from app.integrations.linkedin.service import verify_linkedin_webhook_signature


def test_verify_linkedin_webhook_signature_with_secret() -> None:
    payload = b'{"hello":"world"}'
    with patch.object(settings, "linkedin_client_secret", "test-secret"):
        good_sig = hmac.new(b"test-secret", b"hmacsha256=" + payload, hashlib.sha256).hexdigest()
        assert verify_linkedin_webhook_signature(payload, good_sig) is True
        assert verify_linkedin_webhook_signature(payload, "bad") is False
