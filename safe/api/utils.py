from typing import TypeVar

from fastapi import HTTPException

from safe.models.base import SAFeBaseModel
from safe.store.repository import Repository

T = TypeVar("T", bound=SAFeBaseModel)


def get_or_404(repo: "Repository[T]", entity_id: str, label: str) -> T:
    entity = repo.get(entity_id)
    if entity is None:
        raise HTTPException(status_code=404, detail=f"{label} '{entity_id}' not found")
    return entity
