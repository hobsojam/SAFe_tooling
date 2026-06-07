import pytest

from safe.logic.wsjf import cost_of_delay, rank_features, wsjf
from safe.models.backlog import Feature


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
        Feature(
            name="A",
            user_business_value=1,
            time_criticality=1,
            risk_reduction_opportunity_enablement=1,
            job_size=1,
        ),
        Feature(
            name="B",
            user_business_value=5,
            time_criticality=3,
            risk_reduction_opportunity_enablement=2,
            job_size=2,
        ),
        Feature(
            name="C",
            user_business_value=1,
            time_criticality=2,
            risk_reduction_opportunity_enablement=3,
            job_size=4,
        ),
    ]
    ranked = rank_features(features)
    assert [f.name for f in ranked] == ["B", "A", "C"]
