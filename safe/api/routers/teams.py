"""HTTP error responses (404, 409, 422) for these routes are documented in docs/openapi.yaml."""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query

from safe.api.deps import ReposDep
from safe.api.schemas import TeamCreate, TeamUpdate
from safe.models.art import Team
from safe.store.repos import Repos

router = APIRouter(prefix="/team", tags=["Teams"])


def _get_or_404(repos: Repos, team_id: str) -> Team:
    team = repos.teams.get(team_id)
    if team is None:
        raise HTTPException(status_code=404, detail=f"Team '{team_id}' not found")
    return team


def _reassign_art(
    repos: Repos, team_id: str, old_art_id: str | None, new_art_id: str | None
) -> None:
    if old_art_id is not None:
        old_art = repos.arts.get(old_art_id)
        if old_art is not None:
            repos.arts.save(
                old_art.model_copy(
                    update={"team_ids": [t for t in old_art.team_ids if t != team_id]}
                )
            )
    if new_art_id is not None:
        new_art = repos.arts.get(new_art_id)
        if new_art is not None and team_id not in new_art.team_ids:
            repos.arts.save(new_art.model_copy(update={"team_ids": new_art.team_ids + [team_id]}))


@router.get("", response_model=list[Team])
def list_teams(
    repos: ReposDep,
    art_id: Annotated[str | None, Query()] = None,
):
    if art_id is not None:
        return repos.teams.find(art_id=art_id)
    return repos.teams.get_all()


@router.post(
    "",
    response_model=Team,
    status_code=201,
    responses={404: {"description": "Not found"}},
)
def create_team(body: TeamCreate, repos: ReposDep):
    if body.art_id is not None and repos.arts.get(body.art_id) is None:
        raise HTTPException(status_code=404, detail=f"ART '{body.art_id}' not found")

    team = Team(**body.model_dump())
    repos.teams.save(team)

    if body.art_id is not None:
        art = repos.arts.get(body.art_id)
        if art is not None:
            art = art.model_copy(update={"team_ids": art.team_ids + [team.id]})
            repos.arts.save(art)

    return team


@router.get("/{team_id}", response_model=Team, responses={404: {"description": "Not found"}})
def get_team(team_id: str, repos: ReposDep):
    return _get_or_404(repos, team_id)


@router.patch("/{team_id}", response_model=Team, responses={404: {"description": "Not found"}})
def update_team(team_id: str, body: TeamUpdate, repos: ReposDep):
    team = _get_or_404(repos, team_id)
    update_data = body.model_dump(exclude_unset=True)

    if "art_id" in update_data and update_data["art_id"] is not None:
        if repos.arts.get(update_data["art_id"]) is None:
            raise HTTPException(status_code=404, detail=f"ART '{update_data['art_id']}' not found")

    if "art_id" in update_data and update_data["art_id"] != team.art_id:
        _reassign_art(repos, team_id, team.art_id, update_data["art_id"])

    updated = team.model_copy(update=update_data)
    return repos.teams.save(updated)


@router.delete(
    "/{team_id}",
    status_code=204,
    responses={404: {"description": "Not found"}, 409: {"description": "Conflict"}},
)
def delete_team(team_id: str, repos: ReposDep):
    team = _get_or_404(repos, team_id)
    if repos.features.find(team_id=team_id):
        raise HTTPException(status_code=409, detail="Team has features — reassign them first")
    if repos.stories.find(team_id=team_id):
        raise HTTPException(status_code=409, detail="Team has stories — reassign them first")
    if repos.objectives.find(team_id=team_id):
        raise HTTPException(status_code=409, detail="Team has objectives — delete them first")
    if repos.capacity_plans.find(team_id=team_id):
        raise HTTPException(status_code=409, detail="Team has capacity plans — delete them first")
    repos.teams.delete(team_id)
    if team.art_id is not None:
        art = repos.arts.get(team.art_id)
        if art is not None:
            art = art.model_copy(update={"team_ids": [t for t in art.team_ids if t != team_id]})
            repos.arts.save(art)
