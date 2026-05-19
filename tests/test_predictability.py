import pytest

from safe.logic.predictability import art_predictability, predictability_rating, team_predictability


def test_team_predictability_perfect():
    assert team_predictability(10, 10) == pytest.approx(100.0)


def test_team_predictability_partial():
    assert team_predictability(8, 10) == pytest.approx(80.0)


def test_team_predictability_zero_planned():
    with pytest.raises(ValueError):
        team_predictability(5, 0)


def test_art_predictability():
    pairs = [(8, 10), (9, 10)]
    assert art_predictability(pairs) == pytest.approx(85.0)


def test_predictability_rating_green():
    assert predictability_rating(85.0) == "green"


def test_predictability_rating_yellow():
    assert predictability_rating(70.0) == "yellow"


def test_predictability_rating_red():
    assert predictability_rating(50.0) == "red"
