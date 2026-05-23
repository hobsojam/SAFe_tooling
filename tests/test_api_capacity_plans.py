from datetime import date

import pytest

from safe.api.routers.capacity_plans import _weekdays


class TestWeekdays:
    def test_full_two_week_iteration(self):
        # Mon 2026-01-05 → Fri 2026-01-16 = 10 weekdays
        assert _weekdays(date(2026, 1, 5), date(2026, 1, 16)) == 10

    def test_single_monday(self):
        assert _weekdays(date(2026, 1, 5), date(2026, 1, 5)) == 1

    def test_weekend_only_returns_zero(self):
        # Sat 2026-01-10 → Sun 2026-01-11
        assert _weekdays(date(2026, 1, 10), date(2026, 1, 11)) == 0

    def test_start_saturday_end_monday(self):
        # Sat 2026-01-10 → Mon 2026-01-12 = 1 weekday (Monday)
        assert _weekdays(date(2026, 1, 10), date(2026, 1, 12)) == 1


def _setup(client):
    art_id = client.post("/art", json={"name": "ART"}).json()["id"]
    pi_id = client.post(
        "/pi",
        json={
            "name": "PI 1",
            "art_id": art_id,
            "start_date": "2026-01-05",
            "end_date": "2026-03-27",
        },
    ).json()["id"]
    team_id = client.post("/team", json={"name": "Alpha", "member_count": 7}).json()["id"]
    iter_id = client.post(
        "/iterations",
        json={
            "pi_id": pi_id,
            "number": 1,
            "start_date": "2026-01-05",
            "end_date": "2026-01-16",
        },
    ).json()["id"]
    return pi_id, team_id, iter_id


def _create_plan(client, pi_id, team_id, iter_id, **overrides):
    return client.post(
        "/capacity-plans",
        json={
            "pi_id": pi_id,
            "team_id": team_id,
            "iteration_id": iter_id,
            "team_size": 7,
            **overrides,
        },
    )


def test_create_returns_201(client):
    pi_id, team_id, iter_id = _setup(client)
    r = _create_plan(client, pi_id, team_id, iter_id)
    assert r.status_code == 201
    body = r.json()
    assert "available_capacity" in body
    assert body["available_capacity"] > 0


def test_create_upserts_existing(client):
    pi_id, team_id, iter_id = _setup(client)
    plan_id = _create_plan(client, pi_id, team_id, iter_id).json()["id"]
    r = _create_plan(client, pi_id, team_id, iter_id, team_size=5)
    assert r.status_code == 201
    assert r.json()["id"] == plan_id
    assert r.json()["team_size"] == 5


def test_list_filter_by_pi(client):
    pi_id, team_id, iter_id = _setup(client)
    _create_plan(client, pi_id, team_id, iter_id)
    plans = client.get(f"/capacity-plans?pi_id={pi_id}").json()
    assert len(plans) == 1


def test_get_returns_plan(client):
    pi_id, team_id, iter_id = _setup(client)
    plan_id = _create_plan(client, pi_id, team_id, iter_id).json()["id"]
    r = client.get(f"/capacity-plans/{plan_id}")
    assert r.status_code == 200
    assert r.json()["id"] == plan_id


def test_get_unknown_returns_404(client):
    assert client.get("/capacity-plans/no-such-id").status_code == 404


def test_patch_team_size(client):
    pi_id, team_id, iter_id = _setup(client)
    plan_id = _create_plan(client, pi_id, team_id, iter_id).json()["id"]
    r = client.patch(f"/capacity-plans/{plan_id}", json={"team_size": 10})
    assert r.status_code == 200
    assert r.json()["team_size"] == 10


def test_patch_unknown_returns_404(client):
    assert client.patch("/capacity-plans/no-such-id", json={"team_size": 5}).status_code == 404


def test_delete_returns_204(client):
    pi_id, team_id, iter_id = _setup(client)
    plan_id = _create_plan(client, pi_id, team_id, iter_id).json()["id"]
    assert client.delete(f"/capacity-plans/{plan_id}").status_code == 204
    assert client.get(f"/capacity-plans/{plan_id}").status_code == 404


def test_delete_unknown_returns_404(client):
    assert client.delete("/capacity-plans/no-such-id").status_code == 404


def _setup_for_seed(client):
    """Return (art_id, pi_id) with one team attached to art and two non-IP iterations."""
    art_id = client.post("/art", json={"name": "ART"}).json()["id"]
    pi_id = client.post(
        "/pi",
        json={
            "name": "PI 1",
            "art_id": art_id,
            "start_date": "2026-01-05",
            "end_date": "2026-03-27",
        },
    ).json()["id"]
    client.post("/team", json={"name": "Alpha", "member_count": 6, "art_id": art_id})
    client.post(
        "/iterations",
        json={"pi_id": pi_id, "number": 1, "start_date": "2026-01-05", "end_date": "2026-01-16"},
    )
    client.post(
        "/iterations",
        json={"pi_id": pi_id, "number": 2, "start_date": "2026-01-19", "end_date": "2026-01-30"},
    )
    return art_id, pi_id


def test_create_unknown_pi_returns_404(client):
    _, team_id, iter_id = _setup(client)
    r = _create_plan(client, "no-such-pi", team_id, iter_id)
    assert r.status_code == 404
    assert "PI" in r.json()["detail"]


def test_create_unknown_team_returns_404(client):
    pi_id, _, iter_id = _setup(client)
    r = _create_plan(client, pi_id, "no-such-team", iter_id)
    assert r.status_code == 404
    assert "Team" in r.json()["detail"]


def test_create_unknown_iteration_returns_404(client):
    pi_id, team_id, _ = _setup(client)
    r = _create_plan(client, pi_id, team_id, "no-such-iteration")
    assert r.status_code == 404
    assert "Iteration" in r.json()["detail"]


class TestVelocityEndpoint:
    def _setup_with_stories(self, client):
        pi_id, team_id, iter_id = _setup(client)
        feature_id = client.post(
            "/features",
            json={
                "name": "F",
                "pi_id": pi_id,
                "team_id": team_id,
                "user_business_value": 5,
                "time_criticality": 5,
                "risk_reduction_opportunity_enablement": 5,
                "job_size": 5,
            },
        ).json()["id"]
        done_story_id = client.post(
            "/stories",
            json={
                "name": "done story",
                "feature_id": feature_id,
                "team_id": team_id,
                "iteration_id": iter_id,
                "points": 8,
                "status": "done",
            },
        ).json()["id"]
        client.post(
            "/stories",
            json={
                "name": "in progress story",
                "feature_id": feature_id,
                "team_id": team_id,
                "iteration_id": iter_id,
                "points": 5,
                "status": "in_progress",
            },
        )
        return pi_id, team_id, iter_id, done_story_id

    def test_returns_200(self, client):
        pi_id, _, _, _ = self._setup_with_stories(client)
        r = client.get(f"/capacity-plans/velocity?pi_id={pi_id}")
        assert r.status_code == 200

    def test_completed_points_counts_done_only(self, client):
        pi_id, team_id, iter_id, _ = self._setup_with_stories(client)
        r = client.get(f"/capacity-plans/velocity?pi_id={pi_id}")
        entries = r.json()
        entry = next((e for e in entries if e["team_id"] == team_id), None)
        assert entry is not None
        assert entry["completed_points"] == 8

    def test_accepted_stories_count_as_velocity(self, client):
        pi_id, team_id, iter_id = _setup(client)
        feature_id = client.post(
            "/features",
            json={
                "name": "F2",
                "pi_id": pi_id,
                "team_id": team_id,
                "user_business_value": 5,
                "time_criticality": 5,
                "risk_reduction_opportunity_enablement": 5,
                "job_size": 5,
            },
        ).json()["id"]
        client.post(
            "/stories",
            json={
                "name": "accepted story",
                "feature_id": feature_id,
                "team_id": team_id,
                "iteration_id": iter_id,
                "points": 3,
                "status": "accepted",
            },
        )
        r = client.get(f"/capacity-plans/velocity?pi_id={pi_id}")
        entry = next(e for e in r.json() if e["team_id"] == team_id)
        assert entry["completed_points"] == 3

    def test_available_capacity_null_without_plan(self, client):
        pi_id, team_id, iter_id, _ = self._setup_with_stories(client)
        r = client.get(f"/capacity-plans/velocity?pi_id={pi_id}")
        entry = next(e for e in r.json() if e["team_id"] == team_id)
        assert entry["available_capacity"] is None

    def test_available_capacity_populated_with_plan(self, client):
        pi_id, team_id, iter_id, _ = self._setup_with_stories(client)
        _create_plan(client, pi_id, team_id, iter_id, team_size=5)
        r = client.get(f"/capacity-plans/velocity?pi_id={pi_id}")
        entry = next(e for e in r.json() if e["team_id"] == team_id)
        assert entry["available_capacity"] == pytest.approx(40.0)

    def test_filter_by_team_id(self, client):
        pi_id, team_id, iter_id, _ = self._setup_with_stories(client)
        r = client.get(f"/capacity-plans/velocity?pi_id={pi_id}&team_id={team_id}")
        assert r.status_code == 200
        entries = r.json()
        assert all(e["team_id"] == team_id for e in entries)

    def test_unknown_pi_returns_404(self, client):
        r = client.get("/capacity-plans/velocity?pi_id=no-such-pi")
        assert r.status_code == 404

    def test_unknown_team_returns_404(self, client):
        pi_id, _, _ = _setup(client)
        r = client.get(f"/capacity-plans/velocity?pi_id={pi_id}&team_id=no-such-team")
        assert r.status_code == 404


class TestSeedCapacityPlans:
    def test_creates_plans_for_each_team_iteration_cell(self, client):
        _, pi_id = _setup_for_seed(client)
        r = client.post("/capacity-plans/seed", json={"pi_id": pi_id})
        assert r.status_code == 201
        body = r.json()
        assert body["created"] == 2  # 1 team × 2 non-IP iterations
        assert body["skipped"] == 0

    def test_seed_uses_iteration_weekdays_as_iteration_days(self, client):
        _, pi_id = _setup_for_seed(client)
        client.post("/capacity-plans/seed", json={"pi_id": pi_id})
        plans = client.get(f"/capacity-plans?pi_id={pi_id}").json()
        # Jan 5–16 = 10 weekdays
        assert plans[0]["iteration_days"] == 10

    def test_idempotent_does_not_duplicate(self, client):
        _, pi_id = _setup_for_seed(client)
        client.post("/capacity-plans/seed", json={"pi_id": pi_id})
        r = client.post("/capacity-plans/seed", json={"pi_id": pi_id})
        assert r.status_code == 201
        body = r.json()
        assert body["created"] == 0
        assert body["skipped"] == 2  # 1 team × 2 iterations, all pre-existing

    def test_unknown_pi_returns_404(self, client):
        r = client.post("/capacity-plans/seed", json={"pi_id": "no-such-pi"})
        assert r.status_code == 404
