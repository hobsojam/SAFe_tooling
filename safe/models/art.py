from enum import StrEnum

from pydantic import Field

from safe.models.base import SAFeBaseModel, ShortText


class TeamTopologyType(StrEnum):
    stream_aligned = "stream_aligned"
    enabling = "enabling"
    complicated_subsystem = "complicated_subsystem"
    platform = "platform"


class Team(SAFeBaseModel):
    name: ShortText
    member_count: int = Field(ge=1)
    art_id: str | None = None
    velocity_history: list[int] = Field(default_factory=list)
    topology_type: TeamTopologyType | None = None


class ART(SAFeBaseModel):
    name: ShortText
    team_ids: list[str] = Field(default_factory=list)
