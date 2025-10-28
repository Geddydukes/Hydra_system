"""Symbolic execution agent backed by JSONLogic."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional

from hydra.symbolic import JSONLogicEngine

from .base import AgentConfig, ExecutionContext, HydraAgent


@dataclass(slots=True)
class SELLMAgentConfig(AgentConfig):
    rule: Dict[str, Any] = None


class SELLMAgent(HydraAgent):
    def __init__(self, rule: Dict[str, Any], config: Optional[SELLMAgentConfig] = None) -> None:
        cfg = config or SELLMAgentConfig(id="sellm", name="SELLMAgent", rule=rule)
        super().__init__(cfg)
        self._engine = JSONLogicEngine()
        self._rule = rule

    async def execute_internal(self, context: ExecutionContext) -> Dict[str, Any]:
        data = context.payload.get("inputs", {})
        result, trace = self._engine.evaluate(self._rule, data)
        return {
            "success": True,
            "result": result,
            "trace": [step.__dict__ for step in trace],
            "confidence": 0.9,
        }

    def validate_internal(self, context: ExecutionContext) -> bool:
        return "inputs" in context.payload
