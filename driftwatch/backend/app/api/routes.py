"""HTTP routes. Everything lives under /api."""
from __future__ import annotations

import json

import numpy as np
from fastapi import APIRouter, HTTPException, Request

from ..config import settings
from ..ml.data import FEATURES, SCENARIOS
from ..ml.detect import KS_ALPHA, MIN_DRIFTED_FEATURES, PSI_THRESHOLD
from ..ml.strategies import STRATEGIES, TRAIN_WEEKS
from ..schemas import DriftSimRequest, Rows, SimulationRequest

router = APIRouter(prefix="/api")

STRATEGY_INFO = {
    "frozen": {"label": "Frozen", "blurb": "Never retrain. The baseline everything is compared to."},
    "scheduled": {"label": "Scheduled", "blurb": "Retrain on a fixed calendar, drift or not."},
    "drift_triggered": {"label": "Drift-triggered", "blurb": "Retrain when PSI and KS flag input drift."},
    "performance_triggered": {"label": "Performance-triggered",
                              "blurb": "Retrain when labelled AUC drops below its launch baseline."},
    "hybrid": {"label": "Hybrid", "blurb": "Retrain on either signal: input drift or an AUC drop."},
    "weekly_oracle": {"label": "Weekly oracle", "blurb": "Retrain every week. Upper bound on accuracy and cost."},
}
SCENARIO_INFO = {
    "mixed": {"label": "Mixed drift", "blurb": "Inputs shift and the label rule changes for some features."},
    "covariate_only": {"label": "Input drift only", "blurb": "Inputs shift; the label rule stays the same."},
    "concept_only": {"label": "Concept drift only",
                     "blurb": "Inputs look identical; the label rule changes. Feature monitors cannot see this."},
}


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/meta")
def meta():
    return {
        "features": FEATURES,
        "scenarios": [{"id": s, **SCENARIO_INFO[s]} for s in SCENARIOS],
        "strategies": [{"id": s, **STRATEGY_INFO[s]} for s in STRATEGIES],
        "train_weeks": TRAIN_WEEKS,
        "detector": {"psi_threshold": PSI_THRESHOLD, "ks_alpha": KS_ALPHA, "min_features": MIN_DRIFTED_FEATURES},
    }


@router.post("/simulations", status_code=202)
def create_simulation(body: SimulationRequest, request: Request):
    """Queue a simulation. An identical configuration returns the existing run."""
    return request.app.state.simulations.submit(body)


@router.get("/simulations")
def list_simulations(request: Request, limit: int = 30):
    return request.app.state.simulations.list(min(max(limit, 1), 100))


@router.get("/simulations/{run_id}")
def get_simulation(run_id: str, request: Request):
    run = request.app.state.simulations.get(run_id)
    if not run:
        raise HTTPException(404, "run not found")
    return run


@router.delete("/simulations/{run_id}", status_code=204)
def delete_simulation(run_id: str, request: Request):
    if not request.app.state.simulations.delete(run_id):
        raise HTTPException(404, "run not found")


@router.get("/benchmark")
def benchmark():
    path = settings.benchmark_path
    if not path.exists():
        raise HTTPException(404, "benchmark not generated yet: run python research/run_benchmark.py")
    return json.loads(path.read_text())


@router.post("/predict")
def predict(body: Rows, request: Request):
    X = np.asarray(body.rows, dtype=float)
    return {"predictions": request.app.state.monitoring.predict(X)}


@router.post("/drift/check")
def drift_check(body: Rows, request: Request):
    if len(body.rows) < 200:
        raise HTTPException(422, "send at least 200 rows for a stable drift check")
    return request.app.state.monitoring.check(np.asarray(body.rows, dtype=float))


@router.post("/drift/simulate")
def drift_simulate(body: DriftSimRequest, request: Request):
    return request.app.state.monitoring.simulate(body.shift, body.features, body.n, body.seed)
