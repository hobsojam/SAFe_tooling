FEATURE_BASE = {
    "name": "Auth Service",
    "user_business_value": 8,
    "time_criticality": 5,
    "risk_reduction_opportunity_enablement": 3,
    "job_size": 4,
}


def _setup(client):
    team_id = client.post("/team", json={"name": "Alpha", "member_count": 6}).json()["id"]
    feature_id = client.post("/features", json=FEATURE_BASE).json()["id"]
    return feature_id, team_id


def _create_story(client, feature_id, team_id, **overrides):
    return client.post(
        "/stories",
        json={
            "name": "Login flow",
            "feature_id": feature_id,
            "team_id": team_id,
            "points": 3,
            **overrides,
        },
    )


class TestStoryCreate:
    def test_returns_201(self, client):
        fid, tid = _setup(client)
        r = _create_story(client, fid, tid)
        assert r.status_code == 201
        body = r.json()
        assert body["name"] == "Login flow"
        assert body["status"] == "not_started"
        assert body["points"] == 3

    def test_unknown_feature_returns_404(self, client):
        _, tid = _setup(client)
        r = _create_story(client, "no-feature", tid)
        assert r.status_code == 404

    def test_unknown_team_returns_404(self, client):
        fid, _ = _setup(client)
        r = _create_story(client, fid, "no-team")
        assert r.status_code == 404

    def test_zero_points_returns_422(self, client):
        fid, tid = _setup(client)
        r = _create_story(client, fid, tid, points=0)
        assert r.status_code == 422

    def test_missing_required_fields_returns_422(self, client):
        r = client.post("/stories", json={"name": "X"})
        assert r.status_code == 422


class TestStoryList:
    def test_list_empty(self, client):
        assert client.get("/stories").json() == []

    def test_filter_by_feature_id(self, client):
        fid1, tid = _setup(client)
        fid2 = client.post("/features", json=FEATURE_BASE).json()["id"]
        _create_story(client, fid1, tid, name="S1")
        _create_story(client, fid1, tid, name="S2")
        _create_story(client, fid2, tid, name="S3")
        stories = client.get(f"/stories?feature_id={fid1}").json()
        assert len(stories) == 2
        assert all(s["feature_id"] == fid1 for s in stories)

    def test_list_all_without_filter(self, client):
        fid, tid = _setup(client)
        _create_story(client, fid, tid, name="S1")
        _create_story(client, fid, tid, name="S2")
        assert len(client.get("/stories").json()) == 2

    def test_filter_by_team_id(self, client):
        fid, tid1 = _setup(client)
        tid2 = client.post("/team", json={"name": "Beta", "member_count": 4}).json()["id"]
        _create_story(client, fid, tid1, name="S1")
        _create_story(client, fid, tid2, name="S2")
        stories = client.get(f"/stories?team_id={tid1}").json()
        assert len(stories) == 1
        assert stories[0]["team_id"] == tid1

    def test_filter_by_status(self, client):
        fid, tid = _setup(client)
        sid1 = _create_story(client, fid, tid, name="S1").json()["id"]
        _create_story(client, fid, tid, name="S2")
        client.patch(f"/stories/{sid1}", json={"status": "done"})
        done = client.get("/stories?status=done").json()
        assert len(done) == 1
        assert done[0]["id"] == sid1

    def test_filter_by_iteration_id(self, client):
        fid, tid = _setup(client)
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
        iter_id = client.post(
            "/iterations",
            json={
                "pi_id": pi_id,
                "number": 1,
                "start_date": "2026-01-05",
                "end_date": "2026-01-16",
            },
        ).json()["id"]
        sid1 = _create_story(client, fid, tid, name="S1").json()["id"]
        _create_story(client, fid, tid, name="S2")
        client.patch(f"/stories/{sid1}", json={"iteration_id": iter_id})
        stories = client.get(f"/stories?iteration_id={iter_id}").json()
        assert len(stories) == 1
        assert stories[0]["id"] == sid1


class TestStoryGet:
    def test_returns_story(self, client):
        fid, tid = _setup(client)
        sid = _create_story(client, fid, tid).json()["id"]
        r = client.get(f"/stories/{sid}")
        assert r.status_code == 200
        assert r.json()["id"] == sid

    def test_unknown_returns_404(self, client):
        assert client.get("/stories/no-such-id").status_code == 404


class TestStoryPatch:
    def test_patch_status(self, client):
        fid, tid = _setup(client)
        sid = _create_story(client, fid, tid).json()["id"]
        r = client.patch(f"/stories/{sid}", json={"status": "in_progress"})
        assert r.status_code == 200
        assert r.json()["status"] == "in_progress"

    def test_patch_points(self, client):
        fid, tid = _setup(client)
        sid = _create_story(client, fid, tid).json()["id"]
        r = client.patch(f"/stories/{sid}", json={"points": 8})
        assert r.status_code == 200
        assert r.json()["points"] == 8

    def test_patch_does_not_change_feature_or_team(self, client):
        fid, tid = _setup(client)
        sid = _create_story(client, fid, tid).json()["id"]
        r = client.patch(f"/stories/{sid}", json={"name": "Renamed"})
        body = r.json()
        assert body["feature_id"] == fid
        assert body["team_id"] == tid

    def test_patch_iteration_id_invalid_returns_404(self, client):
        fid, tid = _setup(client)
        sid = _create_story(client, fid, tid).json()["id"]
        r = client.patch(f"/stories/{sid}", json={"iteration_id": "nonexistent-iter"})
        assert r.status_code == 404

    def test_patch_iteration_id_valid_accepted(self, client):
        fid, tid = _setup(client)
        sid = _create_story(client, fid, tid).json()["id"]
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
        iter_id = client.post(
            "/iterations",
            json={
                "pi_id": pi_id,
                "number": 1,
                "start_date": "2026-01-05",
                "end_date": "2026-01-16",
            },
        ).json()["id"]
        r = client.patch(f"/stories/{sid}", json={"iteration_id": iter_id})
        assert r.status_code == 200
        assert r.json()["iteration_id"] == iter_id

    def test_patch_zero_points_returns_422(self, client):
        fid, tid = _setup(client)
        sid = _create_story(client, fid, tid).json()["id"]
        r = client.patch(f"/stories/{sid}", json={"points": 0})
        assert r.status_code == 422

    def test_patch_nonexistent_feature_id_returns_404(self, client):
        fid, tid = _setup(client)
        sid = _create_story(client, fid, tid).json()["id"]
        r = client.patch(f"/stories/{sid}", json={"feature_id": "no-such-feature"})
        assert r.status_code == 404

    def test_patch_team_id_valid_accepted(self, client):
        fid, tid = _setup(client)
        sid = _create_story(client, fid, tid).json()["id"]
        tid2 = client.post("/team", json={"name": "Beta", "member_count": 4}).json()["id"]
        r = client.patch(f"/stories/{sid}", json={"team_id": tid2})
        assert r.status_code == 200
        assert r.json()["team_id"] == tid2

    def test_patch_nonexistent_team_id_returns_404(self, client):
        fid, tid = _setup(client)
        sid = _create_story(client, fid, tid).json()["id"]
        r = client.patch(f"/stories/{sid}", json={"team_id": "no-such-team"})
        assert r.status_code == 404

    def test_unknown_returns_404(self, client):
        assert client.patch("/stories/no-such-id", json={"points": 5}).status_code == 404


class TestStoryDelete:
    def test_delete_returns_204(self, client):
        fid, tid = _setup(client)
        sid = _create_story(client, fid, tid).json()["id"]
        assert client.delete(f"/stories/{sid}").status_code == 204
        assert client.get(f"/stories/{sid}").status_code == 404

    def test_unknown_returns_404(self, client):
        assert client.delete("/stories/no-such-id").status_code == 404
