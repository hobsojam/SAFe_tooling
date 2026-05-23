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
    return client.post("/team", json={"name": "Alpha", "member_count": 6}).json()["id"]


OBJ_BASE = {"description": "Deliver auth service", "planned_business_value": 8}


def _create_objective(client, team_id, pi_id, **overrides):
    return client.post(
        "/objectives", json={"team_id": team_id, "pi_id": pi_id, **OBJ_BASE, **overrides}
    )


def test_create_returns_201(client):
    art_id = _create_art(client)
    pi_id = _create_pi(client, art_id)
    team_id = _create_team(client)
    r = _create_objective(client, team_id, pi_id)
    assert r.status_code == 201
    body = r.json()
    assert body["is_committed"] is True
    assert body["is_stretch"] is False


def test_stretch_objective(client):
    art_id = _create_art(client)
    pi_id = _create_pi(client, art_id)
    team_id = _create_team(client)
    r = _create_objective(client, team_id, pi_id, is_stretch=True)
    assert r.status_code == 201
    assert r.json()["is_committed"] is False


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
    team_id = _create_team(client)
    _create_objective(client, team_id, pi1)
    _create_objective(client, team_id, pi2)
    objs = client.get(f"/objectives?pi_id={pi1}").json()
    assert len(objs) == 1
    assert objs[0]["pi_id"] == pi1


def test_list_filter_by_is_stretch(client):
    art_id = _create_art(client)
    pi_id = _create_pi(client, art_id)
    team_id = _create_team(client)
    _create_objective(client, team_id, pi_id)
    _create_objective(client, team_id, pi_id, is_stretch=True)
    stretch = client.get("/objectives?is_stretch=true").json()
    assert len(stretch) == 1
    assert stretch[0]["is_stretch"] is True
    committed = client.get("/objectives?is_stretch=false").json()
    assert len(committed) == 1
    assert committed[0]["is_stretch"] is False


def test_create_unknown_pi_returns_404(client):
    team_id = _create_team(client)
    r = _create_objective(client, team_id, "no-such-pi")
    assert r.status_code == 404
    assert "PI" in r.json()["detail"]


def test_create_unknown_team_returns_404(client):
    art_id = _create_art(client)
    pi_id = _create_pi(client, art_id)
    r = _create_objective(client, "no-such-team", pi_id)
    assert r.status_code == 404
    assert "Team" in r.json()["detail"]


def test_get_unknown_returns_404(client):
    assert client.get("/objectives/no-such-id").status_code == 404


def test_list_filter_by_team_id(client):
    art_id = _create_art(client)
    pi_id = _create_pi(client, art_id)
    team1 = _create_team(client)
    team2 = client.post("/team", json={"name": "Beta", "member_count": 4}).json()["id"]
    _create_objective(client, team1, pi_id)
    _create_objective(client, team2, pi_id)
    objs = client.get(f"/objectives?team_id={team1}").json()
    assert len(objs) == 1
    assert objs[0]["team_id"] == team1


def test_patch_actual_bv(client):
    art_id = _create_art(client)
    pi_id = _create_pi(client, art_id)
    team_id = _create_team(client)
    oid = _create_objective(client, team_id, pi_id).json()["id"]
    r = client.patch(f"/objectives/{oid}", json={"actual_business_value": 7})
    assert r.status_code == 200
    assert r.json()["actual_business_value"] == 7


def test_patch_unknown_returns_404(client):
    r = client.patch("/objectives/no-such-id", json={"actual_business_value": 5})
    assert r.status_code == 404


def test_delete_returns_204(client):
    art_id = _create_art(client)
    pi_id = _create_pi(client, art_id)
    team_id = _create_team(client)
    oid = _create_objective(client, team_id, pi_id).json()["id"]
    assert client.delete(f"/objectives/{oid}").status_code == 204
    assert client.get(f"/objectives/{oid}").status_code == 404


def test_delete_unknown_returns_404(client):
    assert client.delete("/objectives/no-such-id").status_code == 404
