"""HTTP error responses (404, 409, 422) for these routes are documented in docs/openapi.yaml."""

from fastapi import APIRouter, HTTPException, Query

from safe.api.deps import ReposDep
from safe.api.schemas import PIObjectiveCreate, PIObjectiveUpdate
from safe.models.objectives import PIObjective
from safe.store.repos import Repos

router = APIRouter(prefix="/objectives", tags=["Objectives"])


def _get_or_404(repos: Repos, objective_id: str) -> PIObjective:
    obj = repos.objectives.get(objective_id)
    if obj is None:
        raise HTTPException(status_code=404, detail=f"Objective '{objective_id}' not found")
    return obj


@router.get("", response_model=list[PIObjective])
def list_objectives(
    repos: ReposDep,
    pi_id: str | None = Query(default=None),
    team_id: str | None = Query(default=None),
    is_stretch: bool | None = Query(default=None),
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


@router.get("/{objective_id}", response_model=PIObjective)
def get_objective(objective_id: str, repos: ReposDep):
    return _get_or_404(repos, objective_id)


@router.patch("/{objective_id}", response_model=PIObjective)
def update_objective(objective_id: str, body: PIObjectiveUpdate, repos: ReposDep):
    obj = _get_or_404(repos, objective_id)
    updated = obj.model_copy(update=body.model_dump(exclude_unset=True))
    return repos.objectives.save(updated)


@router.delete("/{objective_id}", status_code=204)
def delete_objective(objective_id: str, repos: ReposDep):
    _get_or_404(repos, objective_id)
    repos.objectives.delete(objective_id)
