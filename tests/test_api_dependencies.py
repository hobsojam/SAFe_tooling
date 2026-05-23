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


def _create_features(client, pi_id):
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
    ).json()["id"]
    f2 = client.post(
        "/features",
        json={
            "name": "SSO Integration",
            "pi_id": pi_id,
            "user_business_value": 5,
            "time_criticality": 8,
            "risk_reduction_opportunity_enablement": 2,
            "job_size": 5,
        },
    ).json()["id"]
    return f1, f2


def _create_dep(client, pi_id, f1, f2, **overrides):
    return client.post(
        "/dependencies",
        json={
            "description": "Needs auth API",
            "pi_id": pi_id,
            "from_feature_id": f1,
            "to_feature_id": f2,
            **overrides,
        },
    )


def test_create_returns_201(client):
    art_id = _create_art(client)
    pi_id = _create_pi(client, art_id)
    f1, f2 = _create_features(client, pi_id)
    r = _create_dep(client, pi_id, f1, f2)
    assert r.status_code == 201
    assert r.json()["status"] == "identified"


def test_create_stores_feature_ids(client):
    art_id = _create_art(client)
    pi_id = _create_pi(client, art_id)
    f1, f2 = _create_features(client, pi_id)
    body = _create_dep(client, pi_id, f1, f2).json()
    assert body["from_feature_id"] == f1
    assert body["to_feature_id"] == f2


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
    f1, f2 = _create_features(client, pi1)
    f3, f4 = _create_features(client, pi2)
    _create_dep(client, pi1, f1, f2)
    _create_dep(client, pi2, f3, f4)
    deps = client.get(f"/dependencies?pi_id={pi1}").json()
    assert len(deps) == 1


def test_roam_sets_status(client):
    art_id = _create_art(client)
    pi_id = _create_pi(client, art_id)
    f1, f2 = _create_features(client, pi_id)
    did = _create_dep(client, pi_id, f1, f2).json()["id"]
    r = client.post(
        f"/dependencies/{did}/roam",
        json={"status": "resolved", "resolution_notes": "Done"},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "resolved"


def test_roam_unknown_returns_404(client):
    r = client.post("/dependencies/no-such-id/roam", json={"status": "resolved"})
    assert r.status_code == 404


def test_create_unknown_from_feature_returns_404(client):
    art_id = _create_art(client)
    pi_id = _create_pi(client, art_id)
    _, f2 = _create_features(client, pi_id)
    r = _create_dep(client, pi_id, "no-such-feature", f2)
    assert r.status_code == 404
    assert "Feature" in r.json()["detail"]


def test_create_unknown_to_feature_returns_404(client):
    art_id = _create_art(client)
    pi_id = _create_pi(client, art_id)
    f1, _ = _create_features(client, pi_id)
    r = _create_dep(client, pi_id, f1, "no-such-feature")
    assert r.status_code == 404
    assert "Feature" in r.json()["detail"]


def test_get_unknown_returns_404(client):
    assert client.get("/dependencies/no-such-id").status_code == 404


def test_patch_description(client):
    art_id = _create_art(client)
    pi_id = _create_pi(client, art_id)
    f1, f2 = _create_features(client, pi_id)
    did = _create_dep(client, pi_id, f1, f2).json()["id"]
    r = client.patch(f"/dependencies/{did}", json={"description": "Updated dep"})
    assert r.status_code == 200
    assert r.json()["description"] == "Updated dep"


def test_patch_unknown_returns_404(client):
    assert client.patch("/dependencies/no-such-id", json={"description": "X"}).status_code == 404


def test_delete_returns_204(client):
    art_id = _create_art(client)
    pi_id = _create_pi(client, art_id)
    f1, f2 = _create_features(client, pi_id)
    did = _create_dep(client, pi_id, f1, f2).json()["id"]
    assert client.delete(f"/dependencies/{did}").status_code == 204
    assert client.get(f"/dependencies/{did}").status_code == 404


def test_delete_unknown_returns_404(client):
    assert client.delete("/dependencies/no-such-id").status_code == 404


def test_list_filter_by_from_feature(client):
    art_id = _create_art(client)
    pi_id = _create_pi(client, art_id)
    f1, f2 = _create_features(client, pi_id)
    _create_dep(client, pi_id, f1, f2)
    _create_dep(client, pi_id, f2, f1)
    deps = client.get(f"/dependencies?from_feature_id={f1}").json()
    assert len(deps) == 1
    assert deps[0]["from_feature_id"] == f1


def test_list_filter_by_to_feature(client):
    art_id = _create_art(client)
    pi_id = _create_pi(client, art_id)
    f1, f2 = _create_features(client, pi_id)
    _create_dep(client, pi_id, f1, f2)
    _create_dep(client, pi_id, f2, f1)
    deps = client.get(f"/dependencies?to_feature_id={f2}").json()
    assert len(deps) == 1
    assert deps[0]["to_feature_id"] == f2


def test_list_filter_by_status(client):
    art_id = _create_art(client)
    pi_id = _create_pi(client, art_id)
    f1, f2 = _create_features(client, pi_id)
    did = _create_dep(client, pi_id, f1, f2).json()["id"]
    _create_dep(client, pi_id, f2, f1)
    client.post(f"/dependencies/{did}/roam", json={"status": "resolved"})
    deps = client.get("/dependencies?status=resolved").json()
    assert len(deps) == 1
    assert deps[0]["status"] == "resolved"
