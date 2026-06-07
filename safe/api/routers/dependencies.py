"""HTTP error responses (404, 409, 422) for these routes are documented in docs/openapi.yaml."""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query

from safe.api.deps import ReposDep
from safe.api.schemas import DependencyCreate, DependencyStatusUpdate, DependencyUpdate
from safe.api.utils import get_or_404
from safe.models.dependency import Dependency

router = APIRouter(prefix="/dependencies", tags=["Dependencies"])


@router.get("", response_model=list[Dependency])
def list_dependencies(
    repos: ReposDep,
    pi_id: Annotated[str | None, Query()] = None,
    from_feature_id: Annotated[str | None, Query()] = None,
    to_feature_id: Annotated[str | None, Query()] = None,
    status: Annotated[str | None, Query()] = None,
):
    deps = repos.dependencies.find(pi_id=pi_id) if pi_id else repos.dependencies.get_all()
    if from_feature_id:
        deps = [d for d in deps if d.from_feature_id == from_feature_id]
    if to_feature_id:
        deps = [d for d in deps if d.to_feature_id == to_feature_id]
    if status:
        deps = [d for d in deps if d.status == status]
    return deps


@router.post(
    "",
    response_model=Dependency,
    status_code=201,
    responses={404: {"description": "Not found"}},
)
def create_dependency(body: DependencyCreate, repos: ReposDep):
    if repos.features.get(body.from_feature_id) is None:
        raise HTTPException(status_code=404, detail=f"Feature '{body.from_feature_id}' not found")
    if repos.features.get(body.to_feature_id) is None:
        raise HTTPException(status_code=404, detail=f"Feature '{body.to_feature_id}' not found")
    dep = Dependency(**body.model_dump())
    return repos.dependencies.save(dep)


@router.get(
    "/{dependency_id}",
    response_model=Dependency,
    responses={404: {"description": "Not found"}},
)
def get_dependency(dependency_id: str, repos: ReposDep):
    return get_or_404(repos.dependencies, dependency_id, "Dependency")


@router.patch(
    "/{dependency_id}",
    response_model=Dependency,
    responses={404: {"description": "Not found"}},
)
def update_dependency(dependency_id: str, body: DependencyUpdate, repos: ReposDep):
    dep = get_or_404(repos.dependencies, dependency_id, "Dependency")
    updated = dep.model_copy(update=body.model_dump(exclude_unset=True))
    return repos.dependencies.save(updated)


@router.post(
    "/{dependency_id}/roam",
    response_model=Dependency,
    responses={404: {"description": "Not found"}},
)
def roam_dependency(dependency_id: str, body: DependencyStatusUpdate, repos: ReposDep):
    dep = get_or_404(repos.dependencies, dependency_id, "Dependency")
    updated = dep.model_copy(update=body.model_dump(exclude_unset=True))
    return repos.dependencies.save(updated)


@router.delete("/{dependency_id}", status_code=204, responses={404: {"description": "Not found"}})
def delete_dependency(dependency_id: str, repos: ReposDep):
    get_or_404(repos.dependencies, dependency_id, "Dependency")
    repos.dependencies.delete(dependency_id)
