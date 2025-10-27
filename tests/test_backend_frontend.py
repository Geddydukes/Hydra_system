"""Integration tests for backend services and frontend helpers."""

from __future__ import annotations

import time
from pathlib import Path

import pytest

from hydra.backend.api import APIResponse, APILayer
from hydra.backend.data import BackupService, ComplianceReporter, Migration, MigrationManager
from hydra.backend.rate_limiting import RateLimiter
from hydra.backend.security import RBAC, Role, TokenError, TokenService
from hydra.frontend.client import HydraClient
from hydra.frontend.flow_builder import FlowBuilder, FlowNode
from hydra.frontend.project import ProjectStore, ProjectVersion
from hydra.frontend.user import User, UserDirectory


def test_token_service_issue_verify_and_expiration(monkeypatch):
    service = TokenService("secret")
    token = service.issue("alice", ["admin"], expires_in=10)
    payload = service.verify(token)
    assert payload["sub"] == "alice"
    assert payload["roles"] == ["admin"]

    original_time = time.time()
    monkeypatch.setattr(time, "time", lambda: original_time + 20)
    with pytest.raises(TokenError):
        service.verify(token)


def test_api_layer_with_security_rate_limiting_and_client():
    token_service = TokenService("api-secret")
    rbac = RBAC([Role("admin", {"deploy"}), Role("guest", {"read"})])
    limiter = RateLimiter(rate=10, capacity=5)
    api = APILayer(token_service, rbac, limiter)

    @api.route("GET", "/status")
    def status(payload, request):
        return APIResponse(200, {"user": payload["sub"], "roles": payload["roles"]})

    @api.route("POST", "/deploy")
    def deploy(payload, request):
        if not rbac.check(payload.get("roles", []), "deploy"):
            return APIResponse(403, {"error": "forbidden"})
        return APIResponse(200, {"ok": True, "version": request.body["version"]})

    client = HydraClient(api, api_key="test-key")
    assert client.request("GET", "/status") == {"user": "anonymous", "roles": ["guest"]}

    token = token_service.issue("alice", ["admin"], expires_in=60)
    client.authenticate(token)
    assert client.request("GET", "/status")["roles"] == ["admin"]
    assert client.request("POST", "/deploy", {"version": "1.0"})["ok"] is True

    with pytest.raises(RuntimeError) as exc:
        for _ in range(6):
            client.request("GET", "/status")
    assert "rate_limited" in str(exc.value)

    unauthenticated = HydraClient(api, api_key="other")
    with pytest.raises(RuntimeError) as exc:
        unauthenticated.request("POST", "/deploy", {"version": "1.0"})
    assert "forbidden" in str(exc.value)


def test_data_services_migrations_and_backups(tmp_path: Path):
    db_path = tmp_path / "db.sqlite"
    manager = MigrationManager(db_path)
    migrations = [
        Migration("001", "CREATE TABLE items(id INTEGER PRIMARY KEY, name TEXT);"),
        Migration("002", "INSERT INTO items(name) VALUES ('alpha');"),
    ]
    applied = manager.apply(migrations)
    assert applied == ["001", "002"]
    assert manager.apply(migrations) == []

    source = tmp_path / "data"
    source.mkdir()
    (source / "file.txt").write_text("payload")
    backup_dir = tmp_path / "backups"
    service = BackupService(source, backup_dir)
    archive = service.create_backup("snapshot")
    assert archive.exists()
    assert archive.suffix == ".zip"

    reporter = ComplianceReporter({"policy": "All systems green"})
    report = reporter.generate()
    assert report["summary"].startswith("Evaluated")
    assert report["rules"]["policy"] == "All systems green"


def test_frontend_builders_projects_and_users():
    builder = FlowBuilder()
    router_node = FlowNode("router", "Router", {"teacher": "loan_dscr_v1"})
    teacher_node = FlowNode("teacher", "Teacher", {"id": "loan_dscr_v1"})
    builder.add_node(router_node)
    builder.add_node(teacher_node)
    builder.connect("router", "teacher")
    flow = builder.serialize()
    assert flow["nodes"][0]["id"] == "router"
    with pytest.raises(ValueError):
        builder.add_node(router_node)
    with pytest.raises(KeyError):
        builder.connect("router", "missing")

    store = ProjectStore()
    store.create("proj-1", "Demo")
    store.add_version("proj-1", ProjectVersion("1.0", "Initial", flow))
    assert store.latest("proj-1").version == "1.0"
    with pytest.raises(ValueError):
        store.create("proj-1", "Duplicate")
    with pytest.raises(KeyError):
        store.latest("missing")

    directory = UserDirectory()
    user = User("alice", "Alice", ["admin"])
    directory.upsert(user)
    assert directory.get("alice").name == "Alice"
    with pytest.raises(KeyError):
        directory.get("missing")
    assert directory.list() == [user]
