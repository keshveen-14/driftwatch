"""Runs simulations in a background worker and caches them by configuration."""
from __future__ import annotations

import hashlib
import json
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

from ..db import RunStore
from ..ml.strategies import SimParams, run_simulation
from ..schemas import SimulationRequest


def config_hash(req: SimulationRequest) -> str:
    return hashlib.sha256(json.dumps(req.model_dump(), sort_keys=True).encode()).hexdigest()[:16]


class SimulationService:
    def __init__(self, store: RunStore):
        self.store = store
        # One worker: scikit-learn already uses every core, so parallel runs would only fight.
        self._pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="sim")
        self._progress: dict[str, float] = {}
        self._lock = threading.Lock()

    def submit(self, req: SimulationRequest) -> dict:
        """Queue a run, or return the existing one for an identical configuration."""
        h = config_hash(req)
        existing = self.store.find_by_hash(h)
        if existing:
            return self._public(existing)
        run_id = uuid.uuid4().hex[:12]
        self.store.insert(run_id, h, datetime.now(timezone.utc).isoformat(), req.model_dump())
        self._progress[run_id] = 0.0
        self._pool.submit(self._run, run_id, req)
        return self._public(self.store.get(run_id))

    def _run(self, run_id: str, req: SimulationRequest):
        self.store.set_status(run_id, "running")
        try:
            params = SimParams(**{k: v for k, v in req.model_dump().items() if k != "strategies"})
            result = run_simulation(params, tuple(req.strategies),
                                    on_progress=lambda f: self._progress.__setitem__(run_id, f))
            result["config"] = req.model_dump()
            summary = {s: v["summary"] for s, v in result["strategies"].items()}
            self.store.finish(run_id, summary, result)
        except Exception as exc:  # noqa: BLE001 - surfaced to the client as a failed run
            self.store.set_status(run_id, "failed", str(exc))
        finally:
            self._progress.pop(run_id, None)

    def _public(self, row: dict, include_result=False) -> dict:
        out = {
            "id": row["id"],
            "created_at": row["created_at"],
            "status": row["status"],
            "config": json.loads(row["config"]),
            "summary": json.loads(row["summary"]) if row.get("summary") else None,
            "progress": 1.0 if row["status"] == "done" else self._progress.get(row["id"], 0.0),
            "error": row.get("error"),
        }
        if include_result and row.get("result"):
            out["result"] = json.loads(row["result"])
        return out

    def get(self, run_id: str, include_result=True):
        row = self.store.get(run_id)
        return self._public(row, include_result) if row else None

    def list(self, limit=30):
        return [self._public({**r, "result": None}) for r in self.store.list(limit)]

    def delete(self, run_id: str) -> bool:
        return self.store.delete(run_id)
