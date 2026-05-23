"""Tests for PI snapshot export/import (safe/logic/snapshot.py) and CLI commands."""

import json

import pytest
import typer.testing

import safe.cli.state as state
from safe.cli.main import app
from safe.logic.snapshot import export_pi, import_pi
from safe.models.art import ART, Team
from safe.models.backlog import Feature, Story
from safe.models.capacity_plan import CapacityPlan
from safe.models.dependency import Dependency
from safe.models.objectives import PIObjective
from safe.models.pi import PI, Iteration
from safe.models.risk import Risk
from safe.store.db import get_db
from safe.store.repos import get_repos

# ── fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def reset_state():
    state.db_path = None
    yield
    state.db_path = None


@pytest.fixture()
def db(tmp_path):
    return get_db(str(tmp_path / "test.json"))


@pytest.fixture()
def repos(db):
    return get_repos(db)


@pytest.fixture()
def populated(repos):
    """Create a minimal but complete PI with all entity types."""
    art = repos.arts.save(ART(name="Test ART"))
    team = repos.teams.save(Team(name="Alpha", member_count=5, art_id=art.id))
    art = art.model_copy(update={"team_ids": [team.id]})
    repos.arts.save(art)

    pi = repos.pis.save(
        PI(
            name="PI 2026.1",
            art_id=art.id,
            start_date="2026-01-01",
            end_date="2026-03-31",
        )
    )
    iteration = repos.iterations.save(
        Iteration(pi_id=pi.id, number=1, start_date="2026-01-01", end_date="2026-01-14")
    )
    pi = pi.model_copy(update={"iteration_ids": [iteration.id]})
    repos.pis.save(pi)

    feature = repos.features.save(
        Feature(
            name="Auth Service",
            pi_id=pi.id,
            team_id=team.id,
            user_business_value=8,
            time_criticality=7,
            risk_reduction_opportunity_enablement=5,
            job_size=5,
        )
    )
    story = repos.stories.save(
        Story(name="Login flow", feature_id=feature.id, team_id=team.id, points=3)
    )
    objective = repos.objectives.save(
        PIObjective(
            description="Deliver Auth v2",
            team_id=team.id,
            pi_id=pi.id,
            planned_business_value=8,
            feature_ids=[feature.id],
        )
    )
    risk = repos.risks.save(Risk(description="Key person risk", pi_id=pi.id, team_id=team.id))
    feature2 = repos.features.save(
        Feature(
            name="Observability",
            pi_id=pi.id,
            team_id=team.id,
            user_business_value=6,
            time_criticality=5,
            risk_reduction_opportunity_enablement=4,
            job_size=8,
        )
    )
    dependency = repos.dependencies.save(
        Dependency(
            description="Auth before Observability",
            pi_id=pi.id,
            from_feature_id=feature.id,
            to_feature_id=feature2.id,
        )
    )
    capacity_plan = repos.capacity_plans.save(
        CapacityPlan(
            team_id=team.id,
            iteration_id=iteration.id,
            pi_id=pi.id,
            team_size=5,
            iteration_days=10,
        )
    )
    return {
        "art": art,
        "team": team,
        "pi": pi,
        "iteration": iteration,
        "feature": feature,
        "feature2": feature2,
        "story": story,
        "objective": objective,
        "risk": risk,
        "dependency": dependency,
        "capacity_plan": capacity_plan,
    }


# ── export_pi ─────────────────────────────────────────────────────────────────


def test_export_raises_for_unknown_pi(repos):
    with pytest.raises(ValueError, match="not found"):
        export_pi(repos, "nonexistent-id")


def test_export_includes_all_entity_types(repos, populated):
    snapshot = export_pi(repos, populated["pi"].id)

    assert snapshot.pi.id == populated["pi"].id
    assert snapshot.art.id == populated["art"].id
    assert len(snapshot.teams) == 1
    assert len(snapshot.iterations) == 1
    assert len(snapshot.features) == 2
    assert len(snapshot.stories) == 1
    assert len(snapshot.objectives) == 1
    assert len(snapshot.risks) == 1
    assert len(snapshot.dependencies) == 1
    assert len(snapshot.capacity_plans) == 1


def test_export_snapshot_is_serialisable(repos, populated):
    snapshot = export_pi(repos, populated["pi"].id)
    data = json.loads(snapshot.model_dump_json())
    assert data["pi"]["name"] == "PI 2026.1"
    assert data["version"] == 1


# ── import_pi ─────────────────────────────────────────────────────────────────


def test_import_creates_pi_with_fresh_id(repos, populated):
    snapshot = export_pi(repos, populated["pi"].id)
    new_pi = import_pi(repos, snapshot)

    assert new_pi.id != populated["pi"].id
    assert new_pi.name == populated["pi"].name


def test_import_reuses_existing_art_by_name(repos, populated):
    snapshot = export_pi(repos, populated["pi"].id)
    import_pi(repos, snapshot)

    # Still only one ART
    assert len(repos.arts.get_all()) == 1


def test_import_reuses_existing_team_by_name(repos, populated):
    snapshot = export_pi(repos, populated["pi"].id)
    import_pi(repos, snapshot)

    # Still only one team
    assert len(repos.teams.get_all()) == 1


def test_import_creates_iterations_with_fresh_ids(repos, populated):
    snapshot = export_pi(repos, populated["pi"].id)
    new_pi = import_pi(repos, snapshot)

    new_iterations = repos.iterations.find(pi_id=new_pi.id)
    assert len(new_iterations) == 1
    assert new_iterations[0].id != populated["iteration"].id
    assert new_iterations[0].number == 1


def test_import_creates_features_with_fresh_ids(repos, populated):
    snapshot = export_pi(repos, populated["pi"].id)
    new_pi = import_pi(repos, snapshot)

    new_features = repos.features.find(pi_id=new_pi.id)
    assert len(new_features) == 2
    old_ids = {populated["feature"].id, populated["feature2"].id}
    for f in new_features:
        assert f.id not in old_ids


def test_import_stories_are_linked_to_new_feature_ids(repos, populated):
    snapshot = export_pi(repos, populated["pi"].id)
    new_pi = import_pi(repos, snapshot)

    new_features = repos.features.find(pi_id=new_pi.id)
    new_feature_ids = {f.id for f in new_features}
    imported_stories = [s for s in repos.stories.get_all() if s.id != populated["story"].id]
    assert len(imported_stories) == 1
    assert imported_stories[0].feature_id in new_feature_ids


def test_import_objectives_remapped(repos, populated):
    snapshot = export_pi(repos, populated["pi"].id)
    new_pi = import_pi(repos, snapshot)

    new_objs = repos.objectives.find(pi_id=new_pi.id)
    assert len(new_objs) == 1
    new_features = {f.id for f in repos.features.find(pi_id=new_pi.id)}
    assert all(fid in new_features for fid in new_objs[0].feature_ids)


def test_import_risks_linked_to_new_pi(repos, populated):
    snapshot = export_pi(repos, populated["pi"].id)
    new_pi = import_pi(repos, snapshot)

    new_risks = repos.risks.find(pi_id=new_pi.id)
    assert len(new_risks) == 1
    assert new_risks[0].id != populated["risk"].id


def test_import_dependencies_remapped(repos, populated):
    snapshot = export_pi(repos, populated["pi"].id)
    new_pi = import_pi(repos, snapshot)

    new_deps = repos.dependencies.find(pi_id=new_pi.id)
    assert len(new_deps) == 1
    new_feature_ids = {f.id for f in repos.features.find(pi_id=new_pi.id)}
    assert new_deps[0].from_feature_id in new_feature_ids
    assert new_deps[0].to_feature_id in new_feature_ids


def test_import_capacity_plans_remapped(repos, populated):
    snapshot = export_pi(repos, populated["pi"].id)
    new_pi = import_pi(repos, snapshot)

    new_plans = repos.capacity_plans.find(pi_id=new_pi.id)
    assert len(new_plans) == 1
    new_team_ids = {t.id for t in repos.teams.get_all()}
    assert new_plans[0].team_id in new_team_ids


def test_import_creates_missing_art(repos, populated):
    snapshot = export_pi(repos, populated["pi"].id)
    # Change the ART name so it won't match
    snapshot = snapshot.model_copy(
        update={"art": snapshot.art.model_copy(update={"name": "Imported ART"})}
    )
    import_pi(repos, snapshot)

    arts = repos.arts.get_all()
    assert any(a.name == "Imported ART" for a in arts)


def test_import_creates_missing_team(repos, populated):
    snapshot = export_pi(repos, populated["pi"].id)
    snapshot = snapshot.model_copy(
        update={"teams": [snapshot.teams[0].model_copy(update={"name": "Omega"})]}
    )
    import_pi(repos, snapshot)

    teams = repos.teams.get_all()
    assert any(t.name == "Omega" for t in teams)


def test_round_trip_preserves_pi_name_and_dates(repos, populated):
    snapshot = export_pi(repos, populated["pi"].id)
    new_pi = import_pi(repos, snapshot)

    assert new_pi.name == populated["pi"].name
    assert new_pi.start_date == populated["pi"].start_date
    assert new_pi.end_date == populated["pi"].end_date


# ── CLI: safe pi export ───────────────────────────────────────────────────────

runner = typer.testing.CliRunner()


def test_cli_export_creates_file(tmp_path, populated, repos):
    # The db fixture opens the singleton at tmp_path/"test.json"; pass the
    # same path so the CLI reuses the already-open instance.
    db_path = str(tmp_path / "test.json")
    out_file = tmp_path / "snap.json"

    result = runner.invoke(
        app,
        ["--db-path", db_path, "pi", "export", populated["pi"].id, "--output", str(out_file)],
        catch_exceptions=False,
    )
    assert result.exit_code == 0
    assert out_file.exists()
    data = json.loads(out_file.read_text())
    assert data["pi"]["name"] == "PI 2026.1"


def test_cli_export_unknown_pi(tmp_path):
    db_path = str(tmp_path / "empty.json")
    result = runner.invoke(
        app,
        ["--db-path", db_path, "pi", "export", "no-such-id"],
    )
    assert result.exit_code == 1
    assert "not found" in result.output.lower()


def test_cli_import_from_file(tmp_path, populated, repos):
    snapshot = export_pi(repos, populated["pi"].id)
    snap_file = tmp_path / "snap.json"
    snap_file.write_text(snapshot.model_dump_json(indent=2))

    # Reuse the same db path so the CLI doesn't try to open a second singleton.
    db_path = str(tmp_path / "test.json")
    result = runner.invoke(
        app,
        ["--db-path", db_path, "pi", "import", str(snap_file)],
        catch_exceptions=False,
    )
    assert result.exit_code == 0
    assert "PI 2026.1" in result.output


def test_cli_import_missing_file(tmp_path):
    db_path = str(tmp_path / "empty.json")
    result = runner.invoke(
        app,
        ["--db-path", db_path, "pi", "import", str(tmp_path / "no-such.json")],
    )
    assert result.exit_code == 1
    # Normalise whitespace before checking — Rich may word-wrap long paths across lines
    assert "not found" in " ".join(result.output.lower().split())


def test_cli_import_invalid_json(tmp_path):
    bad_file = tmp_path / "bad.json"
    bad_file.write_text("not valid json")
    db_path = str(tmp_path / "empty.json")
    result = runner.invoke(
        app,
        ["--db-path", db_path, "pi", "import", str(bad_file)],
    )
    assert result.exit_code == 1
    assert "could not parse" in result.output.lower()
