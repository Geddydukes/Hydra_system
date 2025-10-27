"""Runtime integration tests covering symbolic, hybrid, and sandbox flows."""

from __future__ import annotations

import asyncio
from pathlib import Path

import pytest

from hydra.agents import AgentConfig, RouteRule, RouterAgent
from hydra.audit.logger import AuditLogService
from hydra.backend.monitoring import MetricsRegistry, TraceRecorder
from hydra.connectors.base import Connector, ConnectorConfig, ConnectorContext, make_success
from hydra.feather_agent import FeatherRuntime
from hydra.llm import DeterministicLLM, HybridArbiter
from hydra.runtime.runtime import ExecutionRuntime
from hydra.runtime.sandbox import SandboxExecutionError, SandboxExecutor
from hydra.runtime.task_manager import TaskManager


class _DummyConnector(Connector):
    def __init__(self) -> None:
        super().__init__(ConnectorConfig(id="dummy", name="Dummy", type="internal"))

    async def execute(self, context: ConnectorContext):  # pragma: no cover - not invoked in tests
        return make_success(self, {"ok": True}, 0.0)


def test_execution_runtime_symbolic_flow_records_audit_and_metrics(tmp_path: Path):
    rules = [
        RouteRule("dscr", {"in": ["dscr", {"var": "query_lower"}]}, "loan_dscr_v1", confidence=0.9)
    ]
    router = RouterAgent(rules, AgentConfig(id="router", name="Router"))
    audit = AuditLogService("secret", tmp_path / "audit")
    metrics = MetricsRegistry()
    traces = TraceRecorder()
    runtime = ExecutionRuntime(
        router,
        FeatherRuntime(),
        audit,
        TaskManager(concurrency=2),
        SandboxExecutor(tmp_path / "sandbox"),
        metrics,
        traces,
    )
    runtime.register_connector("dummy", _DummyConnector())

    async def scenario():
        await runtime.start()
        result = await runtime.execute("Does this loan meet DSCR? NOI 120k debt service 100k")
        await runtime.stop()
        return result

    result = asyncio.run(scenario())
    assert result.route == "symbolic"
    assert result.teacher_id == "loan_dscr_v1"
    assert result.payload["success"] is True
    assert runtime.health()["connectors"] == ["dummy"]

    records = audit.find("symbolic_execution")
    assert len(records) == 1
    assert audit.verify(records[0])

    summary = metrics.summary("symbolic_latency")
    assert summary["count"] == 1.0
    assert summary["avg"] >= 0.0


def test_execution_runtime_hybrid_fallback_records_llm_route(tmp_path: Path):
    router = RouterAgent([], AgentConfig(id="router", name="Router"))
    audit = AuditLogService("secret", tmp_path / "audit2")
    metrics = MetricsRegistry()
    traces = TraceRecorder()

    def symbolic_executor(query: str, metadata):
        return {"success": False, "confidence": 0.1}

    arbiter = HybridArbiter(symbolic_executor, DeterministicLLM({"hello": "hi"}), threshold=0.5)
    runtime = ExecutionRuntime(
        router,
        FeatherRuntime(),
        audit,
        TaskManager(),
        SandboxExecutor(tmp_path / "sandbox2"),
        metrics,
        traces,
        arbiter=arbiter,
    )

    async def scenario():
        await runtime.start()
        result = await runtime.execute("hello")
        await runtime.stop()
        return result

    result = asyncio.run(scenario())
    assert result.route == "llm"
    assert "llm" in result.payload
    assert audit.find("llm")


def test_sandbox_execution_success_and_failure(tmp_path: Path):
    router = RouterAgent([], AgentConfig(id="router", name="Router"))
    audit = AuditLogService("secret", tmp_path / "audit3")
    metrics = MetricsRegistry()
    traces = TraceRecorder()
    runtime = ExecutionRuntime(
        router,
        FeatherRuntime(),
        audit,
        TaskManager(),
        SandboxExecutor(tmp_path / "sandbox3"),
        metrics,
        traces,
    )

    async def scenario():
        await runtime.start()
        success = await runtime.run_sandbox(["/bin/echo", "hello"])
        with pytest.raises(SandboxExecutionError):
            await runtime.run_sandbox(["/bin/sh", "-c", "exit 1"])
        await runtime.stop()
        return success

    success = asyncio.run(scenario())
    assert success["stdout"].strip() == "hello"
    assert runtime.health()["started"] is False
