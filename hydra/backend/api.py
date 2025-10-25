"""Minimal API layer with routing, security, and rate limiting."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Callable, Dict, Optional, Tuple

from .rate_limiting import RateLimiter
from .security import RBAC, TokenError, TokenService


@dataclass(slots=True)
class APIRequest:
    method: str
    path: str
    body: Optional[Dict[str, Any]] = None
    headers: Dict[str, str] = None


@dataclass(slots=True)
class APIResponse:
    status: int
    body: Dict[str, Any]


Handler = Callable[[Dict[str, Any], APIRequest], APIResponse]


class APILayer:
    def __init__(
        self,
        token_service: TokenService,
        rbac: RBAC,
        rate_limiter: RateLimiter,
    ) -> None:
        self._token_service = token_service
        self._rbac = rbac
        self._rate_limiter = rate_limiter
        self._routes: Dict[Tuple[str, str], Handler] = {}

    def route(self, method: str, path: str) -> Callable[[Handler], Handler]:
        def decorator(handler: Handler) -> Handler:
            self._routes[(method.upper(), path)] = handler
            return handler

        return decorator

    def handle(self, request: APIRequest) -> APIResponse:
        key = request.headers.get("x-api-key", "anonymous") if request.headers else "anonymous"
        rate = self._rate_limiter.check(key)
        if not rate.allowed:
            return APIResponse(429, {"error": "rate_limited", "reset_at": rate.reset_at})

        payload: Dict[str, Any] = {"roles": ["guest"], "sub": "anonymous"}
        token = request.headers.get("authorization") if request.headers else None
        if token:
            try:
                payload = self._token_service.verify(token.replace("Bearer ", ""))
            except TokenError as exc:
                return APIResponse(401, {"error": str(exc)})

        handler = self._routes.get((request.method.upper(), request.path))
        if handler is None:
            return APIResponse(404, {"error": "not_found"})

        response = handler(payload, request)
        return response
