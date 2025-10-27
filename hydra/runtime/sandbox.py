"""Lightweight sandbox executor using subprocess with resource isolation."""

from __future__ import annotations

import asyncio
import os
import resource
import subprocess
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Optional


@dataclass(slots=True)
class SandboxResult:
    returncode: int
    stdout: str
    stderr: str
    execution_time: float


class SandboxExecutionError(RuntimeError):
    pass


class SandboxExecutor:
    def __init__(self, workdir: Optional[Path] = None) -> None:
        self._workdir = Path(workdir or tempfile.mkdtemp(prefix="hydra-sandbox-"))
        self._workdir.mkdir(parents=True, exist_ok=True)

    async def run(
        self,
        command: Iterable[str],
        *,
        timeout: float = 30.0,
        memory_limit_mb: int = 128,
        input_text: Optional[str] = None,
    ) -> SandboxResult:
        command_list = list(command)
        if not command_list:
            raise ValueError("command cannot be empty")
        start = time.perf_counter()
        try:
            proc = await asyncio.to_thread(
                self._run_subprocess,
                command_list,
                timeout,
                memory_limit_mb,
                input_text,
            )
        except subprocess.TimeoutExpired as exc:
            raise SandboxExecutionError(f"timeout:{timeout}") from exc
        execution_time = time.perf_counter() - start
        if proc.returncode != 0:
            raise SandboxExecutionError(f"non_zero_exit:{proc.returncode}:{proc.stderr.strip()}")
        return SandboxResult(proc.returncode, proc.stdout, proc.stderr, execution_time)

    def _run_subprocess(
        self,
        command: Iterable[str],
        timeout: float,
        memory_limit_mb: int,
        input_text: Optional[str],
    ) -> subprocess.CompletedProcess[str]:
        def set_limits() -> None:
            soft = hard = memory_limit_mb * 1024 * 1024
            resource.setrlimit(resource.RLIMIT_AS, (soft, hard))
            resource.setrlimit(resource.RLIMIT_CPU, (int(timeout) + 1, int(timeout) + 1))

        env = os.environ.copy()
        env.setdefault("PYTHONUNBUFFERED", "1")
        return subprocess.run(
            list(command),
            cwd=self._workdir,
            check=False,
            capture_output=True,
            text=True,
            timeout=timeout,
            input=input_text,
            preexec_fn=set_limits,
            env=env,
        )
