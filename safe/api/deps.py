import os
import threading
from collections.abc import Generator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

from fastapi import Depends
from tinydb import TinyDB

from safe.store.repos import Repos

_DEFAULT_DB_PATH = Path.home() / ".safe_tooling" / "db.json"
_DEV_SESSION_FILE = ".dev_session"

_db: TinyDB | None = None
_db_path: Path | None = None
_db_lock = threading.Lock()


def _dev_session_file(db_path: Path) -> Path:
    return db_path.parent / _DEV_SESSION_FILE


def _is_hot_reload(db_path: Path) -> bool:
    """True when this startup is a hot-reload of the same uvicorn session.

    uvicorn --reload keeps the supervisor (parent) process alive across
    hot reloads while only restarting the worker. Comparing os.getppid()
    against the value written on the previous startup lets us distinguish
    a hot reload (same parent PID) from a fresh server start (new PID).
    """
    session_file = _dev_session_file(db_path)
    if session_file.exists():
        return session_file.read_text().strip() == str(os.getppid())
    return False


def _write_dev_session(db_path: Path) -> None:
    _dev_session_file(db_path).write_text(str(os.getppid()))


@asynccontextmanager
async def lifespan(app):
    global _db, _db_path
    path = Path(os.environ.get("SAFE_DB_PATH", str(_DEFAULT_DB_PATH)))
    path.parent.mkdir(parents=True, exist_ok=True)
    _db_path = path
    _db = TinyDB(path)
    if os.environ.get("SAFE_SEED_DEV") == "1":
        from safe.dev_seed import seed

        if not _is_hot_reload(path):
            # Fresh server start: wipe the dev DB so data never persists across
            # restarts. Safe here because SAFE_SEED_DEV=1 only applies to the
            # dev database, never to the real user database.
            try:
                for table_name in _db.tables():
                    _db.table(table_name).truncate()
            except ValueError:
                # DB file is corrupt (e.g. JSONDecodeError) — close, delete,
                # and reopen. We were about to wipe it anyway.
                _db.close()
                path.unlink(missing_ok=True)
                _db = TinyDB(path)
            _write_dev_session(path)

        seed(Repos(_db))
    elif os.environ.get("SAFE_DEMO_SEED") == "1":
        from safe.dev_seed import seed

        if os.environ.get("SAFE_DEMO_RESET_ON_START") == "1":
            for table_name in _db.tables():
                _db.table(table_name).truncate()
        seed(Repos(_db))
    yield
    if _db is not None:
        _db.close()
        _db = None


def get_repos_dep() -> Generator[Repos, None, None]:
    # TinyDB is not thread-safe. Hold _db_lock for the duration of each request
    # so concurrent FastAPI worker threads never touch the JSON file simultaneously.
    # The None-check and Repos construction must both happen inside the lock so
    # that lifespan() cannot set _db = None between the check and the lock
    # acquisition (TOCTOU race during graceful shutdown).
    with _db_lock:
        if _db is None:
            raise RuntimeError("Database not initialised — lifespan not running")
        yield Repos(_db)


ReposDep = Annotated[Repos, Depends(get_repos_dep)]


def reload_db() -> None:
    global _db
    if _db_path is None:
        raise RuntimeError("Database path not initialised")
    with _db_lock:
        if _db is not None:
            _db.close()
        _db = TinyDB(_db_path)
