"""Agent that reports runtime performance metrics."""

from __future__ import annotations

import random
from typing import Dict, Optional

from hydra.backend.monitoring import MetricsRegistry, TraceRecorder

from .base import AgentConfig, ExecutionContext, HydraAgent


class PerformanceAgent(HydraAgent):
    def __init__(
        self,
        metrics: MetricsRegistry,
        traces: TraceRecorder,
        config: Optional[AgentConfig] = None,
    ) -> None:
        super().__init__(config or AgentConfig(id="performance", name="PerformanceAgent"))
        self._metrics = metrics
        self._traces = traces

    async def execute_internal(self, context: ExecutionContext) -> Dict[str, any]:
        action = context.payload.get("action")
        if action == "observe":
            metric = context.payload["metric"]
            value = float(context.payload.get("value", random.random()))
            self._metrics.observe(metric, value, **context.payload.get("labels", {}))
            return {"success": True, "summary": self._metrics.summary(metric)}
        if action == "trace":
            name = context.payload["name"]
            duration = float(context.payload.get("duration", 0.1))
            trace = self._traces.record(name, duration, **context.payload.get("attributes", {}))
            return {"success": True, "trace": {"name": trace.name, "duration_ms": trace.duration_ms}}
        raise ValueError(f"unknown action {action}")

    def validate_internal(self, context: ExecutionContext) -> bool:
        return "action" in context.payload
