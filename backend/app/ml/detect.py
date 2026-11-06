"""Drift detection.

* Feature drift: Population Stability Index (PSI) plus a two-sample KS test per feature.
  These look at inputs only, so they cannot see concept drift.
* Performance drift: tracks the AUC of the *deployed* model on labelled weeks and alarms when it
  falls below the baseline it had at training time. Needs labels, so it fires late, but it sees
  every kind of drift that actually hurts accuracy.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
from scipy.stats import ks_2samp

PSI_THRESHOLD = 0.1       # 0.1 = moderate shift, 0.25 = large shift (common rule of thumb)
KS_ALPHA = 0.01
MIN_DRIFTED_FEATURES = 2  # alarm only if at least this many features drift
N_BINS = 10
EPS = 1e-4


def _edges(reference: np.ndarray, n_bins: int = N_BINS) -> np.ndarray:
    edges = np.quantile(reference, np.linspace(0, 1, n_bins + 1))
    edges[0], edges[-1] = -np.inf, np.inf
    return np.unique(edges)


def bin_shares(reference: np.ndarray, current: np.ndarray, n_bins: int = N_BINS):
    """Share of `reference` and `current` falling in each reference-quantile bin."""
    edges = _edges(reference, n_bins)
    ref = np.histogram(reference, bins=edges)[0] / len(reference)
    cur = np.histogram(current, bins=edges)[0] / len(current)
    return ref, cur


def psi_from_shares(ref_share: np.ndarray, cur_share: np.ndarray) -> float:
    ref_share = np.clip(ref_share, EPS, None)
    cur_share = np.clip(cur_share, EPS, None)
    return float(np.sum((cur_share - ref_share) * np.log(cur_share / ref_share)))


def psi(reference: np.ndarray, current: np.ndarray, n_bins: int = N_BINS) -> float:
    """PSI of one feature. Bin edges come from reference quantiles."""
    return psi_from_shares(*bin_shares(reference, current, n_bins))


@dataclass
class DriftReport:
    psi: list = field(default_factory=list)
    ks_p: list = field(default_factory=list)
    drifted: list = field(default_factory=list)
    shares: list = field(default_factory=list)  # per feature: share of rows in each reference bin
    alarm: bool = False

    def to_dict(self):
        return {
            "psi": [round(v, 4) for v in self.psi],
            "ks_p": [float(f"{v:.3g}") for v in self.ks_p],
            "drifted_features": self.drifted,
            "alarm": self.alarm,
        }


class DriftDetector:
    def __init__(self, reference: np.ndarray, psi_threshold=PSI_THRESHOLD, ks_alpha=KS_ALPHA,
                 min_features=MIN_DRIFTED_FEATURES):
        self.reference = np.asarray(reference)
        self.psi_threshold = psi_threshold
        self.ks_alpha = ks_alpha
        self.min_features = min_features

    def check(self, batch: np.ndarray) -> DriftReport:
        batch = np.asarray(batch)
        if batch.ndim != 2 or batch.shape[1] != self.reference.shape[1]:
            raise ValueError("batch must be 2-D with the same number of features as the reference")
        rep = DriftReport()
        for j in range(self.reference.shape[1]):
            ref_s, cur_s = bin_shares(self.reference[:, j], batch[:, j])
            p = psi_from_shares(ref_s, cur_s)
            ks = ks_2samp(self.reference[:, j], batch[:, j], method="asymp").pvalue
            rep.psi.append(p)
            rep.ks_p.append(ks)
            rep.shares.append(cur_s.tolist())
            if p >= self.psi_threshold and ks < self.ks_alpha:
                rep.drifted.append(j)
        rep.alarm = len(rep.drifted) >= self.min_features
        return rep


class PerformanceMonitor:
    """Alarm when labelled AUC of the deployed model drops below its training-time baseline."""

    def __init__(self, baseline_auc: float, tolerance: float):
        self.baseline = baseline_auc
        self.tolerance = tolerance

    def check(self, auc: float | None) -> bool:
        return auc is not None and auc < self.baseline - self.tolerance
