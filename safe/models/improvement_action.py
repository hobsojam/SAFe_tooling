from enum import StrEnum

from safe.models.base import LongText, SAFeBaseModel, ShortText


class ImprovementActionStatus(StrEnum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    DONE = "done"


class ImprovementAction(SAFeBaseModel):
    pi_id: str
    problem_statement: LongText
    root_cause: LongText = ""
    action: LongText
    owner: ShortText = ""
    status: ImprovementActionStatus = ImprovementActionStatus.OPEN
