"""HTTP error responses (404, 409, 422) for these routes are documented in docs/openapi.yaml."""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query

from safe.api.deps import ReposDep
from safe.api.schemas import FeatureAssign, FeatureCreate, FeatureUpdate
from safe.api.utils import get_or_404
from safe.logic.wsjf import rank_features
from safe.models.backlog import Feature, FeatureStatus

router = APIRouter(prefix="/features", tags=["Features"])


@router.get("", response_model=list[Feature])
def list_features(
    repos: ReposDep,
    pi_id: Annotated[str | None, Query()] = None,
    team_id: Annotated[str | None, Query()] = None,
    status: Annotated[FeatureStatus | None, Query()] = None,
    sort: Annotated[str | None, Query(pattern="^(wsjf_desc|name_asc)$")] = None,
):
    filters = {
        k: v
        for k, v in {"pi_id": pi_id, "team_id": team_id, "status": status}.items()
        if v is not None
    }
    features = repos.features.find(**filters) if filters else repos.features.get_all()

    if sort == "wsjf_desc":
        features = rank_features(features)
    elif sort == "name_asc":
        features = sorted(features, key=lambda f: f.name)

    return features


@router.post("", response_model=Feature, status_code=201)
def create_feature(body: FeatureCreate, repos: ReposDep):
    if body.pi_id is not None and repos.pis.get(body.pi_id) is None:
        raise HTTPException(status_code=404, detail=f"PI '{body.pi_id}' not found")
    if body.team_id is not None and repos.teams.get(body.team_id) is None:
        raise HTTPException(status_code=404, detail=f"Team '{body.team_id}' not found")
    feature = Feature(**body.model_dump())
    return repos.features.save(feature)


@router.get("/{feature_id}", response_model=Feature, responses={404: {"description": "Not found"}})
def get_feature(feature_id: str, repos: ReposDep):
    return get_or_404(repos.features, feature_id, "Feature")


@router.patch(
    "/{feature_id}",
    response_model=Feature,
    responses={404: {"description": "Not found"}},
)
def update_feature(feature_id: str, body: FeatureUpdate, repos: ReposDep):
    feature = get_or_404(repos.features, feature_id, "Feature")
    if "pi_id" in body.model_fields_set and body.pi_id is not None:
        if repos.pis.get(body.pi_id) is None:
            raise HTTPException(status_code=404, detail=f"PI '{body.pi_id}' not found")
    if "team_id" in body.model_fields_set and body.team_id is not None:
        if repos.teams.get(body.team_id) is None:
            raise HTTPException(status_code=404, detail=f"Team '{body.team_id}' not found")
    updated = feature.model_copy(update=body.model_dump(exclude_unset=True))
    return repos.features.save(updated)


@router.post(
    "/{feature_id}/assign",
    response_model=Feature,
    responses={404: {"description": "Not found"}},
)
def assign_feature(feature_id: str, body: FeatureAssign, repos: ReposDep):
    feature = get_or_404(repos.features, feature_id, "Feature")
    if repos.teams.get(body.team_id) is None:
        raise HTTPException(status_code=404, detail=f"Team '{body.team_id}' not found")
    updated = feature.model_copy(update={"team_id": body.team_id})
    return repos.features.save(updated)


@router.delete("/{feature_id}", status_code=204, responses={404: {"description": "Not found"}})
def delete_feature(feature_id: str, repos: ReposDep):
    get_or_404(repos.features, feature_id, "Feature")
    for story in repos.stories.find(feature_id=feature_id):
        repos.stories.delete(story.id)
    for objective in repos.objectives.get_all():
        if feature_id in objective.feature_ids:
            updated = objective.model_copy(
                update={"feature_ids": [fid for fid in objective.feature_ids if fid != feature_id]}
            )
            repos.objectives.save(updated)
    repos.features.delete(feature_id)
