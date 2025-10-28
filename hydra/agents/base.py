"""Core agent framework for Hydra Systems."""

from __future__ import annotations

import asyncio
import time
import uuid
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Deque, Dict, List, Optional, Protocol


@dataclass(slots=True)
class AgentConfig:
    id: str
    name: str
    description: Optional[str] = None
    version: str = "1.0.0"
    enabled: bool = True
    priority: int = 0
    timeout: float = 30.0
    retries: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class ExecutionContext:
    request_id: str
    payload: Dict[str, Any]
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class AgentResult:
    success: bool
    result: Optional[Dict[str, Any]]
    error: Optional[str]
    execution_time: float
    agent_id: str
    request_id: str
    metadata: Dict[str, Any] = field(default_factory=dict)


class AgentEvent(Protocol):
    type: str
    agent_id: str
    timestamp: float
    payload: Dict[str, Any]


AgentEventHandler = Callable[[AgentEvent], None]


class AgentExecutionError(RuntimeError):
    """Raised when an agent fails after exhausting retries."""


class HydraAgent:
    """Base class that provides lifecycle, validation, and retry logic."""

    def __init__(self, config: Optional[AgentConfig] = None) -> None:
        if config is None:
            config = AgentConfig(id=str(uuid.uuid4()), name=self.__class__.__name__)
        self._config = config
        self._status: str = "idle"
        self._event_handlers: List[AgentEventHandler] = []
        self._recent_results: Deque[AgentResult] = deque(maxlen=100)

    # ------------------------------------------------------------------
    @property
    def id(self) -> str:
        return self._config.id

    @property
    def name(self) -> str:
        return self._config.name

    @property
    def status(self) -> str:
        return self._status

    @property
    def config(self) -> AgentConfig:
        return self._config

    # ------------------------------------------------------------------
    def add_event_listener(self, handler: AgentEventHandler) -> None:
        self._event_handlers.append(handler)

    def remove_event_listener(self, handler: AgentEventHandler) -> None:
        if handler in self._event_handlers:
            self._event_handlers.remove(handler)

    # ------------------------------------------------------------------
    async def start(self) -> None:
        self._status = "idle"
        await self.on_start()
        self._emit("start", {})

    async def stop(self) -> None:
        await self.on_stop()
        self._status = "stopped"
        self._emit("stop", {})

    # ------------------------------------------------------------------
    async def execute(self, context: ExecutionContext) -> AgentResult:
        if not self._config.enabled:
            return self._make_result(context, success=False, error="agent_disabled")

        if not self.validate(context):
            return self._make_result(context, success=False, error="validation_failed")

        attempts = 0
        last_error: Optional[str] = None
        while attempts <= self._config.retries:
            attempts += 1
            start = time.perf_counter()
            self._status = "running"
            try:
                result_payload = await self._execute_with_timeout(context)
                execution_time = time.perf_counter() - start
                result = self._make_result(
                    context,
                    success=True,
                    result=result_payload,
                    execution_time=execution_time,
                )
                self._recent_results.append(result)
                self._status = "idle"
                self._emit("result", {"attempts": attempts, "result": result_payload})
                return result
            except Exception as exc:  # pragma: no cover - error handling exercised in tests
                last_error = exc.__class__.__name__ + ": " + str(exc)
                execution_time = time.perf_counter() - start
                result = self._make_result(
                    context,
                    success=False,
                    error=last_error,
                    execution_time=execution_time,
                )
                self._recent_results.append(result)
                self._emit("error", {"attempts": attempts, "error": last_error})
                if attempts > self._config.retries:
                    self._status = "error"
                    raise AgentExecutionError(last_error) from exc
                await asyncio.sleep(min(0.05 * attempts, 0.5))
        return self._make_result(context, success=False, error=last_error)

    async def _execute_with_timeout(self, context: ExecutionContext) -> Dict[str, Any]:
        coro = self.execute_internal(context)
        try:
            if asyncio.iscoroutine(coro) or isinstance(coro, Awaitable):
                return await asyncio.wait_for(coro, timeout=self._config.timeout)
            raise TypeError("execute_internal must return a coroutine")
        except asyncio.TimeoutError as exc:
            raise AgentExecutionError("timeout") from exc

    # Hooks ----------------------------------------------------------------
    def validate(self, context: ExecutionContext) -> bool:
        try:
            return self.validate_internal(context)
        except Exception:  # pragma: no cover - defensive
            return False

    async def on_start(self) -> None:
        """Optional hook for subclasses."""

    async def on_stop(self) -> None:
        """Optional hook for subclasses."""

    def get_recent_results(self) -> List[AgentResult]:
        return list(self._recent_results)

    # Abstract methods -----------------------------------------------------
    async def execute_internal(self, context: ExecutionContext) -> Dict[str, Any]:
        raise NotImplementedError

    def validate_internal(self, context: ExecutionContext) -> bool:
        raise NotImplementedError

    # Internal helpers -----------------------------------------------------
    def _make_result(
        self,
        context: ExecutionContext,
        success: bool,
        result: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
        execution_time: float = 0.0,
    ) -> AgentResult:
        payload = AgentResult(
            success=success,
            result=result,
            error=error,
            execution_time=execution_time,
            agent_id=self.id,
            request_id=context.request_id,
            metadata={**self._config.metadata, **context.metadata},
        )
        return payload

    def _emit(self, event_type: str, payload: Dict[str, Any]) -> None:
        event = {
            "type": event_type,
            "agent_id": self.id,
            "timestamp": time.time(),
            "payload": payload,
        }
        for handler in list(self._event_handlers):
            handler(event)  # pragma: no cover - listeners tested indirectly


def make_context(payload: Dict[str, Any], metadata: Optional[Dict[str, Any]] = None) -> ExecutionContext:
    return ExecutionContext(request_id=str(uuid.uuid4()), payload=payload, metadata=metadata or {})
