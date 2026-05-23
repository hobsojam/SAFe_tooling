import pytest

FEATURE_BASE = {
    "name": "Auth Service",
    "user_business_value": 8,
    "time_criticality": 5,
    "risk_reduction_opportunity_enablement": 3,
    "job_size": 4,
}


def _create_art(client):
    return client.post("/art", json={"name": "ART"}).json()["id"]


def _create_team(client, art_id=None):
    body = {"name": "Alpha", "member_count": 6}
    if art_id:
        body["art_id"] = art_id
    return client.post("/team", json=body).json()["id"]


def _create_feature(client, **overrides):
    return client.post("/features", json={**FEATURE_BASE, **overrides})


class TestFeatureCreate:
    def test_returns_201(self, client):
        r = _create_feature(client)
        assert r.status_code == 201
        body = r.json()
        assert body["name"] == "Auth Service"
        assert body["cost_of_delay"] == 16
        assert body["wsjf_score"] == pytest.approx(4.0)

    def test_computed_fields_present(self, client):
        body = _create_feature(client).json()
        assert "cost_of_delay" in body
        assert "wsjf_score" in body

    def test_missing_required_fields_returns_422(self, client):
        r = client.post("/features", json={"name": "X"})
        assert r.status_code == 422

    def test_value_out_of_range_returns_422(self, client):
        r = _create_feature(client, user_business_value=11)
        assert r.status_code == 422


class TestFeatureList:
    def test_list_empty(self, client):
        assert client.get("/features").json() == []

    def test_sort_wsjf_desc(self, client):
        _create_feature(
            client,
            name="Low",
            user_business_value=1,
            time_criticality=1,
            risk_reduction_opportunity_enablement=1,
            job_size=10,
        )
        _create_feature(
            client,
            name="High",
            user_business_value=8,
            time_criticality=8,
            risk_reduction_opportunity_enablement=8,
            job_size=1,
        )
        features = client.get("/features?sort=wsjf_desc").json()
        assert features[0]["name"] == "High"

    def test_sort_name_asc(self, client):
        _create_feature(client, name="Zebra")
        _create_feature(client, name="Alpha")
        features = client.get("/features?sort=name_asc").json()
        assert features[0]["name"] == "Alpha"

    def test_filter_by_status(self, client):
        _create_feature(client, name="Backlog", status="backlog")
        _create_feature(client, name="Done", status="done")
        features = client.get("/features?status=done").json()
        assert len(features) == 1
        assert features[0]["name"] == "Done"

    def test_filter_by_pi_id(self, client):
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
        _create_feature(client, name="In PI", pi_id=pi_id)
        _create_feature(client, name="No PI")
        features = client.get(f"/features?pi_id={pi_id}").json()
        assert len(features) == 1
        assert features[0]["name"] == "In PI"

    def test_filter_by_team_id(self, client):
        tid = _create_team(client)
        _create_feature(client, name="Assigned", team_id=tid)
        _create_feature(client, name="Unassigned")
        features = client.get(f"/features?team_id={tid}").json()
        assert len(features) == 1
        assert features[0]["name"] == "Assigned"

    def test_invalid_sort_returns_422(self, client):
        assert client.get("/features?sort=bad_sort").status_code == 422


class TestFeatureGet:
    def test_returns_feature(self, client):
        fid = _create_feature(client).json()["id"]
        r = client.get(f"/features/{fid}")
        assert r.status_code == 200
        assert r.json()["id"] == fid

    def test_unknown_returns_404(self, client):
        assert client.get("/features/no-such-id").status_code == 404


class TestFeaturePatch:
    def test_patch_name(self, client):
        fid = _create_feature(client).json()["id"]
        r = client.patch(f"/features/{fid}", json={"name": "Updated"})
        assert r.status_code == 200
        assert r.json()["name"] == "Updated"

    def test_patch_recalculates_wsjf(self, client):
        fid = _create_feature(client).json()["id"]
        r = client.patch(f"/features/{fid}", json={"job_size": 8})
        assert r.json()["wsjf_score"] == pytest.approx(2.0)

    def test_patch_iteration_id(self, client):
        fid = _create_feature(client).json()["id"]
        r = client.patch(f"/features/{fid}", json={"iteration_id": "iter-abc"})
        assert r.status_code == 200
        assert r.json()["iteration_id"] == "iter-abc"

    def test_patch_iteration_id_clear(self, client):
        fid = _create_feature(client).json()["id"]
        client.patch(f"/features/{fid}", json={"iteration_id": "iter-abc"})
        r = client.patch(f"/features/{fid}", json={"iteration_id": None})
        assert r.status_code == 200
        assert r.json()["iteration_id"] is None

    def test_unknown_returns_404(self, client):
        assert client.patch("/features/no-such-id", json={"name": "X"}).status_code == 404


class TestFeatureAssign:
    def test_assign_team(self, client):
        team_id = _create_team(client)
        fid = _create_feature(client).json()["id"]
        r = client.post(f"/features/{fid}/assign", json={"team_id": team_id})
        assert r.status_code == 200
        assert r.json()["team_id"] == team_id

    def test_assign_unknown_team_returns_404(self, client):
        fid = _create_feature(client).json()["id"]
        r = client.post(f"/features/{fid}/assign", json={"team_id": "no-team"})
        assert r.status_code == 404

    def test_assign_unknown_feature_returns_404(self, client):
        team_id = _create_team(client)
        r = client.post("/features/no-such-id/assign", json={"team_id": team_id})
        assert r.status_code == 404


class TestFeatureDelete:
    def test_delete_returns_204(self, client):
        fid = _create_feature(client).json()["id"]
        assert client.delete(f"/features/{fid}").status_code == 204
        assert client.get(f"/features/{fid}").status_code == 404

    def test_delete_cascades_stories(self, client):
        tid = _create_team(client)
        fid = _create_feature(client).json()["id"]
        sid = client.post(
            "/stories", json={"name": "S", "feature_id": fid, "team_id": tid, "points": 2}
        ).json()["id"]
        client.delete(f"/features/{fid}")
        assert client.get(f"/stories/{sid}").status_code == 404

    def test_delete_cleans_objective_feature_ids(self, client):
        art_id = _create_art(client)
        team_id = _create_team(client, art_id)
        pi_id = client.post(
            "/pi",
            json={
                "name": "PI 1",
                "art_id": art_id,
                "start_date": "2026-01-05",
                "end_date": "2026-03-27",
            },
        ).json()["id"]
        fid = _create_feature(client).json()["id"]
        oid = client.post(
            "/objectives",
            json={
                "team_id": team_id,
                "pi_id": pi_id,
                "description": "Obj",
                "planned_business_value": 5,
                "feature_ids": [fid],
            },
        ).json()["id"]
        client.delete(f"/features/{fid}")
        objective = client.get(f"/objectives/{oid}").json()
        assert fid not in objective["feature_ids"]

    def test_unknown_returns_404(self, client):
        assert client.delete("/features/no-such-id").status_code == 404
