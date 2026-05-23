"""HTTP error responses (404, 422) for these routes are documented in docs/openapi.yaml."""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query

from safe.api.deps import ReposDep
from safe.api.schemas import ImprovementActionCreate, ImprovementActionUpdate
from safe.models.improvement_action import ImprovementAction
from safe.store.repos import Repos

router = APIRouter(prefix="/improvement-actions", tags=["ImprovementActions"])


def _get_or_404(repos: Repos, action_id: str) -> ImprovementAction:
    action = repos.improvement_actions.get(action_id)
    if action is None:
        raise HTTPException(status_code=404, detail=f"ImprovementAction '{action_id}' not found")
    return action


@router.get("", response_model=list[ImprovementAction])
def list_improvement_actions(
    repos: ReposDep,
    pi_id: Annotated[str | None, Query()] = None,
):
    if pi_id is not None:
        return repos.improvement_actions.find(pi_id=pi_id)
    return repos.improvement_actions.get_all()


@router.post(
    "",
    response_model=ImprovementAction,
    status_code=201,
    responses={404: {"description": "Not found"}},
)
def create_improvement_action(body: ImprovementActionCreate, repos: ReposDep):
    if repos.pis.get(body.pi_id) is None:
        raise HTTPException(status_code=404, detail=f"PI '{body.pi_id}' not found")
    action = ImprovementAction(**body.model_dump())
    return repos.improvement_actions.save(action)


@router.get(
    "/{action_id}",
    response_model=ImprovementAction,
    responses={404: {"description": "Not found"}},
)
def get_improvement_action(action_id: str, repos: ReposDep):
    return _get_or_404(repos, action_id)


@router.patch(
    "/{action_id}",
    response_model=ImprovementAction,
    responses={404: {"description": "Not found"}},
)
def update_improvement_action(action_id: str, body: ImprovementActionUpdate, repos: ReposDep):
    action = _get_or_404(repos, action_id)
    updated = action.model_copy(update=body.model_dump(exclude_unset=True))
    return repos.improvement_actions.save(updated)


@router.delete(
    "/{action_id}",
    status_code=204,
    responses={404: {"description": "Not found"}},
)
def delete_improvement_action(action_id: str, repos: ReposDep):
    _get_or_404(repos, action_id)
    repos.improvement_actions.delete(action_id)
