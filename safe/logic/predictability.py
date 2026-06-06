def team_predictability(actual_bv: int, planned_bv: int) -> float | None:
    """Return predictability as a percentage, or None when planned_bv is 0 (undefined)."""
    if planned_bv <= 0:
        return None
    return round((actual_bv / planned_bv) * 100, 1)


def art_predictability(team_results: list[tuple[int, int]]) -> float | None:
    """Accepts a list of (actual_bv, planned_bv) tuples, one per team.

    Returns the ART-level predictability percentage, or None when total planned
    business value is 0 (undefined — no objectives were planned).
    """
    total_planned = sum(p for _, p in team_results)
    total_actual = sum(a for a, _ in team_results)
    return team_predictability(total_actual, total_planned)


def predictability_rating(score: float | None) -> str:
    """Return a colour rating for a predictability score, or 'unknown' for None."""
    if score is None:
        return "unknown"
    if score >= 80:
        return "green"
    if score >= 60:
        return "yellow"
    return "red"
