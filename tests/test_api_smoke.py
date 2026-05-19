"""
End-to-end smoke test: creates a full PI planning scenario and verifies
the complete flow from ART creation through predictability calculation.
"""

import pytest


def test_full_pi_planning_flow(client):
    # 1. Create ART
    art = client.post("/art", json={"name": "Platform ART"}).json()
    assert art["name"] == "Platform ART"
    art_id = art["id"]

    # 2. Create two teams on the ART
    t1 = client.post("/team", json={"name": "Alpha", "member_count": 7, "art_id": art_id}).json()
    t2 = client.post("/team", json={"name": "Beta", "member_count": 5, "art_id": art_id}).json()
    assert art_id in (t1["art_id"], t2["art_id"])
    assert len(client.get(f"/art/{art_id}").json()["team_ids"]) == 2

    # 3. Create and activate a PI
    pi = client.post(
        "/pi",
        json={
            "name": "PI 2026.1",
            "art_id": art_id,
            "start_date": "2026-01-05",
            "end_date": "2026-03-27",
        },
    ).json()
    assert pi["status"] == "planning"
    pi_id = pi["id"]

    pi = client.post(f"/pi/{pi_id}/activate").json()
    assert pi["status"] == "active"

    # 4. Add iterations
    i1 = client.post(
        "/iterations",
        json={
            "pi_id": pi_id,
            "number": 1,
            "start_date": "2026-01-05",
            "end_date": "2026-01-16",
        },
    ).json()
    client.post(
        "/iterations",
        json={
            "pi_id": pi_id,
            "number": 2,
            "start_date": "2026-01-19",
            "end_date": "2026-01-30",
        },
    )
    assert len(client.get(f"/pi/{pi_id}").json()["iteration_ids"]) == 2

    # 5. Create features and assign to teams
    f1 = client.post(
        "/features",
        json={
            "name": "Auth Service",
            "pi_id": pi_id,
            "user_business_value": 8,
            "time_criticality": 5,
            "risk_reduction_opportunity_enablement": 3,
            "job_size": 4,
        },
    ).json()
    assert f1["wsjf_score"] == pytest.approx(4.0)
    assert f1["cost_of_delay"] == 16

    f2 = client.post(
        "/features",
        json={
            "name": "Search",
            "pi_id": pi_id,
            "user_business_value": 5,
            "time_criticality": 3,
            "risk_reduction_opportunity_enablement": 2,
            "job_size": 8,
        },
    ).json()

    client.post(f"/features/{f1['id']}/assign", json={"team_id": t1["id"]})
    client.post(f"/features/{f2['id']}/assign", json={"team_id": t2["id"]})
    assert client.get(f"/features/{f1['id']}").json()["team_id"] == t1["id"]

    # 6. Features sorted by WSJF
    features = client.get("/features?sort=wsjf_desc").json()
    assert features[0]["id"] == f1["id"]

    # 7. Create capacity plans
    plan1 = client.post(
        "/capacity-plans",
        json={
            "pi_id": pi_id,
            "team_id": t1["id"],
            "iteration_id": i1["id"],
            "team_size": 7,
            "iteration_days": 10,
        },
    ).json()
    assert plan1["available_capacity"] > 0

    # 8. Create PI objectives
    obj1 = client.post(
        "/objectives",
        json={
            "description": "Ship auth",
            "team_id": t1["id"],
            "pi_id": pi_id,
            "planned_business_value": 8,
        },
    ).json()
    obj2 = client.post(
        "/objectives",
        json={
            "description": "Ship search",
            "team_id": t2["id"],
            "pi_id": pi_id,
            "planned_business_value": 6,
            "is_stretch": True,
        },
    ).json()
    assert obj1["is_committed"] is True
    assert obj2["is_committed"] is False

    # 9. Score objectives at PI close
    client.patch(f"/objectives/{obj1['id']}", json={"actual_business_value": 7})
    client.patch(f"/objectives/{obj2['id']}", json={"actual_business_value": 5})

    # 10. Log a risk and ROAM it
    risk = client.post(
        "/risks",
        json={
            "description": "Auth dependency on SSO team",
            "pi_id": pi_id,
        },
    ).json()
    roamed = client.post(
        f"/risks/{risk['id']}/roam",
        json={
            "roam_status": "owned",
            "owner": "Alice",
        },
    ).json()
    assert roamed["roam_status"] == "owned"

    # 11. Log a dependency
    dep = client.post(
        "/dependencies",
        json={
            "description": "Auth Service needs Search endpoint",
            "pi_id": pi_id,
            "from_feature_id": f1["id"],
            "to_feature_id": f2["id"],
        },
    ).json()
    resolved = client.post(f"/dependencies/{dep['id']}/roam", json={"status": "resolved"}).json()
    assert resolved["status"] == "resolved"

    # 12. Close the PI
    closed = client.post(f"/pi/{pi_id}/close").json()
    assert closed["status"] == "closed"

    # 13. Stateless predictability calculation
    r = client.post(
        "/compute/predictability",
        json={
            "teams": [
                {"planned_business_value": 8, "actual_business_value": 7},
                {"planned_business_value": 6, "actual_business_value": 5},
            ]
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["score_pct"] == pytest.approx(85.7)
    assert body["rating"] == "green"
