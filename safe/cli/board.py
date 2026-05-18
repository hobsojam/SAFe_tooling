from pathlib import Path

import openpyxl
import typer
from rich.console import Console
from rich.table import Table

import safe.cli.state as state
from safe.logic.board import build_board
from safe.models.dependency import DependencyStatus
from safe.models.pi import PI, Iteration
from safe.store.db import get_db
from safe.store.repos import Repos, get_repos

board_app = typer.Typer(help="PI Program Board")
console = Console()

_DEP_STATUS_COLOUR = {
    DependencyStatus.IDENTIFIED: "red",
    DependencyStatus.ACKNOWLEDGED: "yellow",
    DependencyStatus.IN_PROGRESS: "cyan",
    DependencyStatus.RESOLVED: "green",
}


def _repos() -> Repos:
    return get_repos(get_db(state.db_path) if state.db_path else None)


def _sorted_iterations(repos: Repos, pi: PI) -> list[Iteration]:
    result = [repos.iterations.get(iid) for iid in pi.iteration_ids]
    return sorted([i for i in result if i is not None], key=lambda i: i.number)


def _cell_text(features) -> str:
    if not features:
        return "-"
    return "\n".join(f.name[:24] + ("…" if len(f.name) > 24 else "") for f in features)


def _feature_label(repos: Repos, feature_id: str) -> str:
    feature = repos.features.get(feature_id)
    if feature is None:
        return feature_id
    if feature.team_id:
        team = repos.teams.get(feature.team_id)
        team_name = team.name if team else feature.team_id
        return f"{feature.name} ({team_name})"
    return feature.name


@board_app.command("show")
def board_show(
    pi_id: str = typer.Option(..., "--pi-id", help="PI id"),
):
    """Display the PI Program Board — features mapped to teams and iterations."""
    repos = _repos()
    pi = repos.pis.get(pi_id)
    if pi is None:
        console.print(f"[red]Error: PI '{pi_id}' not found[/red]")
        raise typer.Exit(1)

    iterations = _sorted_iterations(repos, pi)
    features = [f for f in repos.features.find(pi_id=pi_id) if f.team_id is not None]

    if not features:
        console.print("No features assigned to teams for this PI.")
        return

    grid = build_board(features)
    team_ids: list[str] = list(dict.fromkeys(f.team_id for f in features if f.team_id is not None))

    iter_labels = [f"I{i.number}" + (" (IP)" if i.is_ip else "") for i in iterations]
    table = Table("Team", *iter_labels, "Unplanned", title=f"Program Board — {pi.name}")

    for team_id in team_ids:
        team = repos.teams.get(team_id)
        team_name = team.name if team else team_id
        team_grid = grid.get(team_id, {})
        cells = [_cell_text(team_grid.get(i.id, [])) for i in iterations]
        cells.append(_cell_text(team_grid.get(None, [])))
        table.add_row(team_name, *cells)

    console.print(table)

    deps = repos.dependencies.find(pi_id=pi_id)
    if deps:
        dep_table = Table("From", "To", "Description", "Status", title="Dependencies")
        for dep in deps:
            colour = _DEP_STATUS_COLOUR.get(dep.status, "white")
            dep_table.add_row(
                _feature_label(repos, dep.from_feature_id),
                _feature_label(repos, dep.to_feature_id),
                dep.description[:50] + ("…" if len(dep.description) > 50 else ""),
                f"[{colour}]{dep.status}[/{colour}]",
            )
        console.print(dep_table)


def _build_board_row(repos: Repos, team_id: str, iterations, grid: dict) -> list:
    """Build one Excel data row for a team, covering each iteration and unplanned work."""
    team = repos.teams.get(team_id)
    team_name = team.name if team else team_id
    team_grid = grid.get(team_id, {})
    row = [team_name]
    for i in iterations:
        feats = team_grid.get(i.id, [])
        row.append("; ".join(f.name for f in feats) if feats else "")
    unplanned = team_grid.get(None, [])
    row.append("; ".join(f.name for f in unplanned) if unplanned else "")
    return row


def _write_deps_sheet(wb, repos: Repos, pi_id: str) -> None:
    """Add a Dependencies worksheet to *wb* if any dependencies exist for the PI."""
    deps = repos.dependencies.find(pi_id=pi_id)
    if not deps:
        return
    ws_deps = wb.create_sheet("Dependencies")
    ws_deps.append(["From Feature", "To Feature", "Description", "Status", "Owner", "Needed By"])
    for dep in deps:
        ws_deps.append(
            [
                _feature_label(repos, dep.from_feature_id),
                _feature_label(repos, dep.to_feature_id),
                dep.description,
                dep.status,
                dep.owner or "",
                str(dep.needed_by_date) if dep.needed_by_date else "",
            ]
        )


@board_app.command("export")
def board_export(
    pi_id: str = typer.Option(..., "--pi-id", help="PI id"),
    output: Path = typer.Option(Path("board.xlsx"), "--output", "-o", help="Output .xlsx file"),
):
    """Export the PI Program Board to an Excel workbook."""
    repos = _repos()
    pi = repos.pis.get(pi_id)
    if pi is None:
        console.print(f"[red]Error: PI '{pi_id}' not found[/red]")
        raise typer.Exit(1)

    iterations = _sorted_iterations(repos, pi)
    features = [f for f in repos.features.find(pi_id=pi_id) if f.team_id is not None]

    grid = build_board(features)
    team_ids: list[str] = list(dict.fromkeys(f.team_id for f in features if f.team_id is not None))

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = pi.name[:31]

    iter_headers = [f"I{i.number}" + (" (IP)" if i.is_ip else "") for i in iterations]
    ws.append(["Team"] + iter_headers + ["Unplanned"])

    for team_id in team_ids:
        ws.append(_build_board_row(repos, team_id, iterations, grid))

    _write_deps_sheet(wb, repos, pi_id)

    wb.save(output)
    console.print(f"Exported board for [bold]{pi.name}[/bold] to [bold]{output}[/bold]")
