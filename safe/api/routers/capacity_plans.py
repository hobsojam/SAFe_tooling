"""HTTP error responses (404, 409, 422) for these routes are documented in docs/openapi.yaml."""

from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query

from safe.api.deps import ReposDep
from safe.api.schemas import CapacityPlanCreate, CapacityPlanSeed, CapacityPlanUpdate, VelocityEntry
from safe.api.utils import get_or_404
from safe.logic.capacity import team_velocity
from safe.models.capacity_plan import CapacityPlan


def _weekdays(start: date, end: date) -> int:
    count, cur = 0, start
    while cur <= end:
        if cur.weekday() < 5:
            count += 1
        cur += timedelta(days=1)
    return count


router = APIRouter(prefix="/capacity-plans", tags=["Capacity Plans"])


@router.get("", response_model=list[CapacityPlan])
def list_capacity_plans(
    repos: ReposDep,
    pi_id: Annotated[str | None, Query()] = None,
    team_id: Annotated[str | None, Query()] = None,
    iteration_id: Annotated[str | None, Query()] = None,
):
    filters = {
        k: v
        for k, v in {"pi_id": pi_id, "team_id": team_id, "iteration_id": iteration_id}.items()
        if v is not None
    }
    return repos.capacity_plans.find(**filters) if filters else repos.capacity_plans.get_all()


@router.post("/seed", status_code=201, responses={404: {"description": "Not found"}})
def seed_capacity_plans(body: CapacityPlanSeed, repos: ReposDep) -> dict[str, int]:
    pi = repos.pis.get(body.pi_id)
    if pi is None:
        raise HTTPException(status_code=404, detail=f"PI '{body.pi_id}' not found")
    teams = repos.teams.find(art_id=pi.art_id)
    iterations = [it for it in repos.iterations.find(pi_id=body.pi_id) if not it.is_ip]
    created_count = 0
    skipped_count = 0
    for team in teams:
        for iter_ in iterations:
            if repos.capacity_plans.find(pi_id=body.pi_id, team_id=team.id, iteration_id=iter_.id):
                skipped_count += 1
                continue
            plan = CapacityPlan(
                team_id=team.id,
                iteration_id=iter_.id,
                pi_id=body.pi_id,
                team_size=team.member_count,
                iteration_days=_weekdays(iter_.start_date, iter_.end_date),
                pto_days=0,
                overhead_pct=0.2,
            )
            repos.capacity_plans.save(plan)
            created_count += 1
    return {"created": created_count, "skipped": skipped_count}


@router.post(
    "",
    response_model=CapacityPlan,
    status_code=201,
    responses={404: {"description": "Not found"}},
)
def create_or_update_capacity_plan(body: CapacityPlanCreate, repos: ReposDep):
    if repos.pis.get(body.pi_id) is None:
        raise HTTPException(status_code=404, detail=f"PI '{body.pi_id}' not found")
    if repos.teams.get(body.team_id) is None:
        raise HTTPException(status_code=404, detail=f"Team '{body.team_id}' not found")
    if repos.iterations.get(body.iteration_id) is None:
        raise HTTPException(status_code=404, detail=f"Iteration '{body.iteration_id}' not found")
    existing = repos.capacity_plans.find(
        pi_id=body.pi_id, team_id=body.team_id, iteration_id=body.iteration_id
    )
    if existing:
        plan = existing[0].model_copy(update=body.model_dump(exclude_unset=True))
        return repos.capacity_plans.save(plan)
    plan = CapacityPlan(**body.model_dump())
    return repos.capacity_plans.save(plan)


@router.get(
    "/velocity",
    response_model=list[VelocityEntry],
    responses={404: {"description": "Not found"}},
)
def get_velocity(
    repos: ReposDep,
    pi_id: Annotated[str, Query(description="PI id")],
    team_id: Annotated[str | None, Query(description="Filter by team")] = None,
):
    if repos.pis.get(pi_id) is None:
        raise HTTPException(status_code=404, detail=f"PI '{pi_id}' not found")
    if team_id is not None:
        team = repos.teams.get(team_id)
        if team is None:
            raise HTTPException(status_code=404, detail=f"Team '{team_id}' not found")
        teams = [team]
    else:
        teams = repos.teams.get_all()
    iterations = repos.iterations.find(pi_id=pi_id)
    results = []
    for team in teams:
        for iteration in iterations:
            stories = repos.stories.find(team_id=team.id, iteration_id=iteration.id)
            completed = team_velocity(stories)
            plan_list = repos.capacity_plans.find(
                pi_id=pi_id, team_id=team.id, iteration_id=iteration.id
            )
            plan = plan_list[0] if plan_list else None
            results.append(
                VelocityEntry(
                    team_id=team.id,
                    iteration_id=iteration.id,
                    pi_id=pi_id,
                    completed_points=completed,
                    available_capacity=plan.available_capacity if plan else None,
                )
            )
    return results


@router.get(
    "/{plan_id}",
    response_model=CapacityPlan,
    responses={404: {"description": "Not found"}},
)
def get_capacity_plan(plan_id: str, repos: ReposDep):
    return get_or_404(repos.capacity_plans, plan_id, "Capacity plan")


@router.patch(
    "/{plan_id}",
    response_model=CapacityPlan,
    responses={404: {"description": "Not found"}},
)
def update_capacity_plan(plan_id: str, body: CapacityPlanUpdate, repos: ReposDep):
    plan = get_or_404(repos.capacity_plans, plan_id, "Capacity plan")
    updated = plan.model_copy(update=body.model_dump(exclude_unset=True))
    return repos.capacity_plans.save(updated)


@router.delete("/{plan_id}", status_code=204, responses={404: {"description": "Not found"}})
def delete_capacity_plan(plan_id: str, repos: ReposDep):
    get_or_404(repos.capacity_plans, plan_id, "Capacity plan")
    repos.capacity_plans.delete(plan_id)
