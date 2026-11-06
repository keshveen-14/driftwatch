import time

import numpy as np

from .conftest import SMALL

CFG = {"scenario": "concept_only", "strategies": ["frozen", "hybrid"], **SMALL}


def _wait(client, run_id, timeout=90):
    end = time.time() + timeout
    while time.time() < end:
        run = client.get(f"/api/simulations/{run_id}").json()
        if run["status"] in ("done", "failed"):
            return run
        time.sleep(0.3)
    raise AssertionError("simulation did not finish")


def test_health_and_meta(client):
    assert client.get("/api/health").json() == {"status": "ok"}
    meta = client.get("/api/meta").json()
    assert len(meta["features"]) == 10 and len(meta["strategies"]) == 6


def test_simulation_lifecycle_and_cache(client):
    r = client.post("/api/simulations", json=CFG)
    assert r.status_code == 202
    run = _wait(client, r.json()["id"])
    assert run["status"] == "done"
    assert set(run["summary"]) == {"frozen", "hybrid"}
    assert run["result"]["strategies"]["hybrid"]["records"][0]["week"] == 3
    # same config, strategies in another order -> same run, no recompute
    again = client.post("/api/simulations", json={**CFG, "strategies": ["hybrid", "frozen"]})
    assert again.json()["id"] == run["id"]
    assert run["id"] in [x["id"] for x in client.get("/api/simulations").json()]


def test_delete_and_404(client):
    run = client.post("/api/simulations", json={**CFG, "seed": 77}).json()
    _wait(client, run["id"])
    assert client.delete(f"/api/simulations/{run['id']}").status_code == 204
    assert client.get(f"/api/simulations/{run['id']}").status_code == 404
    assert client.delete("/api/simulations/nope").status_code == 404


def test_validation(client):
    assert client.post("/api/simulations", json={"scenario": "bogus"}).status_code == 422
    assert client.post("/api/simulations", json={"n_weeks": 14, "drift_start": 12}).status_code == 422
    assert client.post("/api/simulations", json={"label_delay": 99}).status_code == 422


def test_drift_simulate_alarm_and_quiet(client):
    hot = client.post("/api/drift/simulate", json={"shift": 1.5, "features": [0, 1, 2]}).json()
    assert hot["alarm"] and len(hot["drifted_features"]) == 3
    calm = client.post("/api/drift/simulate", json={"shift": 0.0}).json()
    assert not calm["alarm"]
    one = client.post("/api/drift/simulate", json={"shift": 1.5, "features": [3]}).json()
    assert one["drifted_features"] == ["merchant_risk"] and not one["alarm"]


def test_drift_check_rules(client):
    rows = np.random.default_rng(0).normal(size=(300, 10)).tolist()
    assert client.post("/api/drift/check", json={"rows": rows}).status_code == 200
    assert client.post("/api/drift/check", json={"rows": rows[:50]}).status_code == 422
    assert client.post("/api/drift/check", json={"rows": [[1.0, 2.0]] * 300}).status_code == 422


def test_predict_orders_risk(client):
    safe = [0.0] * 10
    risky = [2.4, -1.6, 2.0, 1.6, -1.6, 1.4, 0.5, -1.0, 0.5, 0.0]
    out = client.post("/api/predict", json={"rows": [safe, risky]}).json()["predictions"]
    assert out[1]["score"] > out[0]["score"] and out[0]["risk"] == "low"


def test_benchmark_missing_returns_404(client):
    assert client.get("/api/benchmark").status_code == 404
