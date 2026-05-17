from pathlib import Path

from tinydb import TinyDB

_DB_PATH = Path.home() / ".safe_tooling" / "db.json"
_instance: TinyDB | None = None
_instance_path: Path | None = None


def get_db(path: Path | None = None) -> TinyDB:
    global _instance, _instance_path
    if path is not None:
        resolved = Path(path).resolve()
        if _instance is not None:
            if _instance_path != resolved:
                raise RuntimeError(
                    f"DB already open with a different path: "
                    f"{_instance_path!r} (requested {resolved!r})"
                )
            return _instance
        _instance = TinyDB(path)
        _instance_path = resolved
        return _instance
    if _instance is None:
        _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        _instance = TinyDB(_DB_PATH)
        _instance_path = _DB_PATH.resolve()
    return _instance


def close_db() -> None:
    global _instance, _instance_path
    if _instance is not None:
        _instance.close()
        _instance = None
        _instance_path = None
