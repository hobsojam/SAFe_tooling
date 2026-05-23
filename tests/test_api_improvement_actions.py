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


def _create_action(client, pi_id, **overrides):
    return client.post(
        "/improvement-actions",
        json={
            "pi_id": pi_id,
            "problem_statement": "Deploys take too long",
            "action": "Automate deployment pipeline",
            **overrides,
        },
    )


def test_create_returns_201(client):
    art_id = _create_art(client)
    pi_id = _create_pi(client, art_id)
    r = _create_action(client, pi_id)
    assert r.status_code == 201
    body = r.json()
    assert body["problem_statement"] == "Deploys take too long"
    assert body["status"] == "open"
    assert body["root_cause"] == ""
    assert body["owner"] == ""


def test_create_with_all_fields(client):
    art_id = _create_art(client)
    pi_id = _create_pi(client, art_id)
    r = _create_action(
        client,
        pi_id,
        root_cause="Manual steps in CI",
        owner="Alice",
        status="in_progress",
    )
    assert r.status_code == 201
    body = r.json()
    assert body["root_cause"] == "Manual steps in CI"
    assert body["owner"] == "Alice"
    assert body["status"] == "in_progress"


def test_create_unknown_pi_returns_404(client):
    r = _create_action(client, "no-such-pi")
    assert r.status_code == 404
    assert "PI" in r.json()["detail"]


def test_list_returns_all(client):
    art_id = _create_art(client)
    pi_id = _create_pi(client, art_id)
    _create_action(client, pi_id)
    _create_action(
        client, pi_id, problem_statement="Tests are flaky", action="Stabilise test suite"
    )
    r = client.get("/improvement-actions")
    assert r.status_code == 200
    assert len(r.json()) == 2


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
    _create_action(client, pi1)
    _create_action(client, pi2)
    results = client.get(f"/improvement-actions?pi_id={pi1}").json()
    assert len(results) == 1
    assert results[0]["pi_id"] == pi1


def test_get_by_id(client):
    art_id = _create_art(client)
    pi_id = _create_pi(client, art_id)
    aid = _create_action(client, pi_id).json()["id"]
    r = client.get(f"/improvement-actions/{aid}")
    assert r.status_code == 200
    assert r.json()["id"] == aid


def test_get_unknown_returns_404(client):
    assert client.get("/improvement-actions/no-such-id").status_code == 404


def test_patch_fields(client):
    art_id = _create_art(client)
    pi_id = _create_pi(client, art_id)
    aid = _create_action(client, pi_id).json()["id"]
    r = client.patch(
        f"/improvement-actions/{aid}",
        json={"status": "done", "owner": "Bob"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "done"
    assert body["owner"] == "Bob"
    assert body["problem_statement"] == "Deploys take too long"


def test_patch_unknown_returns_404(client):
    r = client.patch("/improvement-actions/no-such-id", json={"status": "done"})
    assert r.status_code == 404


def test_delete_returns_204(client):
    art_id = _create_art(client)
    pi_id = _create_pi(client, art_id)
    aid = _create_action(client, pi_id).json()["id"]
    assert client.delete(f"/improvement-actions/{aid}").status_code == 204
    assert client.get(f"/improvement-actions/{aid}").status_code == 404


def test_delete_unknown_returns_404(client):
    assert client.delete("/improvement-actions/no-such-id").status_code == 404
