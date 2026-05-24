from datetime import date
from enum import StrEnum

from pydantic import Field

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
