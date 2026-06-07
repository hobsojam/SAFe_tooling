"""HTTP error responses (404, 409, 422) for these routes are documented in docs/openapi.yaml."""

from fastapi import APIRouter, HTTPException

from safe.api.deps import ReposDep
from safe.api.schemas import ARTCreate, ARTUpdate
from safe.api.utils import get_or_404
from safe.models.art import ART

router = APIRouter(prefix="/art", tags=["ARTs"])


@router.get("", response_model=list[ART])
def list_arts(repos: ReposDep):
    return repos.arts.get_all()


@router.post("", response_model=ART, status_code=201)
def create_art(body: ARTCreate, repos: ReposDep):
    art = ART(name=body.name)
    return repos.arts.save(art)


@router.get("/{art_id}", response_model=ART, responses={404: {"description": "Not found"}})
def get_art(art_id: str, repos: ReposDep):
    return get_or_404(repos.arts, art_id, "ART")


@router.patch("/{art_id}", response_model=ART, responses={404: {"description": "Not found"}})
def update_art(art_id: str, body: ARTUpdate, repos: ReposDep):
    art = get_or_404(repos.arts, art_id, "ART")
    updated = art.model_copy(update=body.model_dump(exclude_unset=True))
    return repos.arts.save(updated)


@router.delete(
    "/{art_id}",
    status_code=204,
    responses={404: {"description": "Not found"}, 409: {"description": "Conflict"}},
)
def delete_art(art_id: str, repos: ReposDep):
    get_or_404(repos.arts, art_id, "ART")
    if repos.teams.find(art_id=art_id):
        raise HTTPException(status_code=409, detail="ART has teams — delete them first")
    if repos.pis.find(art_id=art_id):
        raise HTTPException(status_code=409, detail="ART has PIs — delete them first")
    repos.arts.delete(art_id)
