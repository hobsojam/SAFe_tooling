import pytest


def test_predictability_green(client):
    r = client.post(
        "/compute/predictability",
        json={
            "teams": [
                {"planned_business_value": 10, "actual_business_value": 9},
                {"planned_business_value": 8, "actual_business_value": 7},
            ]
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["score_pct"] == pytest.approx(88.9)
    assert body["rating"] == "green"


def test_predictability_yellow(client):
    r = client.post(
        "/compute/predictability",
        json={"teams": [{"planned_business_value": 10, "actual_business_value": 7}]},
    )
    assert r.status_code == 200
    assert r.json()["rating"] == "yellow"


def test_predictability_red(client):
    r = client.post(
        "/compute/predictability",
        json={"teams": [{"planned_business_value": 10, "actual_business_value": 5}]},
    )
    assert r.status_code == 200
    assert r.json()["rating"] == "red"


def test_empty_teams_returns_422(client):
    r = client.post("/compute/predictability", json={"teams": []})
    assert r.status_code == 422


def test_missing_body_returns_422(client):
    assert client.post("/compute/predictability", json={}).status_code == 422
