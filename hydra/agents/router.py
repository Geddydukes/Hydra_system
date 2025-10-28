"""Router agent that dispatches queries using JSONLogic rules."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from hydra.symbolic import JSONLogicEngine

from .base import AgentConfig, ExecutionContext, HydraAgent


@dataclass(slots=True)
class RouteRule:
    name: str
    condition: Dict[str, Any]
    teacher_id: str
    confidence: float = 1.0


class RouterAgent(HydraAgent):
    def __init__(self, rules: List[RouteRule], config: Optional[AgentConfig] = None) -> None:
        super().__init__(config or AgentConfig(id="router", name="RouterAgent"))
        self._engine = JSONLogicEngine()
        self._rules = rules

    async def execute_internal(self, context: ExecutionContext) -> Dict[str, Any]:
        query = context.payload.get("query", "")
        metadata = context.payload.get("metadata", {})
        eval_data = {"query": query, "query_lower": query.lower(), "metadata": metadata}
        for rule in self._rules:
            result, _ = self._engine.evaluate(rule.condition, eval_data)
            if result:
                return {
                    "success": True,
                    "teacher_id": rule.teacher_id,
                    "confidence": rule.confidence,
                }
        return {"success": False, "confidence": 0.0}

    def validate_internal(self, context: ExecutionContext) -> bool:
        return "query" in context.payload
