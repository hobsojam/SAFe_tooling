from io import StringIO
from pathlib import Path

import pytest
from rich.console import Console
from typer.testing import CliRunner

import safe.cli.state as state
import safe.cli.team as team_module
from safe.cli.main import app
from safe.models import CapacityPlan, Feature, PIObjective, Story
from safe.store.db import get_db
from safe.store.repos import get_repos

runner = CliRunner()


@pytest.fixture(autouse=True)
def reset_state():
    state.db_path = None
    yield
    state.db_path = None


@pytest.fixture
def db_path(tmp_path: Path) -> Path:
    return tmp_path / "test.json"


@pytest.fixture(autouse=True)
def patch_console(monkeypatch):
    buf = StringIO()
    test_console = Console(file=buf, highlight=False, markup=False)
    monkeypatch.setattr(team_module, "console", test_console)
    yield buf


def invoke(db_path: Path, *args):
    return runner.invoke(app, ["--db-path", str(db_path)] + list(args))


def repos_for(db_path: Path):
    return get_repos(get_db(db_path))


def _create_art(db_path: Path, name: str = "Platform ART"):
    invoke(db_path, "art", "create", "--name", name)
    return repos_for(db_path).arts.get_all()[0]


# ---------------------------------------------------------------------------
# team create
# ---------------------------------------------------------------------------


class TestTeamCreate:
    def test_exit_code_success(self, db_path, patch_console):
        result = invoke(db_path, "team", "create", "--name", "Alpha", "--members", "6")
        assert result.exit_code == 0

    def test_name_in_output(self, db_path, patch_console):
        invoke(db_path, "team", "create", "--name", "Alpha", "--members", "6")
        assert "Alpha" in patch_console.getvalue()

    def test_stored_in_db(self, db_path, patch_console):
        invoke(db_path, "team", "create", "--name", "Alpha", "--members", "6")
        teams = repos_for(db_path).teams.get_all()
        assert len(teams) == 1
        assert teams[0].name == "Alpha"
        assert teams[0].member_count == 6

    def test_create_with_art_id(self, db_path, patch_console):
        art = _create_art(db_path)
        result = invoke(
            db_path, "team", "create", "--name", "Alpha", "--members", "6", "--art-id", art.id
        )
        assert result.exit_code == 0
        team = repos_for(db_path).teams.get_all()[0]
        assert team.art_id == art.id

    def test_create_with_art_updates_art(self, db_path, patch_console):
        art = _create_art(db_path)
        invoke(db_path, "team", "create", "--name", "Alpha", "--members", "6", "--art-id", art.id)
        updated_art = repos_for(db_path).arts.get(art.id)
        assert len(updated_art.team_ids) == 1

    def test_invalid_art_id_exits_1(self, db_path, patch_console):
        result = invoke(
            db_path, "team", "create", "--name", "Alpha", "--members", "6", "--art-id", "bad-id"
        )
        assert result.exit_code == 1

    def test_missing_name_exits_nonzero(self, db_path, patch_console):
        result = invoke(db_path, "team", "create", "--members", "6")
        assert result.exit_code != 0

    def test_missing_members_exits_nonzero(self, db_path, patch_console):
        result = invoke(db_path, "team", "create", "--name", "Alpha")
        assert result.exit_code != 0

    def test_create_with_topology_type(self, db_path, patch_console):
        result = invoke(
            db_path,
            "team",
            "create",
            "--name",
            "Platform Team",
            "--members",
            "7",
            "--topology-type",
            "platform",
        )
        assert result.exit_code == 0
        team = repos_for(db_path).teams.get_all()[0]
        assert team.topology_type is not None
        assert team.topology_type.value == "platform"

    def test_create_without_topology_type_defaults_none(self, db_path, patch_console):
        invoke(db_path, "team", "create", "--name", "Alpha", "--members", "6")
        team = repos_for(db_path).teams.get_all()[0]
        assert team.topology_type is None

    def test_invalid_topology_type_exits_nonzero(self, db_path, patch_console):
        result = invoke(
            db_path,
            "team",
            "create",
            "--name",
            "Alpha",
            "--members",
            "6",
            "--topology-type",
            "not_a_type",
        )
        assert result.exit_code != 0


# ---------------------------------------------------------------------------
# team show
# ---------------------------------------------------------------------------


class TestTeamShow:
    def _create_team(self, db_path):
        invoke(db_path, "team", "create", "--name", "Alpha", "--members", "6")
        return repos_for(db_path).teams.get_all()[0]

    def test_shows_name(self, db_path, patch_console):
        team = self._create_team(db_path)
        invoke(db_path, "team", "show", team.id)
        assert "Alpha" in patch_console.getvalue()

    def test_shows_member_count(self, db_path, patch_console):
        team = self._create_team(db_path)
        invoke(db_path, "team", "show", team.id)
        assert "6" in patch_console.getvalue()

    def test_shows_topology_type_when_set(self, db_path, patch_console):
        invoke(
            db_path,
            "team",
            "create",
            "--name",
            "SA Team",
            "--members",
            "6",
            "--topology-type",
            "stream_aligned",
        )
        team = repos_for(db_path).teams.get_all()[0]
        patch_console.truncate(0)
        patch_console.seek(0)
        invoke(db_path, "team", "show", team.id)
        assert "stream_aligned" in patch_console.getvalue()

    def test_shows_dash_when_topology_type_not_set(self, db_path, patch_console):
        team = self._create_team(db_path)
        patch_console.truncate(0)
        patch_console.seek(0)
        invoke(db_path, "team", "show", team.id)
        assert "Topology Type" in patch_console.getvalue()

    def test_exit_code_success(self, db_path, patch_console):
        team = self._create_team(db_path)
        result = invoke(db_path, "team", "show", team.id)
        assert result.exit_code == 0

    def test_missing_id_exits_1(self, db_path, patch_console):
        result = invoke(db_path, "team", "show", "nonexistent")
        assert result.exit_code == 1


# ---------------------------------------------------------------------------
# team list
# ---------------------------------------------------------------------------


class TestTeamList:
    def test_empty(self, db_path, patch_console):
        invoke(db_path, "team", "list")
        assert "No teams found" in patch_console.getvalue()

    def test_lists_all(self, db_path, patch_console):
        invoke(db_path, "team", "create", "--name", "Alpha", "--members", "6")
        invoke(db_path, "team", "create", "--name", "Beta", "--members", "5")
        patch_console.truncate(0)
        patch_console.seek(0)
        invoke(db_path, "team", "list")
        output = patch_console.getvalue()
        assert "Alpha" in output
        assert "Beta" in output

    def test_filter_by_art(self, db_path, patch_console):
        art = _create_art(db_path)
        invoke(db_path, "team", "create", "--name", "Alpha", "--members", "6", "--art-id", art.id)
        invoke(db_path, "team", "create", "--name", "Beta", "--members", "5")
        patch_console.truncate(0)
        patch_console.seek(0)
        invoke(db_path, "team", "list", "--art-id", art.id)
        output = patch_console.getvalue()
        assert "Alpha" in output
        assert "Beta" not in output


# ---------------------------------------------------------------------------
# team delete
# ---------------------------------------------------------------------------


class TestTeamDelete:
    def test_exit_code_success(self, db_path, patch_console):
        invoke(db_path, "team", "create", "--name", "Alpha", "--members", "6")
        team = repos_for(db_path).teams.get_all()[0]
        result = invoke(db_path, "team", "delete", team.id)
        assert result.exit_code == 0

    def test_removed_from_db(self, db_path, patch_console):
        invoke(db_path, "team", "create", "--name", "Alpha", "--members", "6")
        team = repos_for(db_path).teams.get_all()[0]
        invoke(db_path, "team", "delete", team.id)
        assert repos_for(db_path).teams.count() == 0

    def test_removed_from_art(self, db_path, patch_console):
        art = _create_art(db_path)
        invoke(db_path, "team", "create", "--name", "Alpha", "--members", "6", "--art-id", art.id)
        team = repos_for(db_path).teams.get_all()[0]
        invoke(db_path, "team", "delete", team.id)
        updated_art = repos_for(db_path).arts.get(art.id)
        assert team.id not in updated_art.team_ids

    def test_missing_id_exits_1(self, db_path, patch_console):
        result = invoke(db_path, "team", "delete", "nonexistent")
        assert result.exit_code == 1

    def test_blocked_when_team_has_feature(self, db_path, patch_console):
        invoke(db_path, "team", "create", "--name", "Alpha", "--members", "6")
        team = repos_for(db_path).teams.get_all()[0]
        repos = repos_for(db_path)
        feature = Feature(
            name="Auth Service",
            team_id=team.id,
            user_business_value=8,
            time_criticality=7,
            risk_reduction_opportunity_enablement=6,
            job_size=5,
        )
        repos.features.save(feature)
        result = invoke(db_path, "team", "delete", team.id)
        assert result.exit_code == 1
        assert "features" in patch_console.getvalue()

    def test_blocked_when_team_has_story(self, db_path, patch_console):
        invoke(db_path, "team", "create", "--name", "Alpha", "--members", "6")
        team = repos_for(db_path).teams.get_all()[0]
        repos = repos_for(db_path)
        feature = Feature(
            name="Auth Service",
            team_id=team.id,
            user_business_value=8,
            time_criticality=7,
            risk_reduction_opportunity_enablement=6,
            job_size=5,
        )
        repos.features.save(feature)
        story = Story(
            name="Login flow",
            feature_id=feature.id,
            team_id=team.id,
            points=3,
        )
        repos.stories.save(story)
        # Remove the feature so only the story blocks deletion
        repos.features.delete(feature.id)
        result = invoke(db_path, "team", "delete", team.id)
        assert result.exit_code == 1
        assert "stories" in patch_console.getvalue()

    def test_blocked_when_team_has_objective(self, db_path, patch_console):
        invoke(db_path, "team", "create", "--name", "Alpha", "--members", "6")
        team = repos_for(db_path).teams.get_all()[0]
        repos = repos_for(db_path)
        objective = PIObjective(
            description="Deliver auth capability",
            team_id=team.id,
            pi_id="pi-001",
            planned_business_value=7,
        )
        repos.objectives.save(objective)
        result = invoke(db_path, "team", "delete", team.id)
        assert result.exit_code == 1
        assert "objectives" in patch_console.getvalue()

    def test_blocked_when_team_has_capacity_plan(self, db_path, patch_console):
        invoke(db_path, "team", "create", "--name", "Alpha", "--members", "6")
        team = repos_for(db_path).teams.get_all()[0]
        repos = repos_for(db_path)
        plan = CapacityPlan(
            team_id=team.id,
            iteration_id="iter-001",
            pi_id="pi-001",
            team_size=6,
        )
        repos.capacity_plans.save(plan)
        result = invoke(db_path, "team", "delete", team.id)
        assert result.exit_code == 1
        assert "capacity plans" in patch_console.getvalue()

    def test_succeeds_when_team_has_no_dependents(self, db_path, patch_console):
        invoke(db_path, "team", "create", "--name", "Alpha", "--members", "6")
        team = repos_for(db_path).teams.get_all()[0]
        result = invoke(db_path, "team", "delete", team.id)
        assert result.exit_code == 0
        assert repos_for(db_path).teams.count() == 0


# ---------------------------------------------------------------------------
# team create — compensating transaction on ART save failure
# ---------------------------------------------------------------------------


class TestTeamCreateCompensation:
    def test_team_deleted_when_art_save_fails(self, db_path, patch_console, monkeypatch):
        art = _create_art(db_path)
        original_repos = team_module._repos

        def failing_repos():
            repos = original_repos()

            def raise_on_save(entity):
                raise RuntimeError("simulated DB write failure")

            repos.arts.save = raise_on_save
            return repos

        monkeypatch.setattr(team_module, "_repos", failing_repos)
        result = invoke(
            db_path, "team", "create", "--name", "Alpha", "--members", "6", "--art-id", art.id
        )

        assert result.exit_code != 0
        assert repos_for(db_path).teams.get_all() == []
