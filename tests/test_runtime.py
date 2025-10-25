import asyncio
from pathlib import Path

import pytest

from hydra.agents import AgentConfig, RouteRule, RouterAgent
from hydra.audit.logger import AuditLogService
from hydra.backend.monitoring import MetricsRegistry, TraceRecorder
from hydra.feather_agent import FeatherRuntime
from hydra.llm import DeterministicLLM, HybridArbiter
from hydra.runtime.runtime import ExecutionRuntime
from hydra.runtime.sandbox import SandboxExecutor
from hydra.runtime.task_manager import TaskManager


def test_execution_runtime_routes_symbolic(tmp_path: Path):
    rules = [
        RouteRule("dscr", {"in": ["dscr", {"var": "query_lower"}]}, "loan_dscr_v1", confidence=0.95),
        RouteRule("transfer", {"in": ["transfer", {"var": "query_lower"}]}, "transfer_tax_v1", confidence=0.9),
    ]
    router = RouterAgent(rules, AgentConfig(id="router", name="Router"))
    audit = AuditLogService("secret", tmp_path / "audit")
    runtime = ExecutionRuntime(
        router,
        FeatherRuntime(),
        audit,
        TaskManager(),
        SandboxExecutor(tmp_path / "sandbox"),
        MetricsRegistry(),
        TraceRecorder(),
    )
    async def run():
        await runtime.start()
        try:
            return await runtime.execute("Does this loan meet DSCR? NOI 120k debt service 100k")
        finally:
            await runtime.stop()

    result = asyncio.run(run())
    assert result.route == "symbolic"
    assert result.payload["result"]["outputs"]["dscr"] == pytest.approx(1.2)
    assert audit.find("symbolic_execution")


def test_execution_runtime_falls_back_to_llm(tmp_path: Path):
    router = RouterAgent([], AgentConfig(id="router", name="Router"))
    audit = AuditLogService("secret", tmp_path / "audit2")

    def symbolic_executor(query: str, metadata):
        return {"success": False, "confidence": 0.0}

    arbiter = HybridArbiter(symbolic_executor, DeterministicLLM({"hello": "hi"}), threshold=0.5)
    runtime = ExecutionRuntime(
        router,
        FeatherRuntime(),
        audit,
        TaskManager(),
        SandboxExecutor(tmp_path / "sandbox2"),
        MetricsRegistry(),
        TraceRecorder(),
        arbiter=arbiter,
    )
    async def run():
        await runtime.start()
        try:
            return await runtime.execute("hello")
        finally:
            await runtime.stop()

    result = asyncio.run(run())
    assert result.route == "llm"
    assert "llm" in result.payload


def test_sandbox_execution_runs_command(tmp_path: Path):
    router = RouterAgent([], AgentConfig(id="router", name="Router"))
    audit = AuditLogService("secret", tmp_path / "audit3")
    runtime = ExecutionRuntime(
        router,
        FeatherRuntime(),
        audit,
        TaskManager(),
        SandboxExecutor(tmp_path / "sandbox3"),
        MetricsRegistry(),
        TraceRecorder(),
    )
    async def run():
        await runtime.start()
        try:
            return await runtime.run_sandbox(["/bin/echo", "hello"])
        finally:
            await runtime.stop()

    result = asyncio.run(run())
    assert "hello" in result["stdout"].strip()
