import logging
import os
from importlib.metadata import version as pkg_version

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from safe.api.deps import lifespan
from safe.api.routers import (
    arts,
    capacity_plans,
    compute,
    dependencies,
    features,
    improvement_actions,
    iterations,
    objectives,
    pi,
    risks,
    stories,
    teams,
)

_log = logging.getLogger("safe.api")


def _allowed_origins() -> list[str]:
    raw = os.environ.get("SAFE_ALLOWED_ORIGINS", "")
    extras = [o.strip() for o in raw.split(",") if o.strip()]
    return ["http://localhost:5173", "http://localhost:3000", *extras]


def create_app() -> FastAPI:
    docs_disabled = os.environ.get("SAFE_DISABLE_API_DOCS") == "1"
    api_app = FastAPI(
        title="SAFe Tooling API",
        version="1.0.0",
        description="HTTP API for SAFe PI Planning tooling",
        lifespan=lifespan,
        docs_url=None if docs_disabled else "/docs",
        redoc_url=None if docs_disabled else "/redoc",
        openapi_url=None if docs_disabled else "/openapi.json",
    )

    api_app.add_middleware(
        CORSMiddleware,
        allow_origins=_allowed_origins(),
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @api_app.middleware("http")
    async def _log_4xx(request: Request, call_next):
        response = await call_next(request)
        if response.status_code >= 500:
            _log.error("%s %s → %d", request.method, request.url.path, response.status_code)
        elif response.status_code >= 400:
            _log.warning("%s %s → %d", request.method, request.url.path, response.status_code)
        return response

    api_app.include_router(arts.router)
    api_app.include_router(teams.router)
    api_app.include_router(pi.router)
    api_app.include_router(iterations.router)
    api_app.include_router(features.router)
    api_app.include_router(stories.router)
    api_app.include_router(objectives.router)
    api_app.include_router(risks.router)
    api_app.include_router(dependencies.router)
    api_app.include_router(capacity_plans.router)
    api_app.include_router(improvement_actions.router)
    api_app.include_router(compute.router)

    if os.environ.get("SAFE_DEV_ROUTES") == "1":
        from safe.api.routers import dev

        api_app.include_router(dev.router)

    @api_app.get("/health", include_in_schema=False)
    def health() -> dict[str, str]:
        return {"status": "ok", "version": pkg_version("safe-tooling")}

    return api_app


app = create_app()


def run() -> None:
    import os

    host = os.environ.get("SAFE_API_HOST", "127.0.0.1")
    port = int(os.environ.get("SAFE_API_PORT", "8000"))
    uvicorn.run("safe.api.main:app", host=host, port=port, reload=False)


if __name__ == "__main__":
    run()
