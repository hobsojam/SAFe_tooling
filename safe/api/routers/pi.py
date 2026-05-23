"""HTTP error responses (404, 409, 422) for these routes are documented in docs/openapi.yaml."""

from fastapi import APIRouter, HTTPException, Query

from safe.api.deps import ReposDep
from safe.api.schemas import PICreate, PIUpdate
from safe.models.pi import PI, PIStatus
from safe.store.repos import Repos

router = APIRouter(prefix="/pi", tags=["PIs"])


def _get_or_404(repos: Repos, pi_id: str) -> PI:
    pi = repos.pis.get(pi_id)
    if pi is None:
        raise HTTPException(status_code=404, detail=f"PI '{pi_id}' not found")
    return pi


@router.get("", response_model=list[PI])
def list_pis(
    repos: ReposDep,
    art_id: str | None = Query(default=None),
    status: PIStatus | None = Query(default=None),
):
    filters = {k: v for k, v in {"art_id": art_id, "status": status}.items() if v is not None}
    return repos.pis.find(**filters) if filters else repos.pis.get_all()


@router.post("", response_model=PI, status_code=201)
def create_pi(body: PICreate, repos: ReposDep):
    if repos.arts.get(body.art_id) is None:
        raise HTTPException(status_code=404, detail=f"ART '{body.art_id}' not found")
    pi = PI(**body.model_dump())
    return repos.pis.save(pi)


@router.get("/{pi_id}", response_model=PI, responses={404: {"description": "Not found"}})
def get_pi(pi_id: str, repos: ReposDep):
    return _get_or_404(repos, pi_id)


@router.patch("/{pi_id}", response_model=PI, responses={404: {"description": "Not found"}})
def update_pi(pi_id: str, body: PIUpdate, repos: ReposDep):
    pi = _get_or_404(repos, pi_id)
    updated = pi.model_copy(update=body.model_dump(exclude_unset=True))
    return repos.pis.save(updated)


@router.delete(
    "/{pi_id}",
    status_code=204,
    responses={404: {"description": "Not found"}, 409: {"description": "Conflict"}},
)
def delete_pi(pi_id: str, repos: ReposDep):
    _get_or_404(repos, pi_id)
    if repos.features.find(pi_id=pi_id):
        raise HTTPException(status_code=409, detail="PI has features — delete them first")
    if repos.objectives.find(pi_id=pi_id):
        raise HTTPException(status_code=409, detail="PI has objectives — delete them first")
    if repos.risks.find(pi_id=pi_id):
        raise HTTPException(status_code=409, detail="PI has risks — delete them first")
    if repos.dependencies.find(pi_id=pi_id):
        raise HTTPException(status_code=409, detail="PI has dependencies — delete them first")
    for iteration in repos.iterations.find(pi_id=pi_id):
        repos.iterations.delete(iteration.id)
    repos.pis.delete(pi_id)


@router.post(
    "/{pi_id}/activate",
    response_model=PI,
    responses={404: {"description": "Not found"}, 409: {"description": "Invalid state transition"}},
)
def activate_pi(pi_id: str, repos: ReposDep):
    pi = _get_or_404(repos, pi_id)
    if pi.status != PIStatus.PLANNING:
        raise HTTPException(
            status_code=409, detail=f"PI '{pi_id}' is {pi.status.value}, not planning"
        )

    active = repos.pis.find(art_id=pi.art_id, status=PIStatus.ACTIVE)
    if active:
        raise HTTPException(
            status_code=409, detail=f"ART already has an active PI '{active[0].id}'"
        )

    updated = pi.model_copy(update={"status": PIStatus.ACTIVE})
    return repos.pis.save(updated)


@router.post(
    "/{pi_id}/close",
    response_model=PI,
    responses={404: {"description": "Not found"}, 409: {"description": "Invalid state transition"}},
)
def close_pi(pi_id: str, repos: ReposDep):
    pi = _get_or_404(repos, pi_id)
    if pi.status != PIStatus.ACTIVE:
        raise HTTPException(
            status_code=409, detail=f"PI '{pi_id}' is {pi.status.value}, not active"
        )
    updated = pi.model_copy(update={"status": PIStatus.CLOSED})
    return repos.pis.save(updated)
