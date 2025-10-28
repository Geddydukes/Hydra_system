"""Async task manager with retry-aware job queue."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Dict, Optional


@dataclass(slots=True)
class TaskResult:
    task_id: str
    success: bool
    result: Any
    error: Optional[str]
    attempts: int


TaskCallable = Callable[[], Awaitable[Any]]


class TaskManager:
    def __init__(self, concurrency: int = 4) -> None:
        self._queue: asyncio.Queue[tuple[str, TaskCallable, int]] = asyncio.Queue()
        self._results: Dict[str, TaskResult] = {}
        self._workers: list[asyncio.Task[None]] = []
        self._concurrency = max(1, concurrency)
        self._running = False

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        for _ in range(self._concurrency):
            self._workers.append(asyncio.create_task(self._worker()))

    async def stop(self) -> None:
        if not self._running:
            return
        self._running = False
        for _ in self._workers:
            await self._queue.put(("__shutdown__", lambda: asyncio.sleep(0), 0))
        await asyncio.gather(*self._workers, return_exceptions=True)
        self._workers.clear()

    async def submit(self, task_id: str, coro_factory: TaskCallable, retries: int = 0) -> None:
        await self._queue.put((task_id, coro_factory, retries))

    def get_result(self, task_id: str) -> Optional[TaskResult]:
        return self._results.get(task_id)

    async def _worker(self) -> None:
        while True:
            task_id, coro_factory, retries = await self._queue.get()
            if task_id == "__shutdown__":
                self._queue.task_done()
                break
            attempts = 0
            success = False
            result: Any = None
            error: Optional[str] = None
            while attempts <= retries:
                attempts += 1
                try:
                    coro = coro_factory()
                    result = await asyncio.wait_for(coro, timeout=60.0)
                    success = True
                    break
                except Exception as exc:  # pragma: no cover - error path exercised in tests
                    error = f"{exc.__class__.__name__}:{exc}" if exc else "unknown_error"
                    await asyncio.sleep(min(0.1 * attempts, 1.0))
            self._results[task_id] = TaskResult(task_id, success, result, error, attempts)
            self._queue.task_done()
