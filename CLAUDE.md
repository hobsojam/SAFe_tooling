# SAFe Tooling — Project Context

@CLAUDE_SECURITY.md

@CLAUDE_ACCESSIBILITY.md

---

## Purpose

This project builds tooling to support planning, tracking, and execution activities within the **Scaled Agile Framework (SAFe)**. The primary focus is on Program Increment (PI) Planning and related ceremonies/artifacts.

## SAFe Domain Vocabulary

Understand these terms precisely before implementing any feature:

| Term | Definition |
|------|-----------|
| **PI** | Program Increment — a fixed timebox (typically 8–12 weeks) containing 4–5 Iterations plus an Innovation & Planning (IP) iteration |
| **ART** | Agile Release Train — the long-lived team-of-teams that delivers value; typically 50–125 people |
| **Team** | An Agile team on the ART; 5–11 people including a Scrum Master and Product Owner |
| **Iteration** | A 2-week sprint within a PI |
| **Feature** | A service or function that fulfills a stakeholder need; sized to fit in a PI |
| **Story** | A small unit of work that fits within one Iteration, belonging to a Feature |
| **Epic** | A large initiative spanning multiple PIs; may have a Lean Business Case |
| **PI Objectives** | Business outcomes a team or ART commits to for a PI; rated by Business Value (1–10) |
| **WSJF** | Weighted Shortest Job First — prioritization formula: (CoD + ToD + RR/OE) / Job Size |
| **CoD** | Cost of Delay — value lost by not delivering; sum of User/Business Value, Time Criticality, Risk Reduction / Opportunity Enablement |
| **ROAM** | Risk disposition: Resolved, Owned, Accepted, Mitigated |
| **RTE** | Release Train Engineer — servant leader and coach for the ART |
| **Program Board** | Visual artifact mapping Features to Iterations, showing team dependencies |
| **Dependency** | A cross-team or cross-ART reliance that must be coordinated |
| **Capacity** | Available person-days per team per Iteration, accounting for PTO and overhead |
| **Load** | Estimated Story Points or hours committed by a team in an Iteration |
| **IP Iteration** | Innovation & Planning iteration at the end of a PI; not used for regular feature delivery |
| **ART Sync** | Short, regular cross-team coordination meeting during the PI |
| **Inspect & Adapt (I&A)** | End-of-PI ceremony: PI System Demo + quantitative measurement + problem-solving workshop |

## Key Formulas

```
WSJF = Cost of Delay / Job Duration (relative sizing, 1–13 scale)
Cost of Delay = User/Business Value + Time Criticality + Risk Reduction/Opportunity Enablement

Predictability = (Actual Business Value / Planned Business Value) * 100
Target: 80–100%

Team Load % = (Committed Story Points / Available Capacity) * 100
Target: ≤ 100%, warn at > 90%

Available Capacity = (Team Size × Iteration Days − PTO Days) × (1 − Overhead %)
Default overhead: 20%
```

## Entity Relationships

```
ART  1──* Team
ART  1──* PI
PI   1──* Iteration
PI   1──* Feature
PI   1──* Risk
PI   1──* PIObjective  (via Team)
PI   1──* Dependency
Team 1──* PIObjective
Team 1──* CapacityPlan  (one per Iteration)
Feature *──1 Team  (assigned team)
Feature 1──* Story
Feature 1──* Dependency  (feature_id FK)
Story  belongs to Team and Iteration
```

All relationships use ID references (never embedded objects). `PI.iteration_ids`, `Feature.story_ids`, etc. store lists of IDs; the repository layer loads related entities separately. This avoids dual-write bugs in TinyDB.

## Technology Stack

| Layer | Library | Purpose |
|-------|---------|---------|
| Language | Python 3.14 | |
| CLI | Typer (`typer[all]`) | Subcommand structure, `--help` generation |
| HTTP API | FastAPI + uvicorn | REST API matching `docs/openapi.yaml` |
| Data models | Pydantic v2 | Validated models with `computed_field` for derived values |
| Persistence | TinyDB | JSON-backed local store at `~/.safe_tooling/db.json` |
| Terminal output | Rich (bundled with Typer) | Colored tables, status indicators |
| Spreadsheet I/O | openpyxl | Import/export for PI Planning Excel artifacts |
| Testing | pytest + pytest-cov + httpx | |
| Contract testing | schemathesis `>=4.0` | Generates test cases from `docs/openapi.yaml` via ASGI; verifies no endpoint returns 5xx |
| Mutation testing | mutmut `>=2,<3` | Nightly CI job scoped to `safe/logic/`; pinned to v2 because v3 removed the `html` subcommand used in the report step |

Install: `pip install -e ".[dev]"`
Run CLI: `safe --help`
Run API: `safe-api` (or `podman compose up -d --build`)

> **Always run the full CI check suite locally before pushing.** The CI pipeline runs three steps in order — all must pass:
> ```bash
> python -m ruff check .        # lint
> python -m ruff format --check .  # formatting (separate from lint — easy to miss!)
> python -m pytest tests/       # tests
> ```
> `ruff check` and `ruff format` are **independent** — passing one does not imply passing the other. Always run both. To auto-fix, run `ruff check . --fix && ruff format .` before committing.


> **Package discovery:** `pyproject.toml` pins setuptools to `include = ["safe*"]` via `[tool.setuptools.packages.find]`. If you add a new top-level directory (e.g. a second language runtime, a docs generator, a scripts folder), setuptools flat-layout auto-discovery will break the build with "Multiple top-level packages discovered". Either keep non-Python directories out of the project root, or update the `include` list explicitly.

## Project Structure

```
safe/
  models/
    __init__.py          # re-exports all models — import from here
    base.py              # SAFeBaseModel — shared id field (uuid4 default)
    art.py               # ART, Team
    pi.py                # PI, Iteration, PIStatus
    backlog.py           # Feature, FeatureStatus, Story, StoryStatus
    objectives.py        # PIObjective
    risk.py              # Risk, ROAMStatus
    dependency.py        # Dependency, DependencyStatus
    capacity_plan.py     # CapacityPlan
  exceptions.py          # SafeToolingError, IllegalPITransitionError, IllegalStateError, InvalidCapacityError, DomainValidationError
  dev_seed.py            # dev/demo data seeding (used when SAFE_SEED_DEV=1 or SAFE_DEMO_SEED=1)
  logic/
    wsjf.py              # cost_of_delay(), wsjf(), rank_features()
    capacity.py          # available_capacity(), load_percentage(), capacity_warning()
    predictability.py    # team_predictability(), art_predictability(), predictability_rating()
    board.py             # build_board() — feature-to-iteration grid logic
    pi.py                # validate_pi_transition() — enforces PLANNING→ACTIVE→CLOSED state machine
    snapshot.py          # export_pi(), import_pi() — PI snapshot portability; NOTE: imports Repos (I/O) — should move to safe/services/ in a future refactor
  cli/
    main.py              # root Typer app; --db-path callback; wsjf score; registers all sub-apps
    state.py             # shared CLI state: db_path (set by --db-path, read by _repos())
    art.py               # safe art create / show / list
    team.py              # safe team create / show / list / delete
    pi.py                # safe pi create / show / list / activate / close / predictability
                         # safe pi iteration add / list / delete
    feature.py           # safe feature add / show / list / rank / update / assign / delete
    story.py             # safe story add / list / update / delete
    backlog.py           # safe backlog show (WSJF-ranked view with story counts)
    capacity.py          # safe capacity calc / set / show / export
    objective.py         # safe objective add / list / score / update / delete
    risk.py              # safe risk add / list / show / roam / delete
    dependency.py        # safe dependency add / list / show / roam / delete
    board.py             # safe board show / export (PI program board)
  api/
    main.py              # FastAPI app; lifespan; router registration; run() entry point
    deps.py              # get_repos_dep() Depends factory; DB lifecycle via lifespan
    schemas.py           # Create/Update/action request body schemas (never expose id/computed fields)
    routers/             # One file per resource; mirrors safe/cli/ structure
      arts.py            # GET/POST /art, GET/PATCH/DELETE /art/{id}
      teams.py           # GET/POST /team, GET/PATCH/DELETE /team/{id}
      pi.py              # GET/POST /pi, GET/PATCH/DELETE /pi/{id}, POST activate/close
      iterations.py      # GET/POST /iterations (?pi_id required), GET/PATCH/DELETE /{id}
      features.py        # GET/POST /features (?sort=wsjf_desc), GET/PATCH/DELETE /{id}, POST /assign
      stories.py         # GET/POST /stories, GET/PATCH/DELETE /{id}
      objectives.py      # GET/POST /objectives, GET/PATCH/DELETE /{id}
      risks.py           # GET/POST /risks, GET/PATCH/DELETE /{id}, POST /roam
      dependencies.py    # GET/POST /dependencies, GET/PATCH/DELETE /{id}, POST /roam
      capacity_plans.py  # GET/POST /capacity-plans (upsert), GET/PATCH/DELETE /{id}
      compute.py         # POST /compute/predictability (stateless)
      dev.py             # POST /dev/reset-db — TinyDB reload for e2e test fixtures (only mounted when SAFE_DEV_ROUTES=1)
  store/
    db.py                # get_db(path?), close_db() — singleton TinyDB
    repository.py        # Repository[T] — generic save/get/find/delete
    repos.py             # Repos dataclass; get_repos() entry point
docs/
  openapi.yaml           # OpenAPI 3.1 spec — authoritative API contract
tests/
  conftest.py                # shared db (tmp_path TinyDB) and client (TestClient) fixtures
  test_wsjf.py
  test_capacity.py
  test_predictability.py
  test_models.py
  test_repository.py
  test_cli.py                # stateless wsjf / capacity / pi predictability commands
  test_art_commands.py
  test_team_commands.py
  test_pi_commands.py
  test_feature_commands.py
  test_story_commands.py
  test_backlog_commands.py
  test_capacity_commands.py
  test_objective_commands.py
  test_risk_commands.py
  test_dependency_commands.py
  test_board_commands.py
  test_board_commands.py
  test_api_arts.py           # one test file per API router
  test_api_teams.py
  test_api_pi.py
  test_api_iterations.py
  test_api_features.py
  test_api_stories.py
  test_api_objectives.py
  test_api_risks.py
  test_api_dependencies.py
  test_api_capacity_plans.py
  test_api_compute.py
  test_api_smoke.py          # end-to-end smoke test across all routers
  test_openapi_contract.py   # schemathesis contract test — parametrizes all OAS 3.1 operations
  test_pi_logic.py           # tests for validate_pi_transition
Dockerfile
docker-compose.yml       # podman compose up -d --build
pyproject.toml
```

## Technical Conventions

**Models**
- All models live in `safe/models/`; import via `safe.models` (the `__init__.py`), not individual files.
- Every entity inherits `SAFeBaseModel` (`safe/models/base.py`), which provides the `id: str` field with a `uuid4` default.
- **Free-text string fields must use `ShortText` (names/owners, max 200) or `LongText` (descriptions/notes, max 2000) from `safe.models.base`** — never plain `str`. These types strip HTML tags via a `BeforeValidator` to prevent XSS. ID/FK fields remain plain `str`. See `CLAUDE_SECURITY.md` for full rules.
- Computed fields (`wsjf_score`, `cost_of_delay`, `available_capacity`, `is_committed`) use Pydantic `@computed_field`. They are **never stored** — `Repository.save()` derives exclusions at runtime via `model_computed_fields.keys()` and they are recomputed on `model_validate()`.
- `date` fields serialise to ISO strings via `model_dump(mode="json")` and round-trip correctly through `model_validate`.

**Persistence**
- All storage goes through `Repository[T]` in `safe/store/repository.py`. No code should call `TinyDB` directly outside `store/`.
- Use `get_repos()` to obtain all repositories. Pass a `TinyDB` instance (from `get_db(path)`) in tests to avoid touching the real database. **Important:** use `db if db is not None else get_db()` — not `db or get_db()` — because TinyDB defines `__len__` and an empty database is falsy.
- `save()` is an upsert keyed on `id`. Deletion of entities referenced by others should check for downstream references first.
- When creating relationships (e.g. adding a team to an ART), perform the dual-write explicitly: save the child entity first, then update and save the parent's ID list.

**Logic**
- Business logic lives in pure functions in `safe/logic/`. No I/O, no TinyDB, no Rich imports.
- CLI modules (`safe/cli/`) are the only place Rich rendering happens.
- CLI commands call logic functions; logic functions accept model objects or plain scalars.

**CLI structure**
- Each CLI module (`art.py`, `team.py`, `pi.py`) owns its own `console = Console()` and a `_repos()` helper that reads `state.db_path`.
- The root callback in `main.py` sets `state.db_path` when `--db-path` is passed; all sub-apps pick it up via `safe.cli.state`.
- Tests that patch Rich output must monkeypatch the specific module's `console`, not just `main.console`.

**Frontend**
- Use small helper functions for repeated static config rows with the same object shape when they reduce duplication while keeping call sites readable (for example, `navItem('capacity', 'Capacity')`).
- Prefer explicit object literals when there are only a few entries, when fields vary meaningfully, or when named properties are clearer than positional arguments.

**TinyDB threading — critical**
- TinyDB is **not thread-safe**. FastAPI runs each request handler in a worker thread via `anyio.to_thread.run_sync`, so concurrent requests (e.g. multiple `useQuery` hooks firing simultaneously from the React frontend) will interleave file reads and writes, corrupting `db.json` with a `JSONDecodeError`.
- All DB access is serialised through a module-level `threading.Lock` in `safe/api/deps.py`. `get_repos_dep` is a **generator** dependency that holds `_db_lock` for the full duration of each request.
- **Never** call `TinyDB` or `Repos` outside of `get_repos_dep` in an async/threaded context. Never add a second code path that bypasses `get_repos_dep` (e.g. a background task that calls `Repos(_db)` directly) — it will race with the lock.
- Never fire multiple concurrent write requests from the frontend to work around this (e.g. `Promise.all` over N upserts). If N writes are needed, implement a single bulk endpoint that does them sequentially inside one lock acquisition.

**API structure**
- All API route prefixes use **singular resource names**: `/art`, `/team`, `/pi`, `/iterations`, `/features`, `/stories`, `/objectives`, `/risks`, `/dependencies`, `/capacity-plans`. Never use plurals like `/arts` or `/teams`.
- Domain models are used directly as `response_model`. Request bodies always use separate `*Create` / `*Update` schemas from `schemas.py` — never expose `id`, computed fields, or relationship ID lists (`team_ids`, `story_ids`, etc.) in request bodies.
- PATCH handlers use `model_copy(update=body.model_dump(exclude_unset=True))` — `exclude_unset=True` is required so omitted fields are not overwritten with `None`.
- 404 → `HTTPException(404)`, state machine violations → `HTTPException(409)`, validation → FastAPI raises 422 automatically.
- API tests use the `client` fixture from `tests/conftest.py` which injects a fresh `tmp_path` TinyDB via `app.dependency_overrides[get_repos_dep]`.
- The API DB lifecycle is independent of the CLI's `state.db_path` singleton — configured via `SAFE_DB_PATH` env var.

**Testing**
- Repository tests use `tmp_path` fixture to get a fresh TinyDB per test.
- Logic tests are pure unit tests with no I/O.
- CLI tests use `typer.testing.CliRunner` with `--db-path` pointing to a tmp file. Each test module includes an `autouse` `reset_state` fixture that sets `state.db_path = None` before and after each test to prevent state leaking between invocations.
- API tests use `fastapi.testclient.TestClient` with `app.dependency_overrides` to inject a `tmp_path` TinyDB — see `tests/conftest.py`.

**Contract testing with schemathesis**
- `tests/test_openapi_contract.py` uses **schemathesis ≥ 4.0** to auto-generate test cases from the live OpenAPI schema served by the ASGI app (`/openapi.json`).
- The `@schema.parametrize()` decorator expands into one pytest case per operation × example combination; `pytest -v` shows each as `test_api_contract[GET /art]`, etc.
- The assertion is intentionally minimal: any 5xx response is a failure. 4xx responses (e.g. 422 for missing required fields) are expected and pass.
- **API version note**: schemathesis 4.x changed its public API. Always use `schemathesis.openapi.from_asgi()` (not `schemathesis.from_asgi()`). To send a case, use `schema.transport.send(case)` (not `case.call_asgi()`).
- The test injects a fresh `tmp_path` TinyDB via `app.dependency_overrides` — same pattern as `test_api_*.py` — so it never touches the real database.
- The app uses **OpenAPI 3.1.0**; schemathesis < 4.0 does not support OAS 3.1. Do not downgrade the pinned version.
- **`FailedHealthCheck: Too many generated examples are filtered out`** means Hypothesis is discarding too many generated inputs via internal `assume()` calls. The usual cause for PATCH endpoints is an `*Update` schema with very few optional fields and no `minProperties` constraint — Hypothesis generates empty `{}` bodies, schemathesis filters them out as degenerate, and the discard rate crosses the threshold. **Fix: add `minProperties: 1` to the offending `*Update` schema in `docs/openapi.yaml`.** Do not suppress the health check with `@settings(suppress_health_check=...)` — that hides the root cause without fixing it.

**Testing standards — follow the test pyramid**

Apply coverage at the right level. Prefer many fast, focused tests over a few broad ones:

| Layer | Where | What to cover |
|-------|-------|---------------|
| **Unit** | `tests/test_wsjf.py`, `test_capacity.py`, `test_predictability.py`, `test_models.py` | Every pure function, all edge cases and error paths |
| **Integration** | `tests/test_*_commands.py`, `tests/test_api_*.py` | Happy path + key error cases for every CLI command and API endpoint |
| **E2e** | `frontend/e2e/*.spec.ts` | Critical user flows end-to-end; not exhaustive field validation (that lives in unit tests) |

Rules:
- **New business logic** → unit test in `tests/`.
- **New CLI command or API endpoint** → integration test; at minimum happy path + 404/409.
- **New UI page or mutation flow** → Playwright e2e test covering open modal, submit, and result visible.
- **Before any non-trivial commit** (new feature, bug fix, refactor) run the full suite:
  ```bash
  python -m ruff check . && python -m ruff format --check . && python -m pytest tests/
  ```
  For changes that touch the frontend or API together, also run:
  ```bash
  cd frontend && npx playwright test
  ```
- E2e tests use `tests/e2e_fixture.clean.json` as a static DB snapshot. Mutation test files call `resetDb()` in `beforeEach` to restore it. Never modify `e2e_fixture.clean.json` directly — regenerate it intentionally when the fixture data needs to change.

## Build Phases

| Phase | Scope | Status |
|-------|-------|--------|
| 1 | Persistence foundation — `Repository[T]`, model extensions, new models | **Done** |
| 2 | ART / Team / PI setup commands (CLI) | **Done** |
| 3 | Program Backlog Manager + stateful WSJF (CLI) | **Done** |
| 4 | Capacity Planner (stateful CLI) | **Done** |
| 5 | PI Objectives Tracker (CLI) | **Done** |
| 6 | Risk Register (CLI) | **Done** |
| 7 | Dependency Mapper (CLI) | **Done** |
| 8 | FastAPI HTTP layer — full OpenAPI implementation | **Done** |
| 9 | PI Board (integrating view) | **Done** |
| 10 | Web frontend — React SPA consuming the FastAPI layer | **Done** |

## Planned CLI Command Tree

```
safe [--db-path PATH]
  ├── art       create / show / list
  ├── team      create / show / list / delete
  ├── pi        create / show / list / activate / close / predictability
  │   └── iteration  add / list / delete
  ├── feature   add / show / list / rank / update / assign / delete
  ├── wsjf      score (stateless) / rank (alias for feature rank)
  ├── backlog   show / import / export
  ├── story     add / list / update / delete
  ├── capacity  calc (stateless) / set / show / export
  ├── objective add / list / score / update / delete
  ├── risk      add / list / roam / show / delete
  ├── dependency add / list / roam / show / delete
  └── board     show / export
```

## Git Workflow

- Each new feature or phase must be developed on its own branch, branched from `main`.
- **Before creating a new branch**, always `git pull origin main` first so the branch starts from the latest main. Never branch from a stale local main.
- Branch naming: `feat/<short-description>` (e.g. `feat/phase-3-backlog-manager`).
- Every feature branch must have its own PR targeting `main` before being merged.
- Never commit feature work directly to `main`.
- **Before switching branches**, always commit and push all finished work on the current branch. If there are uncommitted changes that are not ready to commit (broken, incomplete, or uncertain), do not switch branch silently — instead ask the user whether to stash, discard, or fix the changes before proceeding.
- **Always include the co-author trailer** in every commit message:
  ```
  Co-Authored-By: Claude Code <noreply@anthropic.com>
  ```
- **Version bump — always ask before creating a PR.** When the user asks you to create a PR, assess whether the changes warrant a version bump (patch for bug fixes, minor for new features, major for breaking API or data changes). If they do, ask the user to confirm the bump and which level before proceeding. Update `pyproject.toml` and `frontend/package.json` in the same commit so they stay in sync.

## Documentation

- **Always update `README.md` when completing a phase or adding new commands.** This means:
  - Marking the feature as "Working" (not "Planned") in the What's implemented table.
  - Adding usage examples for every new command group.
  - Updating the Project Layout section if new files were added.
- **Always update `CLAUDE.md` build phase status** to **Done** when a phase is complete.
- Documentation updates must be committed on the same branch as the feature work, before the PR is created.

## Out of Scope

- Full ALM/project management system replacement (not Jira/Rally)
- Portfolio-level SAFe artifacts (Value Streams, Strategic Themes) unless explicitly added later
- Multi-ART coordination (single ART focus for now)
- Multi-user or shared access (local single-user tool only)
