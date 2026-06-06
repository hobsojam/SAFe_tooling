from html.parser import HTMLParser
from typing import Annotated
from uuid import uuid4

from pydantic import BaseModel, Field, StringConstraints
from pydantic.functional_validators import BeforeValidator


class _TagStripper(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self._parts.append(data)

    def get_text(self) -> str:
        return "".join(self._parts)


def _strip_html(value: str) -> str:
    stripper = _TagStripper()
    stripper.feed(value)
    return stripper.get_text()


def _strip_tags(v: object) -> object:
    if isinstance(v, str):
        return _strip_html(v)
    return v


# Sanitised string types — strip HTML/script tags before validation.
# Use ShortText for single-line fields (names, owners); LongText for
# descriptions, notes, and acceptance criteria.
SanitisedStr = Annotated[str, BeforeValidator(_strip_tags)]
ShortText = Annotated[str, BeforeValidator(_strip_tags), StringConstraints(max_length=200)]
LongText = Annotated[str, BeforeValidator(_strip_tags), StringConstraints(max_length=2000)]


class SAFeBaseModel(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
