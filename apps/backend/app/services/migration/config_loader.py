from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, Field


class ConnectorAuth(BaseModel):
    type: Literal["none", "api_key", "bearer", "basic", "oauth2"]
    header_name: str = "Authorization"
    secret_ref: str | None = None


class ConnectorEndpoint(BaseModel):
    path: str
    method: Literal["GET", "POST"] = "GET"
    response_root_key: str | None = None


class PaginationConfig(BaseModel):
    style: Literal["cursor", "offset", "page", "link_header", "none"] = "none"
    items_path: str | None = None
    cursor_request_param: str = "cursor"
    cursor_response_path: str | None = None
    page_param: str = "page"
    page_size_param: str = "limit"
    page_size: int = Field(default=100, ge=1, le=1000)
    since_param_name: str | None = None


class RateLimitConfig(BaseModel):
    requests_per_second: float = Field(default=5, gt=0)
    max_retries: int = Field(default=5, ge=0, le=10)
    backoff_seconds: float = Field(default=1, ge=0)


class ConnectorConfig(BaseModel):
    id: str
    name: str
    enabled: bool = True
    auth: ConnectorAuth = ConnectorAuth(type="none")
    base_url: str
    endpoints: dict[str, ConnectorEndpoint]
    pagination: PaginationConfig = PaginationConfig()
    rate_limits: RateLimitConfig = RateLimitConfig()
    mappings: dict[str, dict[str, str]] = Field(default_factory=dict)


def load_connector(path: Path) -> ConnectorConfig:
    return ConnectorConfig.model_validate(json.loads(path.read_text(encoding="utf-8")))


def load_connector_registry(directory: Path) -> dict[str, ConnectorConfig]:
    return {
        config.id: config
        for path in sorted(directory.glob("*.json"))
        for config in [load_connector(path)]
        if config.enabled
    }


def get_path(value: Any, path: str | None) -> Any:
    if not path:
        return value
    current = value
    for part in path.split("."):
        if isinstance(current, dict):
            current = current.get(part)
        else:
            return None
    return current
