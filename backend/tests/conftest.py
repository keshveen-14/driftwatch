import os
import tempfile

# Must be set before the app module is imported.
_tmp = tempfile.mkdtemp()
os.environ["DRIFTWATCH_DB"] = os.path.join(_tmp, "test.db")
os.environ["DRIFTWATCH_WARM_START"] = "false"
os.environ["DRIFTWATCH_BENCHMARK_PATH"] = os.path.join(_tmp, "missing-benchmark.json")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


# A small stream keeps the suite fast; the logic under test does not depend on size.
SMALL = dict(n_weeks=16, n_per_week=800, drift_start=7, drift_len=3)
