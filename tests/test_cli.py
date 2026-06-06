"""
CLI tests using Typer's CliRunner.

Rich's Console is created at module level pointing to the real stdout, which
the CliRunner's buffer does not capture. We monkeypatch each module's console
with a Console backed by a StringIO so assertions on output are reliable.
"""

from io import StringIO

import pytest
from rich.console import Console
from typer.testing import CliRunner

import safe.cli.capacity as capacity_module
import safe.cli.main as main_module
import safe.cli.pi as pi_module
from safe.cli.main import app

runner = CliRunner()


@pytest.fixture(autouse=True)
def patch_console(monkeypatch):
    """Replace module-level Rich consoles with ones writing to a shared StringIO."""
    buf = StringIO()
    test_console = Console(file=buf, highlight=False, markup=False)
    monkeypatch.setattr(main_module, "console", test_console)
    monkeypatch.setattr(pi_module, "console", test_console)
    monkeypatch.setattr(capacity_module, "console", test_console)
    yield buf


# ---------------------------------------------------------------------------
# safe wsjf score
# ---------------------------------------------------------------------------


class TestWsjfScore:
    def test_exit_code_success(self, patch_console):
        result = runner.invoke(app, ["wsjf", "score", "-u", "8", "-t", "5", "-r", "3", "-j", "4"])
        assert result.exit_code == 0

    def test_cost_of_delay_in_output(self, patch_console):
        runner.invoke(app, ["wsjf", "score", "-u", "8", "-t", "5", "-r", "3", "-j", "4"])
        assert "16" in patch_console.getvalue()

    def test_wsjf_score_in_output(self, patch_console):
        runner.invoke(app, ["wsjf", "score", "-u", "8", "-t", "5", "-r", "3", "-j", "4"])
        assert "4.0" in patch_console.getvalue()

    def test_long_flags(self, patch_console):
        result = runner.invoke(
            app,
            [
                "wsjf",
                "score",
                "--user-value",
                "5",
                "--time-crit",
                "5",
                "--risk-reduction",
                "5",
                "--job-size",
                "5",
            ],
        )
        assert result.exit_code == 0
        # CoD = 15, WSJF = 15/5 = 3.0
        assert "15" in patch_console.getvalue()
        assert "3.0" in patch_console.getvalue()

    def test_minimum_values(self, patch_console):
        result = runner.invoke(app, ["wsjf", "score", "-u", "1", "-t", "1", "-r", "1", "-j", "1"])
        assert result.exit_code == 0
        assert "3" in patch_console.getvalue()  # CoD = 3
        assert "3.0" in patch_console.getvalue()  # WSJF = 3/1 = 3.0

    def test_missing_user_value(self, patch_console):
        result = runner.invoke(app, ["wsjf", "score", "-t", "5", "-r", "3", "-j", "4"])
        assert result.exit_code != 0

    def test_missing_job_size(self, patch_console):
        result = runner.invoke(app, ["wsjf", "score", "-u", "8", "-t", "5", "-r", "3"])
        assert result.exit_code != 0

    def test_help_accessible(self, patch_console):
        result = runner.invoke(app, ["wsjf", "score", "--help"])
        assert result.exit_code == 0


# ---------------------------------------------------------------------------
# safe capacity calc
# ---------------------------------------------------------------------------


class TestCapacityCalc:
    def test_exit_code_success(self, patch_console):
        result = runner.invoke(app, ["capacity", "calc", "-n", "5"])
        assert result.exit_code == 0

    def test_default_capacity(self, patch_console):
        # 5 members × 10 days × (1 - 0.2) = 40.0
        runner.invoke(app, ["capacity", "calc", "-n", "5"])
        assert "40.0" in patch_console.getvalue()

    def test_with_pto(self, patch_console):
        # (5×10 - 5) × 0.8 = 36.0
        runner.invoke(app, ["capacity", "calc", "-n", "5", "--pto", "5"])
        assert "36.0" in patch_console.getvalue()

    def test_zero_overhead(self, patch_console):
        # 5×10 × 1.0 = 50.0
        runner.invoke(app, ["capacity", "calc", "-n", "5", "--overhead", "0.0"])
        assert "50.0" in patch_console.getvalue()

    def test_larger_team(self, patch_console):
        # 10 × 10 × 0.8 = 80.0
        runner.invoke(app, ["capacity", "calc", "-n", "10"])
        assert "80.0" in patch_console.getvalue()

    def test_custom_iteration_days(self, patch_console):
        # 5 × 8 × 0.8 = 32.0
        runner.invoke(app, ["capacity", "calc", "-n", "5", "-d", "8"])
        assert "32.0" in patch_console.getvalue()

    def test_missing_team_size(self, patch_console):
        result = runner.invoke(app, ["capacity", "calc"])
        assert result.exit_code != 0

    def test_help_accessible(self, patch_console):
        result = runner.invoke(app, ["capacity", "calc", "--help"])
        assert result.exit_code == 0


# ---------------------------------------------------------------------------
# safe pi predictability
# ---------------------------------------------------------------------------


class TestPIPredictability:
    def test_perfect_predictability(self, patch_console):
        result = runner.invoke(app, ["pi", "predictability", "-p", "10", "-a", "10"])
        assert result.exit_code == 0
        assert "100.0%" in patch_console.getvalue()

    def test_partial_predictability(self, patch_console):
        # actual=8, planned=10 → 80%
        result = runner.invoke(app, ["pi", "predictability", "-p", "10", "-a", "8"])
        assert result.exit_code == 0
        assert "80.0%" in patch_console.getvalue()

    def test_multiple_teams(self, patch_console):
        # planned: 10+10=20, actual: 8+9=17 → 85%
        result = runner.invoke(
            app,
            [
                "pi",
                "predictability",
                "-p",
                "10",
                "-p",
                "10",
                "-a",
                "8",
                "-a",
                "9",
            ],
        )
        assert result.exit_code == 0
        assert "85.0%" in patch_console.getvalue()

    def test_over_100_percent(self, patch_console):
        # actual > planned is valid (team over-delivered)
        result = runner.invoke(app, ["pi", "predictability", "-p", "8", "-a", "10"])
        assert result.exit_code == 0
        assert "125.0%" in patch_console.getvalue()

    def test_mismatched_counts_exit_1(self, patch_console):
        result = runner.invoke(
            app,
            [
                "pi",
                "predictability",
                "-p",
                "10",
                "-p",
                "8",
                "-a",
                "9",
            ],
        )
        assert result.exit_code == 1

    def test_mismatched_error_message(self, patch_console):
        runner.invoke(
            app,
            [
                "pi",
                "predictability",
                "-p",
                "10",
                "-p",
                "8",
                "-a",
                "9",
            ],
        )
        assert "Error" in patch_console.getvalue() or "error" in patch_console.getvalue().lower()

    def test_missing_planned(self, patch_console):
        result = runner.invoke(app, ["pi", "predictability", "-a", "9"])
        assert result.exit_code != 0

    def test_missing_actual(self, patch_console):
        result = runner.invoke(app, ["pi", "predictability", "-p", "10"])
        assert result.exit_code != 0

    def test_zero_planned_prints_na(self, patch_console):
        # planned=0 is undefined — must not crash, must print N/A
        result = runner.invoke(app, ["pi", "predictability", "-p", "0", "-a", "0"])
        assert result.exit_code == 0
        output = patch_console.getvalue()
        assert "N/A" in output

    def test_help_accessible(self, patch_console):
        result = runner.invoke(app, ["pi", "predictability", "--help"])
        assert result.exit_code == 0


# ---------------------------------------------------------------------------
# Top-level app
# ---------------------------------------------------------------------------


class TestAppRoot:
    def test_no_args_shows_help(self, patch_console):
        result = runner.invoke(app, [])
        # no_args_is_help=True prints help but Typer/Click exits with 2
        assert result.exit_code == 2

    def test_help_flag(self, patch_console):
        result = runner.invoke(app, ["--help"])
        assert result.exit_code == 0

    def test_unknown_command(self, patch_console):
        result = runner.invoke(app, ["nonexistent"])
        assert result.exit_code != 0
