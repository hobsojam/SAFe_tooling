import pytest
import schemathesis
from hypothesis import strategies as st

from safe.api.deps import get_repos_dep
from safe.api.main import app
from safe.store.db import get_db
from safe.store.repos import get_repos

# hypothesis-jsonschema has no built-in uuid strategy; without this, path
# parameters with format:uuid generate arbitrary strings that are almost never
# valid UUIDs, causing hypothesis to discard them via assume() and trip the
# filter_too_much health check.
schemathesis.openapi.format("uuid", st.uuids().map(str))

schema = schemathesis.openapi.from_asgi("/openapi.json", app)


@pytest.fixture(autouse=True)
def _fresh_db(tmp_path):
    db = get_db(str(tmp_path / "contract.json"))

    def _override():
        yield get_repos(db)

    app.dependency_overrides[get_repos_dep] = _override
    yield
    app.dependency_overrides.clear()
    db.close()


@schema.parametrize()
def test_api_contract(case):
    response = schema.transport.send(case)
    assert response.status_code < 500, (
        f"{case.method} {case.formatted_path} returned {response.status_code}"
    )
