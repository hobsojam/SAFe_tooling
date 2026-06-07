"""HTTP error responses (404, 409, 422) for these routes are documented in docs/openapi.yaml."""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query

from safe.api.deps import ReposDep
from safe.api.schemas import StoryCreate, StoryUpdate
from safe.api.utils import get_or_404
from safe.models.backlog import Story, StoryStatus

router = APIRouter(prefix="/stories", tags=["Stories"])


@router.get("", response_model=list[Story])
def list_stories(
    repos: ReposDep,
    feature_id: Annotated[str | None, Query()] = None,
    team_id: Annotated[str | None, Query()] = None,
    iteration_id: Annotated[str | None, Query()] = None,
    status: Annotated[StoryStatus | None, Query()] = None,
):
    filters = {
        k: v
        for k, v in {
            "feature_id": feature_id,
            "team_id": team_id,
            "iteration_id": iteration_id,
            "status": status,
        }.items()
        if v is not None
    }
    return repos.stories.find(**filters) if filters else repos.stories.get_all()


@router.post(
    "",
    response_model=Story,
    status_code=201,
    responses={404: {"description": "Not found"}},
)
def create_story(body: StoryCreate, repos: ReposDep):
    if repos.features.get(body.feature_id) is None:
        raise HTTPException(status_code=404, detail=f"Feature '{body.feature_id}' not found")
    if repos.teams.get(body.team_id) is None:
        raise HTTPException(status_code=404, detail=f"Team '{body.team_id}' not found")
    story = Story(**body.model_dump())
    return repos.stories.save(story)


@router.get("/{story_id}", response_model=Story, responses={404: {"description": "Not found"}})
def get_story(story_id: str, repos: ReposDep):
    return get_or_404(repos.stories, story_id, "Story")


@router.patch("/{story_id}", response_model=Story, responses={404: {"description": "Not found"}})
def update_story(story_id: str, body: StoryUpdate, repos: ReposDep):
    story = get_or_404(repos.stories, story_id, "Story")
    update_data = body.model_dump(exclude_unset=True)
    if "feature_id" in update_data and update_data["feature_id"] is not None:
        if repos.features.get(update_data["feature_id"]) is None:
            raise HTTPException(
                status_code=404,
                detail=f"Feature '{update_data['feature_id']}' not found",
            )
    if "team_id" in update_data and update_data["team_id"] is not None:
        if repos.teams.get(update_data["team_id"]) is None:
            raise HTTPException(
                status_code=404,
                detail=f"Team '{update_data['team_id']}' not found",
            )
    if "iteration_id" in update_data and update_data["iteration_id"] is not None:
        if repos.iterations.get(update_data["iteration_id"]) is None:
            raise HTTPException(
                status_code=404,
                detail=f"Iteration '{update_data['iteration_id']}' not found",
            )
    updated = story.model_copy(update=update_data)
    return repos.stories.save(updated)


@router.delete("/{story_id}", status_code=204, responses={404: {"description": "Not found"}})
def delete_story(story_id: str, repos: ReposDep):
    get_or_404(repos.stories, story_id, "Story")
    repos.stories.delete(story_id)
