"""Legacy evaluator shim that delegates to the Python feather-agent implementation."""

from __future__ import annotations

from typing import Any, Dict

from hydra.feather_agent.teachers import evaluate_transfer_tax as _evaluate_transfer_tax


def evaluate_transfer_tax(inputs: Dict[str, Any]) -> Dict[str, Any]:
    return _evaluate_transfer_tax(inputs)
