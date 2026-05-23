def _create_art(client):
    return client.post("/art", json={"name": "ART"}).json()["id"]


def _create_pi(client, art_id):
    return client.post(
        "/pi",
        json={
            "name": "PI 1",
            "art_id": art_id,
            "start_date": "2026-01-05",
            "end_date": "2026-03-27",
        },
    ).json()["id"]


def _create_team(client):
    return client.post("/team", json={"name": "Alpha", "member_count": 5}).json()["id"]


def _create_feature(client, pi_id):
    return client.post(
        "/features",
        json={
            "name": "Auth Service",
            "pi_id": pi_id,
            "user_business_value": 8,
            "time_criticality": 5,
            "risk_reduction_opportunity_enablement": 3,
            "job_size": 4,
        },
    ).json()["id"]


def _create_risk(client, pi_id, **overrides):
    return client.post(
        "/risks", json={"description": "Data loss risk", "pi_id": pi_id, **overrides}
    )


def test_create_returns_201(client):
    art_id = _create_art(client)
    pi_id = _create_pi(client, art_id)
    r = _create_risk(client, pi_id)
    assert r.status_code == 201
    assert r.json()["roam_status"] == "unroamed"


def test_list_filter_by_pi(client):
    art_id = _create_art(client)
    pi1 = _create_pi(client, art_id)
    pi2 = client.post(
        "/pi",
        json={
            "name": "PI 2",
            "art_id": art_id,
            "start_date": "2026-04-06",
            "end_date": "2026-06-26",
        },
    ).json()["id"]
    _create_risk(client, pi1)
    _create_risk(client, pi2)
    risks = client.get(f"/risks?pi_id={pi1}").json()
    assert len(risks) == 1


def test_list_filter_by_team(client):
    art_id = _create_art(client)
    pi_id = _create_pi(client, art_id)
    team_id = client.post("/team", json={"name": "Alpha", "member_count": 5}).json()["id"]
    _create_risk(client, pi_id, team_id=team_id)
    _create_risk(client, pi_id)
    risks = client.get(f"/risks?team_id={team_id}").json()
    assert len(risks) == 1
    assert risks[0]["team_id"] == team_id


def test_list_filter_by_roam_status(client):
    art_id = _create_art(client)
    pi_id = _create_pi(client, art_id)
    rid = _create_risk(client, pi_id).json()["id"]
    _create_risk(client, pi_id)
    client.post(f"/risks/{rid}/roam", json={"roam_status": "owned"})
    owned = client.get("/risks?roam_status=owned").json()
    assert len(owned) == 1
    assert owned[0]["roam_status"] == "owned"


def test_create_unknown_pi_returns_404(client):
    r = _create_risk(client, "no-such-pi")
    assert r.status_code == 404
    assert "PI" in r.json()["detail"]


def test_create_unknown_team_returns_404(client):
    art_id = _create_art(client)
    pi_id = _create_pi(client, art_id)
    r = _create_risk(client, pi_id, team_id="no-such-team")
    assert r.status_code == 404
    assert "Team" in r.json()["detail"]


def test_create_unknown_feature_returns_404(client):
    art_id = _create_art(client)
    pi_id = _create_pi(client, art_id)
    r = _create_risk(client, pi_id, feature_id="no-such-feature")
    assert r.status_code == 404
    assert "Feature" in r.json()["detail"]


def test_get_unknown_returns_404(client):
    assert client.get("/risks/no-such-id").status_code == 404


def test_roam_sets_status(client):
    art_id = _create_art(client)
    pi_id = _create_pi(client, art_id)
    rid = _create_risk(client, pi_id).json()["id"]
    r = client.post(f"/risks/{rid}/roam", json={"roam_status": "owned", "owner": "Alice"})
    assert r.status_code == 200
    body = r.json()
    assert body["roam_status"] == "owned"
    assert body["owner"] == "Alice"


def test_roam_unknown_returns_404(client):
    r = client.post("/risks/no-such-id/roam", json={"roam_status": "resolved"})
    assert r.status_code == 404


def test_patch_description(client):
    art_id = _create_art(client)
    pi_id = _create_pi(client, art_id)
    rid = _create_risk(client, pi_id).json()["id"]
    r = client.patch(f"/risks/{rid}", json={"description": "Updated risk"})
    assert r.status_code == 200
    assert r.json()["description"] == "Updated risk"


def test_patch_unknown_returns_404(client):
    assert client.patch("/risks/no-such-id", json={"description": "X"}).status_code == 404


def test_delete_returns_204(client):
    art_id = _create_art(client)
    pi_id = _create_pi(client, art_id)
    rid = _create_risk(client, pi_id).json()["id"]
    assert client.delete(f"/risks/{rid}").status_code == 204
    assert client.get(f"/risks/{rid}").status_code == 404


def test_delete_unknown_returns_404(client):
    assert client.delete("/risks/no-such-id").status_code == 404
