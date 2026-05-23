from tinydb import TinyDB

from safe.models.art import ART, Team
from safe.models.backlog import Feature, Story
from safe.models.capacity_plan import CapacityPlan
from safe.models.dependency import Dependency
from safe.models.improvement_action import ImprovementAction
from safe.models.objectives import PIObjective
from safe.models.pi import PI, Iteration
from safe.models.risk import Risk
from safe.store.db import get_db
from safe.store.repository import Repository


class Repos:
    def __init__(self, db: TinyDB) -> None:
        self.arts = Repository(db, "arts", ART)
        self.teams = Repository(db, "teams", Team)
        self.pis = Repository(db, "pis", PI)
        self.iterations = Repository(db, "iterations", Iteration)
        self.features = Repository(db, "features", Feature)
        self.stories = Repository(db, "stories", Story)
        self.objectives = Repository(db, "objectives", PIObjective)
        self.risks = Repository(db, "risks", Risk)
        self.dependencies = Repository(db, "dependencies", Dependency)
        self.capacity_plans = Repository(db, "capacity_plans", CapacityPlan)
        self.improvement_actions = Repository(db, "improvement_actions", ImprovementAction)


def get_repos(db: TinyDB | None = None) -> Repos:
    # TinyDB defines __len__, so an empty database is falsy — use identity check.
    return Repos(db if db is not None else get_db())
