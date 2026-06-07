"""HTTP error responses (404, 409, 422) for these routes are documented in docs/openapi.yaml."""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query

from safe.api.deps import ReposDep
from safe.api.schemas import PIObjectiveCreate, PIObjectiveUpdate
from safe.api.utils import get_or_404
from safe.models.objectives import PIObjective

router = APIRouter(prefix="/objectives", tags=["Objectives"])


@router.get("", response_model=list[PIObjective])
def list_objectives(
    repos: ReposDep,
    pi_id: Annotated[str | None, Query()] = None,
    team_id: Annotated[str | None, Query()] = None,
    is_stretch: Annotated[bool | None, Query()] = None,
):
    filters = {
        k: v
        for k, v in {"pi_id": pi_id, "team_id": team_id, "is_stretch": is_stretch}.items()
        if v is not None
    }
    return repos.objectives.find(**filters) if filters else repos.objectives.get_all()


@router.post(
    "",
    response_model=PIObjective,
    status_code=201,
    responses={404: {"description": "Not found"}},
)
def create_objective(body: PIObjectiveCreate, repos: ReposDep):
    if repos.pis.get(body.pi_id) is None:
        raise HTTPException(status_code=404, detail=f"PI '{body.pi_id}' not found")
    if repos.teams.get(body.team_id) is None:
        raise HTTPException(status_code=404, detail=f"Team '{body.team_id}' not found")
    obj = PIObjective(**body.model_dump())
    return repos.objectives.save(obj)


@router.get(
    "/{objective_id}",
    response_model=PIObjective,
    responses={404: {"description": "Not found"}},
)
def get_objective(objective_id: str, repos: ReposDep):
    return get_or_404(repos.objectives, objective_id, "Objective")


@router.patch(
    "/{objective_id}",
    response_model=PIObjective,
    responses={404: {"description": "Not found"}},
)
def update_objective(objective_id: str, body: PIObjectiveUpdate, repos: ReposDep):
    obj = get_or_404(repos.objectives, objective_id, "Objective")
    updated = obj.model_copy(update=body.model_dump(exclude_unset=True))
    return repos.objectives.save(updated)


@router.delete("/{objective_id}", status_code=204, responses={404: {"description": "Not found"}})
def delete_objective(objective_id: str, repos: ReposDep):
    get_or_404(repos.objectives, objective_id, "Objective")
    repos.objectives.delete(objective_id)
