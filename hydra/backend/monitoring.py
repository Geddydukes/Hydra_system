"""Monitoring primitives for metrics, traces, and alerts."""

from __future__ import annotations

import statistics
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass(slots=True)
class MetricSample:
    name: str
    value: float
    timestamp: float
    labels: Dict[str, str] = field(default_factory=dict)


class MetricsRegistry:
    def __init__(self) -> None:
        self._samples: Dict[str, List[MetricSample]] = {}

    def observe(self, name: str, value: float, **labels: str) -> None:
        sample = MetricSample(name, value, time.time(), labels)
        self._samples.setdefault(name, []).append(sample)

    def summary(self, name: str) -> Dict[str, float]:
        samples = self._samples.get(name, [])
        if not samples:
            return {"count": 0, "avg": 0.0, "p95": 0.0}
        values = [sample.value for sample in samples]
        return {
            "count": float(len(samples)),
            "avg": statistics.fmean(values),
            "p95": statistics.quantiles(values, n=20)[-1] if len(values) >= 20 else max(values),
        }


@dataclass(slots=True)
class Trace:
    name: str
    start: float
    end: float
    attributes: Dict[str, str]

    @property
    def duration_ms(self) -> float:
        return (self.end - self.start) * 1000.0


class TraceRecorder:
    def __init__(self) -> None:
        self._traces: List[Trace] = []

    def record(self, name: str, duration: float, **attributes: str) -> Trace:
        trace = Trace(name, time.time() - duration, time.time(), attributes)
        self._traces.append(trace)
        return trace

    def find(self, name: Optional[str] = None) -> List[Trace]:
        if name is None:
            return list(self._traces)
        return [trace for trace in self._traces if trace.name == name]


class AlertManager:
    def __init__(self) -> None:
        self._rules: Dict[str, float] = {}
        self._alerts: List[str] = []

    def add_rule(self, metric_name: str, threshold: float) -> None:
        self._rules[metric_name] = threshold

    def evaluate(self, metrics: MetricsRegistry) -> List[str]:
        self._alerts.clear()
        for metric, threshold in self._rules.items():
            summary = metrics.summary(metric)
            if summary["count"] and summary["avg"] > threshold:
                self._alerts.append(f"{metric} above threshold {threshold}")
        return list(self._alerts)
