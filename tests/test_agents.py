"""Comprehensive tests for the Hydra agent framework."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any, Dict, List

import pytest

from hydra.agents import AgentConfig, HydraAgent, make_context
from hydra.agents.base import AgentExecutionError


@dataclass
class _CallRecord:
    event: str
    payload: Dict[str, Any]


class _SampleAgent(HydraAgent):
    def __init__(self, *, fails: int = 0, timeout: float = 0.1, validate: bool = True) -> None:
        super().__init__(
            AgentConfig(
                id="sample", name="SampleAgent", retries=fails, timeout=timeout, metadata={"env": "test"}
            )
        )
        self._fails = fails
        self._validate = validate
        self.calls = 0

    async def execute_internal(self, context):
        self.calls += 1
        await asyncio.sleep(0)
        if self.calls <= self._fails:
            raise RuntimeError("boom")
        value = context.payload.get("value", 0)
        return {"doubled": value * 2, "request_id": context.request_id}

    def validate_internal(self, context):
        return self._validate and "value" in context.payload


def test_agent_executes_successfully_and_records_metadata():
    agent = _SampleAgent()
    events: List[_CallRecord] = []
    agent.add_event_listener(lambda evt: events.append(_CallRecord(evt["type"], evt["payload"])))

    async def scenario():
        await agent.start()
        context = make_context({"value": 21}, metadata={"trace_id": "abc"})
        result = await agent.execute(context)
        await agent.stop()
        return context, result

    context, result = asyncio.run(scenario())
    assert result.success is True
    assert result.result == {"doubled": 42, "request_id": context.request_id}
    assert result.metadata["env"] == "test"
    assert result.metadata["trace_id"] == "abc"
    assert any(evt.event == "result" for evt in events)


def test_agent_retries_until_success():
    agent = _SampleAgent(fails=1)

    async def scenario():
        context = make_context({"value": 5})
        result = await agent.execute(context)
        return result

    result = asyncio.run(scenario())
    assert agent.calls == 2
    assert result.success is True
    assert result.result["doubled"] == 10
    recent = agent.get_recent_results()
    assert len(recent) == 2
    assert recent[-1].success is True


def test_agent_emits_error_after_retries_exhausted():
    agent = _SampleAgent(fails=1)
    agent.config.retries = 0

    async def scenario():
        context = make_context({"value": 1})
        await agent.execute(context)

    with pytest.raises(AgentExecutionError):
        asyncio.run(scenario())
    recent = agent.get_recent_results()
    assert recent[-1].success is False
    assert recent[-1].error.startswith("RuntimeError")


def test_agent_validation_failure_short_circuits_execution():
    agent = _SampleAgent(validate=False)

    async def scenario():
        context = make_context({})
        return await agent.execute(context)

    result = asyncio.run(scenario())
    assert result.success is False
    assert result.error == "validation_failed"
    assert agent.calls == 0


def test_agent_timeout_raises_execution_error():
    class SlowAgent(_SampleAgent):
        async def execute_internal(self, context):  # type: ignore[override]
            await asyncio.sleep(0.2)
            return {"ok": True}

    agent = SlowAgent(timeout=0.01)

    async def scenario():
        context = make_context({"value": 1})
        await agent.execute(context)

    with pytest.raises(AgentExecutionError):
        asyncio.run(scenario())
