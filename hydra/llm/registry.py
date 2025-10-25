"""Teacher registry with schema validation and auto-update support."""

from __future__ import annotations

import json
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Dict, Optional

from jsonschema import Draft7Validator


@dataclass(slots=True)
class TeacherSpec:
    teacher_id: str
    version: str
    path: Path
    metadata: Dict[str, Any]


class TeacherRegistry:
    def __init__(self, registry_root: Path, schema_path: Path) -> None:
        self._registry_root = registry_root
        self._schema = json.loads(schema_path.read_text())
        self._validator = Draft7Validator(self._schema)
        self._executors: Dict[str, Callable[[Dict[str, Any]], Dict[str, Any]]] = {}
        self._cache: Dict[str, TeacherSpec] = {}
        self._timestamps: Dict[str, float] = {}
        self._refresh()

    def register_executor(self, teacher_id: str, executor: Callable[[Dict[str, Any]], Dict[str, Any]]) -> None:
        self._executors[teacher_id] = executor

    def get_executor(self, teacher_id: str) -> Callable[[Dict[str, Any]], Dict[str, Any]]:
        if teacher_id not in self._executors:
            raise KeyError(teacher_id)
        return self._executors[teacher_id]

    def list_teachers(self) -> Dict[str, TeacherSpec]:
        self._refresh()
        return dict(self._cache)

    def resolve(self, teacher_id: str) -> TeacherSpec:
        self._refresh()
        if teacher_id not in self._cache:
            raise KeyError(teacher_id)
        return self._cache[teacher_id]

    def _refresh(self) -> None:
        for path in self._registry_root.rglob("*.json"):
            if "/tests/" in path.as_posix():
                continue
            spec_data = json.loads(path.read_text())
            self._validator.validate(spec_data)
            teacher_id = spec_data.get("id") or spec_data.get("teacher_id")
            if teacher_id is None:
                raise KeyError("teacher_id")
            if "@" in path.name:
                version = path.stem.split("@", 1)[1]
            else:
                version = spec_data.get("version", "1.0.0")
            modified = path.stat().st_mtime
            cache_key = f"{teacher_id}@{version}"
            if cache_key in self._timestamps and self._timestamps[cache_key] >= modified:
                continue
            self._cache[teacher_id] = TeacherSpec(teacher_id, version, path, spec_data)
            self._timestamps[cache_key] = modified


class AutoUpdatePipeline:
    def __init__(self, registry: TeacherRegistry, interval: float = 5.0) -> None:
        self._registry = registry
        self._interval = interval
        self._last_check = 0.0

    def tick(self) -> bool:
        now = time.time()
        if now - self._last_check < self._interval:
            return False
        self._registry.list_teachers()
        self._last_check = now
        return True
