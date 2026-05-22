from safe.models.backlog import Story, StoryStatus


def team_velocity(stories: list[Story]) -> int:
    """Sum story points for done or accepted stories."""
    return sum(s.points for s in stories if s.status in (StoryStatus.DONE, StoryStatus.ACCEPTED))


def available_capacity(
    team_size: int,
    iteration_days: int,
    pto_days: float = 0.0,
    overhead_pct: float = 0.2,
) -> float:
    if not 0 <= overhead_pct <= 1:
        raise ValueError("overhead_pct must be between 0 and 1")
    raw = (team_size * iteration_days) - pto_days
    return round(raw * (1 - overhead_pct), 1)


def load_percentage(committed: float, capacity: float) -> float:
    if capacity <= 0:
        raise ValueError("capacity must be positive")
    return round((committed / capacity) * 100, 1)


def capacity_warning(committed: float, capacity: float) -> str | None:
    pct = load_percentage(committed, capacity)
    if pct > 100:
        return f"OVERLOADED: {pct}% of capacity"
    if pct > 90:
        return f"WARNING: {pct}% of capacity"
    return None
