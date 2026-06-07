from datetime import date

import pytest
from pydantic import ValidationError

from safe.exceptions import IllegalStateError
from safe.models.art import ART, Team
from safe.models.backlog import Feature, FeatureStatus, Story, StoryStatus
from safe.models.capacity_plan import CapacityPlan
from safe.models.dependency import Dependency, DependencyStatus
from safe.models.objectives import PIObjective
from safe.models.pi import PI, Iteration, PIStatus
from safe.models.risk import Risk, ROAMStatus

# ---------------------------------------------------------------------------
# Team
# ---------------------------------------------------------------------------


class TestTeam:
    def test_basic(self):
        t = Team(name="Alpha", member_count=6)
        assert t.name == "Alpha"
        assert t.member_count == 6
        assert t.art_id is None
        assert t.velocity_history == []

    def test_id_auto_generated_and_unique(self):
        assert Team(name="A", member_count=1).id != Team(name="A", member_count=1).id

    def test_member_count_zero_invalid(self):
        with pytest.raises(ValidationError):
            Team(name="Alpha", member_count=0)

    def test_member_count_negative_invalid(self):
        with pytest.raises(ValidationError):
            Team(name="Alpha", member_count=-1)

    def test_art_id_optional(self):
        t = Team(name="Alpha", member_count=5, art_id="art-1")
        assert t.art_id == "art-1"

    def test_velocity_history(self):
        t = Team(name="Alpha", member_count=5, velocity_history=[40, 38, 42])
        assert t.velocity_history == [40, 38, 42]


# ---------------------------------------------------------------------------
# ART
# ---------------------------------------------------------------------------


class TestART:
    def test_basic(self):
        art = ART(name="Platform ART")
        assert art.name == "Platform ART"
        assert art.team_ids == []

    def test_with_team_ids(self):
        art = ART(name="Platform ART", team_ids=["t-1", "t-2"])
        assert len(art.team_ids) == 2


# ---------------------------------------------------------------------------
# Iteration
# ---------------------------------------------------------------------------


class TestIteration:
    def _make(self, **kwargs):
        defaults = {
            "pi_id": "p-1",
            "number": 1,
            "start_date": date(2026, 1, 5),
            "end_date": date(2026, 1, 16),
        }
        return Iteration(**{**defaults, **kwargs})

    def test_basic(self):
        it = self._make()
        assert it.is_ip is False
        assert it.name == "Iteration 1"

    def test_number_zero_invalid(self):
        with pytest.raises(ValidationError):
            self._make(number=0)

    def test_ip_flag(self):
        it = self._make(number=5, is_ip=True)
        assert it.is_ip is True

    def test_name_field(self):
        it = self._make(name="Iteration 1")
        assert it.name == "Iteration 1"

    def test_end_date_before_start_date_invalid(self):
        with pytest.raises(ValidationError):
            self._make(start_date=date(2026, 1, 16), end_date=date(2026, 1, 5))

    def test_same_start_and_end_date_valid(self):
        it = self._make(start_date=date(2026, 1, 5), end_date=date(2026, 1, 5))
        assert it.start_date == it.end_date

    def test_end_date_after_start_date_valid(self):
        it = self._make(start_date=date(2026, 1, 5), end_date=date(2026, 1, 19))
        assert it.end_date > it.start_date


# ---------------------------------------------------------------------------
# PI
# ---------------------------------------------------------------------------


class TestPI:
    def _make(self, **kwargs):
        defaults = {
            "name": "PI 2026.1",
            "art_id": "art-1",
            "start_date": date(2026, 1, 5),
            "end_date": date(2026, 3, 27),
        }
        return PI(**{**defaults, **kwargs})

    def test_defaults(self):
        pi = self._make()
        assert pi.status == PIStatus.PLANNING
        assert pi.iteration_ids == []

    def test_status_active(self):
        pi = self._make(status=PIStatus.ACTIVE)
        assert pi.status == PIStatus.ACTIVE

    def test_status_closed(self):
        pi = self._make(status=PIStatus.CLOSED)
        assert pi.status == PIStatus.CLOSED

    def test_invalid_status(self):
        with pytest.raises(ValidationError):
            self._make(status="not_a_status")

    def test_iteration_ids(self):
        pi = self._make(iteration_ids=["i-1", "i-2", "i-3"])
        assert len(pi.iteration_ids) == 3


# ---------------------------------------------------------------------------
# Feature
# ---------------------------------------------------------------------------


class TestFeature:
    def _make(self, **kwargs):
        defaults = {
            "name": "Login Flow",
            "user_business_value": 8,
            "time_criticality": 5,
            "risk_reduction_opportunity_enablement": 3,
            "job_size": 4,
        }
        return Feature(**{**defaults, **kwargs})

    def test_computed_cost_of_delay(self):
        assert self._make().cost_of_delay == 16

    def test_computed_wsjf_score(self):
        assert self._make().wsjf_score == pytest.approx(4.0)

    def test_wsjf_rounding(self):
        # CoD = 10, size = 3 → 3.33
        f = self._make(
            user_business_value=4,
            time_criticality=3,
            risk_reduction_opportunity_enablement=3,
            job_size=3,
        )
        assert f.wsjf_score == pytest.approx(round(10 / 3, 2))

    def test_maximum_wsjf(self):
        f = self._make(
            user_business_value=10,
            time_criticality=10,
            risk_reduction_opportunity_enablement=10,
            job_size=1,
        )
        assert f.cost_of_delay == 30
        assert f.wsjf_score == pytest.approx(30.0)

    def test_ubv_minimum(self):
        with pytest.raises(ValidationError):
            self._make(user_business_value=0)

    def test_ubv_maximum(self):
        with pytest.raises(ValidationError):
            self._make(user_business_value=11)

    def test_time_criticality_range(self):
        with pytest.raises(ValidationError):
            self._make(time_criticality=0)
        with pytest.raises(ValidationError):
            self._make(time_criticality=11)

    def test_rr_range(self):
        with pytest.raises(ValidationError):
            self._make(risk_reduction_opportunity_enablement=0)
        with pytest.raises(ValidationError):
            self._make(risk_reduction_opportunity_enablement=11)

    def test_job_size_minimum(self):
        with pytest.raises(ValidationError):
            self._make(job_size=0)

    def test_job_size_maximum(self):
        with pytest.raises(ValidationError):
            self._make(job_size=14)

    def test_job_size_boundary_13(self):
        f = self._make(job_size=13)
        assert f.job_size == 13

    def test_default_status(self):
        assert self._make().status == FeatureStatus.BACKLOG

    def test_all_statuses_valid(self):
        for status in FeatureStatus:
            assert self._make(status=status).status == status

    def test_optional_fields_default(self):
        f = self._make()
        assert f.pi_id is None
        assert f.team_id is None
        assert f.iteration_id is None
        assert f.description == ""
        assert f.acceptance_criteria == ""
        assert f.dependency_ids == []

    def test_iteration_id_set(self):
        f = self._make(iteration_id="i-1")
        assert f.iteration_id == "i-1"


# ---------------------------------------------------------------------------
# Story
# ---------------------------------------------------------------------------


class TestStory:
    def _make(self, **kwargs):
        defaults = {
            "name": "As a user I want to log in",
            "feature_id": "f-1",
            "team_id": "t-1",
            "points": 3,
        }
        return Story(**{**defaults, **kwargs})

    def test_defaults(self):
        s = self._make()
        assert s.status == StoryStatus.NOT_STARTED
        assert s.iteration_id is None
        assert s.description == ""
        assert s.acceptance_criteria == ""

    def test_points_minimum(self):
        with pytest.raises(ValidationError):
            self._make(points=0)

    def test_all_statuses_valid(self):
        for status in StoryStatus:
            assert self._make(status=status).status == status

    def test_with_iteration(self):
        s = self._make(iteration_id="i-1")
        assert s.iteration_id == "i-1"


# ---------------------------------------------------------------------------
# PIObjective
# ---------------------------------------------------------------------------


class TestPIObjective:
    def _make(self, **kwargs):
        defaults = {
            "description": "Ship feature X",
            "team_id": "t-1",
            "pi_id": "p-1",
            "planned_business_value": 8,
        }
        return PIObjective(**{**defaults, **kwargs})

    def test_committed_by_default(self):
        obj = self._make()
        assert obj.is_stretch is False
        assert obj.is_committed is True

    def test_stretch_not_committed(self):
        obj = self._make(is_stretch=True)
        assert obj.is_committed is False

    def test_planned_bv_minimum(self):
        with pytest.raises(ValidationError):
            self._make(planned_business_value=0)

    def test_planned_bv_maximum(self):
        with pytest.raises(ValidationError):
            self._make(planned_business_value=11)

    def test_planned_bv_boundary_1(self):
        assert self._make(planned_business_value=1).planned_business_value == 1

    def test_planned_bv_boundary_10(self):
        assert self._make(planned_business_value=10).planned_business_value == 10

    def test_actual_bv_optional(self):
        assert self._make().actual_business_value is None

    def test_actual_bv_set(self):
        obj = self._make(actual_business_value=6)
        assert obj.actual_business_value == 6

    def test_feature_ids_default(self):
        assert self._make().feature_ids == []


# ---------------------------------------------------------------------------
# Risk
# ---------------------------------------------------------------------------


class TestRisk:
    def _make(self, **kwargs):
        defaults = {"description": "Auth service unavailable", "pi_id": "p-1"}
        return Risk(**{**defaults, **kwargs})

    def test_defaults(self):
        r = self._make()
        assert r.roam_status == ROAMStatus.UNROAMED
        assert r.owner is None
        assert r.team_id is None
        assert r.feature_id is None
        assert r.raised_date is not None

    def test_raised_date_explicit(self):
        r = self._make(raised_date=date(2024, 1, 15))
        assert r.raised_date == date(2024, 1, 15)

    def test_all_roam_statuses(self):
        for status in ROAMStatus:
            assert self._make(roam_status=status).roam_status == status

    def test_invalid_roam_status(self):
        with pytest.raises(ValidationError):
            self._make(roam_status="unknown")

    def test_with_owner(self):
        r = self._make(owner="Jane Smith")
        assert r.owner == "Jane Smith"

    def test_with_team_and_feature(self):
        r = self._make(team_id="t-1", feature_id="f-1")
        assert r.team_id == "t-1"
        assert r.feature_id == "f-1"


# ---------------------------------------------------------------------------
# Dependency
# ---------------------------------------------------------------------------


class TestDependency:
    def _make(self, **kwargs):
        defaults = {
            "description": "Need API",
            "pi_id": "p-1",
            "from_feature_id": "feat-a",
            "to_feature_id": "feat-b",
        }
        return Dependency(**{**defaults, **kwargs})

    def test_defaults(self):
        d = self._make()
        assert d.status == DependencyStatus.IDENTIFIED
        assert d.needed_by_date is None
        assert d.raised_date is not None
        assert d.resolution_notes == ""

    def test_raised_date_explicit(self):
        d = self._make(raised_date=date(2024, 1, 15))
        assert d.raised_date == date(2024, 1, 15)

    def test_all_statuses(self):
        for status in DependencyStatus:
            assert self._make(status=status).status == status

    def test_needed_by_date(self):
        d = self._make(needed_by_date=date(2026, 6, 15))
        assert d.needed_by_date == date(2026, 6, 15)

    def test_feature_ids_stored(self):
        d = self._make(from_feature_id="feat-x", to_feature_id="feat-y")
        assert d.from_feature_id == "feat-x"
        assert d.to_feature_id == "feat-y"

    def test_self_referential_dependency_rejected(self):
        with pytest.raises(ValidationError):
            self._make(from_feature_id="f1", to_feature_id="f1")

    def test_different_features_accepted(self):
        d = self._make(from_feature_id="f1", to_feature_id="f2")
        assert d.from_feature_id != d.to_feature_id


# ---------------------------------------------------------------------------
# CapacityPlan
# ---------------------------------------------------------------------------


class TestCapacityPlan:
    def _make(self, **kwargs):
        defaults = {"team_id": "t-1", "iteration_id": "i-1", "pi_id": "p-1", "team_size": 5}
        return CapacityPlan(**{**defaults, **kwargs})

    def test_defaults(self):
        cp = self._make()
        assert cp.iteration_days == 10
        assert cp.pto_days == pytest.approx(0.0)
        assert cp.overhead_pct == pytest.approx(0.2)

    def test_available_capacity_default(self):
        # 5 × 10 × 0.8 = 40.0
        assert self._make().available_capacity == pytest.approx(40.0)

    def test_available_capacity_with_pto(self):
        # (5×10 - 5) × 0.8 = 36.0
        assert self._make(pto_days=5.0).available_capacity == pytest.approx(36.0)

    def test_available_capacity_zero_overhead(self):
        # 5 × 10 × 1.0 = 50.0
        assert self._make(overhead_pct=0.0).available_capacity == pytest.approx(50.0)

    def test_team_size_minimum(self):
        with pytest.raises(ValidationError):
            self._make(team_size=0)

    def test_overhead_above_1_invalid(self):
        with pytest.raises(ValidationError):
            self._make(overhead_pct=1.1)

    def test_overhead_negative_invalid(self):
        with pytest.raises(ValidationError):
            self._make(overhead_pct=-0.1)

    def test_iteration_days_minimum(self):
        with pytest.raises(ValidationError):
            self._make(iteration_days=0)


# ---------------------------------------------------------------------------
# models __init__ re-exports
# ---------------------------------------------------------------------------


class TestIllegalStateError:
    def test_stores_current_and_required_state(self):
        err = IllegalStateError("Bad transition", "planning", "active")
        assert err.current_state == "planning"
        assert err.required_state == "active"

    def test_message_contains_states(self):
        err = IllegalStateError("Bad transition", "planning", "active")
        assert "planning" in str(err)
        assert "active" in str(err)


def test_models_package_exports_all():
    # All public names must be importable from the package; the import itself is the assertion.
    from safe.models import (  # noqa: F401
        ART,
        PI,
        CapacityPlan,
        Dependency,
        DependencyStatus,
        Feature,
        FeatureStatus,
        Iteration,
        PIObjective,
        PIStatus,
        Risk,
        ROAMStatus,
        Story,
        StoryStatus,
        Team,
    )
