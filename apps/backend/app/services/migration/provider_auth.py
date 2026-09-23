from __future__ import annotations

import re
from typing import Any
from urllib.parse import urlparse

import httpx

from app.services.migration.config_loader import ConnectorConfig
from app.services.migration.fetcher import build_auth_headers


class ProviderConnectionError(ValueError):
    pass


_FIXED_HOSTS = {
    "greenhouse": {"harvest.greenhouse.io"},
    "lever": {"api.lever.co", "api.eu.lever.co"},
    "recruiterbox": {"api.recruiterbox.com"},
    "smartrecruiters": {"api.smartrecruiters.com"},
}


def validate_provider_base_url(provider: str, value: str) -> str:
    raw = value.strip().rstrip("/")
    try:
        parsed = urlparse(raw)
        host = (parsed.hostname or "").lower()
    except ValueError as exc:
        raise ProviderConnectionError("The provider URL is invalid") from exc
    if parsed.scheme != "https" or not host or parsed.path not in {"", "/"}:
        raise ProviderConnectionError("Use the provider HTTPS account URL without a path")
    if parsed.query or parsed.fragment or parsed.username or parsed.password or parsed.port:
        raise ProviderConnectionError("Use the provider HTTPS account URL without extra values")
    if provider in _FIXED_HOSTS and host not in _FIXED_HOSTS[provider]:
        raise ProviderConnectionError(f"The URL is not a valid {provider} API host")
    tenant_suffix = {"bamboohr": ".bamboohr.com", "workable": ".workable.com"}.get(provider)
    if tenant_suffix:
        tenant = host.removesuffix(tenant_suffix)
        if not host.endswith(tenant_suffix) or not tenant or "." in tenant:
            raise ProviderConnectionError(f"The URL is not a valid {provider} company URL")
        if not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]*[a-z0-9])?", tenant):
            raise ProviderConnectionError(f"The URL is not a valid {provider} company URL")
    return f"https://{host}"


async def issue_greenhouse_access_token(
    client_id: str,
    client_secret: str,
    organization_id: str | None = None,
    transport: httpx.AsyncBaseTransport | None = None,
) -> str:
    data = {"grant_type": "client_credentials"}
    if organization_id:
        data["sub"] = organization_id
    try:
        async with httpx.AsyncClient(timeout=20, transport=transport) as client:
            response = await client.post(
                "https://auth.greenhouse.io/token",
                auth=httpx.BasicAuth(client_id, client_secret),
                data=data,
            )
    except httpx.RequestError as exc:
        raise ProviderConnectionError("Greenhouse authentication could not be reached") from exc
    if response.status_code in {400, 401}:
        raise ProviderConnectionError("Greenhouse rejected the client ID or client secret")
    if response.status_code >= 400:
        raise ProviderConnectionError(
            f"Greenhouse authentication failed with HTTP {response.status_code}"
        )
    try:
        token = response.json().get("access_token")
    except ValueError as exc:
        raise ProviderConnectionError("Greenhouse returned an invalid token response") from exc
    if not token:
        raise ProviderConnectionError("Greenhouse did not return an access token")
    return str(token)


async def resolve_provider_secret(
    provider: str,
    stored_secret: str | None,
    provider_details: dict[str, Any] | None,
) -> str | None:
    details = provider_details or {}
    if provider == "greenhouse" and details.get("client_id"):
        if not stored_secret:
            raise ProviderConnectionError("Greenhouse client secret is missing")
        return await issue_greenhouse_access_token(
            str(details["client_id"]),
            stored_secret,
            str(details["organization_id"]) if details.get("organization_id") else None,
        )
    return stored_secret


async def validate_provider_connection(
    provider: str,
    config: ConnectorConfig,
    base_url: str,
    secret: str | None,
    transport: httpx.AsyncBaseTransport | None = None,
) -> None:
    if config.auth.type != "none" and not secret:
        raise ProviderConnectionError("A provider credential is required")
    endpoints = [
        (name, endpoint) for name, endpoint in config.endpoints.items() if "{" not in endpoint.path
    ]
    if not endpoints:
        raise ProviderConnectionError("This connector has no connection-check endpoint")
    checked_routes: set[tuple[str, str]] = set()
    try:
        async with httpx.AsyncClient(base_url=base_url, timeout=20, transport=transport) as client:
            for name, endpoint in endpoints:
                route = (endpoint.method, endpoint.path)
                if route in checked_routes:
                    continue
                checked_routes.add(route)
                params = dict(endpoint.params)
                for key in ("limit", "per_page", "page_size"):
                    if key in params:
                        params[key] = 1
                response = await client.request(
                    endpoint.method,
                    endpoint.path,
                    params=params,
                    headers=build_auth_headers(config, secret),
                )
                if response.status_code == 401:
                    raise ProviderConnectionError("The provider rejected the credential")
                if response.status_code == 403:
                    raise ProviderConnectionError(
                        f"The credential lacks read permission for {provider} {name}"
                    )
                if response.status_code >= 400:
                    raise ProviderConnectionError(
                        f"The {provider} {name} check failed with HTTP {response.status_code}"
                    )
                try:
                    response.json()
                except ValueError as exc:
                    raise ProviderConnectionError(
                        f"The {provider} {name} endpoint returned a non-JSON response"
                    ) from exc
    except httpx.RequestError as exc:
        raise ProviderConnectionError("The provider API could not be reached") from exc
