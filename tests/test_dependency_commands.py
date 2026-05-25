from io import StringIO
from pathlib import Path

import pytest
from rich.console import Console
from typer.testing import CliRunner

import safe.cli.dependency as dependency_module
import safe.cli.state as state
from safe.cli.main import app
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
    test_console = Console(file=buf, highlight=False, markup=False, width=200)
    monkeypatch.setattr(dependency_module, "console", test_console)
    yield buf


def invoke(db_path: Path, *args):
    return runner.invoke(app, ["--db-path", str(db_path)] + list(args))


def repos_for(db_path: Path):
    return get_repos(get_db(db_path))


def _setup(db_path):
    """Create an ART, PI, and two features (one per team)."""
    invoke(db_path, "art", "create", "--name", "ART")
    art_id = repos_for(db_path).arts.get_all()[0].id
    invoke(
        db_path,
        "pi",
        "create",
        "--name",
        "PI 1",
        "--art-id",
        art_id,
        "--start",
        "2026-01-05",
        "--end",
        "2026-03-27",
    )
    pi_id = repos_for(db_path).pis.get_all()[0].id
    invoke(
        db_path,
        "feature",
        "add",
        "--name",
        "Auth Service",
        "--pi-id",
        pi_id,
        "--user-value",
        "8",
        "--time-crit",
        "5",
        "--risk-reduction",
        "3",
        "--job-size",
        "4",
    )
    invoke(
        db_path,
        "feature",
        "add",
        "--name",
        "SSO Integration",
        "--pi-id",
        pi_id,
        "--user-value",
        "5",
        "--time-crit",
        "8",
        "--risk-reduction",
        "2",
        "--job-size",
        "5",
    )
    features = repos_for(db_path).features.get_all()
    auth_id = next(f.id for f in features if f.name == "Auth Service")
    sso_id = next(f.id for f in features if f.name == "SSO Integration")
    return pi_id, auth_id, sso_id


def _add_dep(
    db_path, pi_id, from_feature_id, to_feature_id, description="Auth service integration"
):
    return invoke(
        db_path,
        "dependency",
        "add",
        "--description",
        description,
        "--pi-id",
        pi_id,
        "--from-feature-id",
        from_feature_id,
        "--to-feature-id",
        to_feature_id,
    )


class TestDependencyAdd:
    def test_exit_code_success(self, db_path, patch_console):
        pi_id, auth_id, sso_id = _setup(db_path)
        result = _add_dep(db_path, pi_id, auth_id, sso_id)
        assert result.exit_code == 0

    def test_stored_in_db(self, db_path, patch_console):
        pi_id, auth_id, sso_id = _setup(db_path)
        _add_dep(db_path, pi_id, auth_id, sso_id, description="API contract")
        deps = repos_for(db_path).dependencies.get_all()
        assert len(deps) == 1
        assert deps[0].description == "API contract"

    def test_default_status_identified(self, db_path, patch_console):
        pi_id, auth_id, sso_id = _setup(db_path)
        _add_dep(db_path, pi_id, auth_id, sso_id)
        dep = repos_for(db_path).dependencies.get_all()[0]
        assert dep.status == "identified"

    def test_features_stored_correctly(self, db_path, patch_console):
        pi_id, auth_id, sso_id = _setup(db_path)
        _add_dep(db_path, pi_id, auth_id, sso_id)
        dep = repos_for(db_path).dependencies.get_all()[0]
        assert dep.from_feature_id == auth_id
        assert dep.to_feature_id == sso_id

    def test_unknown_pi_exits_1(self, db_path, patch_console):
        _, auth_id, sso_id = _setup(db_path)
        result = invoke(
            db_path,
            "dependency",
            "add",
            "--description",
            "X",
            "--pi-id",
            "bad",
            "--from-feature-id",
            auth_id,
            "--to-feature-id",
            sso_id,
        )
        assert result.exit_code == 1

    def test_unknown_from_feature_exits_1(self, db_path, patch_console):
        pi_id, _, sso_id = _setup(db_path)
        result = invoke(
            db_path,
            "dependency",
            "add",
            "--description",
            "X",
            "--pi-id",
            pi_id,
            "--from-feature-id",
            "bad",
            "--to-feature-id",
            sso_id,
        )
        assert result.exit_code == 1

    def test_unknown_to_feature_exits_1(self, db_path, patch_console):
        pi_id, auth_id, _ = _setup(db_path)
        result = invoke(
            db_path,
            "dependency",
            "add",
            "--description",
            "X",
            "--pi-id",
            pi_id,
            "--from-feature-id",
            auth_id,
            "--to-feature-id",
            "bad",
        )
        assert result.exit_code == 1

    def test_invalid_date_exits_1(self, db_path, patch_console):
        pi_id, auth_id, sso_id = _setup(db_path)
        result = invoke(
            db_path,
            "dependency",
            "add",
            "--description",
            "X",
            "--pi-id",
            pi_id,
            "--from-feature-id",
            auth_id,
            "--to-feature-id",
            sso_id,
            "--needed-by",
            "not-a-date",
        )
        assert result.exit_code == 1

    def test_with_needed_by_date(self, db_path, patch_console):
        pi_id, auth_id, sso_id = _setup(db_path)
        invoke(
            db_path,
            "dependency",
            "add",
            "--description",
            "X",
            "--pi-id",
            pi_id,
            "--from-feature-id",
            auth_id,
            "--to-feature-id",
            sso_id,
            "--needed-by",
            "2026-02-01",
        )
        dep = repos_for(db_path).dependencies.get_all()[0]
        assert str(dep.needed_by_date) == "2026-02-01"


class TestDependencyList:
    def test_empty(self, db_path, patch_console):
        invoke(db_path, "dependency", "list")
        assert "No dependencies found" in patch_console.getvalue()

    def test_lists_dependency(self, db_path, patch_console):
        pi_id, auth_id, sso_id = _setup(db_path)
        _add_dep(db_path, pi_id, auth_id, sso_id, description="Shared library")
        patch_console.truncate(0)
        patch_console.seek(0)
        invoke(db_path, "dependency", "list")
        assert "Shared library" in patch_console.getvalue()

    def test_filter_by_pi(self, db_path, patch_console):
        pi_id, auth_id, sso_id = _setup(db_path)
        _add_dep(db_path, pi_id, auth_id, sso_id)
        result = invoke(db_path, "dependency", "list", "--pi-id", pi_id)
        assert result.exit_code == 0

    def test_filter_by_from_feature(self, db_path, patch_console):
        pi_id, auth_id, sso_id = _setup(db_path)
        _add_dep(db_path, pi_id, auth_id, sso_id)
        result = invoke(db_path, "dependency", "list", "--from-feature-id", auth_id)
        assert result.exit_code == 0

    def test_filter_by_to_feature(self, db_path, patch_console):
        pi_id, auth_id, sso_id = _setup(db_path)
        _add_dep(db_path, pi_id, auth_id, sso_id)
        result = invoke(db_path, "dependency", "list", "--to-feature-id", sso_id)
        assert result.exit_code == 0

    def test_filter_by_status(self, db_path, patch_console):
        pi_id, auth_id, sso_id = _setup(db_path)
        _add_dep(db_path, pi_id, auth_id, sso_id)
        result = invoke(db_path, "dependency", "list", "--status", "identified")
        assert result.exit_code == 0

    def test_feature_names_shown(self, db_path, patch_console):
        pi_id, auth_id, sso_id = _setup(db_path)
        _add_dep(db_path, pi_id, auth_id, sso_id)
        patch_console.truncate(0)
        patch_console.seek(0)
        invoke(db_path, "dependency", "list")
        output = patch_console.getvalue()
        assert "Auth Service" in output
        assert "SSO Integration" in output


class TestDependencyShow:
    def test_shows_all_fields(self, db_path, patch_console):
        pi_id, auth_id, sso_id = _setup(db_path)
        _add_dep(db_path, pi_id, auth_id, sso_id, description="Platform API needed")
        dep = repos_for(db_path).dependencies.get_all()[0]
        patch_console.truncate(0)
        patch_console.seek(0)
        invoke(db_path, "dependency", "show", dep.id)
        output = patch_console.getvalue()
        assert "Platform API needed" in output
        assert "identified" in output
        assert "Auth Service" in output
        assert "SSO Integration" in output

    def test_unknown_exits_1(self, db_path, patch_console):
        result = invoke(db_path, "dependency", "show", "no-such-id")
        assert result.exit_code == 1


class TestDependencyUpdateStatus:
    def test_updates_status(self, db_path, patch_console):
        pi_id, auth_id, sso_id = _setup(db_path)
        _add_dep(db_path, pi_id, auth_id, sso_id)
        dep = repos_for(db_path).dependencies.get_all()[0]
        invoke(db_path, "dependency", "update-status", dep.id, "--status", "acknowledged")
        updated = repos_for(db_path).dependencies.get(dep.id)
        assert updated.status == "acknowledged"

    def test_sets_owner(self, db_path, patch_console):
        pi_id, auth_id, sso_id = _setup(db_path)
        _add_dep(db_path, pi_id, auth_id, sso_id)
        dep = repos_for(db_path).dependencies.get_all()[0]
        invoke(
            db_path,
            "dependency",
            "update-status",
            dep.id,
            "--status",
            "acknowledged",
            "--owner",
            "Alice",
        )
        updated = repos_for(db_path).dependencies.get(dep.id)
        assert updated.owner == "Alice"

    def test_sets_resolution_notes(self, db_path, patch_console):
        pi_id, auth_id, sso_id = _setup(db_path)
        _add_dep(db_path, pi_id, auth_id, sso_id)
        dep = repos_for(db_path).dependencies.get_all()[0]
        invoke(
            db_path,
            "dependency",
            "update-status",
            dep.id,
            "--status",
            "resolved",
            "--notes",
            "Contract agreed",
        )
        updated = repos_for(db_path).dependencies.get(dep.id)
        assert updated.resolution_notes == "Contract agreed"

    def test_unknown_exits_1(self, db_path, patch_console):
        result = invoke(
            db_path, "dependency", "update-status", "no-such-id", "--status", "resolved"
        )
        assert result.exit_code == 1

    def test_all_statuses_accepted(self, db_path, patch_console):
        pi_id, auth_id, sso_id = _setup(db_path)
        for status in ("identified", "acknowledged", "in_progress", "resolved"):
            _add_dep(db_path, pi_id, auth_id, sso_id)
            dep = repos_for(db_path).dependencies.get_all()[-1]
            result = invoke(db_path, "dependency", "update-status", dep.id, "--status", status)
            assert result.exit_code == 0


class TestDependencyDelete:
    def test_removes_dependency(self, db_path, patch_console):
        pi_id, auth_id, sso_id = _setup(db_path)
        _add_dep(db_path, pi_id, auth_id, sso_id)
        dep = repos_for(db_path).dependencies.get_all()[0]
        invoke(db_path, "dependency", "delete", dep.id)
        assert repos_for(db_path).dependencies.get(dep.id) is None

    def test_unknown_exits_1(self, db_path, patch_console):
        result = invoke(db_path, "dependency", "delete", "no-such-id")
        assert result.exit_code == 1


class TestDependencyFeatureLabel:
    """Cover _feature_label edge cases (lines 32, 34–36 in dependency.py)."""

    def test_unknown_feature_id_returns_raw_id(self, db_path, patch_console):
        """Line 32: feature is None → return raw feature_id string."""
        from safe.cli.dependency import _feature_label

        repos = repos_for(db_path)
        result = _feature_label(repos, "ghost-feature-id")
        assert result == "ghost-feature-id"

    def test_feature_with_team_includes_team_name(self, db_path, patch_console):
        """Lines 34–36: feature.team_id is set → label includes team name."""
        from safe.cli.dependency import _feature_label
        from safe.models.backlog import Feature

        repos = repos_for(db_path)
        from safe.models.art import Team

        team = repos.teams.save(Team(name="Omega", member_count=5, art_id="art1"))
        f = Feature(
            name="Auth Service",
            pi_id="pi1",
            team_id=team.id,
            user_business_value=5,
            time_criticality=5,
            risk_reduction_opportunity_enablement=5,
            job_size=5,
        )
        repos.features.save(f)
        result = _feature_label(repos, f.id)
        assert "Auth Service" in result
        assert "Omega" in result


class TestDependencyShowResolutionNotes:
    """Cover line 139: resolution_notes is printed when present."""

    def test_shows_resolution_notes_when_set(self, db_path, patch_console):
        """Line 139: resolution_notes block is entered when the field is non-empty."""
        pi_id, auth_id, sso_id = _setup(db_path)
        _add_dep(db_path, pi_id, auth_id, sso_id, description="Platform contract")
        dep = repos_for(db_path).dependencies.get_all()[0]
        # Update with resolution notes
        invoke(
            db_path,
            "dependency",
            "update-status",
            dep.id,
            "--status",
            "resolved",
            "--notes",
            "Agreed via RFC-42",
        )
        patch_console.truncate(0)
        patch_console.seek(0)
        invoke(db_path, "dependency", "show", dep.id)
        output = patch_console.getvalue()
        assert "Agreed via RFC-42" in output
