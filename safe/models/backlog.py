from enum import StrEnum

from pydantic import Field, computed_field, field_validator

from safe.models.base import LongText, SAFeBaseModel, ShortText


class FeatureStatus(StrEnum):
    FUNNEL = "funnel"
    ANALYZING = "analyzing"
    BACKLOG = "backlog"
    IMPLEMENTING = "implementing"
    DONE = "done"


class Feature(SAFeBaseModel):
    name: ShortText
    description: LongText = ""
    pi_id: str | None = None
    team_id: str | None = None
    iteration_id: str | None = None
    status: FeatureStatus = FeatureStatus.BACKLOG
    acceptance_criteria: LongText = ""
    nfr: LongText = ""
    dependency_ids: list[str] = Field(default_factory=list)
    user_business_value: int = Field(ge=1, le=10)
    time_criticality: int = Field(ge=1, le=10)
    risk_reduction_opportunity_enablement: int = Field(ge=1, le=10)
    job_size: int = Field(ge=1, le=13)

    @computed_field
    @property
    def cost_of_delay(self) -> int:
        return (
            self.user_business_value
            + self.time_criticality
            + self.risk_reduction_opportunity_enablement
        )

    @computed_field
    @property
    def wsjf_score(self) -> float:
        return round(self.cost_of_delay / self.job_size, 2)


class StoryStatus(StrEnum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    ACCEPTED = "accepted"


class Story(SAFeBaseModel):
    name: ShortText
    description: LongText = ""
    feature_id: str
    team_id: str
    iteration_id: str | None = None
    points: int = Field(ge=1)
    status: StoryStatus = StoryStatus.NOT_STARTED
    acceptance_criteria: LongText = ""

    @field_validator("points", mode="before")
    @classmethod
    def validate_points(cls, v):
        if isinstance(v, int) and not isinstance(v, bool) and v < 1:
            raise ValueError(f"story points must be at least 1 (got {v})")
        return v
