import typer
from rich.console import Console
from rich.table import Table

import safe.cli.state as state
from safe.models.backlog import Story, StoryStatus
from safe.store.db import get_db
from safe.store.repos import get_repos

story_app = typer.Typer(help="Manage stories within features")
console = Console()


def _repos():
    return get_repos(get_db(state.db_path) if state.db_path else None)


@story_app.command("add")
def story_add(
    name: str = typer.Option(..., "--name", "-n", help="Story name"),
    feature_id: str = typer.Option(..., "--feature-id", "-f", help="Feature id"),
    team_id: str = typer.Option(..., "--team-id", help="Team id"),
    points: int = typer.Option(..., "--points", "-p", help="Story points (≥1)"),
    description: str = typer.Option("", "--description", "-d", help="Story description"),
    iteration_id: str | None = typer.Option(
        None, "--iteration-id", "-i", help="Assign to iteration"
    ),
):
    """Add a story to a feature."""
    if points < 1:
        console.print(f"[red]Error: --points must be at least 1 (got {points})[/red]")
        raise typer.Exit(1)
    repos = _repos()
    if repos.features.get(feature_id) is None:
        console.print(f"[red]Error: Feature '{feature_id}' not found[/red]")
        raise typer.Exit(1)
    if repos.teams.get(team_id) is None:
        console.print(f"[red]Error: Team '{team_id}' not found[/red]")
        raise typer.Exit(1)
    if iteration_id is not None and repos.iterations.get(iteration_id) is None:
        console.print(f"[red]Error: Iteration '{iteration_id}' not found[/red]")
        raise typer.Exit(1)
    story = Story(
        name=name,
        feature_id=feature_id,
        team_id=team_id,
        points=points,
        description=description,
        iteration_id=iteration_id,
    )
    repos.stories.save(story)
    console.print(f"Added story [bold]{story.name}[/bold] ({story.points} pts, id: {story.id})")


@story_app.command("list")
def story_list(
    feature_id: str | None = typer.Option(None, "--feature-id", "-f", help="Filter by feature"),
    team_id: str | None = typer.Option(None, "--team-id", help="Filter by team"),
    iteration_id: str | None = typer.Option(
        None, "--iteration-id", "-i", help="Filter by iteration"
    ),
):
    """List stories, with optional filters."""
    repos = _repos()
    stories = repos.stories.get_all()
    if feature_id:
        stories = [s for s in stories if s.feature_id == feature_id]
    if team_id:
        stories = [s for s in stories if s.team_id == team_id]
    if iteration_id:
        stories = [s for s in stories if s.iteration_id == iteration_id]
    if not stories:
        console.print("No stories found.")
        return
    table = Table("ID", "Name", "Points", "Status", "Feature", "Team", "Iteration")
    for s in stories:
        table.add_row(
            s.id,
            s.name,
            str(s.points),
            s.status.value,
            s.feature_id,
            s.team_id,
            s.iteration_id or "-",
        )
    console.print(table)


def _apply_points_update(story: Story, points: int) -> None:
    """Validate *points* and assign to *story*, or raise typer.Exit(1) on failure."""
    if points < 1:
        console.print(f"[red]Error: --points must be at least 1 (got {points})[/red]")
        raise typer.Exit(1)
    story.points = points


def _apply_status_update(story: Story, status: str) -> None:
    """Parse *status* into StoryStatus and assign, or raise typer.Exit(1) on failure."""
    try:
        story.status = StoryStatus(status)
    except ValueError:
        valid = ", ".join(s.value for s in StoryStatus)
        console.print(f"[red]Error: invalid status '{status}'. Valid: {valid}[/red]")
        raise typer.Exit(1) from None


def _apply_iteration_update(story: Story, repos, iteration_id: str) -> None:
    """Clear or set *story.iteration_id*, validating existence when a value is provided."""
    if iteration_id == "":
        story.iteration_id = None
    else:
        if repos.iterations.get(iteration_id) is None:
            console.print(f"[red]Error: Iteration '{iteration_id}' not found[/red]")
            raise typer.Exit(1)
        story.iteration_id = iteration_id


@story_app.command("update")
def story_update(
    story_id: str = typer.Argument(..., help="Story id"),
    name: str | None = typer.Option(None, "--name", "-n"),
    points: int | None = typer.Option(None, "--points", "-p"),
    status: str | None = typer.Option(None, "--status", "-s"),
    description: str | None = typer.Option(None, "--description", "-d"),
    iteration_id: str | None = typer.Option(
        None, "--iteration-id", "-i", help="Assign to iteration (use '' to clear)"
    ),
):
    """Update story fields."""
    repos = _repos()
    story = repos.stories.get(story_id)
    if story is None:
        console.print(f"[red]Error: Story '{story_id}' not found[/red]")
        raise typer.Exit(1)
    if name is not None:
        story.name = name
    if points is not None:
        _apply_points_update(story, points)
    if status is not None:
        _apply_status_update(story, status)
    if description is not None:
        story.description = description
    if iteration_id is not None:
        _apply_iteration_update(story, repos, iteration_id)
    repos.stories.save(story)
    console.print(f"Updated story [bold]{story.name}[/bold]")


@story_app.command("delete")
def story_delete(story_id: str = typer.Argument(..., help="Story id")):
    """Delete a story."""
    repos = _repos()
    story = repos.stories.get(story_id)
    if story is None:
        console.print(f"[red]Error: Story '{story_id}' not found[/red]")
        raise typer.Exit(1)
    repos.stories.delete(story_id)
    console.print(f"Deleted story [bold]{story.name}[/bold]")
