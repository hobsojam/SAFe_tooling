def _create_art(client):
    return client.post("/art", json={"name": "ART"}).json()["id"]


def _create_pi(client, art_id, name="PI 1", start="2026-01-05", end="2026-03-27"):
    return client.post(
        "/pi",
        json={
            "name": name,
            "art_id": art_id,
            "start_date": start,
            "end_date": end,
        },
    ).json()["id"]


class TestPICreate:
    def test_returns_201(self, client):
        art_id = _create_art(client)
        r = client.post(
            "/pi",
            json={
                "name": "PI 1",
                "art_id": art_id,
                "start_date": "2026-01-05",
                "end_date": "2026-03-27",
            },
        )
        assert r.status_code == 201
        body = r.json()
        assert body["status"] == "planning"
        assert body["iteration_ids"] == []

    def test_unknown_art_returns_404(self, client):
        r = client.post(
            "/pi",
            json={
                "name": "PI 1",
                "art_id": "no-art",
                "start_date": "2026-01-05",
                "end_date": "2026-03-27",
            },
        )
        assert r.status_code == 404

    def test_missing_field_returns_422(self, client):
        r = client.post("/pi", json={"name": "PI 1"})
        assert r.status_code == 422


class TestPIGet:
    def test_get_returns_pi(self, client):
        art_id = _create_art(client)
        pi_id = _create_pi(client, art_id)
        r = client.get(f"/pi/{pi_id}")
        assert r.status_code == 200
        assert r.json()["id"] == pi_id

    def test_unknown_returns_404(self, client):
        assert client.get("/pi/no-such-id").status_code == 404


class TestPIList:
    def test_list_empty(self, client):
        assert client.get("/pi").json() == []

    def test_filter_by_art_id(self, client):
        art1 = _create_art(client)
        art2 = client.post("/art", json={"name": "ART 2"}).json()["id"]
        _create_pi(client, art1, "PI A")
        _create_pi(client, art2, "PI B")
        pis = client.get(f"/pi?art_id={art1}").json()
        assert len(pis) == 1
        assert pis[0]["art_id"] == art1

    def test_filter_by_status(self, client):
        art_id = _create_art(client)
        pi1 = _create_pi(client, art_id, "PI A")
        _create_pi(client, art_id, "PI B")
        client.post(f"/pi/{pi1}/activate")
        active = client.get("/pi?status=active").json()
        assert len(active) == 1
        assert active[0]["id"] == pi1
        planning = client.get("/pi?status=planning").json()
        assert len(planning) == 1


class TestPIPatch:
    def test_patch_name(self, client):
        art_id = _create_art(client)
        pi_id = _create_pi(client, art_id)
        r = client.patch(f"/pi/{pi_id}", json={"name": "Updated"})
        assert r.status_code == 200
        assert r.json()["name"] == "Updated"

    def test_patch_does_not_change_status(self, client):
        art_id = _create_art(client)
        pi_id = _create_pi(client, art_id)
        r = client.patch(f"/pi/{pi_id}", json={"name": "X"})
        assert r.json()["status"] == "planning"

    def test_unknown_returns_404(self, client):
        assert client.patch("/pi/no-such-id", json={"name": "X"}).status_code == 404


class TestPIDelete:
    def test_delete_returns_204(self, client):
        art_id = _create_art(client)
        pi_id = _create_pi(client, art_id)
        assert client.delete(f"/pi/{pi_id}").status_code == 204
        assert client.get(f"/pi/{pi_id}").status_code == 404

    def test_delete_cascades_iterations(self, client):
        art_id = _create_art(client)
        pi_id = _create_pi(client, art_id)
        iter_id = client.post(
            "/iterations",
            json={
                "pi_id": pi_id,
                "number": 1,
                "start_date": "2026-01-05",
                "end_date": "2026-01-16",
            },
        ).json()["id"]
        client.delete(f"/pi/{pi_id}")
        assert client.get(f"/iterations/{iter_id}").status_code == 404

    def test_delete_with_feature_returns_409(self, client):
        art_id = _create_art(client)
        pi_id = _create_pi(client, art_id)
        client.post(
            "/features",
            json={
                "name": "F",
                "pi_id": pi_id,
                "user_business_value": 5,
                "time_criticality": 5,
                "risk_reduction_opportunity_enablement": 5,
                "job_size": 5,
            },
        )
        assert client.delete(f"/pi/{pi_id}").status_code == 409

    def test_delete_with_risk_returns_409(self, client):
        art_id = _create_art(client)
        pi_id = _create_pi(client, art_id)
        team_id = client.post("/team", json={"name": "T", "member_count": 5}).json()["id"]
        client.post("/risks", json={"description": "R", "pi_id": pi_id, "team_id": team_id})
        assert client.delete(f"/pi/{pi_id}").status_code == 409

    def test_delete_with_objective_returns_409(self, client):
        art_id = _create_art(client)
        pi_id = _create_pi(client, art_id)
        team_id = client.post("/team", json={"name": "T", "member_count": 5}).json()["id"]
        client.post(
            "/objectives",
            json={
                "description": "O",
                "pi_id": pi_id,
                "team_id": team_id,
                "planned_business_value": 5,
            },
        )
        assert client.delete(f"/pi/{pi_id}").status_code == 409

    def test_delete_with_dependency_returns_409(self, client):
        art_id = _create_art(client)
        pi_id = _create_pi(client, art_id)
        f1 = client.post(
            "/features",
            json={
                "name": "F1",
                "user_business_value": 5,
                "time_criticality": 5,
                "risk_reduction_opportunity_enablement": 5,
                "job_size": 5,
            },
        ).json()["id"]
        f2 = client.post(
            "/features",
            json={
                "name": "F2",
                "user_business_value": 5,
                "time_criticality": 5,
                "risk_reduction_opportunity_enablement": 5,
                "job_size": 5,
            },
        ).json()["id"]
        client.post(
            "/dependencies",
            json={"description": "D", "pi_id": pi_id, "from_feature_id": f1, "to_feature_id": f2},
        )
        assert client.delete(f"/pi/{pi_id}").status_code == 409

    def test_unknown_returns_404(self, client):
        assert client.delete("/pi/no-such-id").status_code == 404


class TestPIActivate:
    def test_activate_planning_pi(self, client):
        art_id = _create_art(client)
        pi_id = _create_pi(client, art_id)
        r = client.post(f"/pi/{pi_id}/activate")
        assert r.status_code == 200
        assert r.json()["status"] == "active"

    def test_activate_already_active_returns_409(self, client):
        art_id = _create_art(client)
        pi_id = _create_pi(client, art_id)
        client.post(f"/pi/{pi_id}/activate")
        r = client.post(f"/pi/{pi_id}/activate")
        assert r.status_code == 409

    def test_activate_second_pi_when_one_active_returns_409(self, client):
        art_id = _create_art(client)
        pi1 = _create_pi(client, art_id, "PI 1")
        pi2 = _create_pi(client, art_id, "PI 2")
        client.post(f"/pi/{pi1}/activate")
        r = client.post(f"/pi/{pi2}/activate")
        assert r.status_code == 409

    def test_activate_closed_pi_returns_409(self, client):
        art_id = _create_art(client)
        pi_id = _create_pi(client, art_id)
        client.post(f"/pi/{pi_id}/activate")
        client.post(f"/pi/{pi_id}/close")
        r = client.post(f"/pi/{pi_id}/activate")
        assert r.status_code == 409

    def test_activate_unknown_returns_404(self, client):
        assert client.post("/pi/no-such-id/activate").status_code == 404


class TestPIClose:
    def test_close_active_pi(self, client):
        art_id = _create_art(client)
        pi_id = _create_pi(client, art_id)
        client.post(f"/pi/{pi_id}/activate")
        r = client.post(f"/pi/{pi_id}/close")
        assert r.status_code == 200
        assert r.json()["status"] == "closed"

    def test_close_planning_pi_returns_409(self, client):
        art_id = _create_art(client)
        pi_id = _create_pi(client, art_id)
        r = client.post(f"/pi/{pi_id}/close")
        assert r.status_code == 409

    def test_close_unknown_returns_404(self, client):
        assert client.post("/pi/no-such-id/close").status_code == 404
