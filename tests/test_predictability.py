import pytest

from safe.logic.predictability import art_predictability, predictability_rating, team_predictability


def test_team_predictability_perfect():
    assert team_predictability(10, 10) == pytest.approx(100.0)


def test_team_predictability_partial():
    assert team_predictability(8, 10) == pytest.approx(80.0)


def test_team_predictability_zero_planned_returns_none():
    assert team_predictability(5, 0) is None


def test_team_predictability_negative_planned_returns_none():
    assert team_predictability(5, -1) is None


def test_art_predictability():
    pairs = [(8, 10), (9, 10)]
    assert art_predictability(pairs) == pytest.approx(85.0)


def test_art_predictability_all_zero_planned_returns_none():
    # When every team has planned_bv=0, the aggregate is also undefined.
    pairs = [(0, 0), (5, 0)]
    assert art_predictability(pairs) is None


def test_art_predictability_empty_returns_none():
    # No teams → total_planned=0 → undefined.
    assert art_predictability([]) is None


def test_predictability_rating_green():
    assert predictability_rating(85.0) == "green"


def test_predictability_rating_yellow():
    assert predictability_rating(70.0) == "yellow"


def test_predictability_rating_red():
    assert predictability_rating(50.0) == "red"


def test_predictability_rating_none_returns_unknown():
    assert predictability_rating(None) == "unknown"
