from datetime import date
from enum import StrEnum

from pydantic import Field, model_validator

from safe.models.base import SAFeBaseModel, ShortText


class PIStatus(StrEnum):
    PLANNING = "planning"
    ACTIVE = "active"
    CLOSED = "closed"


class Iteration(SAFeBaseModel):
    pi_id: str
    number: int = Field(ge=1)
    name: ShortText = ""
    start_date: date
    end_date: date
    is_ip: bool = False

    @model_validator(mode="after")
    def default_name(self) -> "Iteration":
        if not self.name:
            self.name = "IP Iteration" if self.is_ip else f"Iteration {self.number}"
        return self


class PI(SAFeBaseModel):
    name: ShortText
    art_id: str
    start_date: date
    end_date: date
    iteration_ids: list[str] = Field(default_factory=list)
    status: PIStatus = PIStatus.PLANNING
