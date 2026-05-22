from safe.logic.board import build_board
from safe.models import Feature


def _feature(**kwargs) -> Feature:
    defaults = {
        "name": "F",
        "user_business_value": 5,
        "time_criticality": 5,
        "risk_reduction_opportunity_enablement": 5,
        "job_size": 5,
    }
    defaults.update(kwargs)
    return Feature(**defaults)


def test_placed_feature_appears_in_correct_grid_cell():
    f = _feature(team_id="t1", iteration_id="i1")
    grid = build_board([f])
    assert grid["t1"]["i1"] == [f]


def test_unplanned_feature_lands_in_none_bucket():
    f = _feature(team_id="t1", iteration_id=None)
    grid = build_board([f])
    assert grid["t1"][None] == [f]


def test_unassigned_feature_excluded_from_grid():
    f = _feature(team_id=None, iteration_id="i1")
    grid = build_board([f])
    assert grid == {}


def test_multiple_features_in_same_cell():
    f1 = _feature(name="F1", team_id="t1", iteration_id="i1")
    f2 = _feature(name="F2", team_id="t1", iteration_id="i1")
    grid = build_board([f1, f2])
    assert grid["t1"]["i1"] == [f1, f2]


def test_multiple_teams_have_separate_keys():
    f1 = _feature(name="F1", team_id="t1", iteration_id="i1")
    f2 = _feature(name="F2", team_id="t2", iteration_id="i1")
    grid = build_board([f1, f2])
    assert set(grid.keys()) == {"t1", "t2"}
    assert grid["t1"]["i1"] == [f1]
    assert grid["t2"]["i1"] == [f2]
