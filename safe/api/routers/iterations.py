"""HTTP error responses (404, 409, 422) for these routes are documented in docs/openapi.yaml."""

from fastapi import APIRouter, HTTPException, Query

from safe.api.deps import ReposDep
from safe.api.schemas import IterationCreate, IterationUpdate
from safe.models.pi import Iteration
from safe.store.repos import Repos

router = APIRouter(prefix="/iterations", tags=["Iterations"])


def _get_or_404(repos: Repos, iteration_id: str) -> Iteration:
    iteration = repos.iterations.get(iteration_id)
    if iteration is None:
        raise HTTPException(status_code=404, detail=f"Iteration '{iteration_id}' not found")
    return iteration


@router.get("", response_model=list[Iteration])
def list_iterations(
    repos: ReposDep,
    pi_id: str = Query(..., description="Filter by PI ID (required)"),
):
    return repos.iterations.find(pi_id=pi_id)


@router.post("", response_model=Iteration, status_code=201)
def create_iteration(body: IterationCreate, repos: ReposDep):
    pi = repos.pis.get(body.pi_id)
    if pi is None:
        raise HTTPException(status_code=404, detail=f"PI '{body.pi_id}' not found")

    if body.start_date < pi.start_date or body.end_date > pi.end_date:
        raise HTTPException(
            status_code=422,
            detail=f"Iteration dates must fall within PI range {pi.start_date} – {pi.end_date}",
        )

    iteration = Iteration(**body.model_dump())
    repos.iterations.save(iteration)

    updated_pi = pi.model_copy(update={"iteration_ids": pi.iteration_ids + [iteration.id]})
    repos.pis.save(updated_pi)

    return iteration


@router.get("/{iteration_id}", response_model=Iteration)
def get_iteration(iteration_id: str, repos: ReposDep):
    return _get_or_404(repos, iteration_id)


@router.patch("/{iteration_id}", response_model=Iteration)
def update_iteration(iteration_id: str, body: IterationUpdate, repos: ReposDep):
    iteration = _get_or_404(repos, iteration_id)
    updated = iteration.model_copy(update=body.model_dump(exclude_unset=True))
    return repos.iterations.save(updated)


@router.delete("/{iteration_id}", status_code=204)
def delete_iteration(iteration_id: str, repos: ReposDep):
    iteration = _get_or_404(repos, iteration_id)
    for plan in repos.capacity_plans.find(iteration_id=iteration_id):
        repos.capacity_plans.delete(plan.id)
    repos.iterations.delete(iteration_id)

    pi = repos.pis.get(iteration.pi_id)
    if pi is not None:
        updated_pi = pi.model_copy(
            update={"iteration_ids": [i for i in pi.iteration_ids if i != iteration_id]}
        )
        repos.pis.save(updated_pi)
