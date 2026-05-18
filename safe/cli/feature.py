import typer
from rich.console import Console
from rich.table import Table

import safe.cli.state as state
from safe.models.backlog import Feature, FeatureStatus
from safe.store.db import get_db
from safe.store.repos import get_repos

feature_app = typer.Typer(help="Manage program backlog features")
console = Console()

_FEATURE_ID_PARAM = "Feature id"


def _repos():
    return get_repos(get_db(state.db_path) if state.db_path else None)


@feature_app.command("add")
def feature_add(
    name: str = typer.Option(..., "--name", "-n", help="Feature name"),
    user_value: int = typer.Option(..., "--user-value", "-u", help="User/Business Value (1–10)"),
    time_crit: int = typer.Option(..., "--time-crit", "-t", help="Time Criticality (1–10)"),
    risk_reduction: int = typer.Option(
        ..., "--risk-reduction", "-r", help="Risk Reduction / OE (1–10)"
    ),
    job_size: int = typer.Option(..., "--job-size", "-j", help="Job Size (1–13)"),
    description: str = typer.Option("", "--description", "-d", help="Feature description"),
    pi_id: str | None = typer.Option(None, "--pi-id", help="Assign to PI"),
):
    """Add a Feature to the program backlog."""
    repos = _repos()
    if pi_id is not None and repos.pis.get(pi_id) is None:
        console.print(f"[red]Error: PI '{pi_id}' not found[/red]")
        raise typer.Exit(1)
    feature = Feature(
        name=name,
        description=description,
        user_business_value=user_value,
        time_criticality=time_crit,
        risk_reduction_opportunity_enablement=risk_reduction,
        job_size=job_size,
        pi_id=pi_id,
    )
    repos.features.save(feature)
    console.print(
        f"Added feature [bold]{feature.name}[/bold] (WSJF: {feature.wsjf_score}, id: {feature.id})"
    )


@feature_app.command("show")
def feature_show(feature_id: str = typer.Argument(..., help=_FEATURE_ID_PARAM)):
    """Show feature details."""
    repos = _repos()
    feature = repos.features.get(feature_id)
    if feature is None:
        console.print(f"[red]Error: Feature '{feature_id}' not found[/red]")
        raise typer.Exit(1)
    stories = repos.stories.find(feature_id=feature_id)
    table = Table(show_header=False, box=None)
    table.add_row("ID", feature.id)
    table.add_row("Name", feature.name)
    table.add_row("Status", feature.status.value)
    table.add_row("PI", feature.pi_id or "-")
    table.add_row("Team", feature.team_id or "-")
    table.add_row("User/Business Value", str(feature.user_business_value))
    table.add_row("Time Criticality", str(feature.time_criticality))
    table.add_row("Risk Reduction / OE", str(feature.risk_reduction_opportunity_enablement))
    table.add_row("Cost of Delay", str(feature.cost_of_delay))
    table.add_row("Job Size", str(feature.job_size))
    table.add_row("WSJF Score", f"[bold green]{feature.wsjf_score}[/bold green]")
    table.add_row("Stories", str(len(stories)))
    if feature.description:
        table.add_row("Description", feature.description)
    console.print(table)


@feature_app.command("list")
def feature_list(
    pi_id: str | None = typer.Option(None, "--pi-id", help="Filter by PI"),
    status: str | None = typer.Option(None, "--status", "-s", help="Filter by status"),
):
    """List features."""
    repos = _repos()
    features = repos.features.find(pi_id=pi_id) if pi_id else repos.features.get_all()
    if status:
        try:
            status_enum = FeatureStatus(status)
        except ValueError:
            valid = ", ".join(s.value for s in FeatureStatus)
            console.print(f"[red]Error: invalid status '{status}'. Valid: {valid}[/red]")
            raise typer.Exit(1) from None
        features = [f for f in features if f.status == status_enum]
    if not features:
        console.print("No features found.")
        return
    table = Table("ID", "Name", "Status", "CoD", "Size", "WSJF", "PI", "Team")
    for f in features:
        table.add_row(
            f.id,
            f.name,
            f.status.value,
            str(f.cost_of_delay),
            str(f.job_size),
            str(f.wsjf_score),
            f.pi_id or "-",
            f.team_id or "-",
        )
    console.print(table)


@feature_app.command("rank")
def feature_rank(
    pi_id: str | None = typer.Option(None, "--pi-id", help="Filter by PI"),
):
    """List features ranked by WSJF score (highest first)."""
    repos = _repos()
    features = repos.features.find(pi_id=pi_id) if pi_id else repos.features.get_all()
    if not features:
        console.print("No features found.")
        return
    features.sort(key=lambda f: f.wsjf_score, reverse=True)
    table = Table("#", "Name", "CoD", "Size", "WSJF", "Status")
    for rank, f in enumerate(features, 1):
        table.add_row(
            str(rank),
            f.name,
            str(f.cost_of_delay),
            str(f.job_size),
            str(f.wsjf_score),
            f.status.value,
        )
    console.print(table)


@feature_app.command("update")
def feature_update(
    feature_id: str = typer.Argument(..., help=_FEATURE_ID_PARAM),
    name: str | None = typer.Option(None, "--name", "-n"),
    description: str | None = typer.Option(None, "--description", "-d"),
    status: str | None = typer.Option(None, "--status", "-s"),
    user_value: int | None = typer.Option(None, "--user-value", "-u"),
    time_crit: int | None = typer.Option(None, "--time-crit", "-t"),
    risk_reduction: int | None = typer.Option(None, "--risk-reduction", "-r"),
    job_size: int | None = typer.Option(None, "--job-size", "-j"),
):
    """Update feature fields."""
    repos = _repos()
    feature = repos.features.get(feature_id)
    if feature is None:
        console.print(f"[red]Error: Feature '{feature_id}' not found[/red]")
        raise typer.Exit(1)
    if name is not None:
        feature.name = name
    if description is not None:
        feature.description = description
    if status is not None:
        try:
            feature.status = FeatureStatus(status)
        except ValueError:
            valid = ", ".join(s.value for s in FeatureStatus)
            console.print(f"[red]Error: invalid status '{status}'. Valid: {valid}[/red]")
            raise typer.Exit(1) from None
    if user_value is not None:
        feature.user_business_value = user_value
    if time_crit is not None:
        feature.time_criticality = time_crit
    if risk_reduction is not None:
        feature.risk_reduction_opportunity_enablement = risk_reduction
    if job_size is not None:
        feature.job_size = job_size
    repos.features.save(feature)
    console.print(f"Updated feature [bold]{feature.name}[/bold] (WSJF: {feature.wsjf_score})")


@feature_app.command("assign")
def feature_assign(
    feature_id: str = typer.Argument(..., help=_FEATURE_ID_PARAM),
    team_id: str = typer.Option(..., "--team-id", help="Team to assign to"),
    pi_id: str | None = typer.Option(None, "--pi-id", help="PI to assign to"),
):
    """Assign a feature to a team (and optionally a PI)."""
    repos = _repos()
    feature = repos.features.get(feature_id)
    if feature is None:
        console.print(f"[red]Error: Feature '{feature_id}' not found[/red]")
        raise typer.Exit(1)
    if repos.teams.get(team_id) is None:
        console.print(f"[red]Error: Team '{team_id}' not found[/red]")
        raise typer.Exit(1)
    if pi_id is not None and repos.pis.get(pi_id) is None:
        console.print(f"[red]Error: PI '{pi_id}' not found[/red]")
        raise typer.Exit(1)
    feature.team_id = team_id
    if pi_id is not None:
        feature.pi_id = pi_id
    repos.features.save(feature)
    console.print(f"Assigned [bold]{feature.name}[/bold] to team {team_id}")


@feature_app.command("delete")
def feature_delete(feature_id: str = typer.Argument(..., help=_FEATURE_ID_PARAM)):
    """Delete a feature and its stories."""
    repos = _repos()
    feature = repos.features.get(feature_id)
    if feature is None:
        console.print(f"[red]Error: Feature '{feature_id}' not found[/red]")
        raise typer.Exit(1)
    for story in repos.stories.find(feature_id=feature_id):
        repos.stories.delete(story.id)
    repos.features.delete(feature_id)
    console.print(f"Deleted feature [bold]{feature.name}[/bold]")
