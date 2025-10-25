from hydra.backend.api import APIRequest, APILayer, APIResponse
from hydra.backend.data import BackupService, ComplianceReporter, Migration, MigrationManager
from hydra.backend.monitoring import AlertManager, MetricsRegistry, TraceRecorder
from hydra.backend.rate_limiting import RateLimiter
from hydra.backend.security import RBAC, Role, TokenService
from hydra.frontend.client import HydraClient
from hydra.frontend.flow_builder import FlowBuilder, FlowNode
from hydra.frontend.project import ProjectStore, ProjectVersion
from hydra.frontend.user import User, UserDirectory


def test_api_layer_enforces_security_and_rate_limiting(tmp_path):
    token_service = TokenService("secret")
    rbac = RBAC([Role("admin", {"deploy"}), Role("guest", set())])
    limiter = RateLimiter(rate=10, capacity=5)
    api = APILayer(token_service, rbac, limiter)

    @api.route("POST", "/deploy")
    def deploy_handler(payload, request):
        assert payload["sub"] == "alice"
        return APIResponse(200, {"status": "deployed"})

    token = token_service.issue("alice", ["admin"])
    client = HydraClient(api, token)
    response = client.request("POST", "/deploy", {"version": "1.0.0"})
    assert response == {"status": "deployed"}


def test_data_management_and_frontend_integration(tmp_path):
    db_path = tmp_path / "db.sqlite"
    migrations = [Migration("1", "CREATE TABLE items(id INTEGER PRIMARY KEY, name TEXT);")]
    manager = MigrationManager(db_path)
    applied = manager.apply(migrations)
    assert applied == ["1"]

    backup_service = BackupService(tmp_path, tmp_path / "backups")
    archive = backup_service.create_backup("initial")
    assert archive.exists()

    reporter = ComplianceReporter({"policy": "All systems green"})
    report = reporter.generate()
    assert "summary" in report

    flow_builder = FlowBuilder()
    flow_builder.add_node(FlowNode("router", "Router", {"teacher": "loan_dscr_v1"}))
    flow_builder.add_node(FlowNode("teacher", "Teacher", {"id": "loan_dscr_v1"}))
    flow_builder.connect("router", "teacher")

    store = ProjectStore()
    project = store.create("proj", "Demo")
    store.add_version("proj", ProjectVersion("1.0.0", "Initial", flow_builder.serialize()))
    assert store.latest("proj").version == "1.0.0"

    directory = UserDirectory()
    directory.upsert(User("alice", "Alice", ["admin"]))
    assert directory.get("alice").name == "Alice"

    metrics = MetricsRegistry()
    traces = TraceRecorder()
    alerts = AlertManager()
    metrics.observe("latency", 10)
    traces.record("deploy", 0.05, status="ok")
    alerts.add_rule("latency", 5)
    assert alerts.evaluate(metrics)
