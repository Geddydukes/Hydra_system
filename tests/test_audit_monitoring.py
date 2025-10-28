"""Tests for audit logging, metrics, traces, and alerts."""

from __future__ import annotations

from pathlib import Path

from hydra.audit.logger import AuditLogService
from hydra.backend.monitoring import AlertManager, MetricsRegistry, TraceRecorder


def test_audit_log_service_persists_and_verifies_records(tmp_path: Path):
    audit = AuditLogService("secret", tmp_path)
    record = audit.record("symbolic_execution", {"query": "hello", "success": True})
    assert audit.verify(record)

    stored = audit.find("symbolic_execution")
    assert len(stored) == 1
    assert stored[0].event_id == record.event_id

    summary = audit.analyze(stored)
    assert summary == {"total": 1, "by_type": {"symbolic_execution": 1}}


def test_metrics_traces_and_alerts_workflow():
    metrics = MetricsRegistry()
    traces = TraceRecorder()
    alerts = AlertManager()

    metrics.observe("latency", 50)
    metrics.observe("latency", 75)
    metrics.observe("errors", 1)

    trace = traces.record("execution", 0.05, route="symbolic")
    assert trace.duration_ms > 0

    summary = metrics.summary("latency")
    assert summary["count"] == 2.0
    assert summary["avg"] >= 50

    alerts.add_rule("latency", 40)
    alert_list = alerts.evaluate(metrics)
    assert alert_list == ["latency above threshold 40"]
