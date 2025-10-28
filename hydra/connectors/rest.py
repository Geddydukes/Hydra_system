"""REST connector implemented with urllib for zero external dependencies."""

from __future__ import annotations

import asyncio
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from typing import Any, Dict, Optional

from .base import Connector, ConnectorConfig, ConnectorContext, ConnectorResult, make_error, make_success


@dataclass(slots=True)
class RestConnectorConfig(ConnectorConfig):
    base_url: str = ""
    timeout: float = 15.0
    headers: Dict[str, str] = field(default_factory=dict)
    auth: Optional[Dict[str, str]] = None


class RestConnector(Connector):
    def __init__(self, config: RestConnectorConfig) -> None:
        super().__init__(config)
        self._config = config
        self._opener = urllib.request.build_opener()

    async def connect(self) -> None:
        await super().connect()

    async def execute(self, context: ConnectorContext) -> ConnectorResult:
        if not self.enabled:
            return make_error(self, "connector_disabled", 0.0)
        if not self.validate(context):
            return make_error(self, "invalid_context", 0.0)
        start = time.perf_counter()
        try:
            data = await asyncio.to_thread(self._perform_request, context)
            return make_success(
                self,
                data,
                time.perf_counter() - start,
                metadata={"operation": context.operation.lower()},
            )
        except Exception as exc:
            return make_error(self, str(exc), time.perf_counter() - start)

    def validate(self, context: ConnectorContext) -> bool:
        return super().validate(context) and context.operation.upper() in {"GET", "POST", "PUT", "PATCH", "DELETE"}

    async def health_check(self) -> bool:
        try:
            await asyncio.to_thread(self._perform_health_check)
            return True
        except Exception:
            return False

    # ------------------------------------------------------------------
    def _perform_request(self, context: ConnectorContext) -> Any:
        method = context.operation.upper()
        url = self._build_url(context.parameters.get("path"))
        params = context.parameters.get("query") or {}
        if params:
            query = urllib.parse.urlencode(params, doseq=True)
            url = f"{url}?{query}"
        body: Optional[bytes] = None
        if context.data is not None:
            body = json.dumps(context.data).encode("utf-8")
        request = urllib.request.Request(url, data=body, method=method)
        headers = self._prepare_headers()
        request.headers.update(headers)
        extra_headers = context.parameters.get("headers")
        if isinstance(extra_headers, dict):
            request.headers.update({str(k): str(v) for k, v in extra_headers.items()})
        if body is not None:
            request.headers.setdefault("Content-Type", "application/json")
        try:
            with self._opener.open(request, timeout=self._config.timeout) as response:
                payload = response.read()
                if not payload:
                    return None
                content_type = response.headers.get("Content-Type", "")
                if "json" in content_type:
                    return json.loads(payload.decode("utf-8"))
                return payload.decode("utf-8")
        except urllib.error.HTTPError as exc:  # pragma: no cover - network errors
            raise RuntimeError(f"HTTP {exc.code}: {exc.reason}") from exc
        except urllib.error.URLError as exc:  # pragma: no cover
            raise RuntimeError(f"network_error:{exc.reason}") from exc

    def _perform_health_check(self) -> None:
        url = self._build_url("/health")
        request = urllib.request.Request(url, method="GET")
        request.headers.update(self._prepare_headers())
        with self._opener.open(request, timeout=min(self._config.timeout, 3.0)) as response:
            if response.status >= 400:
                raise RuntimeError("health_check_failed")

    def _build_url(self, path: Optional[str]) -> str:
        base = self._config.base_url.rstrip('/')
        if path is None:
            return base
        return f"{base}/{path.lstrip('/')}"

    def _prepare_headers(self) -> Dict[str, str]:
        headers = {**self._config.headers}
        auth = self._config.auth or {}
        if auth.get("type") == "bearer" and auth.get("token"):
            headers.setdefault("Authorization", f"Bearer {auth['token']}")
        elif auth.get("type") == "basic" and auth.get("username") and auth.get("password"):
            import base64

            token = base64.b64encode(f"{auth['username']}:{auth['password']}".encode("utf-8")).decode("utf-8")
            headers.setdefault("Authorization", f"Basic {token}")
        return headers
