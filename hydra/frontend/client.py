"""Client that interacts with the backend API layer."""

from __future__ import annotations

from typing import Any, Dict, Optional

from hydra.backend.api import APIRequest, APILayer


class HydraClient:
    def __init__(self, api: APILayer, token: Optional[str] = None, api_key: str = "anonymous") -> None:
        self._api = api
        self._token = token
        self._api_key = api_key

    def authenticate(self, token: str) -> None:
        self._token = token

    def request(self, method: str, path: str, body: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        headers = {"x-api-key": self._api_key}
        if self._token:
            headers["authorization"] = f"Bearer {self._token}"
        response = self._api.handle(APIRequest(method=method.upper(), path=path, body=body, headers=headers))
        if response.status >= 400:
            raise RuntimeError(response.body["error"])
        return response.body
