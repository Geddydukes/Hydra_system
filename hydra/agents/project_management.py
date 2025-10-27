"""Agent responsible for deployment orchestration."""

from __future__ import annotations

from pathlib import Path
from typing import Dict, Optional

from hydra.deployment.manager import DeploymentManager, HealthMonitor
from hydra.runtime.task_manager import TaskManager

from .base import AgentConfig, ExecutionContext, HydraAgent


class ProjectManagementAgent(HydraAgent):
    def __init__(
        self,
        deployment: DeploymentManager,
        health: HealthMonitor,
        tasks: TaskManager,
        config: Optional[AgentConfig] = None,
    ) -> None:
        super().__init__(config or AgentConfig(id="project-manager", name="ProjectManagementAgent"))
        self._deployment = deployment
        self._health = health
        self._tasks = tasks

    async def execute_internal(self, context: ExecutionContext) -> Dict[str, any]:
        action = context.payload.get("action")
        if action == "package":
            src = Path(context.payload["source"])
            version = context.payload["version"]
            package = self._deployment.package(src, version)
            return {"success": True, "package": package.__dict__}
        if action == "rollback":
            version = context.payload["version"]
            package = self._deployment.rollback(version)
            return {"success": True, "package": package.__dict__}
        if action == "health":
            return {"success": True, "health": self._health.summary()}
        if action == "submit_task":
            task_id = context.payload["task_id"]
            coro_factory = context.payload["coro_factory"]
            retries = int(context.payload.get("retries", 0))
            await self._tasks.submit(task_id, coro_factory, retries)
            return {"success": True, "task_id": task_id}
        raise ValueError(f"unknown action {action}")

    def validate_internal(self, context: ExecutionContext) -> bool:
        return "action" in context.payload
