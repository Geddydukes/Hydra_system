"""Agent that records and analyzes audit events."""

from __future__ import annotations

from typing import Dict, Iterable, Optional

from hydra.audit.logger import AuditLogService

from .base import AgentConfig, ExecutionContext, HydraAgent


class AuditAgent(HydraAgent):
    def __init__(self, audit: AuditLogService, config: Optional[AgentConfig] = None) -> None:
        super().__init__(config or AgentConfig(id="audit", name="AuditAgent"))
        self._audit = audit

    async def execute_internal(self, context: ExecutionContext) -> Dict[str, any]:
        action = context.payload.get("action")
        if action == "record":
            record = self._audit.record(context.payload["event_type"], context.payload.get("payload", {}))
            return {"success": True, "record": record.__dict__}
        if action == "analyze":
            records = self._audit.find(context.payload.get("event_type"))
            return {"success": True, "analysis": self._audit.analyze(records)}
        raise ValueError(f"unknown action {action}")

    def validate_internal(self, context: ExecutionContext) -> bool:
        return "action" in context.payload
