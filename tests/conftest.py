import pytest
from fastapi.testclient import TestClient
from tinydb import TinyDB

from safe.api.deps import get_repos_dep
from safe.api.main import app
from safe.store.db import close_db
from safe.store.repos import Repos


@pytest.fixture(autouse=True)
def reset_db_singleton():
    """Close the db singleton after every test so CLI tests with different
    tmp_path values don't trigger the path-conflict RuntimeError."""
    yield
    close_db()


@pytest.fixture
def db(tmp_path):
    database = TinyDB(tmp_path / "api_test.json")
    yield database
    database.close()


@pytest.fixture
def client(db):
    app.dependency_overrides[get_repos_dep] = lambda: Repos(db)
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
