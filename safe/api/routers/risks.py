"""HTTP error responses (404, 409, 422) for these routes are documented in docs/openapi.yaml."""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query

from safe.api.deps import ReposDep
from safe.api.schemas import RiskCreate, RiskROAM, RiskUpdate
from safe.api.utils import get_or_404
from safe.models.risk import Risk, ROAMStatus

router = APIRouter(prefix="/risks", tags=["Risks"])


@router.get("", response_model=list[Risk])
def list_risks(
    repos: ReposDep,
    pi_id: Annotated[str | None, Query()] = None,
    team_id: Annotated[str | None, Query()] = None,
    roam_status: Annotated[ROAMStatus | None, Query()] = None,
):
    filters = {
        k: v
        for k, v in {"pi_id": pi_id, "team_id": team_id, "roam_status": roam_status}.items()
        if v is not None
    }
    return repos.risks.find(**filters) if filters else repos.risks.get_all()


@router.post(
    "",
    response_model=Risk,
    status_code=201,
    responses={404: {"description": "Not found"}},
)
def create_risk(body: RiskCreate, repos: ReposDep):
    if repos.pis.get(body.pi_id) is None:
        raise HTTPException(status_code=404, detail=f"PI '{body.pi_id}' not found")
    if body.team_id is not None and repos.teams.get(body.team_id) is None:
        raise HTTPException(status_code=404, detail=f"Team '{body.team_id}' not found")
    if body.feature_id is not None and repos.features.get(body.feature_id) is None:
        raise HTTPException(status_code=404, detail=f"Feature '{body.feature_id}' not found")
    risk = Risk(**body.model_dump())
    return repos.risks.save(risk)


@router.get("/{risk_id}", response_model=Risk, responses={404: {"description": "Not found"}})
def get_risk(risk_id: str, repos: ReposDep):
    return get_or_404(repos.risks, risk_id, "Risk")


@router.patch("/{risk_id}", response_model=Risk, responses={404: {"description": "Not found"}})
def update_risk(risk_id: str, body: RiskUpdate, repos: ReposDep):
    risk = get_or_404(repos.risks, risk_id, "Risk")
    updated = risk.model_copy(update=body.model_dump(exclude_unset=True))
    return repos.risks.save(updated)


@router.post("/{risk_id}/roam", response_model=Risk, responses={404: {"description": "Not found"}})
def roam_risk(risk_id: str, body: RiskROAM, repos: ReposDep):
    risk = get_or_404(repos.risks, risk_id, "Risk")
    updated = risk.model_copy(update=body.model_dump(exclude_unset=True))
    return repos.risks.save(updated)


@router.delete("/{risk_id}", status_code=204, responses={404: {"description": "Not found"}})
def delete_risk(risk_id: str, repos: ReposDep):
    get_or_404(repos.risks, risk_id, "Risk")
    repos.risks.delete(risk_id)
