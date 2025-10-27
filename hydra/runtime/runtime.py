"""High-level execution runtime orchestrating symbolic, LLM, and task workflows."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any, Dict, Optional

from hydra.agents import ExecutionContext, RouterAgent, make_context
from hydra.audit.logger import AuditLogService
from hydra.backend.monitoring import MetricsRegistry, TraceRecorder
from hydra.connectors import Connector
from hydra.feather_agent import FeatherRuntime
from hydra.llm import HybridArbiter
from hydra.runtime.sandbox import SandboxExecutor, SandboxExecutionError
from hydra.runtime.task_manager import TaskManager


@dataclass(slots=True)
class RuntimeResult:
    route: str
    teacher_id: Optional[str]
    payload: Dict[str, Any]
    audit_id: Optional[str]


class ExecutionRuntime:
    def __init__(
        self,
        router: RouterAgent,
        symbolic_runtime: FeatherRuntime,
        audit: AuditLogService,
        task_manager: TaskManager,
        sandbox: SandboxExecutor,
        metrics: MetricsRegistry,
        traces: TraceRecorder,
        arbiter: Optional[HybridArbiter] = None,
    ) -> None:
        self._router = router
        self._symbolic_runtime = symbolic_runtime
        self._audit = audit
        self._task_manager = task_manager
        self._sandbox = sandbox
        self._metrics = metrics
        self._traces = traces
        self._arbiter = arbiter
        self._connectors: Dict[str, Connector] = {}
        self._started = False

    async def start(self) -> None:
        if self._started:
            return
        await self._task_manager.start()
        self._started = True

    async def stop(self) -> None:
        if not self._started:
            return
        await self._task_manager.stop()
        self._started = False

    def register_connector(self, name: str, connector: Connector) -> None:
        self._connectors[name] = connector

    async def execute(self, query: str, metadata: Optional[Dict[str, Any]] = None) -> RuntimeResult:
        metadata = metadata or {}
        context = make_context({"query": query, "metadata": metadata})
        router_result = await self._router.execute(context)
        route_payload = router_result.result or {}
        if route_payload.get("success"):
            symbolic = self._symbolic_runtime.execute(query, metadata)
            payload = {
                "success": symbolic.result is not None,
                "result": symbolic.result,
                "explanation": symbolic.explanation,
                "teacher_id": symbolic.teacher_id,
                "confidence": route_payload.get("confidence", 1.0),
            }
            audit_record = self._audit.record(
                "symbolic_execution",
                {
                    "query": query,
                    "teacher_id": payload["teacher_id"],
                    "success": payload["success"],
                },
            )
            self._metrics.observe("symbolic_latency", router_result.execution_time)
            return RuntimeResult("symbolic", payload["teacher_id"], payload, audit_record.event_id)
        if self._arbiter:
            decision = self._arbiter.execute(query, metadata)
            audit_record = self._audit.record(
                decision.route,
                {"query": query, "confidence": decision.confidence},
            )
            return RuntimeResult(decision.route, None, decision.result, audit_record.event_id)
        raise RuntimeError("routing_failed")

    async def run_sandbox(self, command: list[str]) -> Dict[str, Any]:
        try:
            result = await self._sandbox.run(command)
            self._metrics.observe("sandbox_runtime", result.execution_time)
            return {"stdout": result.stdout, "stderr": result.stderr}
        except SandboxExecutionError as exc:
            self._metrics.observe("sandbox_failures", 1.0)
            raise

    def health(self) -> Dict[str, Any]:
        return {
            "runtime": "execution",
            "connectors": list(self._connectors.keys()),
            "started": self._started,
        }
