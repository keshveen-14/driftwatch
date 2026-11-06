"""DriftWatch API. Serves the JSON API and, in production, the built React app."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .api.routes import router
from .config import settings
from .db import RunStore
from .schemas import SimulationRequest
from .services.monitoring import MonitoringService
from .services.simulations import SimulationService

log = logging.getLogger("driftwatch")


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.store = RunStore(settings.db_path)
    app.state.simulations = SimulationService(app.state.store)
    app.state.monitoring = MonitoringService()
    if settings.warm_start:
        # Queue the three headline scenarios so the dashboard has data on first load.
        for scenario in ("mixed", "concept_only", "covariate_only"):
            app.state.simulations.submit(SimulationRequest(scenario=scenario))
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="DriftWatch", version="2.0.0",
                  description="Monitor a deployed classifier for drift and compare retraining policies.",
                  lifespan=lifespan)
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins,
                       allow_methods=["*"], allow_headers=["*"])
    app.include_router(router)

    dist = settings.frontend_dist
    if dist.exists():
        app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

        @app.get("/{path:path}", include_in_schema=False)
        def spa(path: str):
            candidate = dist / path
            if path and candidate.is_file() and dist in candidate.resolve().parents:
                return FileResponse(candidate)
            return FileResponse(dist / "index.html")
    return app


app = create_app()
