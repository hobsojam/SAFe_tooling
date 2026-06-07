from datetime import date
from enum import StrEnum

from pydantic import Field, model_validator

from safe.models.base import LongText, SAFeBaseModel, ShortText


class DependencyStatus(StrEnum):
    IDENTIFIED = "identified"
    ACKNOWLEDGED = "acknowledged"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"


class Dependency(SAFeBaseModel):
    description: LongText
    pi_id: str
    from_feature_id: str
    to_feature_id: str
    status: DependencyStatus = DependencyStatus.IDENTIFIED
    owner: ShortText | None = None
    resolution_notes: LongText = ""
    raised_date: date = Field(default_factory=date.today)
    needed_by_date: date | None = None

    @model_validator(mode="after")
    def from_and_to_must_differ(self) -> "Dependency":
        if self.from_feature_id == self.to_feature_id:
            raise ValueError("from_feature_id and to_feature_id must be different")
        return self
