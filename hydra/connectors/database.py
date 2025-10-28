"""SQLite-backed database connector used for deterministic tests."""

from __future__ import annotations

import asyncio
import sqlite3
import time
from dataclasses import dataclass, field
from typing import Any, Iterable, List, Optional

from .base import Connector, ConnectorConfig, ConnectorContext, ConnectorResult, make_error, make_success


@dataclass(slots=True)
class DatabaseConnectorConfig(ConnectorConfig):
    database_path: str = ":memory:"
    pragmas: List[str] = field(default_factory=lambda: ["PRAGMA foreign_keys=ON"])


class DatabaseConnector(Connector):
    def __init__(self, config: DatabaseConnectorConfig) -> None:
        super().__init__(config)
        self._config = config
        self._connection: Optional[sqlite3.Connection] = None
        self._lock = asyncio.Lock()

    async def connect(self) -> None:
        await super().connect()
        self._connection = sqlite3.connect(self._config.database_path, check_same_thread=False)
        for pragma in self._config.pragmas:
            self._connection.execute(pragma)
        self._connection.row_factory = sqlite3.Row

    async def disconnect(self) -> None:
        if self._connection is not None:
            await asyncio.to_thread(self._connection.close)
            self._connection = None
        await super().disconnect()

    async def health_check(self) -> bool:
        if self._connection is None:
            return False
        try:
            await asyncio.to_thread(self._connection.execute, "SELECT 1")
            return True
        except sqlite3.Error:
            return False

    async def execute(self, context: ConnectorContext) -> ConnectorResult:
        if not self.enabled:
            return make_error(self, "connector_disabled", 0.0)
        if self._connection is None:
            return make_error(self, "not_connected", 0.0)
        operation = context.operation.lower()
        start = time.perf_counter()
        async with self._lock:
            try:
                if operation == "query":
                    rows = await asyncio.to_thread(self._run_query, context)
                    return make_success(self, rows, time.perf_counter() - start)
                if operation == "execute":
                    count = await asyncio.to_thread(self._run_execute, context)
                    return make_success(self, {"rowcount": count}, time.perf_counter() - start)
                if operation == "transaction":
                    result = await asyncio.to_thread(self._run_transaction, context)
                    return make_success(self, result, time.perf_counter() - start)
                return make_error(self, f"unknown_operation:{operation}", time.perf_counter() - start)
            except sqlite3.Error as exc:
                return make_error(self, f"sqlite_error:{exc}", time.perf_counter() - start)

    # ------------------------------------------------------------------
    def _run_query(self, context: ConnectorContext) -> List[dict]:
        query = context.parameters.get("sql")
        params = context.parameters.get("params") or []
        if not isinstance(params, Iterable) or isinstance(params, (str, bytes)):
            raise sqlite3.Error("query params must be iterable")
        cursor = self._connection.execute(query, tuple(params))  # type: ignore[arg-type]
        rows = [dict(row) for row in cursor.fetchall()]
        cursor.close()
        return rows

    def _run_execute(self, context: ConnectorContext) -> int:
        query = context.parameters.get("sql")
        params = context.parameters.get("params") or []
        cursor = self._connection.execute(query, tuple(params))  # type: ignore[arg-type]
        self._connection.commit()
        count = cursor.rowcount
        cursor.close()
        return count

    def _run_transaction(self, context: ConnectorContext) -> List[Any]:
        queries = context.parameters.get("statements")
        if not isinstance(queries, list):
            raise sqlite3.Error("transaction requires statements list")
        cursor = self._connection.cursor()
        results: List[Any] = []
        try:
            for statement in queries:
                sql = statement.get("sql")
                params = statement.get("params", [])
                cursor.execute(sql, tuple(params))
                if statement.get("fetch"):
                    results.append([dict(row) for row in cursor.fetchall()])
                else:
                    results.append({"rowcount": cursor.rowcount})
            self._connection.commit()
            return results
        except Exception:
            self._connection.rollback()
            raise
        finally:
            cursor.close()
