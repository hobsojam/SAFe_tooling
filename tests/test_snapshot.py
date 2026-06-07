"""Tests for PI snapshot export/import (safe/logic/snapshot.py) and CLI commands."""

import json

import pytest
import typer.testing
from tinydb import TinyDB

import safe.cli.state as state
from safe.cli.main import app
from safe.logic.snapshot import export_pi, import_pi
from safe.models.art import ART, Team
from safe.models.backlog import Feature, Story
from safe.models.capacity_plan import CapacityPlan
from safe.models.dependency import Dependency
from safe.models.objectives import PIObjective
from safe.models.pi import PI, Iteration, PIStatus
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


# ── Bug-fix regression tests ──────────────────────────────────────────────────
# These tests directly verify the two correctness bugs described in the ticket.


def test_import_closed_pi_status_is_reset_to_planning(repos, populated, tmp_path):
    """Bug 1 regression: importing a CLOSED PI must create it with PLANNING status.

    Previously import_pi passed status=snapshot.pi.status which preserved the
    source status — meaning a closed PI was imported already closed and could not
    be activated or have features added to it.
    """
    # Mark the source PI as CLOSED before exporting
    closed_pi = populated["pi"].model_copy(update={"status": PIStatus.CLOSED})
    repos.pis.save(closed_pi)

    snapshot = export_pi(repos, closed_pi.id)
    assert snapshot.pi.status == PIStatus.CLOSED  # snapshot faithfully captures source

    # Import into a separate TinyDB to avoid singleton conflicts
    target_db = TinyDB(tmp_path / "target.json")
    try:
        target_repos = get_repos(target_db)
        new_pi = import_pi(target_repos, snapshot)
        assert new_pi.status == PIStatus.PLANNING
    finally:
        target_db.close()


def test_import_active_pi_status_is_reset_to_planning(repos, populated, tmp_path):
    """Import of an ACTIVE PI must also start in PLANNING status."""
    active_pi = populated["pi"].model_copy(update={"status": PIStatus.ACTIVE})
    repos.pis.save(active_pi)

    snapshot = export_pi(repos, active_pi.id)

    target_db = TinyDB(tmp_path / "target.json")
    try:
        target_repos = get_repos(target_db)
        new_pi = import_pi(target_repos, snapshot)
        assert new_pi.status == PIStatus.PLANNING
    finally:
        target_db.close()


def test_objective_with_unmapped_team_is_skipped(repos, populated, tmp_path):
    """Bug 2 regression: objectives whose team_id has no mapping must be skipped.

    Previously import_pi fell back to the original (stale) team_id when the
    team was not in the snapshot, silently writing a dangling FK into the DB.
    """
    snapshot = export_pi(repos, populated["pi"].id)

    # Inject a ghost objective referencing a team_id that is not in snapshot.teams
    ghost_obj = PIObjective(
        description="Ghost objective with stale team",
        team_id="stale-team-id-not-in-snapshot",
        pi_id=snapshot.pi.id,
        planned_business_value=5,
    )
    snapshot = snapshot.model_copy(update={"objectives": snapshot.objectives + [ghost_obj]})

    target_db = TinyDB(tmp_path / "target.json")
    try:
        target_repos = get_repos(target_db)
        new_pi = import_pi(target_repos, snapshot)

        new_objectives = target_repos.objectives.find(pi_id=new_pi.id)
        # The one valid objective from populated fixture must be imported
        assert len(new_objectives) == 1
        assert new_objectives[0].description == "Deliver Auth v2"

        # The ghost objective must not appear anywhere in the target DB
        all_obj_descriptions = [o.description for o in target_repos.objectives.get_all()]
        assert "Ghost objective with stale team" not in all_obj_descriptions

        # Critically: no objective must carry the stale team_id
        all_team_ids = {o.team_id for o in target_repos.objectives.get_all()}
        assert "stale-team-id-not-in-snapshot" not in all_team_ids
    finally:
        target_db.close()


def test_all_objectives_unmapped_team_results_in_zero_objectives(repos, populated, tmp_path):
    """When every objective has an unmapped team_id, zero objectives are imported
    and the function still returns successfully (no exception)."""
    snapshot = export_pi(repos, populated["pi"].id)

    ghost_only = PIObjective(
        description="All ghost",
        team_id="phantom-team-id",
        pi_id=snapshot.pi.id,
        planned_business_value=3,
    )
    snapshot = snapshot.model_copy(update={"objectives": [ghost_only]})

    target_db = TinyDB(tmp_path / "target.json")
    try:
        target_repos = get_repos(target_db)
        new_pi = import_pi(target_repos, snapshot)
        assert target_repos.objectives.find(pi_id=new_pi.id) == []
    finally:
        target_db.close()


def test_round_trip_into_fresh_db_all_relationships_remapped(repos, populated, tmp_path):
    """Full round-trip into a separate database.

    Verifies that every cross-entity relationship in the imported data uses the
    new IDs assigned by import_pi — no reference to any source ID survives.
    """
    snapshot = export_pi(repos, populated["pi"].id)

    # Collect all source IDs
    source_ids: set[str] = {
        populated["art"].id,
        populated["team"].id,
        populated["pi"].id,
        populated["iteration"].id,
        populated["feature"].id,
        populated["feature2"].id,
        populated["story"].id,
        populated["objective"].id,
        populated["risk"].id,
        populated["dependency"].id,
        populated["capacity_plan"].id,
    }

    target_db = TinyDB(tmp_path / "target.json")
    try:
        target_repos = get_repos(target_db)
        new_pi = import_pi(target_repos, snapshot)

        assert new_pi.id not in source_ids

        # Stories reference new feature IDs
        new_features = target_repos.features.find(pi_id=new_pi.id)
        new_feature_ids = {f.id for f in new_features}
        assert new_feature_ids.isdisjoint(source_ids)

        imported_stories = target_repos.stories.get_all()
        assert len(imported_stories) == 1
        assert imported_stories[0].feature_id in new_feature_ids
        assert imported_stories[0].feature_id not in source_ids

        # Dependencies reference new feature IDs
        new_deps = target_repos.dependencies.find(pi_id=new_pi.id)
        assert len(new_deps) == 1
        assert new_deps[0].from_feature_id in new_feature_ids
        assert new_deps[0].to_feature_id in new_feature_ids

        # Capacity plans reference new iteration and team IDs
        new_iter_id = new_pi.iteration_ids[0]
        assert new_iter_id not in source_ids
        new_cps = target_repos.capacity_plans.find(pi_id=new_pi.id)
        assert len(new_cps) == 1
        assert new_cps[0].iteration_id == new_iter_id

        # Objectives reference new team IDs
        new_teams = target_repos.teams.get_all()
        new_team_ids = {t.id for t in new_teams}
        new_objs = target_repos.objectives.find(pi_id=new_pi.id)
        assert len(new_objs) == 1
        assert new_objs[0].team_id in new_team_ids
        assert new_objs[0].team_id not in source_ids
    finally:
        target_db.close()


def test_existing_art_and_team_reused_not_duplicated(repos, populated, tmp_path):
    """If the target DB already has an ART and team with the same names,
    import_pi must reuse them and not create duplicates."""
    snapshot = export_pi(repos, populated["pi"].id)

    target_db = TinyDB(tmp_path / "target.json")
    try:
        target_repos = get_repos(target_db)

        # Pre-populate target with the same ART and team names
        pre_art = target_repos.arts.save(ART(name="Test ART"))
        pre_team = target_repos.teams.save(Team(name="Alpha", member_count=5, art_id=pre_art.id))
        pre_art = pre_art.model_copy(update={"team_ids": [pre_team.id]})
        target_repos.arts.save(pre_art)

        import_pi(target_repos, snapshot)

        assert target_repos.arts.count() == 1
        assert target_repos.teams.count() == 1

        # The IDs must be the pre-existing ones
        assert target_repos.arts.get_all()[0].id == pre_art.id
        assert target_repos.teams.get_all()[0].id == pre_team.id
    finally:
        target_db.close()


# ── coverage gap tests ────────────────────────────────────────────────────────


def test_export_raises_when_art_deleted_after_pi_creation(repos):
    """Line 47: export_pi raises ValueError when the PI's art_id references no ART."""
    art = repos.arts.save(ART(name="Deleted ART"))
    pi = repos.pis.save(
        PI(
            name="Orphan PI",
            art_id=art.id,
            start_date="2026-01-01",
            end_date="2026-03-31",
        )
    )
    # Delete the ART so art_id is now dangling
    repos.arts.delete(art.id)

    with pytest.raises(ValueError, match="not found"):
        export_pi(repos, pi.id)


def test_import_skips_story_with_unmapped_feature_id(repos, populated):
    """Line 179: story is skipped when its feature_id maps to nothing in id_map."""
    snapshot = export_pi(repos, populated["pi"].id)

    # Inject a story whose feature_id has no match in the snapshot's feature list
    ghost_story = Story(
        name="Ghost story",
        feature_id="nonexistent-feature-id",
        team_id=populated["team"].id,
        points=2,
    )
    snapshot = snapshot.model_copy(update={"stories": snapshot.stories + [ghost_story]})

    new_pi = import_pi(repos, snapshot)

    # Ghost story must not be imported; all other stories (from the real feature) must be
    imported_stories = [s for s in repos.stories.get_all() if s.id != populated["story"].id]
    new_feature_ids = {f.id for f in repos.features.find(pi_id=new_pi.id)}
    valid_imported = [s for s in imported_stories if s.feature_id in new_feature_ids]
    ghost_imported = [s for s in imported_stories if s.name == "Ghost story"]

    assert len(ghost_imported) == 0
    assert len(valid_imported) == 1  # the real story was imported


def test_import_skips_dependency_with_unmapped_from_feature(repos, populated):
    """Line 231: dependency is skipped when from_feature_id maps to nothing in id_map."""
    snapshot = export_pi(repos, populated["pi"].id)

    # Inject a dependency whose from_feature_id has no match in the snapshot
    ghost_dep = Dependency(
        description="Ghost dependency",
        pi_id=populated["pi"].id,
        from_feature_id="nonexistent-feature-id",
        to_feature_id=populated["feature"].id,
    )
    snapshot = snapshot.model_copy(update={"dependencies": snapshot.dependencies + [ghost_dep]})

    new_pi = import_pi(repos, snapshot)

    # Only the real dependency (auth→observability) must be imported; ghost must be skipped
    new_deps = repos.dependencies.find(pi_id=new_pi.id)
    ghost_deps = [d for d in new_deps if d.description == "Ghost dependency"]
    assert len(ghost_deps) == 0
    # The original dependency was imported
    assert len(new_deps) == 1


def test_import_backfills_feature_dependency_ids(repos, populated):
    """Lines 250–257: dependency_ids on a feature are remapped during import."""
    # Give the first feature a dependency_ids list referencing the existing dependency
    dep = populated["dependency"]
    feature = populated["feature"]
    feature_with_deps = feature.model_copy(update={"dependency_ids": [dep.id]})
    repos.features.save(feature_with_deps)

    snapshot = export_pi(repos, populated["pi"].id)

    # The snapshot should capture the feature's dependency_ids
    snap_feature = next(f for f in snapshot.features if f.id == feature.id)
    assert len(snap_feature.dependency_ids) == 1

    new_pi = import_pi(repos, snapshot)

    new_features = repos.features.find(pi_id=new_pi.id)
    # Find the imported counterpart of 'feature' (Auth Service)
    imported_auth = next(f for f in new_features if f.name == "Auth Service")
    # Its dependency_ids must have been backfilled with new (remapped) dep IDs
    assert len(imported_auth.dependency_ids) == 1
    # The remapped dep ID must exist in the new PI's dependencies
    new_deps = {d.id for d in repos.dependencies.find(pi_id=new_pi.id)}
    assert imported_auth.dependency_ids[0] in new_deps


def test_import_skips_capacity_plan_with_unmapped_team(repos, populated):
    """Line 264: capacity plan is skipped when team_id maps to nothing in id_map."""
    snapshot = export_pi(repos, populated["pi"].id)

    # Inject a capacity plan whose team_id doesn't match any team in the snapshot
    ghost_plan = CapacityPlan(
        team_id="nonexistent-team-id",
        iteration_id=populated["iteration"].id,
        pi_id=populated["pi"].id,
        team_size=3,
        iteration_days=10,
    )
    snapshot = snapshot.model_copy(
        update={"capacity_plans": snapshot.capacity_plans + [ghost_plan]}
    )

    new_pi = import_pi(repos, snapshot)

    new_plans = repos.capacity_plans.find(pi_id=new_pi.id)
    # Only the real plan (mapped team) must exist; the ghost must be skipped
    assert len(new_plans) == 1


def test_import_drops_unmapped_objective_feature_ids(repos, populated, tmp_path):
    """Bug fix regression: objective feature_ids not in the snapshot must be dropped.

    The old code used id_map.get(fid, fid) which kept the original stale ID when
    a feature wasn't in the snapshot, creating a dangling FK.  The fix drops them.
    """
    snapshot = export_pi(repos, populated["pi"].id)

    # Inject a second feature_id on the objective that references a feature NOT
    # present in the snapshot (simulates a stale ID from a deleted feature).
    stale_fid = "nonexistent-feature-id"
    original_obj = snapshot.objectives[0]
    patched_obj = original_obj.model_copy(
        update={"feature_ids": original_obj.feature_ids + [stale_fid]}
    )
    snapshot = snapshot.model_copy(update={"objectives": [patched_obj]})

    target_db = TinyDB(tmp_path / "target.json")
    try:
        target_repos = get_repos(target_db)
        new_pi = import_pi(target_repos, snapshot)

        new_objs = target_repos.objectives.find(pi_id=new_pi.id)
        assert len(new_objs) == 1

        imported_obj = new_objs[0]
        # The stale ID must have been dropped, not kept
        assert stale_fid not in imported_obj.feature_ids

        # The valid feature_id (remapped) must still be present
        new_feature_ids = {f.id for f in target_repos.features.find(pi_id=new_pi.id)}
        assert all(fid in new_feature_ids for fid in imported_obj.feature_ids)
    finally:
        target_db.close()
