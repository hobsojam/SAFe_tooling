import pytest
import schemathesis
from hypothesis import HealthCheck, settings

from safe.api.deps import get_repos_dep
from safe.api.main import app
from safe.store.db import get_db
from safe.store.repos import get_repos

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
@settings(suppress_health_check=[HealthCheck.too_many_filtered_examples])
def test_api_contract(case):
    response = schema.transport.send(case)
    assert response.status_code < 500, (
        f"{case.method} {case.formatted_path} returned {response.status_code}"
    )
