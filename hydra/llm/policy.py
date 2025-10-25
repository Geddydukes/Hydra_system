"""Policy watcher utilities for compliance monitoring."""

from __future__ import annotations

import hashlib
from typing import Callable, Dict, List


class PolicyWatcher:
    def __init__(self, fetcher: Callable[[], Dict[str, str]]) -> None:
        self._fetcher = fetcher
        self._last_hashes: Dict[str, str] = {}

    def poll(self) -> List[str]:
        current = self._fetcher()
        changes: List[str] = []
        for key, value in current.items():
            digest = hashlib.sha256(value.encode("utf-8")).hexdigest()
            if key not in self._last_hashes:
                changes.append(f"new_policy:{key}")
            elif self._last_hashes[key] != digest:
                changes.append(f"updated_policy:{key}")
            self._last_hashes[key] = digest
        removed = set(self._last_hashes) - set(current)
        for key in removed:
            changes.append(f"removed_policy:{key}")
            del self._last_hashes[key]
        return changes
