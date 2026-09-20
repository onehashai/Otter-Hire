import unittest
from contextlib import ExitStack
from unittest.mock import patch

from app.core.config import settings
from app.services.email._factory import get_platform_provider


class EmailProviderFactoryTests(unittest.TestCase):
    def tearDown(self) -> None:
        get_platform_provider.cache_clear()

    def test_explicit_ses_is_selected_on_staging(self):
        values = {
            "email_provider": "ses",
            "is_production": False,
            "aws_ses_access_key": "access",
            "aws_ses_secret_key": "secret",
            "aws_ses_region": "ap-south-1",
            "ses_transactional_from_email": "noreply@smartats.in",
        }
        with ExitStack() as stack:
            for name, value in values.items():
                stack.enter_context(patch.object(settings, name, value))
            get_platform_provider.cache_clear()
            self.assertEqual(get_platform_provider().name, "SES")

    def test_explicit_provider_fails_when_incomplete(self):
        values = {
            "email_provider": "ses",
            "aws_ses_access_key": None,
            "aws_access_key_id": None,
        }
        with ExitStack() as stack:
            for name, value in values.items():
                stack.enter_context(patch.object(settings, name, value))
            get_platform_provider.cache_clear()
            with self.assertRaisesRegex(RuntimeError, "EMAIL_PROVIDER=ses"):
                get_platform_provider()


if __name__ == "__main__":
    unittest.main()
