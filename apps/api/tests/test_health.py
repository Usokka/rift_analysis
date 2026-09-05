import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.api.health import get_database_probe
from app.main import create_app


@pytest.fixture
def client():
    with TestClient(create_app()) as test_client:
        yield test_client


def test_liveness_does_not_need_database(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_readiness_checks_database(client):
    calls = []
    client.app.dependency_overrides[get_database_probe] = lambda: lambda: calls.append(True)
    response = client.get("/api/v1/ready")
    assert response.status_code == 200
    assert response.json() == {"status": "ready", "database": "reachable"}
    assert calls == [True]


def test_database_failure_is_503_without_leaking_details(client):
    def fail():
        raise OperationalError("SELECT 1", {}, Exception("password=private"))

    client.app.dependency_overrides[get_database_probe] = lambda: fail
    response = client.get("/api/v1/ready")
    assert response.status_code == 503
    assert response.json() == {"status": "unavailable", "database": "unreachable"}
    assert "private" not in response.text


def test_cors_allows_configured_origin_only(client):
    allowed = client.get("/api/v1/health", headers={"Origin": "http://localhost:3000"})
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:3000"
    blocked = client.get("/api/v1/health", headers={"Origin": "https://untrusted.example"})
    assert "access-control-allow-origin" not in blocked.headers
