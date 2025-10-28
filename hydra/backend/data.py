"""Data management utilities including migrations and backups."""

from __future__ import annotations

import json
import shutil
import sqlite3
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List


@dataclass(slots=True)
class Migration:
    version: str
    sql: str


class MigrationManager:
    def __init__(self, db_path: Path) -> None:
        self._db_path = db_path
        self._applied: List[str] = []

    def apply(self, migrations: Iterable[Migration]) -> List[str]:
        connection = sqlite3.connect(self._db_path)
        applied: List[str] = []
        try:
            for migration in migrations:
                if migration.version in self._applied:
                    continue
                connection.executescript(migration.sql)
                self._applied.append(migration.version)
                applied.append(migration.version)
            connection.commit()
            return applied
        finally:
            connection.close()


class BackupService:
    def __init__(self, source: Path, destination: Path) -> None:
        self._source = source
        self._destination = destination
        self._destination.mkdir(parents=True, exist_ok=True)

    def create_backup(self, label: str) -> Path:
        temp_dir = Path(tempfile.mkdtemp(prefix="hydra-backup-"))
        archive = self._destination / f"{label}.zip"
        shutil.make_archive(str(temp_dir / "backup"), "zip", self._source)
        shutil.move(str(temp_dir / "backup.zip"), archive)
        shutil.rmtree(temp_dir, ignore_errors=True)
        return archive


class ComplianceReporter:
    def __init__(self, rules: Dict[str, str]) -> None:
        self._rules = rules

    def generate(self) -> Dict[str, any]:
        return {
            "rules": self._rules,
            "summary": f"Evaluated {len(self._rules)} compliance rules",
        }
