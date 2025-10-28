"""Legacy evaluator shim that delegates to the Python feather-agent implementation."""

from __future__ import annotations

from typing import Any, Dict

from hydra.feather_agent.teachers import evaluate_dscr as _evaluate_dscr


def evaluate_dscr(inputs: Dict[str, Any]) -> Dict[str, Any]:
    return _evaluate_dscr(inputs)
