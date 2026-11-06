"""Retraining policies run on the same drifting stream.

Policies
--------
frozen              never retrain
scheduled           retrain every N weeks
drift_triggered     retrain when the feature-drift detector (PSI + KS) alarms
performance_triggered  retrain when labelled AUC falls below the training baseline
hybrid              retrain on either alarm (feature drift OR performance drop)
weekly_oracle       retrain every week; upper bound on accuracy and on cost

Label delay: labels for week t arrive at the end of week t + label_delay. The model can only be
retrained on labelled weeks, and the performance monitor only sees labelled weeks.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import roc_auc_score

from .data import make_stream
from .detect import DriftDetector, PerformanceMonitor

TRAIN_WEEKS = 3  # initial training window and retraining window length
STRATEGIES = ("frozen", "scheduled", "drift_triggered", "performance_triggered", "hybrid",
              "weekly_oracle")


@dataclass
class SimParams:
    scenario: str = "mixed"
    seed: int = 0
    n_weeks: int = 24
    n_per_week: int = 2000
    drift_start: int = 10
    drift_len: int = 4
    drift_size: float = 1.5
    label_delay: int = 0
    psi_threshold: float = 0.1
    min_features: int = 2
    perf_tolerance: float = 0.04
    schedule_every: int = 4
    cooldown: int = 2


def fit_model(X, y, seed):
    return HistGradientBoostingClassifier(max_iter=60, learning_rate=0.15, random_state=seed).fit(X, y)


def window(stream, end_week):
    """Concatenate the last TRAIN_WEEKS weeks up to and including end_week."""
    lo = max(0, end_week - TRAIN_WEEKS + 1)
    X = np.vstack([stream[t][0] for t in range(lo, end_week + 1)])
    y = np.concatenate([stream[t][1] for t in range(lo, end_week + 1)])
    return X, y


def train_with_baseline(stream, end_week, seed):
    """Fit on a window and estimate its baseline AUC by scoring the newest week with a model
    trained on the older weeks (an honest hold-out, not the in-sample score)."""
    X, y = window(stream, end_week)
    Xh, yh = stream[end_week]
    Xa, ya = window(stream, end_week - 1)
    holdout_model = fit_model(Xa, ya, seed)
    baseline = float(roc_auc_score(yh, holdout_model.predict_proba(Xh)[:, 1]))
    return fit_model(X, y, seed), DriftDetector(X), baseline


def run_strategy(stream, strategy, p: SimParams):
    """Run one policy. Returns per-week records plus retrain/alarm bookkeeping."""
    model, detector, baseline = train_with_baseline(stream, TRAIN_WEEKS - 1, p.seed)
    detector.psi_threshold, detector.min_features = p.psi_threshold, p.min_features
    perf = PerformanceMonitor(baseline, p.perf_tolerance)
    served_auc: dict[int, float] = {}
    deployed_from = TRAIN_WEEKS
    version, last_retrain = 1, -10
    records, retrain_weeks = [], []

    for t in range(TRAIN_WEEKS, len(stream)):
        X, y = stream[t]
        auc = float(roc_auc_score(y, model.predict_proba(X)[:, 1]))
        served_auc[t] = auc

        # Monitoring signals available at the end of week t.
        feat = detector.check(X)
        tl = t - p.label_delay
        monitor_auc = served_auc.get(tl) if tl >= deployed_from else None
        perf_alarm = perf.check(monitor_auc)
        cooled = (t - last_retrain) > p.cooldown

        if strategy == "scheduled":
            retrain = (t % p.schedule_every) == (p.schedule_every - 1)
        elif strategy == "drift_triggered":
            retrain = feat.alarm and cooled
        elif strategy == "performance_triggered":
            retrain = perf_alarm and cooled
        elif strategy == "hybrid":
            retrain = (feat.alarm or perf_alarm) and cooled
        elif strategy == "weekly_oracle":
            retrain = True
        else:
            retrain = False

        # Can only retrain on labelled weeks.
        end = t - p.label_delay
        retrain = retrain and end >= TRAIN_WEEKS - 1
        records.append({
            "week": t,
            "auc": round(auc, 4),
            "model_version": version,
            "feature_alarm": bool(feat.alarm),
            "performance_alarm": bool(perf_alarm),
            "drifted_features": feat.drifted,
            "monitor_auc": None if monitor_auc is None else round(float(monitor_auc), 4),
            "retrained": bool(retrain),
        })
        if retrain:
            # The performance target stays anchored to the launch-time baseline (an SLO). Re-deriving
            # it from a window that is mid-drift would lower the bar and silence the monitor.
            model, detector, _ = train_with_baseline(stream, end, p.seed)
            detector.psi_threshold, detector.min_features = p.psi_threshold, p.min_features
            deployed_from = t + 1
            last_retrain = t
            version += 1
            retrain_weeks.append(t)

    return {"records": records, "retrain_weeks": retrain_weeks, "baseline_auc": round(baseline, 4)}


def feature_drift_timeline(stream):
    """Per-week PSI / KS / bin shares against the initial training window (strategy independent)."""
    Xref, _ = window(stream, TRAIN_WEEKS - 1)
    det = DriftDetector(Xref)
    weeks = []
    for t in range(TRAIN_WEEKS, len(stream)):
        rep = det.check(stream[t][0])
        weeks.append({
            "week": t,
            "psi": [round(v, 4) for v in rep.psi],
            "ks_p": [float(f"{v:.3g}") for v in rep.ks_p],
            "drifted": rep.drifted,
            "alarm": rep.alarm,
            "shares": [[round(s, 4) for s in f] for f in rep.shares],
        })
    return weeks


def summarise(records, drift_start):
    pre = [r["auc"] for r in records if r["week"] < drift_start]
    post = [r["auc"] for r in records if r["week"] >= drift_start]
    floor = float(np.mean(pre)) - 0.03
    worst = min(records, key=lambda r: r["auc"])
    alarms = [r["week"] for r in records if r["feature_alarm"] or r["performance_alarm"]]
    return {
        "pre_drift_auc": round(float(np.mean(pre)), 4),
        "post_drift_auc": round(float(np.mean(post)), 4),
        "worst_auc": worst["auc"],
        "worst_week": worst["week"],
        "weeks_degraded": int(sum(a < floor for a in post)),
        "retrains": int(sum(r["retrained"] for r in records)),
        "final_auc": records[-1]["auc"],
        "first_alarm_week": next((w for w in alarms if w >= drift_start), None),
    }


def run_simulation(p: SimParams, strategies=STRATEGIES, on_progress=None):
    """Run the requested policies on one stream and return the full result document."""
    stream = make_stream(p.seed, p.n_weeks, p.n_per_week, p.drift_start, p.drift_len,
                         p.scenario, p.drift_size)
    out = {}
    for i, s in enumerate(strategies):
        run = run_strategy(stream, s, p)
        run["summary"] = summarise(run["records"], p.drift_start)
        out[s] = run
        if on_progress:
            on_progress((i + 1) / (len(strategies) + 1))
    timeline = feature_drift_timeline(stream)
    if on_progress:
        on_progress(1.0)
    positive_rate = [round(float(stream[t][1].mean()), 4) for t in range(TRAIN_WEEKS, len(stream))]
    return {"strategies": out, "feature_drift": timeline, "positive_rate": positive_rate,
            "first_week": TRAIN_WEEKS}
