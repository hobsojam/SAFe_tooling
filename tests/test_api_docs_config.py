from fastapi.testclient import TestClient

from safe.api.main import create_app


def test_api_docs_are_available_by_default(monkeypatch):
    monkeypatch.delenv("SAFE_DISABLE_API_DOCS", raising=False)

    with TestClient(create_app()) as client:
        assert client.get("/docs").status_code == 200
        assert client.get("/openapi.json").status_code == 200


def test_api_docs_can_be_disabled(monkeypatch):
    monkeypatch.setenv("SAFE_DISABLE_API_DOCS", "1")

    with TestClient(create_app()) as client:
        assert client.get("/docs").status_code == 404
        assert client.get("/redoc").status_code == 404
        assert client.get("/openapi.json").status_code == 404
