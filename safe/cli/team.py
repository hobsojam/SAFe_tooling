import typer
from rich.console import Console
from rich.table import Table

import safe.cli.state as state
from safe.models.art import Team, TeamTopologyType
from safe.store.db import get_db
from safe.store.repos import get_repos

team_app = typer.Typer(help="Manage ART teams")
console = Console()


def _repos():
    return get_repos(get_db(state.db_path) if state.db_path else None)


@team_app.command("create")
def team_create(
    name: str = typer.Option(..., "--name", "-n", help="Team name"),
    members: int = typer.Option(..., "--members", "-m", help="Number of team members"),
    art_id: str | None = typer.Option(None, "--art-id", help="ART to assign this team to"),
    topology_type: TeamTopologyType | None = typer.Option(
        None,
        "--topology-type",
        "-t",
        help="Team Topologies type: stream_aligned, enabling, complicated_subsystem, platform",
    ),
):
    """Create a new team."""
    repos = _repos()
    if art_id is not None:
        art = repos.arts.get(art_id)
        if art is None:
            console.print(f"[red]Error: ART '{art_id}' not found[/red]")
            raise typer.Exit(1)
    team = Team(name=name, member_count=members, art_id=art_id, topology_type=topology_type)
    repos.teams.save(team)
    if art_id is not None:
        try:
            art = art.model_copy(update={"team_ids": art.team_ids + [team.id]})
            repos.arts.save(art)
        except Exception:
            repos.teams.delete(team.id)
            raise
    console.print(f"Created team [bold]{team.name}[/bold] (id: {team.id})")


@team_app.command("show")
def team_show(team_id: str = typer.Argument(..., help="Team id")):
    """Show team details."""
    repos = _repos()
    team = repos.teams.get(team_id)
    if team is None:
        console.print(f"[red]Error: Team '{team_id}' not found[/red]")
        raise typer.Exit(1)
    table = Table(show_header=False, box=None)
    table.add_row("ID", team.id)
    table.add_row("Name", team.name)
    table.add_row("Members", str(team.member_count))
    table.add_row("ART", team.art_id or "-")
    table.add_row("Topology Type", team.topology_type.value if team.topology_type else "-")
    table.add_row("Velocity History", str(team.velocity_history) if team.velocity_history else "-")
    console.print(table)


@team_app.command("list")
def team_list(
    art_id: str | None = typer.Option(None, "--art-id", help="Filter by ART"),
):
    """List teams, optionally filtered by ART."""
    repos = _repos()
    teams = repos.teams.find(art_id=art_id) if art_id else repos.teams.get_all()
    if not teams:
        console.print("No teams found.")
        return
    table = Table("ID", "Name", "Members", "ART", "Topology Type")
    for team in teams:
        table.add_row(
            team.id,
            team.name,
            str(team.member_count),
            team.art_id or "-",
            team.topology_type.value if team.topology_type else "-",
        )
    console.print(table)


@team_app.command("delete")
def team_delete(team_id: str = typer.Argument(..., help="Team id")):
    """Delete a team."""
    repos = _repos()
    team = repos.teams.get(team_id)
    if team is None:
        console.print(f"[red]Error: Team '{team_id}' not found[/red]")
        raise typer.Exit(1)
    if repos.features.find(team_id=team_id):
        console.print("[red]Error: Team has features — reassign them first[/red]")
        raise typer.Exit(1)
    if repos.stories.find(team_id=team_id):
        console.print("[red]Error: Team has stories — reassign them first[/red]")
        raise typer.Exit(1)
    if repos.objectives.find(team_id=team_id):
        console.print("[red]Error: Team has objectives — delete them first[/red]")
        raise typer.Exit(1)
    if repos.capacity_plans.find(team_id=team_id):
        console.print("[red]Error: Team has capacity plans — delete them first[/red]")
        raise typer.Exit(1)
    if team.art_id is not None:
        art = repos.arts.get(team.art_id)
        if art is not None:
            art = art.model_copy(update={"team_ids": [t for t in art.team_ids if t != team.id]})
            repos.arts.save(art)
    repos.teams.delete(team_id)
    console.print(f"Deleted team [bold]{team.name}[/bold]")
