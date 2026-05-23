[![CI](https://github.com/hobsojam/SAFe_tooling/actions/workflows/ci.yml/badge.svg)](https://github.com/hobsojam/SAFe_tooling/actions/workflows/ci.yml)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=hobsojam_SAFe_tooling&metric=coverage)](https://sonarcloud.io/summary/new_code?id=hobsojam_SAFe_tooling)
# SAFe Tooling

> **Disclaimer:** This is an independent, open-source project and is not an official Scaled Agile product. It is not affiliated with, endorsed by, or sponsored by Scaled Agile, Inc. SAFe® and Scaled Agile Framework® are registered trademarks of Scaled Agile, Inc.

> **Not for production use:** This tool has no authentication or authorisation. Anyone with network access to the API can read and modify all data. It is intended for local, single-user use only — do not expose the API or web UI on a shared or public network.

A local PI Planning platform for Scaled Agile Framework (SAFe) teams. Manage your ART's Program Increments through a web interface, a REST API, or a terminal CLI — all backed by a single JSON store at `~/.safe_tooling/db.json`.

## What it does

| Domain | Capabilities |
|--------|-------------|
| **ART & Teams** | Define your Agile Release Train and teams |
| **Program Increments** | Create PIs, manage their lifecycle (planning → active → closed), add iterations |
| **Program Backlog** | Track features with WSJF scoring (Cost of Delay / Job Size), rank by priority |
| **Capacity Planning** | Set team capacity per iteration, track story point load % |
| **PI Objectives** | Record committed and stretch objectives with business value scoring |
| **Risk Register** | Log risks and ROAM them (Resolved / Owned / Accepted / Mitigated) |
| **Dependencies** | Map cross-team dependencies and track their resolution |
| **Program Board** | Visual teams × iterations board with feature placement and dependency overlay |
| **Predictability** | Calculate ART PI predictability from planned vs. actual business value |
| **PI Roadmap** | Cross-PI feature timeline — view all features across every PI in a team × PI matrix |

## Screenshots

| Board | Backlog |
|-------|---------|
| ![Program Board](docs/screenshots/board.png) | ![Program Backlog](docs/screenshots/backlog.png) |

| Capacity | PI Health |
|----------|-----------|
| ![Capacity Planning](docs/screenshots/capacity.png) | ![PI Health](docs/screenshots/pi-health.png) |

![Risks](docs/screenshots/risks.png)

> Screenshots are captured automatically from the fixture dataset on every merge to `main`.

---

## Three interfaces

| Interface | Best for | How to start |
|-----------|----------|-------------|
| **Web UI** | Creating and reviewing PI data (ARTs, Teams, PIs, Board, Backlog, …) | `SAFE_SEED_DEV=1 safe-api` + `cd frontend && npm run dev` |
| **REST API** | Integrations and scripting | `safe-api` → `http://127.0.0.1:8000/docs` |
| **CLI** | Bulk creation and scripting | `safe --help` |

---

## Quick start

### Requirements

- Python 3.11+
- Node.js 20+ (web UI only)

### Install

```bash
pip install -e ".[dev]"
```

This installs two executables on your `PATH`:

| Command | Description |
|---------|-------------|
| `safe` | CLI for creating and managing all SAFe entities |
| `safe-api` | FastAPI/uvicorn server on `http://127.0.0.1:8000` |

> **Not sure if the executables are on your PATH?** You can always use the Python module form instead — `python -m safe.api.main` is equivalent to `safe-api`, and `python -m safe.cli.main` is equivalent to `safe`. All examples below show both forms.

### Running in dev mode (recommended for local testing)

Dev mode starts the API with a realistic pre-seeded dataset (one ART, two teams, one active PI, four features, ten stories, risks, and dependencies). This is the easiest way to explore the web UI without manually creating data first.

Open **two terminal windows** in the project root.

**Terminal 1 — API server (dev mode):**

Linux / macOS:
```bash
SAFE_SEED_DEV=1 safe-api
# or: SAFE_SEED_DEV=1 python -m safe.api.main
```

Windows PowerShell:
```powershell
$env:SAFE_SEED_DEV = "1"; safe-api
# or: $env:SAFE_SEED_DEV = "1"; python -m safe.api.main
```

The server starts on **http://127.0.0.1:8000**. Interactive API docs are at **http://127.0.0.1:8000/docs**.

> `SAFE_SEED_DEV=1` triggers the built-in dev seed on startup. The seed only runs when the database is empty, so it is safe to set on every startup. **Without this flag the database starts empty and the PI dropdown in the web UI will show no options.**

**Terminal 2 — Frontend dev server:**
```bash
cd frontend
npm install   # first time only
npm run dev
# Starts on http://localhost:5173 by default
```

Open **http://localhost:5173** in your browser (check the terminal output for the exact URL — if 5173 is already in use, Vite will automatically try 5174, 5175, etc.). Select a PI from the sidebar to see the Board, Backlog, Risks, Dependencies, PI Setup, and Team Setup pages. The ART Setup page is accessible from the sidebar at any time without a PI selected.

> The Vite dev server proxies `/api/*` to FastAPI on port 8000 — no CORS configuration needed.

### Option A — API only (no seed data)

To start the API against your real database (no seed data):

```bash
safe-api
# or: python -m safe.api.main
```

Use the web UI to create ARTs and Teams via the ART Setup and Team Setup pages, and the CLI (`safe` or `python -m safe.cli.main`) to create PIs, features, stories, and other records. Browse everything via the web UI or API docs.

### Option B — CLI only

```bash
safe --help
# or: python -m safe.cli.main --help
```

All commands accept `--db-path PATH` to use a custom database file instead of `~/.safe_tooling/db.json`.

### Option C — Docker (API + frontend together)

```bash
podman compose up -d --build
# API:      http://127.0.0.1:8000
# Frontend: http://127.0.0.1:3000
```

> On Windows with Podman, use `127.0.0.1` not `localhost` — WSL2's IPv6 forwarding causes a connection reset with `localhost`.

---

## Web frontend

The React SPA provides views across all key PI artifacts for a selected PI.

| Page | Route | Description |
|------|-------|-------------|
| **Board** | `/pi/:id/board` | Program Board — feature cards placed in team × iteration grid with dependency arrows |
| **Backlog** | `/pi/:id/backlog` | WSJF-ranked feature list with inline story management per feature |
| **Objectives** | `/pi/:id/objectives` | PI Objectives — committed and stretch objectives with planned/actual BV scoring; predictability summary footer |
| **Predictability** | `/pi/:id/predictability` | ART PI Predictability — per-team and ART-level actual vs planned BV with colour-coded predictability % |
| **Capacity** | `/pi/:id/capacity` | Capacity grid — set team size, PTO, and overhead per iteration; cells colour-coded by load % (amber / blue / red) |
| **Risks** | `/pi/:id/risks` | ROAM risk register with unroamed count callout |
| **Dependencies** | `/pi/:id/dependencies` | Cross-team dependency tracker with unresolved count |
| **Inspect & Adapt** | `/pi/:id/inspect-adapt` | End-of-PI ceremony view — predictability summary, ROAM breakdown, and full objectives table |
| **PI Setup** | `/pi/:id/setup` | Edit PI details, manage lifecycle (activate/close), add/delete iterations, delete PI |
| **Team Setup** | `/pi/:id/team-setup` | Create, rename, and delete ART teams; set Team Topologies type; reassign a team to a different ART |
| **ART Setup** | `/art-setup` | Create, rename, and delete Agile Release Trains (always accessible) |
| **PI Roadmap** | `/roadmap` | Cross-PI feature matrix — teams as rows, PIs as columns, feature cards with status and WSJF score (always accessible) |

Built with Vite, React 18, TypeScript, Tailwind CSS v4, TanStack Query, and React Router.

| Board | Backlog |
|-------|---------|
| ![Program Board](https://raw.githubusercontent.com/hobsojam/SAFe_tooling/screenshots/docs/screenshots/board.png) | ![Program Backlog](https://raw.githubusercontent.com/hobsojam/SAFe_tooling/screenshots/docs/screenshots/backlog.png) |

| PI Roadmap |
|-----------|
| ![PI Roadmap](https://raw.githubusercontent.com/hobsojam/SAFe_tooling/screenshots/docs/screenshots/roadmap.png) |

---

## REST API

Full CRUD for every domain entity, exposed via FastAPI.

```bash
safe-api                             # starts on http://127.0.0.1:8000
SAFE_DB_PATH=/path/to/db.json safe-api   # custom DB location
```

Interactive docs: **http://127.0.0.1:8000/docs**

### Key endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET/POST` | `/art` | ARTs |
| `GET/POST` | `/team` | Teams |
| `GET/POST` | `/pi` | PIs |
| `POST` | `/pi/{id}/activate` | planning → active |
| `POST` | `/pi/{id}/close` | active → closed |
| `GET/POST` | `/iterations` | Iterations (`?pi_id` required for list) |
| `GET/POST` | `/features` | Features (`?sort=wsjf_desc`, `?pi_id`, `?team_id`) |
| `POST` | `/features/{id}/assign` | Assign feature to a team |
| `GET/POST` | `/stories` | Stories |
| `GET/POST` | `/objectives` | PI Objectives |
| `GET/POST` | `/risks` | Risks |
| `POST` | `/risks/{id}/roam` | Set ROAM status |
| `GET/POST` | `/dependencies` | Dependencies |
| `POST` | `/dependencies/{id}/roam` | Set dependency status |
| `GET/POST` | `/capacity-plans` | Capacity plans (upsert) |
| `POST` | `/compute/predictability` | Stateless ART predictability |

---

## CLI reference

The CLI is the primary way to create and update records. The web UI and API are used to read and view.

### ART & Teams

```bash
safe art create --name "Platform ART"
safe art list
safe art show <id>

safe team create --name "Alpha" --members 6 --art-id <art-id>
safe team create --name "Platform Team" --members 7 --art-id <art-id> \
  --topology-type platform          # stream_aligned | enabling | complicated_subsystem | platform
safe team list
safe team list --art-id <art-id>
safe team show <id>
safe team delete <id>
```

### PI lifecycle

```bash
safe pi create --name "PI 2026.1" --art-id <art-id> --start 2026-01-05 --end 2026-03-27
safe pi activate <id>   # planning → active
safe pi close <id>      # active → closed
safe pi list
safe pi show <id>

safe pi iteration add --pi-id <pi-id> --number 1 --start 2026-01-05 --end 2026-01-16
safe pi iteration add --pi-id <pi-id> --number 5 --start 2026-03-16 --end 2026-03-27 --ip
safe pi iteration list --pi-id <pi-id>
safe pi iteration delete <id>
```

### Program Backlog

```bash
# Features
safe feature add --name "Auth Service" \
  --user-value 8 --time-crit 5 --risk-reduction 3 --job-size 4 --pi-id <pi-id>
safe feature assign <id> --team-id <team-id>
safe feature update <id> --status implementing
safe feature list --pi-id <pi-id>
safe feature rank              # WSJF-ranked view
safe backlog show              # ranked view with story counts
safe feature delete <id>

# Stories
safe story add --name "Login flow" --feature-id <fid> --team-id <tid> --points 3 \
  --iteration-id <iter-id>
safe story list --feature-id <fid>
safe story update <id> --status in_progress
safe story delete <id>

# Stateless WSJF calculator
safe wsjf score --user-value 8 --time-crit 5 --risk-reduction 3 --job-size 4
```

### Capacity planning

```bash
safe capacity set --pi-id <pi-id> --team-id <tid> --iteration-id <iter-id> \
  --team-size 7 --pto 2 --overhead 0.2
safe capacity show --pi-id <pi-id>
safe capacity export --pi-id <pi-id> --output capacity.csv

# Stateless calculation
safe capacity calc --team-size 7 --days 10 --pto 3 --overhead 0.2
```

![Capacity Planning](https://raw.githubusercontent.com/hobsojam/SAFe_tooling/screenshots/docs/screenshots/capacity.png)

### PI Objectives

```bash
safe objective add --description "Deliver auth service" \
  --team-id <tid> --pi-id <pi-id> --planned-bv 8
safe objective add --description "Add SSO support" \
  --team-id <tid> --pi-id <pi-id> --planned-bv 5 --stretch
safe objective score <id> --actual-bv 7   # record at end of PI
safe objective list --pi-id <pi-id>
safe objective update <id> --planned-bv 9
safe objective delete <id>

# ART predictability
safe pi predictability --planned 10 --planned 8 --actual 9 --actual 7
```

![PI Health](https://raw.githubusercontent.com/hobsojam/SAFe_tooling/screenshots/docs/screenshots/pi-health.png)

### Risk Register

```bash
safe risk add --description "Auth service unavailable" --pi-id <pi-id> \
  --team-id <tid> --owner "Alice"
safe risk list --pi-id <pi-id>
safe risk list --status unroamed
safe risk show <id>
safe risk roam <id> --status owned --owner "Bob"
safe risk roam <id> --status mitigated --notes "Added circuit breaker"
safe risk roam <id> --status resolved
safe risk delete <id>
```

![Risks](https://raw.githubusercontent.com/hobsojam/SAFe_tooling/screenshots/docs/screenshots/risks.png)

### Dependencies

```bash
safe dependency add --description "Auth service API contract" \
  --pi-id <pi-id> --from-team-id <from-tid> --to-team-id <to-tid> \
  --owner "Alice" --needed-by 2026-02-14
safe dependency list --pi-id <pi-id>
safe dependency list --status identified
safe dependency show <id>
safe dependency roam <id> --status mitigated --notes "Interface agreed in Iteration 2"
safe dependency roam <id> --status resolved
safe dependency delete <id>
```

### Program Board

```bash
safe board show --pi-id <pi-id>
safe board export --pi-id <pi-id> --output board.xlsx
```

---

## Tests

```bash
pytest
pytest --cov=safe   # with coverage
```

### End-to-end (Playwright)

```bash
cd frontend
npx playwright test        # runs all 161 e2e tests against a local API + UI
npx playwright test --ui   # interactive UI mode
```

The e2e suite starts a dedicated API server on port 8001 and a Vite server on port 5180 automatically. It uses a static fixture database (`tests/e2e_fixture.clean.json`) that is restored before each test.

### Mutation testing

#### Python (`safe/logic/`)

Mutation tests run nightly on `main` via GitHub Actions using `mutmut`, scoped to `safe/logic/`. Results are published as a downloadable HTML report artifact on each run.

**View in the browser:** go to [Actions → Mutation Testing](https://github.com/hobsojam/SAFe_tooling/actions/workflows/mutation.yml), open the latest run, and download the `mutation-report` artifact at the bottom of the page.

**Download via CLI** (run from the repo root, not from `frontend/`):

```bash
gh run download <run-id> -R hobsojam/SAFe_tooling -n mutation-report
# run-id: gh run list --workflow "Mutation Testing" -R hobsojam/SAFe_tooling
```

Then open `index.html` from the downloaded folder in your browser.

#### Frontend (`frontend/src/`)

Mutation tests run nightly on `main` via GitHub Actions using [Stryker Mutator](https://stryker-mutator.io/) with the Vitest runner, scoped to `src/api/` and `src/components/`.

**Run locally** (from the `frontend/` directory):

```bash
npm run stryker
# Report written to frontend/reports/mutation/index.html
```

**Download the CI report** (run from the repo root):

```bash
gh run download <run-id> -R hobsojam/SAFe_tooling -n frontend-mutation-report
# run-id: gh run list --workflow "Frontend Mutation Testing" -R hobsojam/SAFe_tooling
```

Then open `index.html` from the downloaded folder in your browser.

---

## Project layout

```
frontend/           React SPA (Vite + TypeScript + Tailwind)
  src/
    api/            Typed fetch client
    components/     Layout, Badge, Spinner, EmptyState
    pages/          Board, Backlog, Objectives, Predictability, Capacity, Risks, Dependencies, Roadmap, Setup, TeamSetup, ARTSetup
  e2e/              Playwright end-to-end tests (154 tests)
  Dockerfile        Multi-stage build → nginx
  nginx.conf        SPA routing + /api/ proxy to FastAPI
safe/
  models/           Pydantic models (ART, Team, PI, Feature, Story, ...)
  logic/            Pure business logic (WSJF, capacity, predictability, board)
  cli/
    main.py         Root Typer app; wsjf score/rank; --db-path global option
    state.py        Shared CLI state (db_path)
    art.py          safe art commands
    team.py         safe team commands
    pi.py           safe pi and safe pi iteration commands
    feature.py      safe feature commands (add/show/list/rank/update/assign/delete)
    story.py        safe story commands (add/list/update/delete)
    backlog.py      safe backlog show
    capacity.py     safe capacity commands (calc/set/show/export)
    objective.py    safe objective commands (add/list/score/update/delete)
    risk.py         safe risk commands (add/list/show/roam/delete)
    dependency.py   safe dependency commands (add/list/show/roam/delete)
    board.py        safe board commands (show/export)
  api/
    main.py         FastAPI app; lifespan; router registration; run() entry point
    deps.py         get_repos_dep() Depends factory; DB lifecycle via lifespan
    schemas.py      Create/Update/action request body schemas
    routers/        One file per resource (arts, teams, pi, iterations, features, ...)
  store/            TinyDB persistence (Repository[T], get_repos())
tests/              pytest test suite (633 tests — unit, CLI, API, smoke)
Dockerfile          Python API image
docker-compose.yml  API (port 8000) + frontend/nginx (port 3000)
pyproject.toml
```

Data is stored at `~/.safe_tooling/db.json`. The CLI and API share this file.

---

## Planned improvements

| Area | Description |
|------|-------------|
| **API response documentation** | Add `responses={...}` annotations to FastAPI route decorators so the generated OpenAPI UI shows 404/409 status codes alongside each endpoint — tracked in [#212](https://github.com/hobsojam/SAFe_tooling/issues/212) |

---

## Development notes

See `CLAUDE.md` for SAFe domain vocabulary, entity relationships, technical conventions, and the phased build plan.

> **How README screenshots work:** on every merge to `main`, CI takes Playwright screenshots of the live app against the fixture dataset and force-pushes them as a single orphan commit to the [`screenshots`](https://github.com/hobsojam/SAFe_tooling/tree/screenshots) branch. The branch is auto-managed and should **never** be merged — any PR opened from it will be closed automatically.
