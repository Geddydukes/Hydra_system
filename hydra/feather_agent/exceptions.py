"""Custom exceptions for the Python feather-agent runtime shim."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Iterable, Optional


@dataclass(frozen=True)
class NormalizationError(Exception):
    """Raised when router normalization fails."""

    message: str
    missing: Optional[Iterable[str]] = None
    field: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        payload: Dict[str, Any] = {"error": self.message}
        if self.missing:
            payload["missing"] = list(self.missing)
        if self.field:
            payload["field"] = self.field
        return payload


class RoutingError(Exception):
    """Raised when a router cannot determine a teacher."""

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message

    def to_dict(self) -> Dict[str, Any]:
        return {"error": self.message}
