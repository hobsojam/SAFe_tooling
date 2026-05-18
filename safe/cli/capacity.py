import csv
from pathlib import Path

import typer
from rich.console import Console
from rich.table import Table

import safe.cli.state as state
from safe.logic.capacity import available_capacity, capacity_warning, load_percentage
from safe.models.capacity_plan import CapacityPlan
from safe.store.db import get_db
from safe.store.repos import get_repos

capacity_app = typer.Typer(help="Manage team capacity plans")
console = Console()


def _repos():
    return get_repos(get_db(state.db_path) if state.db_path else None)


def _find_existing(repos, pi_id: str, team_id: str, iteration_id: str) -> CapacityPlan | None:
    matches = [
        p
        for p in repos.capacity_plans.find(pi_id=pi_id)
        if p.team_id == team_id and p.iteration_id == iteration_id
    ]
    return matches[0] if matches else None


@capacity_app.command("calc")
def capacity_calc(
    team_size: int = typer.Option(..., "--team-size", "-n", help="Number of team members"),
    iteration_days: int = typer.Option(10, "--days", "-d", help="Working days per iteration"),
    pto_days: float = typer.Option(0.0, "--pto", help="Total PTO days across team"),
    overhead_pct: float = typer.Option(0.2, "--overhead", help="Overhead fraction (default 0.20)"),
):
    """Calculate available team capacity for an iteration (stateless)."""
    cap = available_capacity(team_size, iteration_days, pto_days, overhead_pct)
    console.print(f"Available Capacity : [bold green]{cap}[/bold green] person-days")


@capacity_app.command("set")
def capacity_set(
    pi_id: str = typer.Option(..., "--pi-id", help="PI id"),
    team_id: str = typer.Option(..., "--team-id", help="Team id"),
    iteration_id: str = typer.Option(..., "--iteration-id", "-i", help="Iteration id"),
    team_size: int = typer.Option(..., "--team-size", "-n", help="Number of team members"),
    iteration_days: int = typer.Option(10, "--days", "-d", help="Working days in iteration"),
    pto_days: float = typer.Option(0.0, "--pto", help="Total PTO days across team"),
    overhead_pct: float = typer.Option(0.2, "--overhead", help="Overhead fraction (default 0.20)"),
):
    """Create or update a capacity plan for a team/iteration (upsert)."""
    repos = _repos()
    if repos.pis.get(pi_id) is None:
        console.print(f"[red]Error: PI '{pi_id}' not found[/red]")
        raise typer.Exit(1)
    if repos.teams.get(team_id) is None:
        console.print(f"[red]Error: Team '{team_id}' not found[/red]")
        raise typer.Exit(1)
    if repos.iterations.get(iteration_id) is None:
        console.print(f"[red]Error: Iteration '{iteration_id}' not found[/red]")
        raise typer.Exit(1)

    existing = _find_existing(repos, pi_id, team_id, iteration_id)
    if existing is not None:
        plan = existing.model_copy(
            update={
                "team_size": team_size,
                "iteration_days": iteration_days,
                "pto_days": pto_days,
                "overhead_pct": overhead_pct,
            }
        )
    else:
        plan = CapacityPlan(
            pi_id=pi_id,
            team_id=team_id,
            iteration_id=iteration_id,
            team_size=team_size,
            iteration_days=iteration_days,
            pto_days=pto_days,
            overhead_pct=overhead_pct,
        )
    repos.capacity_plans.save(plan)
    action = "Updated" if existing else "Created"
    console.print(
        f"{action} capacity plan: [bold green]{plan.available_capacity}[/bold green] "
        f"person-days available (id: {plan.id})"
    )


def _load_status(committed: int, available: float) -> tuple[str, str]:
    """Return (load_str, status_str) for a team/iteration pair.

    Returns ("-", "-") when there is no load or no capacity to compare against.
    Otherwise returns the numeric percentage string and a Rich-coloured status cell.
    """
    if committed <= 0 or available <= 0:
        return "-", "-"
    load_pct = load_percentage(committed, available)
    warning = capacity_warning(committed, available)
    if warning and "OVERLOADED" in warning:
        status = f"[red]{load_pct}%[/red]"
    elif warning:
        status = f"[yellow]{load_pct}%[/yellow]"
    else:
        status = f"[green]{load_pct}%[/green]"
    return str(load_pct), status


@capacity_app.command("show")
def capacity_show(
    pi_id: str | None = typer.Option(None, "--pi-id", help="Filter by PI"),
    team_id: str | None = typer.Option(None, "--team-id", help="Filter by team"),
):
    """Show capacity plans with load % where stories are assigned."""
    repos = _repos()
    plans = repos.capacity_plans.find(pi_id=pi_id) if pi_id else repos.capacity_plans.get_all()
    if team_id:
        plans = [p for p in plans if p.team_id == team_id]
    if not plans:
        console.print("No capacity plans found.")
        return

    table = Table("Team", "Iteration", "Size", "Days", "PTO", "Available", "Load %", "Status")
    for plan in plans:
        stories = repos.stories.find(team_id=plan.team_id, iteration_id=plan.iteration_id)
        committed = sum(s.points for s in stories)
        team = repos.teams.get(plan.team_id)
        iteration = repos.iterations.get(plan.iteration_id)
        team_name = team.name if team else plan.team_id
        iter_label = f"I{iteration.number}" if iteration else plan.iteration_id
        load_str, status = _load_status(committed, plan.available_capacity)

        table.add_row(
            team_name,
            iter_label,
            str(plan.team_size),
            str(plan.iteration_days),
            str(plan.pto_days),
            str(plan.available_capacity),
            load_str,
            status,
        )
    console.print(table)


@capacity_app.command("export")
def capacity_export(
    pi_id: str = typer.Option(..., "--pi-id", help="PI id"),
    output: Path = typer.Option(Path("capacity.csv"), "--output", "-o", help="Output CSV file"),
):
    """Export capacity plans for a PI to CSV."""
    repos = _repos()
    if repos.pis.get(pi_id) is None:
        console.print(f"[red]Error: PI '{pi_id}' not found[/red]")
        raise typer.Exit(1)
    plans = repos.capacity_plans.find(pi_id=pi_id)
    if not plans:
        console.print("No capacity plans found for this PI.")
        return

    with output.open("w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(
            [
                "team",
                "iteration",
                "team_size",
                "iteration_days",
                "pto_days",
                "overhead_pct",
                "available_capacity",
            ]
        )
        for plan in plans:
            team = repos.teams.get(plan.team_id)
            iteration = repos.iterations.get(plan.iteration_id)
            writer.writerow(
                [
                    team.name if team else plan.team_id,
                    f"I{iteration.number}" if iteration else plan.iteration_id,
                    plan.team_size,
                    plan.iteration_days,
                    plan.pto_days,
                    plan.overhead_pct,
                    plan.available_capacity,
                ]
            )
    console.print(f"Exported {len(plans)} plan(s) to [bold]{output}[/bold]")
