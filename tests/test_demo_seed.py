"""Tests for SAFE_DEMO_SEED / SAFE_DEMO_RESET_ON_START startup seeding."""

import pytest
from fastapi.testclient import TestClient
from tinydb import TinyDB

import safe.api.deps as deps_module
from safe.models.art import ART
from safe.store.repos import Repos


@pytest.fixture(autouse=True)
def _reset_deps(monkeypatch):
    monkeypatch.setattr(deps_module, "_db", None)
    monkeypatch.setattr(deps_module, "_db_path", None)
    monkeypatch.delenv("SAFE_SEED_DEV", raising=False)
    monkeypatch.delenv("SAFE_DEMO_SEED", raising=False)
    monkeypatch.delenv("SAFE_DEMO_RESET_ON_START", raising=False)


def _client(tmp_path, monkeypatch, **env):
    monkeypatch.setenv("SAFE_DB_PATH", str(tmp_path / "db.json"))
    for key, val in env.items():
        monkeypatch.setenv(key, val)
    from safe.api.main import create_app

    return TestClient(create_app())


def test_demo_seed_populates_empty_db(tmp_path, monkeypatch):
    with _client(tmp_path, monkeypatch, SAFE_DEMO_SEED="1") as client:
        arts = client.get("/art").json()

    assert len(arts) == 1
    assert arts[0]["name"] == "Platform ART"


def test_demo_seed_skips_if_data_already_exists(tmp_path, monkeypatch):
    db_path = tmp_path / "db.json"
    pre_db = TinyDB(db_path)
    Repos(pre_db).arts.save(ART(name="Pre-existing ART"))
    pre_db.close()

    with _client(tmp_path, monkeypatch, SAFE_DEMO_SEED="1") as client:
        arts = client.get("/art").json()

    assert len(arts) == 1
    assert arts[0]["name"] == "Pre-existing ART"


def test_demo_reset_on_start_wipes_and_reseeds(tmp_path, monkeypatch):
    db_path = tmp_path / "db.json"
    pre_db = TinyDB(db_path)
    Repos(pre_db).arts.save(ART(name="Pre-existing ART"))
    pre_db.close()

    with _client(tmp_path, monkeypatch, SAFE_DEMO_SEED="1", SAFE_DEMO_RESET_ON_START="1") as client:
        arts = client.get("/art").json()

    assert len(arts) == 1
    assert arts[0]["name"] == "Platform ART"


def test_no_seed_without_env_var(tmp_path, monkeypatch):
    with _client(tmp_path, monkeypatch) as client:
        arts = client.get("/art").json()

    assert arts == []


def test_demo_seed_independent_of_safe_seed_dev(tmp_path, monkeypatch):
    # SAFE_SEED_DEV and SAFE_DEMO_SEED are mutually exclusive; SAFE_SEED_DEV takes
    # precedence (elif), so setting only SAFE_DEMO_SEED must not activate dev behaviour.
    with _client(tmp_path, monkeypatch, SAFE_DEMO_SEED="1") as client:
        features = client.get("/features").json()

    assert len(features) == 6  # exactly the seed dataset, no dev-only extras
