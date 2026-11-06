import numpy as np

from app.ml.detect import DriftDetector, PerformanceMonitor, psi


def test_psi_is_near_zero_for_same_distribution():
    rng = np.random.default_rng(0)
    assert psi(rng.normal(size=5000), rng.normal(size=5000)) < 0.02


def test_psi_grows_with_shift():
    rng = np.random.default_rng(0)
    ref = rng.normal(size=5000)
    small = psi(ref, rng.normal(0.3, 1, 5000))
    large = psi(ref, rng.normal(1.5, 1, 5000))
    assert 0.02 < small < large
    assert large > 0.25  # the conventional "large shift" mark


def test_detector_quiet_on_stable_batch():
    rng = np.random.default_rng(1)
    det = DriftDetector(rng.normal(size=(6000, 10)))
    rep = det.check(rng.normal(size=(2000, 10)))
    assert not rep.alarm and rep.drifted == []


def test_detector_alarms_when_two_features_shift():
    rng = np.random.default_rng(2)
    det = DriftDetector(rng.normal(size=(6000, 10)))
    batch = rng.normal(size=(2000, 10))
    batch[:, [0, 1]] += 1.0
    rep = det.check(batch)
    assert rep.alarm and rep.drifted == [0, 1]


def test_detector_ignores_a_single_drifted_feature():
    rng = np.random.default_rng(3)
    det = DriftDetector(rng.normal(size=(6000, 10)))
    batch = rng.normal(size=(2000, 10))
    batch[:, 4] += 1.5
    rep = det.check(batch)
    assert rep.drifted == [4] and not rep.alarm


def test_detector_rejects_wrong_shape():
    det = DriftDetector(np.zeros((100, 10)))
    try:
        det.check(np.zeros((50, 3)))
    except ValueError:
        return
    raise AssertionError("expected ValueError")


def test_performance_monitor_threshold():
    m = PerformanceMonitor(baseline_auc=0.85, tolerance=0.04)
    assert not m.check(0.83) and m.check(0.80) and not m.check(None)
