"""Multi-seed benchmark. Writes research/results/benchmark.json (served by GET /api/benchmark).

    python research/run_benchmark.py 12        # about 12 minutes on two CPU cores

Part 1: every scenario x every policy, mean over seeds, with 95% CIs and the mean AUC curve.
Part 2: label-delay sweep, which shows how late labels hurt each policy.
"""
import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.ml.data import SCENARIOS  # noqa: E402
from app.ml.strategies import STRATEGIES, SimParams, run_simulation  # noqa: E402

N_SEEDS = int(sys.argv[1]) if len(sys.argv) > 1 else 12
DELAY_SEEDS = max(4, N_SEEDS // 2)
DRIFT_START = 10
OUT = ROOT / "research" / "results" / "benchmark.json"


def ci95(x):
    x = np.asarray(x, float)
    return float(1.96 * x.std(ddof=1) / np.sqrt(len(x))) if len(x) > 1 else 0.0


def aggregate(runs):
    """runs: list of run_simulation outputs for one scenario."""
    summary = {}
    for s in STRATEGIES:
        post = [r["strategies"][s]["summary"]["post_drift_auc"] for r in runs]
        summary[s] = {
            "pre_drift_auc": round(float(np.mean([r["strategies"][s]["summary"]["pre_drift_auc"] for r in runs])), 4),
            "post_drift_auc": round(float(np.mean(post)), 4),
            "post_drift_auc_ci95": round(ci95(post), 4),
            "retrains": round(float(np.mean([r["strategies"][s]["summary"]["retrains"] for r in runs])), 1),
            "weeks_degraded": round(float(np.mean([r["strategies"][s]["summary"]["weeks_degraded"] for r in runs])), 1),
            "auc_by_week": [round(float(v), 4) for v in np.mean(
                [[x["auc"] for x in r["strategies"][s]["records"]] for r in runs], axis=0)],
        }
    # Detector quality, measured on the frozen model so the reference never changes.
    def first(r, key):
        return next((x["week"] for x in r["strategies"]["frozen"]["records"]
                     if x[key] and x["week"] >= DRIFT_START), None)

    def false_alarms(r, key):
        return sum(1 for x in r["strategies"]["frozen"]["records"] if x[key] and x["week"] < DRIFT_START)

    det = {}
    for name, key in (("feature", "feature_alarm"), ("performance", "performance_alarm")):
        firsts = [first(r, key) for r in runs]
        hit = [f - DRIFT_START for f in firsts if f is not None]
        det[name] = {
            "detection_rate": round(len(hit) / len(runs), 3),
            "mean_weeks_to_detect": round(float(np.mean(hit)), 2) if hit else None,
            "false_alarm_weeks_per_run": round(float(np.mean([false_alarms(r, key) for r in runs])), 3),
        }
    return {"strategies": summary, "detectors": det}


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    result = {"n_seeds": N_SEEDS, "drift_start_week": DRIFT_START, "first_week": 3,
              "scenarios": {}, "label_delay": {}}
    for sc in SCENARIOS:
        runs = []
        for seed in range(N_SEEDS):
            runs.append(run_simulation(SimParams(scenario=sc, seed=seed)))
            print("main", sc, seed, flush=True)
        result["scenarios"][sc] = aggregate(runs)

    sweep_strats = ("scheduled", "drift_triggered", "hybrid")
    result["label_delay"] = {"n_seeds": DELAY_SEEDS, "strategies": list(sweep_strats), "scenarios": {}}
    for sc in ("mixed", "concept_only"):
        rows = []
        for delay in (0, 1, 2, 3):
            vals = {s: [] for s in sweep_strats}
            for seed in range(DELAY_SEEDS):
                r = run_simulation(SimParams(scenario=sc, seed=100 + seed, label_delay=delay), sweep_strats)
                for s in sweep_strats:
                    vals[s].append(r["strategies"][s]["summary"]["post_drift_auc"])
                print("delay", sc, delay, seed, flush=True)
            rows.append({"label_delay": delay, **{s: round(float(np.mean(v)), 4) for s, v in vals.items()}})
        result["label_delay"]["scenarios"][sc] = rows

    OUT.write_text(json.dumps(result, indent=1))
    print("wrote", OUT)


if __name__ == "__main__":
    main()
