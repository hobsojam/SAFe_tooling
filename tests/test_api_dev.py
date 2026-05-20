from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import safe.api.deps as deps_module
from safe.api.routers.dev import router as dev_router

# Minimal app that always has the dev router (bypasses the SAFE_DEV_ROUTES guard)
_app = FastAPI()
_app.include_router(dev_router)
_client = TestClient(_app, raise_server_exceptions=True)


class TestDevResetDb:
    def test_returns_204(self):
        with patch("safe.api.routers.dev.reload_db"):
            response = _client.post("/dev/reset-db")
        assert response.status_code == 204

    def test_calls_reload_db(self):
        with patch("safe.api.routers.dev.reload_db") as mock_reload:
            _client.post("/dev/reset-db")
        mock_reload.assert_called_once()

    def test_response_has_no_body(self):
        with patch("safe.api.routers.dev.reload_db"):
            response = _client.post("/dev/reset-db")
        assert response.content == b""

    def test_propagates_runtime_error_when_db_path_not_set(self, monkeypatch):
        monkeypatch.setattr(deps_module, "_db_path", None)
        with pytest.raises(RuntimeError, match="Database path not initialised"):
            _client.post("/dev/reset-db")
