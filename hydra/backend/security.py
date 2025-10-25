"""Security utilities including JWT-like tokens and RBAC enforcement."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Set


class TokenError(Exception):
    pass


class TokenService:
    def __init__(self, secret: str) -> None:
        self._secret = secret.encode("utf-8")

    def issue(self, subject: str, roles: Iterable[str], expires_in: int = 3600) -> str:
        payload = {
            "sub": subject,
            "roles": sorted(set(roles)),
            "exp": int(time.time()) + expires_in,
        }
        body = json.dumps(payload, sort_keys=True).encode("utf-8")
        signature = hmac.new(self._secret, body, hashlib.sha256).digest()
        return base64.urlsafe_b64encode(body + signature).decode("ascii")

    def verify(self, token: str) -> Dict[str, any]:
        try:
            raw = base64.urlsafe_b64decode(token.encode("ascii"))
            body, signature = raw[:-32], raw[-32:]
            expected = hmac.new(self._secret, body, hashlib.sha256).digest()
            if not hmac.compare_digest(signature, expected):
                raise TokenError("invalid_signature")
            payload = json.loads(body.decode("utf-8"))
            if payload["exp"] < int(time.time()):
                raise TokenError("token_expired")
            return payload
        except Exception as exc:  # pragma: no cover - defensive
            raise TokenError(str(exc)) from exc


@dataclass(slots=True)
class Role:
    name: str
    permissions: Set[str]


class RBAC:
    def __init__(self, roles: Iterable[Role]) -> None:
        self._roles = {role.name: role for role in roles}

    def check(self, user_roles: Iterable[str], permission: str) -> bool:
        for role_name in user_roles:
            role = self._roles.get(role_name)
            if role and permission in role.permissions:
                return True
        return False

    def required(self, permission: str) -> callable:
        def decorator(func):
            def wrapper(token_payload: Dict[str, any], *args, **kwargs):
                if not self.check(token_payload.get("roles", []), permission):
                    raise PermissionError(permission)
                return func(token_payload, *args, **kwargs)

            return wrapper

        return decorator
