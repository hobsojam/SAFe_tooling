from datetime import date

import typer
from rich.console import Console
from rich.table import Table

import safe.cli.state as state
from safe.models.dependency import Dependency, DependencyStatus
from safe.store.db import get_db
from safe.store.repos import get_repos

dependency_app = typer.Typer(help="Manage cross-feature Dependencies")
console = Console()

_DEPENDENCY_ID_PARAM = "Dependency id"

_STATUS_COLOUR = {
    DependencyStatus.IDENTIFIED: "red",
    DependencyStatus.ACKNOWLEDGED: "yellow",
    DependencyStatus.IN_PROGRESS: "cyan",
    DependencyStatus.RESOLVED: "green",
}


def _repos():
    return get_repos(get_db(state.db_path) if state.db_path else None)


def _feature_label(repos, feature_id: str) -> str:
    feature = repos.features.get(feature_id)
    if feature is None:
        return feature_id
    if feature.team_id:
        team = repos.teams.get(feature.team_id)
        team_name = team.name if team else feature.team_id
        return f"{feature.name} ({team_name})"
    return feature.name


@dependency_app.command("add")
def dependency_add(
    description: str = typer.Option(..., "--description", "-d", help="Dependency description"),
    pi_id: str = typer.Option(..., "--pi-id", help="PI id"),
    from_feature_id: str = typer.Option(
        ..., "--from-feature-id", help="Feature that has the dependency"
    ),
    to_feature_id: str = typer.Option(
        ..., "--to-feature-id", help="Feature that must fulfil the dependency"
    ),
    owner: str | None = typer.Option(None, "--owner", help="Dependency owner name"),
    needed_by_date: str | None = typer.Option(None, "--needed-by", help="Date needed (YYYY-MM-DD)"),
):
    """Add a cross-feature dependency for a PI."""
    repos = _repos()
    if repos.pis.get(pi_id) is None:
        console.print(f"[red]Error: PI '{pi_id}' not found[/red]")
        raise typer.Exit(1)
    if repos.features.get(from_feature_id) is None:
        console.print(f"[red]Error: Feature '{from_feature_id}' not found[/red]")
        raise typer.Exit(1)
    if repos.features.get(to_feature_id) is None:
        console.print(f"[red]Error: Feature '{to_feature_id}' not found[/red]")
        raise typer.Exit(1)
    parsed_needed_by: date | None = None
    if needed_by_date is not None:
        try:
            parsed_needed_by = date.fromisoformat(needed_by_date)
        except ValueError:
            console.print(f"[red]Error: Invalid date '{needed_by_date}' — use YYYY-MM-DD[/red]")
            raise typer.Exit(1) from None
    dep = Dependency(
        description=description,
        pi_id=pi_id,
        from_feature_id=from_feature_id,
        to_feature_id=to_feature_id,
        owner=owner,
        needed_by_date=parsed_needed_by,
    )
    repos.dependencies.save(dep)
    console.print(f"Added dependency (status: identified, id: {dep.id})")


@dependency_app.command("list")
def dependency_list(
    pi_id: str | None = typer.Option(None, "--pi-id", help="Filter by PI"),
    from_feature_id: str | None = typer.Option(
        None, "--from-feature-id", help="Filter by from-feature"
    ),
    to_feature_id: str | None = typer.Option(None, "--to-feature-id", help="Filter by to-feature"),
    status: DependencyStatus | None = typer.Option(None, "--status", help="Filter by status"),
):
    """List dependencies, optionally filtered by PI, feature, or status."""
    repos = _repos()
    deps = repos.dependencies.find(pi_id=pi_id) if pi_id else repos.dependencies.get_all()
    if from_feature_id:
        deps = [d for d in deps if d.from_feature_id == from_feature_id]
    if to_feature_id:
        deps = [d for d in deps if d.to_feature_id == to_feature_id]
    if status:
        deps = [d for d in deps if d.status == status]
    if not deps:
        console.print("No dependencies found.")
        return
    table = Table("ID", "Description", "PI", "From", "To", "Status", "Owner", "Needed By")
    for d in deps:
        colour = _STATUS_COLOUR.get(d.status, "white")
        table.add_row(
            d.id,
            d.description[:50] + ("…" if len(d.description) > 50 else ""),
            d.pi_id,
            _feature_label(repos, d.from_feature_id),
            _feature_label(repos, d.to_feature_id),
            f"[{colour}]{d.status}[/{colour}]",
            d.owner or "-",
            str(d.needed_by_date) if d.needed_by_date else "-",
        )
    console.print(table)


@dependency_app.command("show")
def dependency_show(dep_id: str = typer.Argument(..., help=_DEPENDENCY_ID_PARAM)):
    """Show full details of a dependency."""
    repos = _repos()
    dep = repos.dependencies.get(dep_id)
    if dep is None:
        console.print(f"[red]Error: Dependency '{dep_id}' not found[/red]")
        raise typer.Exit(1)
    colour = _STATUS_COLOUR.get(dep.status, "white")
    console.print(f"ID           : {dep.id}")
    console.print(f"Description  : {dep.description}")
    console.print(f"PI           : {dep.pi_id}")
    console.print(f"From Feature : {_feature_label(repos, dep.from_feature_id)}")
    console.print(f"To Feature   : {_feature_label(repos, dep.to_feature_id)}")
    console.print(f"Status       : [{colour}]{dep.status}[/{colour}]")
    console.print(f"Owner        : {dep.owner or '-'}")
    console.print(f"Raised       : {dep.raised_date}")
    console.print(f"Needed By    : {dep.needed_by_date or '-'}")
    if dep.resolution_notes:
        console.print(f"Notes        : {dep.resolution_notes}")


@dependency_app.command("update-status")
def dependency_update_status(
    dep_id: str = typer.Argument(..., help=_DEPENDENCY_ID_PARAM),
    status: DependencyStatus = typer.Option(..., "--status", "-s", help="New status"),
    owner: str | None = typer.Option(None, "--owner", help="Dependency owner name"),
    notes: str | None = typer.Option(None, "--notes", "-n", help="Resolution notes"),
):
    """Update the status (and optionally owner/notes) for a dependency."""
    repos = _repos()
    dep = repos.dependencies.get(dep_id)
    if dep is None:
        console.print(f"[red]Error: Dependency '{dep_id}' not found[/red]")
        raise typer.Exit(1)
    updates: dict = {"status": status}
    if owner is not None:
        updates["owner"] = owner
    if notes is not None:
        updates["resolution_notes"] = notes
    updated = dep.model_copy(update=updates)
    repos.dependencies.save(updated)
    colour = _STATUS_COLOUR.get(status, "white")
    console.print(f"Dependency {dep_id} → [{colour}]{status}[/{colour}]")


@dependency_app.command("delete")
def dependency_delete(dep_id: str = typer.Argument(..., help=_DEPENDENCY_ID_PARAM)):
    """Delete a dependency."""
    repos = _repos()
    dep = repos.dependencies.get(dep_id)
    if dep is None:
        console.print(f"[red]Error: Dependency '{dep_id}' not found[/red]")
        raise typer.Exit(1)
    repos.dependencies.delete(dep_id)
    console.print(f"Deleted dependency [bold]{dep_id}[/bold]")
