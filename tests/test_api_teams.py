def _create_art(client, name="Platform ART"):
    return client.post("/art", json={"name": name}).json()["id"]


def test_list_empty(client):
    r = client.get("/team")
    assert r.status_code == 200
    assert r.json() == []


def test_create_returns_201(client):
    r = client.post("/team", json={"name": "Alpha", "member_count": 6})
    assert r.status_code == 201
    body = r.json()
    assert body["name"] == "Alpha"
    assert body["member_count"] == 6
    assert body["art_id"] is None


def test_create_with_art_id(client):
    art_id = _create_art(client)
    r = client.post("/team", json={"name": "Beta", "member_count": 7, "art_id": art_id})
    assert r.status_code == 201
    assert r.json()["art_id"] == art_id


def test_create_updates_art_team_ids(client):
    art_id = _create_art(client)
    team_id = client.post(
        "/team", json={"name": "Gamma", "member_count": 5, "art_id": art_id}
    ).json()["id"]
    art = client.get(f"/art/{art_id}").json()
    assert team_id in art["team_ids"]


def test_create_with_unknown_art_returns_404(client):
    r = client.post("/team", json={"name": "Orphan", "member_count": 5, "art_id": "no-such-art"})
    assert r.status_code == 404


def test_create_member_count_zero_returns_422(client):
    r = client.post("/team", json={"name": "Bad", "member_count": 0})
    assert r.status_code == 422


def test_get_returns_team(client):
    team_id = client.post("/team", json={"name": "Delta", "member_count": 8}).json()["id"]
    r = client.get(f"/team/{team_id}")
    assert r.status_code == 200
    assert r.json()["id"] == team_id


def test_get_unknown_returns_404(client):
    r = client.get("/team/no-such-id")
    assert r.status_code == 404


def test_list_filter_by_art_id(client):
    art1 = _create_art(client, "ART 1")
    art2 = _create_art(client, "ART 2")
    client.post("/team", json={"name": "T1", "member_count": 5, "art_id": art1})
    client.post("/team", json={"name": "T2", "member_count": 5, "art_id": art2})
    client.post("/team", json={"name": "T3", "member_count": 5, "art_id": art1})

    teams = client.get(f"/team?art_id={art1}").json()
    assert len(teams) == 2
    assert all(t["art_id"] == art1 for t in teams)


def test_patch_name(client):
    team_id = client.post("/team", json={"name": "Old", "member_count": 5}).json()["id"]
    r = client.patch(f"/team/{team_id}", json={"name": "New"})
    assert r.status_code == 200
    assert r.json()["name"] == "New"
    assert r.json()["member_count"] == 5


def test_patch_unknown_returns_404(client):
    r = client.patch("/team/no-such-id", json={"name": "X"})
    assert r.status_code == 404


def test_delete_returns_204(client):
    team_id = client.post("/team", json={"name": "Temp", "member_count": 4}).json()["id"]
    r = client.delete(f"/team/{team_id}")
    assert r.status_code == 204
    assert client.get(f"/team/{team_id}").status_code == 404


def test_delete_removes_from_art_team_ids(client):
    art_id = _create_art(client)
    team_id = client.post(
        "/team", json={"name": "Gone", "member_count": 5, "art_id": art_id}
    ).json()["id"]
    client.delete(f"/team/{team_id}")
    art = client.get(f"/art/{art_id}").json()
    assert team_id not in art["team_ids"]


def test_delete_with_stories_returns_409(client):
    team_id = client.post("/team", json={"name": "T", "member_count": 5}).json()["id"]
    feat_id = client.post(
        "/features",
        json={
            "name": "F",
            "user_business_value": 5,
            "time_criticality": 5,
            "risk_reduction_opportunity_enablement": 5,
            "job_size": 5,
        },
    ).json()["id"]
    client.post(
        "/stories",
        json={"name": "S", "feature_id": feat_id, "team_id": team_id, "points": 3},
    )
    assert client.delete(f"/team/{team_id}").status_code == 409


def test_delete_with_objectives_returns_409(client):
    art_id = _create_art(client)
    pi_id = client.post(
        "/pi",
        json={
            "name": "PI 1",
            "art_id": art_id,
            "start_date": "2026-01-05",
            "end_date": "2026-03-27",
        },
    ).json()["id"]
    team_id = client.post("/team", json={"name": "T", "member_count": 5}).json()["id"]
    client.post(
        "/objectives",
        json={
            "description": "Ship X",
            "team_id": team_id,
            "pi_id": pi_id,
            "planned_business_value": 8,
        },
    )
    assert client.delete(f"/team/{team_id}").status_code == 409


def test_delete_with_capacity_plans_returns_409(client):
    art_id = _create_art(client)
    pi_id = client.post(
        "/pi",
        json={
            "name": "PI 1",
            "art_id": art_id,
            "start_date": "2026-01-05",
            "end_date": "2026-03-27",
        },
    ).json()["id"]
    team_id = client.post("/team", json={"name": "T", "member_count": 5}).json()["id"]
    iter_id = client.post(
        "/iterations",
        json={"pi_id": pi_id, "number": 1, "start_date": "2026-01-05", "end_date": "2026-01-16"},
    ).json()["id"]
    client.post(
        "/capacity-plans",
        json={"pi_id": pi_id, "team_id": team_id, "iteration_id": iter_id, "team_size": 5},
    )
    assert client.delete(f"/team/{team_id}").status_code == 409


def test_delete_with_feature_returns_409(client):
    team_id = client.post("/team", json={"name": "T", "member_count": 5}).json()["id"]
    client.post(
        "/features",
        json={
            "name": "F",
            "team_id": team_id,
            "user_business_value": 5,
            "time_criticality": 5,
            "risk_reduction_opportunity_enablement": 5,
            "job_size": 5,
        },
    )
    assert client.delete(f"/team/{team_id}").status_code == 409


def test_delete_unknown_returns_404(client):
    r = client.delete("/team/no-such-id")
    assert r.status_code == 404


def test_create_with_topology_type(client):
    r = client.post(
        "/team", json={"name": "Platform", "member_count": 6, "topology_type": "platform"}
    )
    assert r.status_code == 201
    assert r.json()["topology_type"] == "platform"


def test_create_without_topology_type_is_null(client):
    r = client.post("/team", json={"name": "Alpha", "member_count": 6})
    assert r.status_code == 201
    assert r.json()["topology_type"] is None


def test_create_invalid_topology_type_returns_422(client):
    r = client.post("/team", json={"name": "Bad", "member_count": 5, "topology_type": "not_a_type"})
    assert r.status_code == 422


def test_patch_topology_type(client):
    team_id = client.post("/team", json={"name": "Untyped", "member_count": 5}).json()["id"]
    r = client.patch(f"/team/{team_id}", json={"topology_type": "enabling"})
    assert r.status_code == 200
    assert r.json()["topology_type"] == "enabling"


class TestTeamPatch:
    def test_patch_name(self, client):
        art_id = client.post("/art", json={"name": "ART"}).json()["id"]
        payload = {"name": "Alpha", "member_count": 5, "art_id": art_id}
        team_id = client.post("/team", json=payload).json()["id"]
        r = client.patch(f"/team/{team_id}", json={"name": "Alpha Renamed"})
        assert r.status_code == 200
        assert r.json()["name"] == "Alpha Renamed"

    def test_patch_reassign_to_new_art(self, client):
        art1_id = client.post("/art", json={"name": "ART 1"}).json()["id"]
        art2_id = client.post("/art", json={"name": "ART 2"}).json()["id"]
        payload = {"name": "Alpha", "member_count": 5, "art_id": art1_id}
        team_id = client.post("/team", json=payload).json()["id"]
        r = client.patch(f"/team/{team_id}", json={"art_id": art2_id})
        assert r.status_code == 200
        assert r.json()["art_id"] == art2_id
        assert team_id not in client.get(f"/art/{art1_id}").json()["team_ids"]
        assert team_id in client.get(f"/art/{art2_id}").json()["team_ids"]

    def test_patch_invalid_art_returns_404(self, client):
        team_id = client.post("/team", json={"name": "Alpha", "member_count": 5}).json()["id"]
        r = client.patch(f"/team/{team_id}", json={"art_id": "no-such-art"})
        assert r.status_code == 404

    def test_patch_unknown_team_returns_404(self, client):
        r = client.patch("/team/no-such-id", json={"name": "X"})
        assert r.status_code == 404
