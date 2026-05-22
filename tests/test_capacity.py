import pytest

from safe.logic.capacity import available_capacity, capacity_warning, load_percentage, team_velocity
from safe.models.backlog import Story, StoryStatus


def test_available_capacity_basic():
    assert available_capacity(5, 10, 0.0, 0.2) == pytest.approx(40.0)


def test_available_capacity_with_pto():
    assert available_capacity(5, 10, 5.0, 0.2) == pytest.approx(36.0)


def test_load_percentage():
    assert load_percentage(30.0, 40.0) == pytest.approx(75.0)


def test_load_overloaded():
    assert load_percentage(45.0, 40.0) == pytest.approx(112.5)


def test_capacity_warning_overloaded():
    warn = capacity_warning(45.0, 40.0)
    assert warn is not None
    assert "OVERLOADED" in warn


def test_capacity_warning_high():
    warn = capacity_warning(37.0, 40.0)
    assert warn is not None
    assert "WARNING" in warn


def test_capacity_warning_ok():
    assert capacity_warning(30.0, 40.0) is None


def test_invalid_overhead():
    with pytest.raises(ValueError):
        available_capacity(5, 10, 0, 1.5)


def test_load_percentage_zero_capacity():
    with pytest.raises(ValueError):
        load_percentage(10.0, 0.0)


def _story(points: int, status: StoryStatus) -> Story:
    return Story(
        name="s",
        feature_id="f",
        team_id="t",
        points=points,
        status=status,
    )


def test_team_velocity_empty():
    assert team_velocity([]) == 0


def test_team_velocity_counts_done():
    stories = [_story(5, StoryStatus.DONE), _story(3, StoryStatus.NOT_STARTED)]
    assert team_velocity(stories) == 5


def test_team_velocity_counts_accepted():
    stories = [_story(4, StoryStatus.ACCEPTED), _story(2, StoryStatus.IN_PROGRESS)]
    assert team_velocity(stories) == 4


def test_team_velocity_sums_done_and_accepted():
    stories = [
        _story(5, StoryStatus.DONE),
        _story(3, StoryStatus.ACCEPTED),
        _story(10, StoryStatus.NOT_STARTED),
    ]
    assert team_velocity(stories) == 8


def test_team_velocity_excludes_in_progress():
    stories = [_story(7, StoryStatus.IN_PROGRESS)]
    assert team_velocity(stories) == 0
