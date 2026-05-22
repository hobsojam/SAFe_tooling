from datetime import date

import pytest

from safe.exceptions import IllegalPITransitionError
from safe.logic.pi import validate_pi_transition
from safe.models.pi import PI, PIStatus


def _pi(status: PIStatus) -> PI:
    return PI(
        name="Test PI",
        art_id="art-1",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 3, 31),
        status=status,
    )


def test_planning_to_active_is_valid():
    validate_pi_transition(_pi(PIStatus.PLANNING), PIStatus.ACTIVE)


def test_active_to_closed_is_valid():
    validate_pi_transition(_pi(PIStatus.ACTIVE), PIStatus.CLOSED)


def test_planning_to_closed_raises():
    with pytest.raises(IllegalPITransitionError) as exc_info:
        validate_pi_transition(_pi(PIStatus.PLANNING), PIStatus.CLOSED)
    assert exc_info.value.current_status == PIStatus.PLANNING.value
    assert exc_info.value.target_status == PIStatus.CLOSED.value


def test_active_to_planning_raises():
    with pytest.raises(IllegalPITransitionError) as exc_info:
        validate_pi_transition(_pi(PIStatus.ACTIVE), PIStatus.PLANNING)
    assert exc_info.value.current_status == PIStatus.ACTIVE.value
    assert exc_info.value.target_status == PIStatus.PLANNING.value


def test_closed_to_active_raises():
    with pytest.raises(IllegalPITransitionError) as exc_info:
        validate_pi_transition(_pi(PIStatus.CLOSED), PIStatus.ACTIVE)
    assert exc_info.value.current_status == PIStatus.CLOSED.value
    assert exc_info.value.target_status == PIStatus.ACTIVE.value


def test_closed_to_planning_raises():
    with pytest.raises(IllegalPITransitionError) as exc_info:
        validate_pi_transition(_pi(PIStatus.CLOSED), PIStatus.PLANNING)
    assert exc_info.value.current_status == PIStatus.CLOSED.value
    assert exc_info.value.target_status == PIStatus.PLANNING.value
