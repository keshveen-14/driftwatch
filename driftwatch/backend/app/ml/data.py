"""Synthetic weekly card-transaction stream with controllable drift.

The stream is synthetic on purpose: drift start, type and size are known, so detector
quality (time-to-detect, false alarms) and retraining policies can be scored exactly.
Features are standardised, so a shift of 1.0 means one standard deviation.
"""
from __future__ import annotations

import numpy as np

FEATURES = [
    "txn_amount",
    "velocity_24h",
    "distance_from_home",
    "merchant_risk",
    "account_age",
    "device_trust",
    "hour_of_day",
    "n_recent_declines",
    "ip_reputation",
    "basket_size",
]
N_FEATURES = len(FEATURES)

W0 = np.array([1.2, -0.9, 0.8, 0.7, -0.6, 0.5, 0.4, -0.3, 0.2, 0.1])
# After concept drift the relationship between features and label flips for features 3-5.
W1 = W0.copy()
W1[[3, 4, 5]] = -W0[[3, 4, 5]]
BIAS = -2.6  # measured pre-drift positive rate is about 17% (the interaction term lifts it above the bias alone)
SHIFT_FEATURES = [0, 1, 2]

SCENARIOS = ("mixed", "covariate_only", "concept_only")


def ramp(week: int, drift_start: int, drift_len: int) -> float:
    """0 before drift, rising linearly to 1 over `drift_len` weeks."""
    return float(np.clip((week - drift_start + 1) / drift_len, 0.0, 1.0))


def make_week(rng, week, n, drift_start, drift_len, scenario, drift_size=1.5):
    """Return (X, y) for one week."""
    alpha = ramp(week, drift_start, drift_len)
    X = rng.normal(size=(n, N_FEATURES))
    covariate = scenario in ("mixed", "covariate_only")
    concept = scenario in ("mixed", "concept_only")
    if covariate:
        X[:, SHIFT_FEATURES] += alpha * drift_size
    w = (1 - alpha) * W0 + alpha * W1 if concept else W0
    logit = X @ w + 0.5 * X[:, 0] * X[:, 1] + BIAS
    p = 1.0 / (1.0 + np.exp(-logit))
    y = (rng.random(n) < p).astype(int)
    return X, y


def make_stream(seed, n_weeks=24, n_per_week=2000, drift_start=10, drift_len=4,
                scenario="mixed", drift_size=1.5):
    if scenario not in SCENARIOS:
        raise ValueError(f"scenario must be one of {SCENARIOS}")
    rng = np.random.default_rng(seed)
    return [make_week(rng, t, n_per_week, drift_start, drift_len, scenario, drift_size)
            for t in range(n_weeks)]
