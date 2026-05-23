from enum import StrEnum

from safe.models.base import SAFeBaseModel


class ImprovementActionStatus(StrEnum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    DONE = "done"


class ImprovementAction(SAFeBaseModel):
    pi_id: str
    problem_statement: str
    root_cause: str = ""
    action: str
    owner: str = ""
    status: ImprovementActionStatus = ImprovementActionStatus.OPEN
