import pytest

from app.core.config import Settings


def _settings(**values):
    defaults = {
        "api_base_url": "",
        "oauth_issuer_url": "",
        "is_production": False,
        "app_domain": "localhost.com",
        "app_subdomain": "app",
    }
    defaults.update(values)
    return Settings.model_construct(**defaults)


def test_external_api_url_uses_oauth_issuer_when_api_url_is_unset():
    settings = _settings(oauth_issuer_url="https://auth.example.com")

    assert settings.external_api_base_url == "https://auth.example.com"


def test_external_api_url_ignores_localhost_in_favor_of_public_issuer():
    settings = _settings(
        api_base_url="http://localhost:8000",
        oauth_issuer_url="https://staging.example.com",
    )

    assert settings.external_api_base_url == "https://staging.example.com"


def test_production_external_api_url_falls_back_to_app_domain():
    settings = _settings(
        api_base_url="http://localhost:8000",
        is_production=True,
        app_domain="otter.bz",
        app_subdomain="app",
    )

    assert settings.external_api_base_url == "https://app.otter.bz"


def test_production_does_not_return_localhost_when_no_public_origin_exists():
    settings = _settings(api_base_url="http://localhost:8000", is_production=True)

    with pytest.raises(ValueError, match="Cannot resolve a public API URL"):
        _ = settings.external_api_base_url


def test_google_oauth_post_login_url_uses_optional_relative_path():
    settings = _settings(
        frontend_base_url="https://smartats.in",
        google_oauth_post_login_path="/jobs",
    )

    assert settings.google_oauth_post_login_url == "https://smartats.in/jobs"


def test_google_oauth_post_login_url_rejects_absolute_url():
    settings = _settings(
        frontend_base_url="https://smartats.in",
        google_oauth_post_login_path="https://untrusted.example/jobs",
    )

    with pytest.raises(ValueError, match="must be a relative path"):
        _ = settings.google_oauth_post_login_url
