def _create_art(client):
    return client.post("/art", json={"name": "ART"}).json()["id"]


def _create_pi(client, art_id, start="2026-01-05", end="2026-03-27"):
    return client.post(
        "/pi",
        json={
            "name": "PI 1",
            "art_id": art_id,
            "start_date": start,
            "end_date": end,
        },
    ).json()["id"]


def _create_iteration(client, pi_id, number=1, start="2026-01-05", end="2026-01-16"):
    return client.post(
        "/iterations",
        json={
            "pi_id": pi_id,
            "number": number,
            "start_date": start,
            "end_date": end,
        },
    )


class TestIterationCreate:
    def test_returns_201(self, client):
        art_id = _create_art(client)
        pi_id = _create_pi(client, art_id)
        r = _create_iteration(client, pi_id)
        assert r.status_code == 201
        body = r.json()
        assert body["pi_id"] == pi_id
        assert body["number"] == 1
        assert body["is_ip"] is False

    def test_updates_pi_iteration_ids(self, client):
        art_id = _create_art(client)
        pi_id = _create_pi(client, art_id)
        iter_id = _create_iteration(client, pi_id).json()["id"]
        pi = client.get(f"/pi/{pi_id}").json()
        assert iter_id in pi["iteration_ids"]

    def test_unknown_pi_returns_404(self, client):
        r = client.post(
            "/iterations",
            json={
                "pi_id": "no-such-pi",
                "number": 1,
                "start_date": "2026-01-05",
                "end_date": "2026-01-16",
            },
        )
        assert r.status_code == 404

    def test_dates_outside_pi_range_returns_422(self, client):
        art_id = _create_art(client)
        pi_id = _create_pi(client, art_id, start="2026-01-05", end="2026-03-27")
        r = client.post(
            "/iterations",
            json={
                "pi_id": pi_id,
                "number": 1,
                "start_date": "2025-12-01",
                "end_date": "2026-01-16",
            },
        )
        assert r.status_code == 422

    def test_end_date_beyond_pi_returns_422(self, client):
        art_id = _create_art(client)
        pi_id = _create_pi(client, art_id, start="2026-01-05", end="2026-03-27")
        r = client.post(
            "/iterations",
            json={
                "pi_id": pi_id,
                "number": 5,
                "start_date": "2026-03-16",
                "end_date": "2026-04-10",
            },
        )
        assert r.status_code == 422

    def test_ip_iteration_flag(self, client):
        art_id = _create_art(client)
        pi_id = _create_pi(client, art_id)
        r = client.post(
            "/iterations",
            json={
                "pi_id": pi_id,
                "number": 5,
                "start_date": "2026-03-16",
                "end_date": "2026-03-27",
                "is_ip": True,
            },
        )
        assert r.status_code == 201
        assert r.json()["is_ip"] is True

    def test_default_name_from_number(self, client):
        art_id = _create_art(client)
        pi_id = _create_pi(client, art_id)
        r = _create_iteration(client, pi_id, number=2, start="2026-01-19", end="2026-01-30")
        assert r.json()["name"] == "Iteration 2"

    def test_default_name_ip_iteration(self, client):
        art_id = _create_art(client)
        pi_id = _create_pi(client, art_id)
        r = client.post(
            "/iterations",
            json={
                "pi_id": pi_id,
                "number": 5,
                "start_date": "2026-03-16",
                "end_date": "2026-03-27",
                "is_ip": True,
            },
        )
        assert r.json()["name"] == "IP Iteration"

    def test_explicit_name_preserved(self, client):
        art_id = _create_art(client)
        pi_id = _create_pi(client, art_id)
        r = client.post(
            "/iterations",
            json={
                "pi_id": pi_id,
                "number": 1,
                "start_date": "2026-01-05",
                "end_date": "2026-01-16",
                "name": "Sprint Alpha",
            },
        )
        assert r.json()["name"] == "Sprint Alpha"

    def test_dates_equal_pi_boundary_returns_201(self, client):
        art_id = _create_art(client)
        pi_id = _create_pi(client, art_id, start="2026-01-05", end="2026-03-27")
        r = client.post(
            "/iterations",
            json={
                "pi_id": pi_id,
                "number": 1,
                "start_date": "2026-01-05",
                "end_date": "2026-03-27",
            },
        )
        assert r.status_code == 201


class TestIterationList:
    def test_requires_pi_id(self, client):
        r = client.get("/iterations")
        assert r.status_code == 422

    def test_returns_iterations_for_pi(self, client):
        art_id = _create_art(client)
        pi_id = _create_pi(client, art_id)
        _create_iteration(client, pi_id, number=1, start="2026-01-05", end="2026-01-16")
        _create_iteration(client, pi_id, number=2, start="2026-01-19", end="2026-01-30")
        iterations = client.get(f"/iterations?pi_id={pi_id}").json()
        assert len(iterations) == 2

    def test_does_not_return_other_pi_iterations(self, client):
        art_id = _create_art(client)
        pi1 = _create_pi(client, art_id, start="2026-01-05", end="2026-03-27")
        pi2 = _create_pi(client, art_id, start="2026-04-06", end="2026-06-26")
        _create_iteration(client, pi1, number=1, start="2026-01-05", end="2026-01-16")
        _create_iteration(client, pi2, number=1, start="2026-04-06", end="2026-04-17")
        assert len(client.get(f"/iterations?pi_id={pi1}").json()) == 1


class TestIterationGet:
    def test_returns_iteration(self, client):
        art_id = _create_art(client)
        pi_id = _create_pi(client, art_id)
        iter_id = _create_iteration(client, pi_id).json()["id"]
        r = client.get(f"/iterations/{iter_id}")
        assert r.status_code == 200
        assert r.json()["id"] == iter_id

    def test_unknown_returns_404(self, client):
        assert client.get("/iterations/no-such-id").status_code == 404


class TestIterationPatch:
    def test_patch_number(self, client):
        art_id = _create_art(client)
        pi_id = _create_pi(client, art_id)
        iter_id = _create_iteration(client, pi_id).json()["id"]
        r = client.patch(f"/iterations/{iter_id}", json={"number": 3})
        assert r.status_code == 200
        assert r.json()["number"] == 3

    def test_patch_unknown_returns_404(self, client):
        r = client.patch("/iterations/no-such-id", json={"number": 2})
        assert r.status_code == 404


class TestIterationDelete:
    def test_delete_returns_204(self, client):
        art_id = _create_art(client)
        pi_id = _create_pi(client, art_id)
        iter_id = _create_iteration(client, pi_id).json()["id"]
        assert client.delete(f"/iterations/{iter_id}").status_code == 204
        assert client.get(f"/iterations/{iter_id}").status_code == 404

    def test_delete_removes_from_pi_iteration_ids(self, client):
        art_id = _create_art(client)
        pi_id = _create_pi(client, art_id)
        iter_id = _create_iteration(client, pi_id).json()["id"]
        client.delete(f"/iterations/{iter_id}")
        pi = client.get(f"/pi/{pi_id}").json()
        assert iter_id not in pi["iteration_ids"]

    def test_delete_cascades_capacity_plans(self, client):
        art_id = _create_art(client)
        pi_id = _create_pi(client, art_id)
        iter_id = _create_iteration(client, pi_id).json()["id"]
        team_id = client.post("/team", json={"name": "Alpha", "member_count": 6}).json()["id"]
        plan_id = client.post(
            "/capacity-plans",
            json={
                "iteration_id": iter_id,
                "team_id": team_id,
                "pi_id": pi_id,
                "team_size": 6,
            },
        ).json()["id"]
        client.delete(f"/iterations/{iter_id}")
        assert client.get(f"/capacity-plans/{plan_id}").status_code == 404

    def test_unknown_returns_404(self, client):
        assert client.delete("/iterations/no-such-id").status_code == 404
