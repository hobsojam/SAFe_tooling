"""HTTP error responses (404, 409, 422) for these routes are documented in docs/openapi.yaml."""

from fastapi import APIRouter, HTTPException

from safe.api.deps import ReposDep
from safe.api.schemas import ARTCreate, ARTUpdate
from safe.models.art import ART
from safe.store.repos import Repos

router = APIRouter(prefix="/art", tags=["ARTs"])


def _get_or_404(repos: Repos, art_id: str) -> ART:
    art = repos.arts.get(art_id)
    if art is None:
        raise HTTPException(status_code=404, detail=f"ART '{art_id}' not found")
    return art


@router.get("", response_model=list[ART])
def list_arts(repos: ReposDep):
    return repos.arts.get_all()


@router.post("", response_model=ART, status_code=201)
def create_art(body: ARTCreate, repos: ReposDep):
    art = ART(name=body.name)
    return repos.arts.save(art)


@router.get("/{art_id}", response_model=ART, responses={404: {"description": "Not found"}})
def get_art(art_id: str, repos: ReposDep):
    return _get_or_404(repos, art_id)


@router.patch("/{art_id}", response_model=ART, responses={404: {"description": "Not found"}})
def update_art(art_id: str, body: ARTUpdate, repos: ReposDep):
    art = _get_or_404(repos, art_id)
    updated = art.model_copy(update=body.model_dump(exclude_unset=True))
    return repos.arts.save(updated)


@router.delete(
    "/{art_id}",
    status_code=204,
    responses={404: {"description": "Not found"}, 409: {"description": "Conflict"}},
)
def delete_art(art_id: str, repos: ReposDep):
    _get_or_404(repos, art_id)
    if repos.teams.find(art_id=art_id):
        raise HTTPException(status_code=409, detail="ART has teams — delete them first")
    if repos.pis.find(art_id=art_id):
        raise HTTPException(status_code=409, detail="ART has PIs — delete them first")
    repos.arts.delete(art_id)
