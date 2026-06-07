from datetime import date
from pathlib import Path

import typer
from rich.console import Console
from rich.table import Table

import safe.cli.state as state
from safe.exceptions import IllegalPITransitionError
from safe.logic import pi as pi_logic
from safe.logic.predictability import art_predictability, predictability_rating
from safe.logic.snapshot import PISnapshot, export_pi, import_pi
from safe.models.pi import PI, Iteration, PIStatus
from safe.store.db import get_db
from safe.store.repos import get_repos

pi_app = typer.Typer(help="Manage Program Increments")
iteration_app = typer.Typer(help="Manage PI iterations")
pi_app.add_typer(iteration_app, name="iteration")
console = Console()

_PI_ID_PARAM = "PI id"


def _repos():
    return get_repos(get_db(state.db_path) if state.db_path else None)


def _parse_date(value: str, option: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise typer.BadParameter("Expected YYYY-MM-DD", param_hint=f"'--{option}'") from None


@pi_app.command("create")
def pi_create(
    name: str = typer.Option(..., "--name", "-n", help="PI name"),
    art_id: str = typer.Option(..., "--art-id", help="ART id"),
    start: str = typer.Option(..., "--start", help="Start date (YYYY-MM-DD)"),
    end: str = typer.Option(..., "--end", help="End date (YYYY-MM-DD)"),
):
    """Create a new Program Increment."""
    repos = _repos()
    if repos.arts.get(art_id) is None:
        console.print(f"[red]Error: ART '{art_id}' not found[/red]")
        raise typer.Exit(1)
    pi = PI(
        name=name,
        art_id=art_id,
        start_date=_parse_date(start, "start"),
        end_date=_parse_date(end, "end"),
    )
    repos.pis.save(pi)
    console.print(f"Created PI [bold]{pi.name}[/bold] (id: {pi.id})")


@pi_app.command("show")
def pi_show(pi_id: str = typer.Argument(..., help=_PI_ID_PARAM)):
    """Show PI details."""
    repos = _repos()
    pi = repos.pis.get(pi_id)
    if pi is None:
        console.print(f"[red]Error: PI '{pi_id}' not found[/red]")
        raise typer.Exit(1)
    table = Table(show_header=False, box=None)
    table.add_row("ID", pi.id)
    table.add_row("Name", pi.name)
    table.add_row("ART", pi.art_id)
    table.add_row("Status", pi.status.value)
    table.add_row("Start", str(pi.start_date))
    table.add_row("End", str(pi.end_date))
    table.add_row("Iterations", str(len(pi.iteration_ids)))
    console.print(table)


@pi_app.command("list")
def pi_list(
    art_id: str | None = typer.Option(None, "--art-id", help="Filter by ART"),
):
    """List PIs, optionally filtered by ART."""
    repos = _repos()
    pis = repos.pis.find(art_id=art_id) if art_id else repos.pis.get_all()
    if not pis:
        console.print("No PIs found.")
        return
    table = Table("ID", "Name", "ART", "Status", "Start", "End")
    for pi in pis:
        table.add_row(
            pi.id, pi.name, pi.art_id, pi.status.value, str(pi.start_date), str(pi.end_date)
        )
    console.print(table)


@pi_app.command("activate")
def pi_activate(pi_id: str = typer.Argument(..., help=_PI_ID_PARAM)):
    """Transition a PI from planning to active."""
    repos = _repos()
    pi = repos.pis.get(pi_id)
    if pi is None:
        console.print(f"[red]Error: PI '{pi_id}' not found[/red]")
        raise typer.Exit(1)
    try:
        pi_logic.validate_pi_transition(pi, PIStatus.ACTIVE)
    except IllegalPITransitionError as e:
        console.print(f"[red]Error: {e}[/red]")
        raise typer.Exit(1) from None
    active = [p for p in repos.pis.find(art_id=pi.art_id) if p.status == PIStatus.ACTIVE]
    if active:
        console.print(f"[red]Error: PI '{active[0].name}' is already active for this ART[/red]")
        raise typer.Exit(1)
    pi.status = PIStatus.ACTIVE
    repos.pis.save(pi)
    console.print(f"PI [bold]{pi.name}[/bold] is now active.")


@pi_app.command("close")
def pi_close(pi_id: str = typer.Argument(..., help=_PI_ID_PARAM)):
    """Close an active PI."""
    repos = _repos()
    pi = repos.pis.get(pi_id)
    if pi is None:
        console.print(f"[red]Error: PI '{pi_id}' not found[/red]")
        raise typer.Exit(1)
    try:
        pi_logic.validate_pi_transition(pi, PIStatus.CLOSED)
        pi.status = PIStatus.CLOSED
        repos.pis.save(pi)
        console.print(f"PI [bold]{pi.name}[/bold] is now closed.")
    except IllegalPITransitionError as e:
        console.print(f"[red]Error: {e}[/red]")
        raise typer.Exit(1) from None


@pi_app.command("predictability")
def pi_predictability(
    planned: list[int] = typer.Option(
        ..., "--planned", "-p", help="Planned BV per team (repeat flag)"
    ),
    actual: list[int] = typer.Option(
        ..., "--actual", "-a", help="Actual BV per team (repeat flag)"
    ),
):
    """Calculate ART PI Predictability."""
    if len(planned) != len(actual):
        console.print(
            "[red]Error: --planned and --actual must be provided the same number of times[/red]"
        )
        raise typer.Exit(1)
    score = art_predictability(list(zip(actual, planned, strict=False)))
    rating = predictability_rating(score)
    if score is None:
        console.print("ART Predictability : [bold]N/A[/bold] (no planned business value)")
    else:
        console.print(f"ART Predictability : [bold {rating}]{score}%[/bold {rating}]")


@pi_app.command("export")
def pi_export(
    pi_id: str = typer.Argument(..., help=_PI_ID_PARAM),
    output: Path | None = typer.Option(None, "--output", "-o", help="Output file path"),
):
    """Export a PI and all its scoped entities to a JSON snapshot file."""
    repos = _repos()
    try:
        snapshot = export_pi(repos, pi_id)
    except ValueError as e:
        console.print(f"[red]Error: {e}[/red]")
        raise typer.Exit(1) from None
    safe_filename = Path(snapshot.pi.name.replace(" ", "_") + "_snapshot.json").name
    out_path = output or Path(safe_filename)
    out_path.write_text(snapshot.model_dump_json(indent=2))
    console.print(f"Exported PI [bold]{snapshot.pi.name}[/bold] to [bold]{out_path}[/bold]")
    console.print(
        f"  {len(snapshot.iterations)} iteration(s), "
        f"{len(snapshot.features)} feature(s), "
        f"{len(snapshot.stories)} stor(y/ies), "
        f"{len(snapshot.objectives)} objective(s), "
        f"{len(snapshot.risks)} risk(s), "
        f"{len(snapshot.dependencies)} dependenc(y/ies)"
    )


@pi_app.command("import")
def pi_import(
    file: Path = typer.Argument(..., help="Path to a PI snapshot JSON file"),
):
    """Import a PI snapshot, creating all entities with fresh IDs.

    Teams and the ART are matched by name — existing records are reused,
    new ones are created if not found.
    """
    repos = _repos()
    if not file.exists():
        console.print(f"[red]Error: file '{file}' not found[/red]")
        raise typer.Exit(1)
    try:
        snapshot = PISnapshot.model_validate_json(file.read_text())
    except Exception as e:
        console.print(f"[red]Error: could not parse snapshot — {e}[/red]")
        raise typer.Exit(1) from None
    pi = import_pi(repos, snapshot)
    console.print(f"Imported PI [bold]{pi.name}[/bold] (id: {pi.id})")
    console.print(f"  ART: {snapshot.art.name}")
    console.print(f"  {len(snapshot.iterations)} iteration(s) imported")
    console.print(f"  {len(snapshot.features)} feature(s) imported")
    console.print(f"  {len(snapshot.stories)} stor(y/ies) imported")
    console.print(f"  {len(snapshot.objectives)} objective(s) imported")
    console.print(f"  {len(snapshot.risks)} risk(s) imported")
    console.print(f"  {len(snapshot.dependencies)} dependenc(y/ies) imported")


@iteration_app.command("add")
def iteration_add(
    pi_id: str = typer.Option(..., "--pi-id", help=_PI_ID_PARAM),
    number: int = typer.Option(..., "--number", "-n", help="Iteration number"),
    start: str = typer.Option(..., "--start", help="Start date (YYYY-MM-DD)"),
    end: str = typer.Option(..., "--end", help="End date (YYYY-MM-DD)"),
    name: str = typer.Option("", "--name", help="Iteration name"),
    is_ip: bool = typer.Option(False, "--ip", help="Mark as IP (Innovation & Planning) iteration"),
):
    """Add an iteration to a PI."""
    repos = _repos()
    pi = repos.pis.get(pi_id)
    if pi is None:
        console.print(f"[red]Error: PI '{pi_id}' not found[/red]")
        raise typer.Exit(1)
    start_date = _parse_date(start, "start")
    end_date = _parse_date(end, "end")
    if not (pi.start_date <= start_date and end_date <= pi.end_date):
        console.print("[red]Error: iteration dates must fall within the PI date range[/red]")
        raise typer.Exit(1)
    iteration = Iteration(
        pi_id=pi_id, number=number, start_date=start_date, end_date=end_date, name=name, is_ip=is_ip
    )
    repos.iterations.save(iteration)
    try:
        pi.iteration_ids.append(iteration.id)
        repos.pis.save(pi)
    except Exception:
        repos.iterations.delete(iteration.id)
        raise
    label = f"{'IP ' if is_ip else ''}Iteration {number}"
    console.print(f"Added {label} to PI [bold]{pi.name}[/bold] (id: {iteration.id})")


@iteration_app.command("list")
def iteration_list(
    pi_id: str = typer.Option(..., "--pi-id", help=_PI_ID_PARAM),
):
    """List iterations for a PI."""
    repos = _repos()
    if repos.pis.get(pi_id) is None:
        console.print(f"[red]Error: PI '{pi_id}' not found[/red]")
        raise typer.Exit(1)
    iterations = repos.iterations.find(pi_id=pi_id)
    if not iterations:
        console.print("No iterations found.")
        return
    iterations.sort(key=lambda it: it.number)
    table = Table("ID", "Number", "Name", "Start", "End", "IP")
    for it in iterations:
        table.add_row(
            it.id,
            str(it.number),
            it.name or "-",
            str(it.start_date),
            str(it.end_date),
            "yes" if it.is_ip else "no",
        )
    console.print(table)


@iteration_app.command("delete")
def iteration_delete(iteration_id: str = typer.Argument(..., help="Iteration id")):
    """Delete an iteration."""
    repos = _repos()
    iteration = repos.iterations.get(iteration_id)
    if iteration is None:
        console.print(f"[red]Error: Iteration '{iteration_id}' not found[/red]")
        raise typer.Exit(1)
    pi = repos.pis.get(iteration.pi_id)
    if pi is not None and iteration.id in pi.iteration_ids:
        pi.iteration_ids.remove(iteration.id)
        repos.pis.save(pi)
    repos.iterations.delete(iteration_id)
    console.print(f"Deleted Iteration {iteration.number}")
