import re
from typing import Annotated
from uuid import uuid4

from pydantic import BaseModel, Field, StringConstraints
from pydantic.functional_validators import BeforeValidator

_TAG_RE = re.compile(r"<[^>]*>")


def _strip_tags(v: object) -> object:
    if isinstance(v, str):
        return _TAG_RE.sub("", v)
    return v


# Sanitised string types — strip HTML/script tags before validation.
# Use ShortText for single-line fields (names, owners); LongText for
# descriptions, notes, and acceptance criteria.
SanitisedStr = Annotated[str, BeforeValidator(_strip_tags)]
ShortText = Annotated[str, BeforeValidator(_strip_tags), StringConstraints(max_length=200)]
LongText = Annotated[str, BeforeValidator(_strip_tags), StringConstraints(max_length=2000)]


class SAFeBaseModel(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
