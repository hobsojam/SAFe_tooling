from datetime import date
from pathlib import Path

import pytest
from tinydb import TinyDB

import safe.store.db as db_module
from safe.models.art import ART, Team
from safe.models.backlog import Feature
from safe.models.capacity_plan import CapacityPlan
from safe.models.dependency import Dependency, DependencyStatus
from safe.store.db import close_db, get_db
from safe.store.repos import Repos
from safe.store.repository import Repository


@pytest.fixture
def db(tmp_path: Path) -> TinyDB:
    db = TinyDB(tmp_path / "test.json")
    yield db
    db.close()


@pytest.fixture
def repos(db: TinyDB) -> Repos:
    return Repos(db)


# --- Repository basics ---


def test_save_and_get(db: TinyDB) -> None:
    repo: Repository[Team] = Repository(db, "teams", Team)
    team = Team(name="Alpha", member_count=6)
    repo.save(team)
    loaded = repo.get(team.id)
    assert loaded is not None
    assert loaded.name == "Alpha"
    assert loaded.member_count == 6


def test_get_missing_returns_none(db: TinyDB) -> None:
    repo: Repository[Team] = Repository(db, "teams", Team)
    assert repo.get("nonexistent-id") is None


def test_save_is_upsert(db: TinyDB) -> None:
    repo: Repository[Team] = Repository(db, "teams", Team)
    team = Team(name="Alpha", member_count=6)
    repo.save(team)
    team.member_count = 8
    repo.save(team)
    assert repo.count() == 1
    assert repo.get(team.id).member_count == 8


def test_get_all(db: TinyDB) -> None:
    repo: Repository[Team] = Repository(db, "teams", Team)
    repo.save(Team(name="Alpha", member_count=6))
    repo.save(Team(name="Beta", member_count=5))
    assert repo.count() == 2
    names = {t.name for t in repo.get_all()}
    assert names == {"Alpha", "Beta"}


def test_find_no_kwargs_raises(db: TinyDB) -> None:
    repo: Repository[Team] = Repository(db, "teams", Team)
    with pytest.raises(ValueError, match="get_all"):
        repo.find()


def test_delete(db: TinyDB) -> None:
    repo: Repository[Team] = Repository(db, "teams", Team)
    team = Team(name="Alpha", member_count=6)
    repo.save(team)
    assert repo.delete(team.id) is True
    assert repo.get(team.id) is None
    assert repo.count() == 0


def test_delete_missing_returns_false(db: TinyDB) -> None:
    repo: Repository[Team] = Repository(db, "teams", Team)
    assert repo.delete("nonexistent-id") is False


def test_find_by_field(db: TinyDB) -> None:
    repo: Repository[Team] = Repository(db, "teams", Team)
    art_id = "art-1"
    repo.save(Team(name="Alpha", member_count=6, art_id=art_id))
    repo.save(Team(name="Beta", member_count=5, art_id=art_id))
    repo.save(Team(name="Gamma", member_count=4, art_id="art-2"))
    results = repo.find(art_id=art_id)
    assert len(results) == 2
    assert all(t.art_id == art_id for t in results)


def test_find_multiple_conditions(db: TinyDB) -> None:
    repo: Repository[Team] = Repository(db, "teams", Team)
    art_id = "art-1"
    repo.save(Team(name="Alpha", member_count=6, art_id=art_id))
    repo.save(Team(name="Beta", member_count=5, art_id=art_id))
    results = repo.find(art_id=art_id, member_count=6)
    assert len(results) == 1
    assert results[0].name == "Alpha"


# --- Computed fields not persisted ---


def test_computed_fields_excluded_from_storage(db: TinyDB) -> None:
    repo: Repository[Feature] = Repository(db, "features", Feature)
    feature = Feature(
        name="Login Flow",
        user_business_value=8,
        time_criticality=5,
        risk_reduction_opportunity_enablement=3,
        job_size=4,
    )
    repo.save(feature)
    raw = db.table("features").all()[0]
    assert "wsjf_score" not in raw
    assert "cost_of_delay" not in raw


def test_computed_fields_available_after_load(db: TinyDB) -> None:
    repo: Repository[Feature] = Repository(db, "features", Feature)
    feature = Feature(
        name="Login Flow",
        user_business_value=8,
        time_criticality=5,
        risk_reduction_opportunity_enablement=3,
        job_size=4,
    )
    repo.save(feature)
    loaded = repo.get(feature.id)
    assert loaded.wsjf_score == pytest.approx(4.0)
    assert loaded.cost_of_delay == 16


# --- CapacityPlan computed field ---


def test_capacity_plan_computed_excluded(db: TinyDB) -> None:
    repo: Repository[CapacityPlan] = Repository(db, "capacity_plans", CapacityPlan)
    plan = CapacityPlan(team_id="t1", iteration_id="i1", pi_id="p1", team_size=5)
    repo.save(plan)
    raw = db.table("capacity_plans").all()[0]
    assert "available_capacity" not in raw


def test_capacity_plan_computed_reloads(db: TinyDB) -> None:
    repo: Repository[CapacityPlan] = Repository(db, "capacity_plans", CapacityPlan)
    plan = CapacityPlan(team_id="t1", iteration_id="i1", pi_id="p1", team_size=5)
    repo.save(plan)
    loaded = repo.get(plan.id)
    assert loaded.available_capacity == pytest.approx(40.0)


# --- Date serialisation round-trip ---


def test_dependency_date_roundtrip(db: TinyDB) -> None:
    repo: Repository[Dependency] = Repository(db, "dependencies", Dependency)
    dep = Dependency(
        description="Feature A depends on Feature B",
        pi_id="pi-1",
        from_feature_id="feature-a",
        to_feature_id="feature-b",
        needed_by_date=date(2026, 6, 15),
    )
    repo.save(dep)
    loaded = repo.get(dep.id)
    assert loaded.needed_by_date == date(2026, 6, 15)
    assert loaded.status == DependencyStatus.IDENTIFIED


# --- Repos convenience wrapper ---


def test_repos_all_tables_accessible(repos: Repos) -> None:
    assert repos.arts is not None
    assert repos.teams is not None
    assert repos.pis is not None
    assert repos.iterations is not None
    assert repos.features is not None
    assert repos.stories is not None
    assert repos.objectives is not None
    assert repos.risks is not None
    assert repos.dependencies is not None
    assert repos.capacity_plans is not None


def test_repos_independent_tables(repos: Repos) -> None:
    repos.teams.save(Team(name="Alpha", member_count=6))
    repos.arts.save(ART(name="Platform ART"))
    assert repos.teams.count() == 1
    assert repos.arts.count() == 1


# --- db singleton and close_db ---


def test_get_db_with_path_returns_fresh_db(tmp_path: Path) -> None:
    db = get_db(path=tmp_path / "test.json")
    assert isinstance(db, TinyDB)
    db.close()


def test_get_db_singleton(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(db_module, "_DB_PATH", tmp_path / "singleton.json")
    monkeypatch.setattr(db_module, "_instance", None)
    db1 = get_db()
    db2 = get_db()
    assert db1 is db2
    close_db()


def test_close_db_resets_singleton(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(db_module, "_DB_PATH", tmp_path / "singleton.json")
    monkeypatch.setattr(db_module, "_instance", None)
    db1 = get_db()
    close_db()
    assert db_module._instance is None
    db2 = get_db()
    assert db1 is not db2
    close_db()


def test_close_db_when_none_is_safe(monkeypatch) -> None:
    monkeypatch.setattr(db_module, "_instance", None)
    monkeypatch.setattr(db_module, "_instance_path", None)
    close_db()  # should not raise


# --- get_db() path conflict detection ---


def test_get_db_same_path_returns_singleton(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(db_module, "_instance", None)
    monkeypatch.setattr(db_module, "_instance_path", None)
    p = tmp_path / "same.json"
    db1 = get_db(path=p)
    db2 = get_db(path=p)
    assert db1 is db2
    close_db()


def test_get_db_conflicting_path_raises(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(db_module, "_instance", None)
    monkeypatch.setattr(db_module, "_instance_path", None)
    p1 = tmp_path / "first.json"
    p2 = tmp_path / "second.json"
    get_db(path=p1)
    with pytest.raises(RuntimeError, match="different path"):
        get_db(path=p2)
    close_db()


def test_get_db_no_path_returns_existing_instance(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(db_module, "_instance", None)
    monkeypatch.setattr(db_module, "_instance_path", None)
    monkeypatch.setattr(db_module, "_DB_PATH", tmp_path / "default.json")
    db1 = get_db()
    db2 = get_db()
    assert db1 is db2
    close_db()


# --- Repository.find() unknown kwarg validation ---


def test_find_unknown_field_raises(db: TinyDB) -> None:
    repo: Repository[Team] = Repository(db, "teams", Team)
    with pytest.raises(ValueError, match="Unknown field"):
        repo.find(nonexistent_field="value")


def test_find_unknown_field_error_names_the_key(db: TinyDB) -> None:
    repo: Repository[Team] = Repository(db, "teams", Team)
    with pytest.raises(ValueError, match="'bad_kwarg'"):
        repo.find(bad_kwarg="oops")
