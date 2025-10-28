"""User management helpers for frontend workflows."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List


@dataclass(slots=True)
class User:
    user_id: str
    name: str
    roles: List[str]


class UserDirectory:
    def __init__(self) -> None:
        self._users: Dict[str, User] = {}

    def upsert(self, user: User) -> None:
        self._users[user.user_id] = user

    def get(self, user_id: str) -> User:
        if user_id not in self._users:
            raise KeyError(user_id)
        return self._users[user_id]

    def list(self) -> List[User]:
        return list(self._users.values())
