"""Base connector abstractions used throughout the Hydra runtime."""

from __future__ import annotations

import abc
from dataclasses import dataclass, field
from typing import Any, Dict, Optional


@dataclass(slots=True)
class ConnectorConfig:
    id: str
    name: str
    type: str
    enabled: bool = True
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class ConnectorContext:
    operation: str
    data: Optional[Dict[str, Any]] = None
    parameters: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class ConnectorResult:
    success: bool
    data: Optional[Any]
    error: Optional[str]
    execution_time: float
    metadata: Dict[str, Any] = field(default_factory=dict)


class ConnectorError(RuntimeError):
    pass


class Connector(abc.ABC):
    def __init__(self, config: ConnectorConfig) -> None:
        self._config = config
        self._connected = False

    @property
    def id(self) -> str:
        return self._config.id

    @property
    def name(self) -> str:
        return self._config.name

    @property
    def type(self) -> str:
        return self._config.type

    @property
    def enabled(self) -> bool:
        return self._config.enabled

    @property
    def metadata(self) -> Dict[str, Any]:
        return dict(self._config.metadata)

    async def connect(self) -> None:
        self._connected = True

    async def disconnect(self) -> None:
        self._connected = False

    async def health_check(self) -> bool:
        return self._connected

    @abc.abstractmethod
    async def execute(self, context: ConnectorContext) -> ConnectorResult:
        raise NotImplementedError

    def validate(self, context: ConnectorContext) -> bool:
        return bool(context.operation)


def make_success(
    connector: Connector,
    data: Any,
    execution_time: float,
    metadata: Optional[Dict[str, Any]] = None,
) -> ConnectorResult:
    base_metadata = {
        "connector_id": connector.id,
        "connector_name": connector.name,
        "connector_type": connector.type,
    }
    if metadata:
        base_metadata.update(metadata)
    return ConnectorResult(True, data, None, execution_time, base_metadata)


def make_error(
    connector: Connector,
    error: str,
    execution_time: float,
    metadata: Optional[Dict[str, Any]] = None,
) -> ConnectorResult:
    base_metadata = {
        "connector_id": connector.id,
        "connector_name": connector.name,
        "connector_type": connector.type,
    }
    if metadata:
        base_metadata.update(metadata)
    return ConnectorResult(False, None, error, execution_time, base_metadata)
