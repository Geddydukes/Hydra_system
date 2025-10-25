"""Cryptographically signed audit log service."""

from __future__ import annotations

import hashlib
import hmac
import json
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional


@dataclass(slots=True)
class AuditRecord:
    event_id: str
    event_type: str
    payload: Dict[str, Any]
    timestamp: float
    signature: str


class AuditLogService:
    def __init__(self, secret: str, storage_path: Optional[Path] = None) -> None:
        self._secret = secret.encode("utf-8")
        self._storage_path = Path(storage_path or Path(".hydra_audit"))
        self._storage_path.mkdir(parents=True, exist_ok=True)

    def record(self, event_type: str, payload: Dict[str, Any]) -> AuditRecord:
        timestamp = time.time()
        event_id = hashlib.sha256(f"{event_type}:{timestamp}".encode("utf-8")).hexdigest()
        canonical_payload = json.dumps(payload, sort_keys=True)
        signature = hmac.new(self._secret, canonical_payload.encode("utf-8"), hashlib.sha256).hexdigest()
        record = AuditRecord(event_id, event_type, payload, timestamp, signature)
        self._persist(record)
        return record

    def verify(self, record: AuditRecord) -> bool:
        canonical_payload = json.dumps(record.payload, sort_keys=True)
        expected = hmac.new(self._secret, canonical_payload.encode("utf-8"), hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, record.signature)

    def find(self, event_type: Optional[str] = None) -> List[AuditRecord]:
        results: List[AuditRecord] = []
        for path in self._storage_path.glob("*.json"):
            data = json.loads(path.read_text())
            record = AuditRecord(**data)
            if event_type is None or record.event_type == event_type:
                results.append(record)
        return sorted(results, key=lambda rec: rec.timestamp)

    def analyze(self, records: Iterable[AuditRecord]) -> Dict[str, Any]:
        total = 0
        by_type: Dict[str, int] = {}
        for record in records:
            total += 1
            by_type[record.event_type] = by_type.get(record.event_type, 0) + 1
        return {"total": total, "by_type": by_type}

    def _persist(self, record: AuditRecord) -> None:
        payload = json.dumps(asdict(record), sort_keys=True, indent=2)
        path = self._storage_path / f"{record.event_id}.json"
        path.write_text(payload)
