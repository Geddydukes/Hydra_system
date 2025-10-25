import asyncio
import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import pytest

from hydra.connectors import (
    ConnectorContext,
    DatabaseConnector,
    DatabaseConnectorConfig,
    RestConnector,
    RestConnectorConfig,
)


class _TestHandler(BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802 - required by BaseHTTPRequestHandler
        if self.path == "/health":
            payload = {"status": "ok"}
        else:
            payload = {"message": "Hello"}
        body = json.dumps(payload).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):  # noqa: A003 - signature fixed
        return


@pytest.fixture(scope="module")
def http_server():
    server = HTTPServer(("127.0.0.1", 0), _TestHandler)
    thread = threading.Thread(target=server.serve_forever)
    thread.start()
    try:
        yield server
    finally:
        server.shutdown()
        thread.join()


def test_rest_connector_gets_json_response(http_server):
    port = http_server.server_address[1]
    connector = RestConnector(
        RestConnectorConfig(
            id="rest", name="Rest", type="rest", base_url=f"http://127.0.0.1:{port}"
        )
    )
    async def run():
        await connector.connect()
        return await connector.execute(ConnectorContext(operation="GET", parameters={"path": "/status"}))

    result = asyncio.run(run())
    assert result.success is True
    assert result.data == {"message": "Hello"}
    assert result.metadata["connector_type"] == "rest"


def test_database_connector_executes_queries(tmp_path: Path):
    db_path = tmp_path / "test.sqlite"
    config = DatabaseConnectorConfig(id="db", name="DB", type="database", database_path=str(db_path))
    connector = DatabaseConnector(config)
    async def run():
        await connector.connect()
        await connector.execute(
            ConnectorContext(operation="execute", parameters={"sql": "CREATE TABLE loans(id INTEGER PRIMARY KEY, amount INTEGER)"})
        )
        await connector.execute(
            ConnectorContext(
                operation="execute",
                parameters={"sql": "INSERT INTO loans(amount) VALUES (?)", "params": [100]},
            )
        )
        return await connector.execute(
            ConnectorContext(
                operation="query",
                parameters={"sql": "SELECT amount FROM loans WHERE id = ?", "params": [1]},
            )
        )

    rows = asyncio.run(run())
    assert rows.success is True
    assert rows.data == [{"amount": 100}]
