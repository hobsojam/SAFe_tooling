from datetime import date
from enum import StrEnum

from pydantic import Field

from safe.models.base import LongText, SAFeBaseModel, ShortText


class ROAMStatus(StrEnum):
    RESOLVED = "resolved"
    OWNED = "owned"
    ACCEPTED = "accepted"
    MITIGATED = "mitigated"
    UNROAMED = "unroamed"


class Risk(SAFeBaseModel):
    description: LongText
    pi_id: str
    team_id: str | None = None
    feature_id: str | None = None
    roam_status: ROAMStatus = ROAMStatus.UNROAMED
    owner: ShortText | None = None
    mitigation_notes: LongText = ""
    raised_date: date = Field(default_factory=date.today)
