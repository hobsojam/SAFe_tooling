import pytest

from safe.logic.capacity import available_capacity, capacity_warning, load_percentage


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
