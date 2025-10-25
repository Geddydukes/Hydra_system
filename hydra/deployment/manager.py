"""Deployment tooling including packaging, versioning, and health monitoring."""

from __future__ import annotations

import hashlib
import json
import shutil
import tempfile
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional


@dataclass(slots=True)
class DeploymentPackage:
    version: str
    artifact_path: Path
    checksum: str
    manifest: Dict[str, str]


class DeploymentManager:
    def __init__(self, storage_root: Optional[Path] = None) -> None:
        self._storage_root = Path(storage_root or Path(".hydra_deploy"))
        self._storage_root.mkdir(parents=True, exist_ok=True)
        self._history: List[DeploymentPackage] = []

    def package(self, source_dir: Path, version: str) -> DeploymentPackage:
        if not source_dir.exists():
            raise FileNotFoundError(source_dir)
        temp_dir = Path(tempfile.mkdtemp(prefix="hydra-deploy-"))
        artifact_path = self._storage_root / f"{version}.zip"
        shutil.make_archive(str(temp_dir / "artifact"), "zip", source_dir)
        shutil.move(str(temp_dir / "artifact.zip"), artifact_path)
        manifest = self._generate_manifest(source_dir)
        checksum = hashlib.sha256(artifact_path.read_bytes()).hexdigest()
        package = DeploymentPackage(version, artifact_path, checksum, manifest)
        self._history.append(package)
        shutil.rmtree(temp_dir, ignore_errors=True)
        return package

    def rollback(self, version: str) -> DeploymentPackage:
        for package in reversed(self._history):
            if package.version == version:
                return package
        raise ValueError(f"Unknown deployment version {version}")

    def latest(self) -> Optional[DeploymentPackage]:
        return self._history[-1] if self._history else None

    def _generate_manifest(self, source_dir: Path) -> Dict[str, str]:
        manifest: Dict[str, str] = {}
        for path in sorted(source_dir.rglob("*")):
            if path.is_file():
                relative = path.relative_to(source_dir).as_posix()
                manifest[relative] = hashlib.sha256(path.read_bytes()).hexdigest()
        manifest_path = self._storage_root / "manifest.json"
        manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True))
        return manifest


@dataclass(slots=True)
class ServiceHealth:
    name: str
    healthy: bool
    last_check: float
    latency_ms: float
    notes: Optional[str] = None


class HealthMonitor:
    def __init__(self) -> None:
        self._services: Dict[str, ServiceHealth] = {}

    def report(self, name: str, healthy: bool, latency_ms: float, notes: Optional[str] = None) -> ServiceHealth:
        record = ServiceHealth(name, healthy, time.time(), latency_ms, notes)
        self._services[name] = record
        return record

    def summary(self) -> Dict[str, any]:
        overall = all(record.healthy for record in self._services.values()) if self._services else True
        return {
            "overall": overall,
            "services": {name: record.__dict__ for name, record in self._services.items()},
        }
