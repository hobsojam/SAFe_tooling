from fastapi import APIRouter

from safe.api.deps import reload_db

router = APIRouter(prefix="/dev", tags=["dev"])


@router.post("/reset-db", status_code=204)
def reset_db() -> None:
    """Reload TinyDB so e2e tests see the freshly copied fixture data."""
    reload_db()
