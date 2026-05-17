from typing import Generic, TypeVar

from tinydb import Query, TinyDB

from safe.models.base import SAFeBaseModel

T = TypeVar("T", bound=SAFeBaseModel)

# Module-level singleton avoids rebuilding Query() on every method call — TinyDB
# Query objects are stateless field-accessor proxies, so sharing one is safe.
_Q = Query()


class ReferentialIntegrityError(Exception):
    pass


class Repository(Generic[T]):
    def __init__(self, db: TinyDB, table_name: str, model: type[T]) -> None:
        self._table = db.table(table_name)
        self._model = model

    def save(self, entity: T) -> T:
        # Derive exclusions from Pydantic metadata rather than a hardcoded set so
        # new computed fields on any model are automatically excluded without a
        # corresponding update here.
        exclude = set(entity.__class__.model_computed_fields.keys())
        data = entity.model_dump(mode="json", exclude=exclude)
        self._table.upsert(data, _Q.id == entity.id)
        return entity

    def get(self, entity_id: str) -> T | None:
        result = self._table.get(_Q.id == entity_id)
        return self._model.model_validate(result) if result else None

    def get_all(self) -> list[T]:
        return [self._model.model_validate(r) for r in self._table.all()]

    def find(self, **kwargs) -> list[T]:
        if not kwargs:
            raise ValueError(
                "find() requires at least one filter — use get_all() for unrestricted access"
            )
        valid_fields = self._model.model_fields.keys()
        for k in kwargs:
            if k not in valid_fields:
                raise ValueError(f"Unknown field: {k!r}")
        cond = None
        for k, v in kwargs.items():
            clause = getattr(_Q, k) == v
            cond = clause if cond is None else (cond & clause)
        if cond is None:  # pragma: no cover — loop always runs (kwargs non-empty guard above)
            raise RuntimeError("find() built no query condition despite non-empty kwargs")
        return [self._model.model_validate(r) for r in self._table.search(cond)]

    def delete(self, entity_id: str) -> bool:
        return len(self._table.remove(_Q.id == entity_id)) > 0

    def count(self) -> int:
        return len(self._table)
