import pytest

from safe.logic.wsjf import cost_of_delay, rank_features, wsjf


def test_cost_of_delay():
    assert cost_of_delay(8, 5, 3) == 16


def test_wsjf_basic():
    assert wsjf(8, 5, 3, 4) == pytest.approx(4.0)


def test_wsjf_rounding():
    assert wsjf(7, 5, 3, 3) == pytest.approx(5.0)


def test_wsjf_zero_job_size():
    with pytest.raises(ValueError):
        wsjf(8, 5, 3, 0)


def test_rank_features():
    features = [
        {"name": "A", "wsjf_score": 3.0},
        {"name": "B", "wsjf_score": 5.0},
        {"name": "C", "wsjf_score": 1.5},
    ]
    ranked = rank_features(features)
    assert [f["name"] for f in ranked] == ["B", "A", "C"]
