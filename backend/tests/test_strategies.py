import pytest

from app.ml.strategies import SimParams, run_simulation

from .conftest import SMALL

STRATS = ("frozen", "scheduled", "drift_triggered", "hybrid", "weekly_oracle")


@pytest.fixture(scope="module")
def mixed():
    return run_simulation(SimParams(scenario="mixed", **SMALL), STRATS)


@pytest.fixture(scope="module")
def concept():
    return run_simulation(SimParams(scenario="concept_only", **SMALL), STRATS)


def test_result_shape(mixed):
    weeks = SMALL["n_weeks"] - 3
    assert set(mixed["strategies"]) == set(STRATS)
    assert all(len(v["records"]) == weeks for v in mixed["strategies"].values())
    assert len(mixed["feature_drift"]) == weeks and len(mixed["positive_rate"]) == weeks


def test_retrain_counts(mixed):
    s = mixed["strategies"]
    assert s["frozen"]["summary"]["retrains"] == 0
    assert s["weekly_oracle"]["summary"]["retrains"] == SMALL["n_weeks"] - 3
    assert 0 < s["drift_triggered"]["summary"]["retrains"] < s["weekly_oracle"]["summary"]["retrains"]


def test_frozen_model_degrades_under_mixed_drift(mixed):
    s = mixed["strategies"]
    assert s["frozen"]["summary"]["post_drift_auc"] < s["frozen"]["summary"]["pre_drift_auc"] - 0.05
    assert s["drift_triggered"]["summary"]["post_drift_auc"] > s["frozen"]["summary"]["post_drift_auc"] + 0.03


def test_feature_monitor_is_blind_to_concept_drift(concept):
    s = concept["strategies"]
    assert s["drift_triggered"]["summary"]["retrains"] == 0
    assert not any(w["alarm"] for w in concept["feature_drift"])


def test_hybrid_recovers_from_concept_drift(concept):
    s = concept["strategies"]
    assert s["hybrid"]["summary"]["retrains"] >= 1
    assert s["hybrid"]["summary"]["post_drift_auc"] > s["drift_triggered"]["summary"]["post_drift_auc"] + 0.05


def test_no_false_alarms_before_drift(mixed):
    pre = [r for r in mixed["strategies"]["frozen"]["records"] if r["week"] < SMALL["drift_start"]]
    assert not any(r["feature_alarm"] for r in pre)


def test_label_delay_hides_recent_labels():
    p = SimParams(scenario="concept_only", label_delay=2, **SMALL)
    res = run_simulation(p, ("frozen",))
    recs = res["strategies"]["frozen"]["records"]
    # the monitor can only look back `label_delay` weeks
    assert all(r["monitor_auc"] is None for r in recs[:2])
    assert recs[2]["monitor_auc"] == recs[0]["auc"]
