"""End-to-end tests for the Python feather-agent runtime shim."""

from __future__ import annotations

import json
from pathlib import Path

from jsonschema import validate

from hydra.feather_agent import FeatherRuntime, FeatherRuntimeResult


def test_health(feather_runtime: FeatherRuntime) -> None:
    status = feather_runtime.health()
    assert status["ok"] is True
    assert status["runtime"] == "feather-agent"


def test_registry_schema() -> None:
    schema = json.loads(Path("schema/TeacherSpec.schema.json").read_text())
    for spec_path in Path("registry").rglob("*.json"):
        if "/tests/" in str(spec_path):
            continue
        spec = json.loads(spec_path.read_text())
        validate(instance=spec, schema=schema)


def test_run_dscr_pass(feather_runtime: FeatherRuntime) -> None:
    result = feather_runtime.execute(
        "Does this loan meet DSCR? NOI $120,000 and debt service 100k",
    )
    _assert_symbolic_success(result, "loan_dscr_v1")
    assert abs(result.result["outputs"]["dscr"] - 1.2) < 1e-6
    assert result.result["verdict"] == "PASS"
    assert "Debt service coverage ratio" in result.explanation


def test_run_transfer_tax(feather_runtime: FeatherRuntime) -> None:
    result = feather_runtime.execute(
        "What is transfer tax on $500,000 at 0.5%?",
    )
    _assert_symbolic_success(result, "transfer_tax_v1")
    tax = result.result["outputs"]["transfer_tax"]
    assert abs(tax - 2500.0) < 1e-6
    assert "Transfer tax computed deterministically" in result.explanation


def _assert_symbolic_success(result: FeatherRuntimeResult, teacher_id: str) -> None:
    assert result.routing_decision == "symbolic"
    assert result.teacher_id == teacher_id
    assert result.normalized_input is not None
    assert isinstance(result.result, dict)
