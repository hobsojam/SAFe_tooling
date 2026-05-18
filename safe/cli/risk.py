import typer
from rich.console import Console
from rich.table import Table

import safe.cli.state as state
from safe.models.risk import Risk, ROAMStatus
from safe.store.db import get_db
from safe.store.repos import get_repos

risk_app = typer.Typer(help="Manage PI Risks (ROAM)")
console = Console()

_RISK_ID_PARAM = "Risk id"

_STATUS_COLOUR = {
    ROAMStatus.UNROAMED: "red",
    ROAMStatus.OWNED: "yellow",
    ROAMStatus.ACCEPTED: "bright_yellow",
    ROAMStatus.MITIGATED: "cyan",
    ROAMStatus.RESOLVED: "green",
}


def _repos():
    return get_repos(get_db(state.db_path) if state.db_path else None)


@risk_app.command("add")
def risk_add(
    description: str = typer.Option(..., "--description", "-d", help="Risk description"),
    pi_id: str = typer.Option(..., "--pi-id", help="PI id"),
    team_id: str | None = typer.Option(None, "--team-id", help="Owning team id"),
    feature_id: str | None = typer.Option(None, "--feature-id", help="Related feature id"),
    owner: str | None = typer.Option(None, "--owner", help="Risk owner name"),
):
    """Add a risk to the ROAM register for a PI."""
    repos = _repos()
    if repos.pis.get(pi_id) is None:
        console.print(f"[red]Error: PI '{pi_id}' not found[/red]")
        raise typer.Exit(1)
    if team_id is not None and repos.teams.get(team_id) is None:
        console.print(f"[red]Error: Team '{team_id}' not found[/red]")
        raise typer.Exit(1)
    risk = Risk(
        description=description,
        pi_id=pi_id,
        team_id=team_id,
        feature_id=feature_id,
        owner=owner,
    )
    repos.risks.save(risk)
    console.print(f"Added risk (status: unroamed, id: {risk.id})")


@risk_app.command("list")
def risk_list(
    pi_id: str | None = typer.Option(None, "--pi-id", help="Filter by PI"),
    team_id: str | None = typer.Option(None, "--team-id", help="Filter by team"),
    status: ROAMStatus | None = typer.Option(None, "--status", help="Filter by ROAM status"),
):
    """List risks, optionally filtered by PI, team, or ROAM status."""
    repos = _repos()
    risks = repos.risks.find(pi_id=pi_id) if pi_id else repos.risks.get_all()
    if team_id:
        risks = [r for r in risks if r.team_id == team_id]
    if status:
        risks = [r for r in risks if r.roam_status == status]
    if not risks:
        console.print("No risks found.")
        return
    table = Table("ID", "Description", "PI", "Team", "Status", "Owner", "Raised")
    for r in risks:
        team = repos.teams.get(r.team_id) if r.team_id else None
        colour = _STATUS_COLOUR.get(r.roam_status, "white")
        table.add_row(
            r.id,
            r.description[:50] + ("…" if len(r.description) > 50 else ""),
            r.pi_id,
            team.name if team else (r.team_id or "-"),
            f"[{colour}]{r.roam_status}[/{colour}]",
            r.owner or "-",
            str(r.raised_date),
        )
    console.print(table)


@risk_app.command("show")
def risk_show(risk_id: str = typer.Argument(..., help=_RISK_ID_PARAM)):
    """Show full details of a risk."""
    repos = _repos()
    risk = repos.risks.get(risk_id)
    if risk is None:
        console.print(f"[red]Error: Risk '{risk_id}' not found[/red]")
        raise typer.Exit(1)
    colour = _STATUS_COLOUR.get(risk.roam_status, "white")
    console.print(f"ID          : {risk.id}")
    console.print(f"Description : {risk.description}")
    console.print(f"PI          : {risk.pi_id}")
    console.print(f"Team        : {risk.team_id or '-'}")
    console.print(f"Feature     : {risk.feature_id or '-'}")
    console.print(f"Status      : [{colour}]{risk.roam_status}[/{colour}]")
    console.print(f"Owner       : {risk.owner or '-'}")
    console.print(f"Raised      : {risk.raised_date}")
    if risk.mitigation_notes:
        console.print(f"Notes       : {risk.mitigation_notes}")


@risk_app.command("roam")
def risk_roam(
    risk_id: str = typer.Argument(..., help=_RISK_ID_PARAM),
    status: ROAMStatus = typer.Option(..., "--status", "-s", help="New ROAM status"),
    owner: str | None = typer.Option(None, "--owner", help="Risk owner name"),
    notes: str | None = typer.Option(None, "--notes", "-n", help="Mitigation notes"),
):
    """Update the ROAM status (and optionally owner/notes) for a risk."""
    repos = _repos()
    risk = repos.risks.get(risk_id)
    if risk is None:
        console.print(f"[red]Error: Risk '{risk_id}' not found[/red]")
        raise typer.Exit(1)
    updates: dict = {"roam_status": status}
    if owner is not None:
        updates["owner"] = owner
    if notes is not None:
        updates["mitigation_notes"] = notes
    updated = risk.model_copy(update=updates)
    repos.risks.save(updated)
    colour = _STATUS_COLOUR.get(status, "white")
    console.print(f"Risk {risk_id} → [{colour}]{status}[/{colour}]")


@risk_app.command("delete")
def risk_delete(risk_id: str = typer.Argument(..., help=_RISK_ID_PARAM)):
    """Delete a risk from the register."""
    repos = _repos()
    risk = repos.risks.get(risk_id)
    if risk is None:
        console.print(f"[red]Error: Risk '{risk_id}' not found[/red]")
        raise typer.Exit(1)
    repos.risks.delete(risk_id)
    console.print(f"Deleted risk [bold]{risk_id}[/bold]")
