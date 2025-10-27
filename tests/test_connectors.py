"""End-to-end tests for REST and database connectors."""

from __future__ import annotations

import asyncio
import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Any, Dict

import pytest

from hydra.connectors import (
    ConnectorContext,
    DatabaseConnector,
    DatabaseConnectorConfig,
    RestConnector,
    RestConnectorConfig,
)


class _Handler(BaseHTTPRequestHandler):
    state: Dict[str, Any] = {"items": ["alpha", "beta"]}

    def do_GET(self):  # noqa: N802 - required signature
        if self.path.startswith("/items"):
            payload = {"items": list(self.state["items"])}
        elif self.path == "/health":
            payload = {"status": "ok"}
        else:
            payload = {"message": "unknown"}
        self._write_response(200, payload)

    def do_POST(self):  # noqa: N802 - required signature
        length = int(self.headers.get("Content-Length", "0"))
        body = json.loads(self.rfile.read(length) or b"{}")
        token = self.headers.get("Authorization")
        if token != "Bearer secret-token":
            self._write_response(401, {"error": "unauthorized"})
            return
        item = body.get("item")
        if item:
            self.state.setdefault("items", []).append(item)
        self._write_response(201, {"created": item})

    def log_message(self, format, *args):  # noqa: A003 - keep server quiet
        return

    def _write_response(self, status: int, payload: Dict[str, Any]) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


@pytest.fixture(scope="module")
def http_server():
    server = HTTPServer(("127.0.0.1", 0), _Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield server
    finally:
        server.shutdown()
        thread.join()


def test_rest_connector_supports_get_post_and_health(http_server):
    port = http_server.server_address[1]
    connector = RestConnector(
        RestConnectorConfig(
            id="rest",
            name="REST",
            type="rest",
            base_url=f"http://127.0.0.1:{port}",
            auth={"type": "bearer", "token": "secret-token"},
        )
    )

    async def scenario():
        await connector.connect()
        get_result = await connector.execute(ConnectorContext(operation="GET", parameters={"path": "/items"}))
        post_context = ConnectorContext(operation="POST", data={"item": "gamma"}, parameters={"path": "/items"})
        post_result = await connector.execute(post_context)
        health = await connector.health_check()
        disabled = await RestConnector(
            RestConnectorConfig(
                id="rest2",
                name="Disabled",
                type="rest",
                base_url="http://127.0.0.1",
                enabled=False,
            )
        ).execute(ConnectorContext(operation="GET"))
        return get_result, post_result, health, disabled

    get_result, post_result, health, disabled = asyncio.run(scenario())
    assert get_result.success is True
    assert get_result.data == {"items": ["alpha", "beta"]}
    assert post_result.success is True
    assert post_result.data == {"created": "gamma"}
    assert health is True
    assert disabled.success is False and disabled.error == "connector_disabled"


def test_rest_connector_rejects_unknown_operation(http_server):
    port = http_server.server_address[1]
    connector = RestConnector(
        RestConnectorConfig(id="rest", name="REST", type="rest", base_url=f"http://127.0.0.1:{port}")
    )

    async def scenario():
        await connector.connect()
        return await connector.execute(ConnectorContext(operation="TRACE"))

    result = asyncio.run(scenario())
    assert result.success is False
    assert result.error == "invalid_context"


def test_database_connector_executes_queries_transactions_and_health(tmp_path: Path):
    db_path = tmp_path / "db.sqlite"
    connector = DatabaseConnector(
        DatabaseConnectorConfig(id="db", name="DB", type="database", database_path=str(db_path))
    )

    async def scenario():
        await connector.connect()
        await connector.execute(
            ConnectorContext(operation="execute", parameters={"sql": "CREATE TABLE items(id INTEGER PRIMARY KEY, name TEXT)"})
        )
        insert_tasks = [
            connector.execute(
                ConnectorContext(
                    operation="execute",
                    parameters={"sql": "INSERT INTO items(name) VALUES (?)", "params": [f"item-{index}"]},
                )
            )
            for index in range(5)
        ]
        await asyncio.gather(*insert_tasks)
        query = await connector.execute(
            ConnectorContext(
                operation="query",
                parameters={"sql": "SELECT name FROM items WHERE name LIKE ?", "params": ["item-%"]},
            )
        )
        transaction = await connector.execute(
            ConnectorContext(
                operation="transaction",
                parameters={
                    "statements": [
                        {"sql": "UPDATE items SET name = ? WHERE name = ?", "params": ["updated", "item-1"], "fetch": False},
                        {"sql": "SELECT COUNT(*) as count FROM items", "fetch": True},
                    ]
                },
            )
        )
        health = await connector.health_check()
        bad = await connector.execute(ConnectorContext(operation="query", parameters={"sql": "SELECT * FROM missing"}))
        await connector.disconnect()
        disconnected = await connector.execute(ConnectorContext(operation="query", parameters={"sql": "SELECT 1"}))
        return query, transaction, health, bad, disconnected

    query, transaction, health, bad, disconnected = asyncio.run(scenario())
    assert query.success and len(query.data) == 5
    assert transaction.success and transaction.data[-1][0]["count"] == 5
    assert health is True
    assert bad.success is False and "sqlite_error" in bad.error
    assert disconnected.success is False and disconnected.error == "not_connected"
