import numpy as np
import pytest

from app.ml.data import N_FEATURES, make_stream, ramp


def test_ramp_shape():
    assert ramp(9, 10, 4) == 0.0
    assert ramp(10, 10, 4) == pytest.approx(0.25)
    assert ramp(13, 10, 4) == 1.0 and ramp(20, 10, 4) == 1.0


def test_stream_shape_and_positive_rate():
    s = make_stream(0, n_weeks=6, n_per_week=2000, scenario="mixed")  # all before drift_start=10
    assert len(s) == 6 and s[0][0].shape == (2000, N_FEATURES)
    assert 0.14 < np.mean([y.mean() for _, y in s]) < 0.20  # measured: about 17%


def test_same_seed_is_reproducible():
    a, b = make_stream(5, n_weeks=3), make_stream(5, n_weeks=3)
    assert np.array_equal(a[2][0], b[2][0]) and np.array_equal(a[2][1], b[2][1])


def test_covariate_drift_moves_inputs_but_concept_only_does_not():
    cov = make_stream(0, n_weeks=16, scenario="covariate_only")
    con = make_stream(0, n_weeks=16, scenario="concept_only")
    assert cov[15][0][:, 0].mean() > 1.2
    assert abs(con[15][0][:, 0].mean()) < 0.15


def test_unknown_scenario_rejected():
    with pytest.raises(ValueError):
        make_stream(0, scenario="nope")
