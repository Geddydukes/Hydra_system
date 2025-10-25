"""Monitoring dashboard utilities."""

from __future__ import annotations

from typing import Dict

from hydra.backend.monitoring import AlertManager, MetricsRegistry, TraceRecorder


class MonitoringDashboard:
    def __init__(self, metrics: MetricsRegistry, traces: TraceRecorder, alerts: AlertManager) -> None:
        self._metrics = metrics
        self._traces = traces
        self._alerts = alerts

    def snapshot(self) -> Dict[str, any]:
        return {
            "metrics": {name: self._metrics.summary(name) for name in self._metrics._samples},
            "traces": [
                {
                    "name": trace.name,
                    "duration_ms": trace.duration_ms,
                    "attributes": trace.attributes,
                }
                for trace in self._traces.find()
            ],
            "alerts": self._alerts.evaluate(self._metrics),
        }
