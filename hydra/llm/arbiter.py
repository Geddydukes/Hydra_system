"""Hybrid arbiter that balances symbolic and LLM execution."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Dict, Optional

from .engines import BaseLLMEngine

SymbolicExecutor = Callable[[str, Dict[str, Any]], Dict[str, Any]]


@dataclass(slots=True)
class HybridDecision:
    route: str
    confidence: float
    result: Dict[str, Any]
    explanation: str


class HybridArbiter:
    def __init__(
        self,
        symbolic_executor: SymbolicExecutor,
        llm_engine: BaseLLMEngine,
        threshold: float = 0.7,
    ) -> None:
        self._symbolic_executor = symbolic_executor
        self._llm_engine = llm_engine
        self._threshold = threshold

    def execute(self, query: str, metadata: Optional[Dict[str, Any]] = None) -> HybridDecision:
        metadata = metadata or {}
        symbolic = self._symbolic_executor(query, metadata)
        confidence = symbolic.get("confidence", 0.0)
        if symbolic.get("success") and confidence >= self._threshold:
            return HybridDecision("symbolic", confidence, symbolic, "Symbolic engine satisfied threshold")
        llm_response = self._llm_engine.generate(query)
        combined_result = {
            "symbolic": symbolic,
            "llm": {"response": llm_response},
        }
        explanation = (
            "Symbolic confidence below threshold; fallback to LLM response" if symbolic.get("success")
            else "Symbolic execution failed; using LLM output"
        )
        return HybridDecision("llm", confidence, combined_result, explanation)
