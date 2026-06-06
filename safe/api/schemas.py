from datetime import date

from pydantic import BaseModel, Field

from safe.models.art import TeamTopologyType
from safe.models.backlog import FeatureStatus, StoryStatus
from safe.models.base import LongText, ShortText
from safe.models.dependency import DependencyStatus
from safe.models.improvement_action import ImprovementActionStatus
from safe.models.risk import ROAMStatus

# --- ART ---


class ARTCreate(BaseModel):
    name: ShortText


class ARTUpdate(BaseModel):
    name: ShortText | None = None


# --- Team ---


class TeamCreate(BaseModel):
    name: ShortText
    member_count: int = Field(ge=1)
    art_id: str | None = None
    velocity_history: list[int] = []
    topology_type: TeamTopologyType | None = None


class TeamUpdate(BaseModel):
    name: ShortText | None = None
    member_count: int | None = Field(default=None, ge=1)
    art_id: str | None = None
    velocity_history: list[int] | None = None
    topology_type: TeamTopologyType | None = None


# --- PI ---


class PICreate(BaseModel):
    name: ShortText
    art_id: str
    start_date: date
    end_date: date


class PIUpdate(BaseModel):
    name: ShortText | None = None
    start_date: date | None = None
    end_date: date | None = None


# --- Iteration ---


class IterationCreate(BaseModel):
    pi_id: str
    number: int = Field(ge=1)
    name: ShortText = ""
    start_date: date
    end_date: date
    is_ip: bool = False


class IterationUpdate(BaseModel):
    number: int | None = Field(default=None, ge=1)
    name: ShortText | None = None
    start_date: date | None = None
    end_date: date | None = None
    is_ip: bool | None = None


# --- Feature ---


class FeatureCreate(BaseModel):
    name: ShortText
    description: LongText = ""
    pi_id: str | None = None
    team_id: str | None = None
    iteration_id: str | None = None
    status: FeatureStatus = FeatureStatus.BACKLOG
    acceptance_criteria: LongText = ""
    nfr: LongText = ""
    user_business_value: int = Field(ge=1, le=10)
    time_criticality: int = Field(ge=1, le=10)
    risk_reduction_opportunity_enablement: int = Field(ge=1, le=10)
    job_size: int = Field(ge=1, le=13)


class FeatureUpdate(BaseModel):
    name: ShortText | None = None
    description: LongText | None = None
    pi_id: str | None = None
    team_id: str | None = None
    iteration_id: str | None = None
    status: FeatureStatus | None = None
    acceptance_criteria: LongText | None = None
    nfr: LongText | None = None
    user_business_value: int | None = Field(default=None, ge=1, le=10)
    time_criticality: int | None = Field(default=None, ge=1, le=10)
    risk_reduction_opportunity_enablement: int | None = Field(default=None, ge=1, le=10)
    job_size: int | None = Field(default=None, ge=1, le=13)


class FeatureAssign(BaseModel):
    team_id: str


# --- Story ---


class StoryCreate(BaseModel):
    name: ShortText
    description: LongText = ""
    feature_id: str
    team_id: str
    iteration_id: str | None = None
    points: int = Field(ge=1)
    status: StoryStatus = StoryStatus.NOT_STARTED
    acceptance_criteria: LongText = ""


class StoryUpdate(BaseModel):
    name: ShortText | None = None
    description: LongText | None = None
    feature_id: str | None = None
    team_id: str | None = None
    iteration_id: str | None = None
    points: int | None = Field(default=None, ge=1)
    status: StoryStatus | None = None
    acceptance_criteria: LongText | None = None


# --- PIObjective ---


class PIObjectiveCreate(BaseModel):
    description: LongText
    team_id: str
    pi_id: str
    planned_business_value: int = Field(ge=1, le=10)
    actual_business_value: int | None = None
    is_stretch: bool = False
    feature_ids: list[str] = []


class PIObjectiveUpdate(BaseModel):
    description: LongText | None = None
    planned_business_value: int | None = Field(default=None, ge=1, le=10)
    actual_business_value: int | None = None
    is_stretch: bool | None = None
    feature_ids: list[str] | None = None


# --- Risk ---


class RiskCreate(BaseModel):
    description: LongText
    pi_id: str
    team_id: str | None = None
    feature_id: str | None = None
    roam_status: ROAMStatus = ROAMStatus.UNROAMED
    owner: ShortText | None = None
    mitigation_notes: LongText = ""


class RiskUpdate(BaseModel):
    description: LongText | None = None
    team_id: str | None = None
    feature_id: str | None = None
    roam_status: ROAMStatus | None = None
    owner: ShortText | None = None
    mitigation_notes: LongText | None = None


class RiskROAM(BaseModel):
    roam_status: ROAMStatus
    owner: ShortText | None = None
    mitigation_notes: LongText | None = None


# --- Dependency ---


class DependencyCreate(BaseModel):
    description: LongText
    pi_id: str
    from_feature_id: str
    to_feature_id: str
    status: DependencyStatus = DependencyStatus.IDENTIFIED
    owner: ShortText | None = None
    resolution_notes: LongText = ""
    needed_by_date: date | None = None


class DependencyUpdate(BaseModel):
    description: LongText | None = None
    status: DependencyStatus | None = None
    owner: ShortText | None = None
    resolution_notes: LongText | None = None
    needed_by_date: date | None = None


class DependencyStatusUpdate(BaseModel):
    status: DependencyStatus
    owner: ShortText | None = None
    resolution_notes: LongText | None = None


# --- CapacityPlan ---


class CapacityPlanCreate(BaseModel):
    team_id: str
    iteration_id: str
    pi_id: str
    team_size: int = Field(ge=1)
    iteration_days: int = Field(ge=1, default=10)
    pto_days: float = Field(ge=0.0, default=0.0)
    overhead_pct: float = Field(ge=0.0, le=1.0, default=0.2)


class CapacityPlanUpdate(BaseModel):
    team_size: int | None = Field(default=None, ge=1)
    iteration_days: int | None = Field(default=None, ge=1)
    pto_days: float | None = Field(default=None, ge=0.0)
    overhead_pct: float | None = Field(default=None, ge=0.0, le=1.0)


class CapacityPlanSeed(BaseModel):
    pi_id: str


class VelocityEntry(BaseModel):
    team_id: str
    iteration_id: str
    pi_id: str
    completed_points: int
    available_capacity: float | None = None


# --- ImprovementAction ---


class ImprovementActionCreate(BaseModel):
    pi_id: str
    problem_statement: LongText
    root_cause: LongText = ""
    action: LongText
    owner: ShortText = ""
    status: ImprovementActionStatus = ImprovementActionStatus.OPEN


class ImprovementActionUpdate(BaseModel):
    problem_statement: LongText | None = None
    root_cause: LongText | None = None
    action: LongText | None = None
    owner: ShortText | None = None
    status: ImprovementActionStatus | None = None


# --- Compute ---


class PredictabilityTeamInput(BaseModel):
    planned_business_value: int = Field(ge=0)
    actual_business_value: int = Field(ge=0)


class PredictabilityRequest(BaseModel):
    teams: list[PredictabilityTeamInput] = Field(min_length=1)


class PredictabilityResponse(BaseModel):
    score_pct: float | None
    rating: str
