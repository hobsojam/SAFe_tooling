from pydantic import Field, computed_field

from safe.models.base import LongText, SAFeBaseModel


class PIObjective(SAFeBaseModel):
    description: LongText
    team_id: str
    pi_id: str
    planned_business_value: int = Field(ge=1, le=10)
    actual_business_value: int | None = None
    is_stretch: bool = False
    feature_ids: list[str] = Field(default_factory=list)

    @computed_field
    @property
    def is_committed(self) -> bool:
        return not self.is_stretch
