from io import StringIO
from pathlib import Path

import pytest
from rich.console import Console
from typer.testing import CliRunner

import safe.cli.pi as pi_module
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
    test_console = Console(file=buf, highlight=False, markup=False)
    monkeypatch.setattr(pi_module, "console", test_console)
    yield buf


def invoke(db_path: Path, *args):
    return runner.invoke(app, ["--db-path", str(db_path)] + list(args))


def repos_for(db_path: Path):
    return get_repos(get_db(db_path))


def _create_art(db_path: Path) -> str:
    invoke(db_path, "art", "create", "--name", "Platform ART")
    return repos_for(db_path).arts.get_all()[0].id


def _create_pi(db_path: Path, art_id: str, name: str = "PI 2026.1") -> str:
    invoke(
        db_path,
        "pi",
        "create",
        "--name",
        name,
        "--art-id",
        art_id,
        "--start",
        "2026-01-05",
        "--end",
        "2026-03-27",
    )
    return repos_for(db_path).pis.get_all()[0].id


# ---------------------------------------------------------------------------
# pi create
# ---------------------------------------------------------------------------


class TestPiCreate:
    def test_exit_code_success(self, db_path, patch_console):
        art_id = _create_art(db_path)
        result = invoke(
            db_path,
            "pi",
            "create",
            "--name",
            "PI 2026.1",
            "--art-id",
            art_id,
            "--start",
            "2026-01-05",
            "--end",
            "2026-03-27",
        )
        assert result.exit_code == 0

    def test_name_in_output(self, db_path, patch_console):
        art_id = _create_art(db_path)
        invoke(
            db_path,
            "pi",
            "create",
            "--name",
            "PI 2026.1",
            "--art-id",
            art_id,
            "--start",
            "2026-01-05",
            "--end",
            "2026-03-27",
        )
        assert "PI 2026.1" in patch_console.getvalue()

    def test_stored_in_db(self, db_path, patch_console):
        art_id = _create_art(db_path)
        invoke(
            db_path,
            "pi",
            "create",
            "--name",
            "PI 2026.1",
            "--art-id",
            art_id,
            "--start",
            "2026-01-05",
            "--end",
            "2026-03-27",
        )
        pis = repos_for(db_path).pis.get_all()
        assert len(pis) == 1
        assert pis[0].name == "PI 2026.1"
        assert pis[0].art_id == art_id

    def test_invalid_art_id_exits_1(self, db_path, patch_console):
        result = invoke(
            db_path,
            "pi",
            "create",
            "--name",
            "PI 2026.1",
            "--art-id",
            "bad-id",
            "--start",
            "2026-01-05",
            "--end",
            "2026-03-27",
        )
        assert result.exit_code == 1

    def test_invalid_date_exits_nonzero(self, db_path, patch_console):
        art_id = _create_art(db_path)
        result = invoke(
            db_path,
            "pi",
            "create",
            "--name",
            "PI 2026.1",
            "--art-id",
            art_id,
            "--start",
            "not-a-date",
            "--end",
            "2026-03-27",
        )
        assert result.exit_code != 0


# ---------------------------------------------------------------------------
# pi show
# ---------------------------------------------------------------------------


class TestPiShow:
    def test_shows_name(self, db_path, patch_console):
        art_id = _create_art(db_path)
        pi_id = _create_pi(db_path, art_id)
        invoke(db_path, "pi", "show", pi_id)
        assert "PI 2026.1" in patch_console.getvalue()

    def test_shows_status(self, db_path, patch_console):
        art_id = _create_art(db_path)
        pi_id = _create_pi(db_path, art_id)
        invoke(db_path, "pi", "show", pi_id)
        assert "planning" in patch_console.getvalue()

    def test_exit_code_success(self, db_path, patch_console):
        art_id = _create_art(db_path)
        pi_id = _create_pi(db_path, art_id)
        result = invoke(db_path, "pi", "show", pi_id)
        assert result.exit_code == 0

    def test_missing_exits_1(self, db_path, patch_console):
        result = invoke(db_path, "pi", "show", "nonexistent")
        assert result.exit_code == 1


# ---------------------------------------------------------------------------
# pi list
# ---------------------------------------------------------------------------


class TestPiList:
    def test_empty(self, db_path, patch_console):
        invoke(db_path, "pi", "list")
        assert "No PIs found" in patch_console.getvalue()

    def test_lists_all(self, db_path, patch_console):
        art_id = _create_art(db_path)
        _create_pi(db_path, art_id, "PI 2026.1")
        patch_console.truncate(0)
        patch_console.seek(0)
        invoke(db_path, "pi", "list")
        assert "PI 2026.1" in patch_console.getvalue()

    def test_filter_by_art(self, db_path, patch_console):
        art_id = _create_art(db_path)
        invoke(db_path, "art", "create", "--name", "Other ART")
        other_art_id = [a.id for a in repos_for(db_path).arts.get_all() if a.id != art_id][0]
        _create_pi(db_path, art_id, "PI 2026.1")
        invoke(
            db_path,
            "pi",
            "create",
            "--name",
            "PI Other",
            "--art-id",
            other_art_id,
            "--start",
            "2026-01-05",
            "--end",
            "2026-03-27",
        )
        patch_console.truncate(0)
        patch_console.seek(0)
        invoke(db_path, "pi", "list", "--art-id", art_id)
        output = patch_console.getvalue()
        assert "PI 2026.1" in output
        assert "PI Other" not in output


# ---------------------------------------------------------------------------
# pi activate / close
# ---------------------------------------------------------------------------


class TestPiActivate:
    def test_planning_to_active(self, db_path, patch_console):
        art_id = _create_art(db_path)
        pi_id = _create_pi(db_path, art_id)
        result = invoke(db_path, "pi", "activate", pi_id)
        assert result.exit_code == 0
        pi = repos_for(db_path).pis.get(pi_id)
        assert pi.status.value == "active"

    def test_active_in_output(self, db_path, patch_console):
        art_id = _create_art(db_path)
        pi_id = _create_pi(db_path, art_id)
        invoke(db_path, "pi", "activate", pi_id)
        assert "active" in patch_console.getvalue()

    def test_already_active_pi_blocks(self, db_path, patch_console):
        art_id = _create_art(db_path)
        pi_id1 = _create_pi(db_path, art_id, "PI 2026.1")
        invoke(db_path, "pi", "activate", pi_id1)
        # create a second PI for the same ART
        invoke(
            db_path,
            "pi",
            "create",
            "--name",
            "PI 2026.2",
            "--art-id",
            art_id,
            "--start",
            "2026-04-01",
            "--end",
            "2026-06-30",
        )
        pi_id2 = [p.id for p in repos_for(db_path).pis.get_all() if p.id != pi_id1][0]
        result = invoke(db_path, "pi", "activate", pi_id2)
        assert result.exit_code == 1

    def test_activate_wrong_status_exits_1(self, db_path, patch_console):
        art_id = _create_art(db_path)
        pi_id = _create_pi(db_path, art_id)
        invoke(db_path, "pi", "activate", pi_id)
        invoke(db_path, "pi", "close", pi_id)
        result = invoke(db_path, "pi", "activate", pi_id)
        assert result.exit_code == 1

    def test_missing_exits_1(self, db_path, patch_console):
        result = invoke(db_path, "pi", "activate", "nonexistent")
        assert result.exit_code == 1


class TestPiClose:
    def test_active_to_closed(self, db_path, patch_console):
        art_id = _create_art(db_path)
        pi_id = _create_pi(db_path, art_id)
        invoke(db_path, "pi", "activate", pi_id)
        result = invoke(db_path, "pi", "close", pi_id)
        assert result.exit_code == 0
        pi = repos_for(db_path).pis.get(pi_id)
        assert pi.status.value == "closed"

    def test_close_planning_exits_1(self, db_path, patch_console):
        art_id = _create_art(db_path)
        pi_id = _create_pi(db_path, art_id)
        result = invoke(db_path, "pi", "close", pi_id)
        assert result.exit_code == 1

    def test_missing_exits_1(self, db_path, patch_console):
        result = invoke(db_path, "pi", "close", "nonexistent")
        assert result.exit_code == 1


# ---------------------------------------------------------------------------
# pi iteration add / list / delete
# ---------------------------------------------------------------------------


class TestIterationAdd:
    def test_exit_code_success(self, db_path, patch_console):
        art_id = _create_art(db_path)
        pi_id = _create_pi(db_path, art_id)
        result = invoke(
            db_path,
            "pi",
            "iteration",
            "add",
            "--pi-id",
            pi_id,
            "--number",
            "1",
            "--start",
            "2026-01-05",
            "--end",
            "2026-01-16",
        )
        assert result.exit_code == 0

    def test_stored_in_db(self, db_path, patch_console):
        art_id = _create_art(db_path)
        pi_id = _create_pi(db_path, art_id)
        invoke(
            db_path,
            "pi",
            "iteration",
            "add",
            "--pi-id",
            pi_id,
            "--number",
            "1",
            "--start",
            "2026-01-05",
            "--end",
            "2026-01-16",
        )
        iterations = repos_for(db_path).iterations.get_all()
        assert len(iterations) == 1
        assert iterations[0].number == 1

    def test_updates_pi_iteration_ids(self, db_path, patch_console):
        art_id = _create_art(db_path)
        pi_id = _create_pi(db_path, art_id)
        invoke(
            db_path,
            "pi",
            "iteration",
            "add",
            "--pi-id",
            pi_id,
            "--number",
            "1",
            "--start",
            "2026-01-05",
            "--end",
            "2026-01-16",
        )
        pi = repos_for(db_path).pis.get(pi_id)
        assert len(pi.iteration_ids) == 1

    def test_ip_flag(self, db_path, patch_console):
        art_id = _create_art(db_path)
        pi_id = _create_pi(db_path, art_id)
        invoke(
            db_path,
            "pi",
            "iteration",
            "add",
            "--pi-id",
            pi_id,
            "--number",
            "5",
            "--start",
            "2026-03-16",
            "--end",
            "2026-03-27",
            "--ip",
        )
        it = repos_for(db_path).iterations.get_all()[0]
        assert it.is_ip is True

    def test_default_name_from_number(self, db_path, patch_console):
        art_id = _create_art(db_path)
        pi_id = _create_pi(db_path, art_id)
        invoke(
            db_path,
            "pi",
            "iteration",
            "add",
            "--pi-id",
            pi_id,
            "--number",
            "3",
            "--start",
            "2026-02-02",
            "--end",
            "2026-02-13",
        )
        it = repos_for(db_path).iterations.get_all()[0]
        assert it.name == "Iteration 3"

    def test_default_name_ip_iteration(self, db_path, patch_console):
        art_id = _create_art(db_path)
        pi_id = _create_pi(db_path, art_id)
        invoke(
            db_path,
            "pi",
            "iteration",
            "add",
            "--pi-id",
            pi_id,
            "--number",
            "5",
            "--start",
            "2026-03-16",
            "--end",
            "2026-03-27",
            "--ip",
        )
        it = repos_for(db_path).iterations.get_all()[0]
        assert it.name == "IP Iteration"

    def test_explicit_name_preserved(self, db_path, patch_console):
        art_id = _create_art(db_path)
        pi_id = _create_pi(db_path, art_id)
        invoke(
            db_path,
            "pi",
            "iteration",
            "add",
            "--pi-id",
            pi_id,
            "--number",
            "1",
            "--start",
            "2026-01-05",
            "--end",
            "2026-01-16",
            "--name",
            "Sprint Alpha",
        )
        it = repos_for(db_path).iterations.get_all()[0]
        assert it.name == "Sprint Alpha"

    def test_dates_outside_pi_exits_1(self, db_path, patch_console):
        art_id = _create_art(db_path)
        pi_id = _create_pi(db_path, art_id)
        result = invoke(
            db_path,
            "pi",
            "iteration",
            "add",
            "--pi-id",
            pi_id,
            "--number",
            "1",
            "--start",
            "2025-12-01",
            "--end",
            "2025-12-12",
        )
        assert result.exit_code == 1

    def test_invalid_pi_exits_1(self, db_path, patch_console):
        result = invoke(
            db_path,
            "pi",
            "iteration",
            "add",
            "--pi-id",
            "bad-id",
            "--number",
            "1",
            "--start",
            "2026-01-05",
            "--end",
            "2026-01-16",
        )
        assert result.exit_code == 1


class TestIterationList:
    def test_empty(self, db_path, patch_console):
        art_id = _create_art(db_path)
        pi_id = _create_pi(db_path, art_id)
        invoke(db_path, "pi", "iteration", "list", "--pi-id", pi_id)
        assert "No iterations found" in patch_console.getvalue()

    def test_lists_iterations(self, db_path, patch_console):
        art_id = _create_art(db_path)
        pi_id = _create_pi(db_path, art_id)
        invoke(
            db_path,
            "pi",
            "iteration",
            "add",
            "--pi-id",
            pi_id,
            "--number",
            "1",
            "--start",
            "2026-01-05",
            "--end",
            "2026-01-16",
        )
        invoke(
            db_path,
            "pi",
            "iteration",
            "add",
            "--pi-id",
            pi_id,
            "--number",
            "2",
            "--start",
            "2026-01-19",
            "--end",
            "2026-01-30",
        )
        patch_console.truncate(0)
        patch_console.seek(0)
        invoke(db_path, "pi", "iteration", "list", "--pi-id", pi_id)
        output = patch_console.getvalue()
        assert "1" in output
        assert "2" in output

    def test_invalid_pi_exits_1(self, db_path, patch_console):
        result = invoke(db_path, "pi", "iteration", "list", "--pi-id", "bad-id")
        assert result.exit_code == 1


class TestIterationDelete:
    def test_exit_code_success(self, db_path, patch_console):
        art_id = _create_art(db_path)
        pi_id = _create_pi(db_path, art_id)
        invoke(
            db_path,
            "pi",
            "iteration",
            "add",
            "--pi-id",
            pi_id,
            "--number",
            "1",
            "--start",
            "2026-01-05",
            "--end",
            "2026-01-16",
        )
        it_id = repos_for(db_path).iterations.get_all()[0].id
        result = invoke(db_path, "pi", "iteration", "delete", it_id)
        assert result.exit_code == 0

    def test_removed_from_db(self, db_path, patch_console):
        art_id = _create_art(db_path)
        pi_id = _create_pi(db_path, art_id)
        invoke(
            db_path,
            "pi",
            "iteration",
            "add",
            "--pi-id",
            pi_id,
            "--number",
            "1",
            "--start",
            "2026-01-05",
            "--end",
            "2026-01-16",
        )
        it_id = repos_for(db_path).iterations.get_all()[0].id
        invoke(db_path, "pi", "iteration", "delete", it_id)
        assert repos_for(db_path).iterations.count() == 0

    def test_removes_from_pi(self, db_path, patch_console):
        art_id = _create_art(db_path)
        pi_id = _create_pi(db_path, art_id)
        invoke(
            db_path,
            "pi",
            "iteration",
            "add",
            "--pi-id",
            pi_id,
            "--number",
            "1",
            "--start",
            "2026-01-05",
            "--end",
            "2026-01-16",
        )
        it_id = repos_for(db_path).iterations.get_all()[0].id
        invoke(db_path, "pi", "iteration", "delete", it_id)
        pi = repos_for(db_path).pis.get(pi_id)
        assert it_id not in pi.iteration_ids

    def test_missing_exits_1(self, db_path, patch_console):
        result = invoke(db_path, "pi", "iteration", "delete", "nonexistent")
        assert result.exit_code == 1


# ---------------------------------------------------------------------------
# pi export — filename sanitization
# ---------------------------------------------------------------------------


class TestPiExport:
    def _create_pi_with_name(self, db_path: Path, name: str) -> str:
        art_id = _create_art(db_path)
        invoke(
            db_path,
            "pi",
            "create",
            "--name",
            name,
            "--art-id",
            art_id,
            "--start",
            "2026-01-05",
            "--end",
            "2026-03-27",
        )
        return repos_for(db_path).pis.get_all()[0].id

    def test_export_creates_file(self, db_path, patch_console, tmp_path):
        pi_id = self._create_pi_with_name(db_path, "PI 2026.1")
        output_file = tmp_path / "out.json"
        result = invoke(db_path, "pi", "export", pi_id, "--output", str(output_file))
        assert result.exit_code == 0
        assert output_file.exists()

    def test_export_default_filename_sanitized(self, db_path, patch_console, tmp_path, monkeypatch):
        """A PI name with path separators must not cause directory traversal."""
        # Use a name containing path separator chars
        pi_id = self._create_pi_with_name(db_path, "../../evil_pi")
        # Change into a clean subdirectory so the only .json files written there
        # are from the export (not the db file which lives in tmp_path itself)
        export_dir = tmp_path / "export_cwd"
        export_dir.mkdir()
        monkeypatch.chdir(export_dir)
        result = invoke(db_path, "pi", "export", pi_id)
        assert result.exit_code == 0
        # The file written must be in the current directory, not a parent
        generated = list(export_dir.glob("*.json"))
        assert len(generated) == 1
        # The filename must not contain path separators
        assert "/" not in generated[0].name
        assert "\\" not in generated[0].name
        # The file must not have escaped outside export_dir
        assert generated[0].parent == export_dir

    def test_export_unknown_pi_exits_1(self, db_path, patch_console):
        result = invoke(db_path, "pi", "export", "nonexistent-pi-id")
        assert result.exit_code == 1


# ---------------------------------------------------------------------------
# iteration add — compensating transaction on PI save failure
# ---------------------------------------------------------------------------


class TestIterationAddCompensation:
    def test_iteration_deleted_when_pi_save_fails(self, db_path, patch_console, monkeypatch):
        art_id = _create_art(db_path)
        pi_id = _create_pi(db_path, art_id)
        original_repos = pi_module._repos

        def failing_repos():
            repos = original_repos()

            def raise_on_save(entity):
                raise RuntimeError("simulated DB write failure")

            repos.pis.save = raise_on_save
            return repos

        monkeypatch.setattr(pi_module, "_repos", failing_repos)
        result = invoke(
            db_path,
            "pi",
            "iteration",
            "add",
            "--pi-id",
            pi_id,
            "--number",
            "1",
            "--start",
            "2026-01-05",
            "--end",
            "2026-01-18",
        )

        assert result.exit_code != 0
        assert repos_for(db_path).iterations.get_all() == []
