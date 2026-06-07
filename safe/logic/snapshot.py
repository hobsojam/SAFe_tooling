"""PI snapshot export and import — data portability for a single PI."""

from datetime import UTC, datetime

from pydantic import BaseModel, Field

from safe.models.art import ART, Team
from safe.models.backlog import Feature, Story
from safe.models.capacity_plan import CapacityPlan
from safe.models.dependency import Dependency
from safe.models.objectives import PIObjective
from safe.models.pi import PI, Iteration
from safe.models.risk import Risk
from safe.store.repos import Repos


class PISnapshot(BaseModel):
    """Self-contained serialisable snapshot of a single PI and all its scoped entities.

    IDs inside the snapshot are the *original* IDs from the source database.
    On import, every entity receives a fresh UUID — collisions with the target
    database are therefore impossible.
    """

    version: int = 1
    exported_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    art: ART
    teams: list[Team]
    pi: PI
    iterations: list[Iteration]
    features: list[Feature]
    stories: list[Story]
    objectives: list[PIObjective]
    risks: list[Risk]
    dependencies: list[Dependency]
    capacity_plans: list[CapacityPlan]


def export_pi(repos: Repos, pi_id: str) -> PISnapshot:
    """Collect all entities scoped to *pi_id* and return a portable snapshot."""
    pi = repos.pis.get(pi_id)
    if pi is None:
        raise ValueError(f"PI '{pi_id}' not found")

    art = repos.arts.get(pi.art_id)
    if art is None:
        raise ValueError(f"ART '{pi.art_id}' not found")

    iterations = repos.iterations.find(pi_id=pi_id)
    features = repos.features.find(pi_id=pi_id)
    objectives = repos.objectives.find(pi_id=pi_id)
    risks = repos.risks.find(pi_id=pi_id)
    dependencies = repos.dependencies.find(pi_id=pi_id)
    capacity_plans = repos.capacity_plans.find(pi_id=pi_id)

    stories: list[Story] = []
    for feature in features:
        stories.extend(repos.stories.find(feature_id=feature.id))

    # Collect all team IDs referenced across the PI's entities.
    team_ids: set[str] = set()
    for f in features:
        if f.team_id:
            team_ids.add(f.team_id)
    for o in objectives:
        team_ids.add(o.team_id)
    for r in risks:
        if r.team_id:
            team_ids.add(r.team_id)
    for cp in capacity_plans:
        team_ids.add(cp.team_id)
    for s in stories:
        team_ids.add(s.team_id)

    teams = [t for tid in team_ids if (t := repos.teams.get(tid)) is not None]

    return PISnapshot(
        art=art,
        teams=teams,
        pi=pi,
        iterations=iterations,
        features=features,
        stories=stories,
        objectives=objectives,
        risks=risks,
        dependencies=dependencies,
        capacity_plans=capacity_plans,
    )


def import_pi(repos: Repos, snapshot: PISnapshot) -> PI:
    """Re-hydrate a snapshot into *repos*, assigning fresh IDs to every entity.

    Teams and the ART are resolved by name; existing records are reused rather
    than duplicated.  All other entities are always created fresh.

    Returns the newly created PI.
    """
    id_map: dict[str, str] = {}  # old_id -> new_id for every remapped entity

    # ── ART ──────────────────────────────────────────────────────────────────
    existing_arts = [a for a in repos.arts.get_all() if a.name == snapshot.art.name]
    art = existing_arts[0] if existing_arts else repos.arts.save(ART(name=snapshot.art.name))
    id_map[snapshot.art.id] = art.id

    # ── Teams ─────────────────────────────────────────────────────────────────
    for team in snapshot.teams:
        art_teams = repos.teams.find(art_id=art.id)
        existing = [t for t in art_teams if t.name == team.name]
        if existing:
            new_team = existing[0]
        else:
            new_team = repos.teams.save(
                Team(
                    name=team.name,
                    member_count=team.member_count,
                    art_id=art.id,
                    topology_type=team.topology_type,
                    velocity_history=list(team.velocity_history),
                )
            )
            art = art.model_copy(update={"team_ids": art.team_ids + [new_team.id]})
            repos.arts.save(art)
        id_map[team.id] = new_team.id

    # ── PI ────────────────────────────────────────────────────────────────────
    new_pi = PI(
        name=snapshot.pi.name,
        art_id=art.id,
        start_date=snapshot.pi.start_date,
        end_date=snapshot.pi.end_date,
        iteration_ids=[],
    )
    id_map[snapshot.pi.id] = new_pi.id

    # ── Iterations ────────────────────────────────────────────────────────────
    for it in snapshot.iterations:
        new_it = repos.iterations.save(
            Iteration(
                pi_id=new_pi.id,
                number=it.number,
                name=it.name,
                start_date=it.start_date,
                end_date=it.end_date,
                is_ip=it.is_ip,
            )
        )
        id_map[it.id] = new_it.id
        new_pi = new_pi.model_copy(update={"iteration_ids": new_pi.iteration_ids + [new_it.id]})

    repos.pis.save(new_pi)

    # ── Features ──────────────────────────────────────────────────────────────
    for f in snapshot.features:
        new_f = repos.features.save(
            Feature(
                name=f.name,
                description=f.description,
                pi_id=new_pi.id,
                team_id=id_map.get(f.team_id) if f.team_id else None,
                iteration_id=id_map.get(f.iteration_id) if f.iteration_id else None,
                status=f.status,
                acceptance_criteria=f.acceptance_criteria,
                nfr=f.nfr,
                user_business_value=f.user_business_value,
                time_criticality=f.time_criticality,
                risk_reduction_opportunity_enablement=f.risk_reduction_opportunity_enablement,
                job_size=f.job_size,
            )
        )
        id_map[f.id] = new_f.id

    # ── Stories ───────────────────────────────────────────────────────────────
    for s in snapshot.stories:
        feature_id = id_map.get(s.feature_id)
        team_id = id_map.get(s.team_id)
        if not feature_id or not team_id:
            continue  # skip stories whose parent feature or team didn't survive the import
        new_s = repos.stories.save(
            Story(
                name=s.name,
                description=s.description,
                feature_id=feature_id,
                team_id=team_id,
                iteration_id=id_map.get(s.iteration_id) if s.iteration_id else None,
                points=s.points,
                status=s.status,
                acceptance_criteria=s.acceptance_criteria,
            )
        )
        id_map[s.id] = new_s.id

    # ── Objectives ────────────────────────────────────────────────────────────
    for o in snapshot.objectives:
        team_id = id_map.get(o.team_id)
        if not team_id:
            continue  # skip objectives whose team wasn't in the snapshot
        new_o = repos.objectives.save(
            PIObjective(
                description=o.description,
                team_id=team_id,
                pi_id=new_pi.id,
                planned_business_value=o.planned_business_value,
                actual_business_value=o.actual_business_value,
                is_stretch=o.is_stretch,
                feature_ids=[id_map[fid] for fid in o.feature_ids if fid in id_map],
            )
        )
        id_map[o.id] = new_o.id

    # ── Risks ─────────────────────────────────────────────────────────────────
    for r in snapshot.risks:
        new_r = repos.risks.save(
            Risk(
                description=r.description,
                pi_id=new_pi.id,
                team_id=id_map.get(r.team_id) if r.team_id else None,
                feature_id=id_map.get(r.feature_id) if r.feature_id else None,
                roam_status=r.roam_status,
                owner=r.owner,
                mitigation_notes=r.mitigation_notes,
                raised_date=r.raised_date,
            )
        )
        id_map[r.id] = new_r.id

    # ── Dependencies ──────────────────────────────────────────────────────────
    for d in snapshot.dependencies:
        from_id = id_map.get(d.from_feature_id)
        to_id = id_map.get(d.to_feature_id)
        if not from_id or not to_id:
            continue  # skip deps whose features weren't imported
        new_d = repos.dependencies.save(
            Dependency(
                description=d.description,
                pi_id=new_pi.id,
                from_feature_id=from_id,
                to_feature_id=to_id,
                status=d.status,
                owner=d.owner,
                resolution_notes=d.resolution_notes,
                raised_date=d.raised_date,
                needed_by_date=d.needed_by_date,
            )
        )
        id_map[d.id] = new_d.id

    # Back-fill feature.dependency_ids now that dep IDs are known.
    for f in snapshot.features:
        if f.dependency_ids:
            new_fid = id_map.get(f.id)
            if new_fid is None:
                continue
            remapped = [id_map[did] for did in f.dependency_ids if did in id_map]
            if remapped:
                saved = repos.features.get(new_fid)
                if saved:
                    repos.features.save(saved.model_copy(update={"dependency_ids": remapped}))

    # ── Capacity plans ────────────────────────────────────────────────────────
    for cp in snapshot.capacity_plans:
        team_id = id_map.get(cp.team_id)
        iteration_id = id_map.get(cp.iteration_id)
        if not team_id or not iteration_id:
            continue
        repos.capacity_plans.save(
            CapacityPlan(
                team_id=team_id,
                iteration_id=iteration_id,
                pi_id=new_pi.id,
                team_size=cp.team_size,
                iteration_days=cp.iteration_days,
                pto_days=cp.pto_days,
                overhead_pct=cp.overhead_pct,
            )
        )

    return new_pi
