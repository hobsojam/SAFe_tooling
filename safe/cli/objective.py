import typer
from rich.console import Console
from rich.table import Table

import safe.cli.state as state
from safe.models.objectives import PIObjective
from safe.store.db import get_db
from safe.store.repos import get_repos

objective_app = typer.Typer(help="Manage PI Objectives")
console = Console()

_OBJECTIVE_ID_PARAM = "Objective id"


def _repos():
    return get_repos(get_db(state.db_path) if state.db_path else None)


@objective_app.command("add")
def objective_add(
    description: str = typer.Option(..., "--description", "-d", help="Objective description"),
    team_id: str = typer.Option(..., "--team-id", help="Team id"),
    pi_id: str = typer.Option(..., "--pi-id", help="PI id"),
    planned_bv: int = typer.Option(..., "--planned-bv", "-p", help="Planned Business Value (1–10)"),
    stretch: bool = typer.Option(False, "--stretch", help="Mark as stretch objective"),
):
    """Add a PI Objective for a team."""
    repos = _repos()
    if repos.teams.get(team_id) is None:
        console.print(f"[red]Error: Team '{team_id}' not found[/red]")
        raise typer.Exit(1)
    if repos.pis.get(pi_id) is None:
        console.print(f"[red]Error: PI '{pi_id}' not found[/red]")
        raise typer.Exit(1)
    obj = PIObjective(
        description=description,
        team_id=team_id,
        pi_id=pi_id,
        planned_business_value=planned_bv,
        is_stretch=stretch,
    )
    repos.objectives.save(obj)
    kind = "stretch" if stretch else "committed"
    console.print(f"Added {kind} objective (BV: {planned_bv}, id: {obj.id})")


@objective_app.command("list")
def objective_list(
    pi_id: str | None = typer.Option(None, "--pi-id", help="Filter by PI"),
    team_id: str | None = typer.Option(None, "--team-id", help="Filter by team"),
):
    """List PI Objectives."""
    repos = _repos()
    objs = repos.objectives.find(pi_id=pi_id) if pi_id else repos.objectives.get_all()
    if team_id:
        objs = [o for o in objs if o.team_id == team_id]
    if not objs:
        console.print("No objectives found.")
        return
    table = Table("ID", "Description", "Team", "PI", "Planned BV", "Actual BV", "Type")
    for o in objs:
        team = repos.teams.get(o.team_id)
        kind = "stretch" if o.is_stretch else "committed"
        actual = str(o.actual_business_value) if o.actual_business_value is not None else "-"
        table.add_row(
            o.id,
            o.description[:50] + ("…" if len(o.description) > 50 else ""),
            team.name if team else o.team_id,
            o.pi_id,
            str(o.planned_business_value),
            actual,
            kind,
        )
    console.print(table)


@objective_app.command("score")
def objective_score(
    objective_id: str = typer.Argument(..., help=_OBJECTIVE_ID_PARAM),
    actual_bv: int = typer.Option(..., "--actual-bv", "-a", help="Actual Business Value (1–10)"),
):
    """Record the actual Business Value achieved for an objective."""
    repos = _repos()
    obj = repos.objectives.get(objective_id)
    if obj is None:
        console.print(f"[red]Error: Objective '{objective_id}' not found[/red]")
        raise typer.Exit(1)
    obj.actual_business_value = actual_bv
    repos.objectives.save(obj)
    console.print(
        f"Scored objective: planned [bold]{obj.planned_business_value}[/bold] → "
        f"actual [bold green]{actual_bv}[/bold green]"
    )


@objective_app.command("update")
def objective_update(
    objective_id: str = typer.Argument(..., help=_OBJECTIVE_ID_PARAM),
    description: str | None = typer.Option(None, "--description", "-d"),
    planned_bv: int | None = typer.Option(None, "--planned-bv", "-p"),
    stretch: bool | None = typer.Option(None, "--stretch/--committed"),
):
    """Update an objective's description, planned BV, or stretch flag."""
    repos = _repos()
    obj = repos.objectives.get(objective_id)
    if obj is None:
        console.print(f"[red]Error: Objective '{objective_id}' not found[/red]")
        raise typer.Exit(1)
    if description is not None:
        obj.description = description
    if planned_bv is not None:
        obj.planned_business_value = planned_bv
    if stretch is not None:
        obj.is_stretch = stretch
    repos.objectives.save(obj)
    console.print(f"Updated objective [bold]{obj.id}[/bold]")


@objective_app.command("delete")
def objective_delete(objective_id: str = typer.Argument(..., help=_OBJECTIVE_ID_PARAM)):
    """Delete a PI Objective."""
    repos = _repos()
    obj = repos.objectives.get(objective_id)
    if obj is None:
        console.print(f"[red]Error: Objective '{objective_id}' not found[/red]")
        raise typer.Exit(1)
    repos.objectives.delete(objective_id)
    console.print(f"Deleted objective [bold]{obj.id}[/bold]")
