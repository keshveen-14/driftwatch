"""Live scoring and one-off drift checks against a reference model trained at start-up."""
from __future__ import annotations

import numpy as np

from ..ml.data import FEATURES, N_FEATURES, make_stream
from ..ml.detect import KS_ALPHA, MIN_DRIFTED_FEATURES, PSI_THRESHOLD, DriftDetector
from ..ml.strategies import TRAIN_WEEKS, fit_model, window


class MonitoringService:
    def __init__(self, seed: int = 0):
        stream = make_stream(seed=seed, n_weeks=TRAIN_WEEKS)
        X, y = window(stream, TRAIN_WEEKS - 1)
        self.model = fit_model(X, y, seed)
        self.detector = DriftDetector(X)
        self.reference_scores = self.model.predict_proba(X)[:, 1]

    def predict(self, X: np.ndarray) -> list[dict]:
        scores = self.model.predict_proba(X)[:, 1]
        return [{"score": round(float(s), 4),
                 "risk": "high" if s >= 0.5 else "medium" if s >= 0.2 else "low"} for s in scores]

    def check(self, X: np.ndarray) -> dict:
        rep = self.detector.check(X)
        scores = self.model.predict_proba(X)[:, 1]
        return {
            "n_rows": int(len(X)),
            "alarm": rep.alarm,
            "drifted_features": [FEATURES[j] for j in rep.drifted],
            "features": [
                {"name": FEATURES[j], "psi": round(rep.psi[j], 4), "ks_p": float(f"{rep.ks_p[j]:.3g}"),
                 "drifted": j in rep.drifted, "shares": [round(s, 4) for s in rep.shares[j]]}
                for j in range(N_FEATURES)
            ],
            "thresholds": {"psi": PSI_THRESHOLD, "ks_alpha": KS_ALPHA, "min_features": MIN_DRIFTED_FEATURES},
            "mean_score": round(float(scores.mean()), 4),
            "reference_mean_score": round(float(self.reference_scores.mean()), 4),
        }

    def simulate(self, shift: float, features: list[int], n: int, seed: int) -> dict:
        rng = np.random.default_rng(10_000 + seed)
        X = rng.normal(size=(n, N_FEATURES))
        if features:
            X[:, features] += shift
        out = self.check(X)
        out["shifted_features"] = [FEATURES[j] for j in sorted(set(features))]
        out["shift"] = shift
        return out
