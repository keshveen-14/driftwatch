"""Request and response models."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator

from .ml.data import N_FEATURES
from .ml.strategies import STRATEGIES

Scenario = Literal["mixed", "covariate_only", "concept_only"]
Strategy = Literal["frozen", "scheduled", "drift_triggered", "performance_triggered", "hybrid",
                   "weekly_oracle"]


class SimulationRequest(BaseModel):
    scenario: Scenario = "mixed"
    strategies: list[Strategy] = Field(default_factory=lambda: list(STRATEGIES), min_length=1)
    seed: int = Field(0, ge=0, le=9999)
    n_weeks: int = Field(24, ge=14, le=36)
    n_per_week: int = Field(2000, ge=500, le=5000)
    drift_start: int = Field(10, ge=5, le=30)
    drift_len: int = Field(4, ge=1, le=8)
    drift_size: float = Field(1.5, ge=0.0, le=3.0, description="covariate shift in standard deviations")
    label_delay: int = Field(0, ge=0, le=4, description="weeks until labels arrive")
    psi_threshold: float = Field(0.1, ge=0.02, le=0.5)
    min_features: int = Field(2, ge=1, le=5)
    perf_tolerance: float = Field(0.04, ge=0.01, le=0.15)
    schedule_every: int = Field(4, ge=2, le=12)
    cooldown: int = Field(2, ge=0, le=6)

    @model_validator(mode="after")
    def _check(self):
        if self.drift_start + self.drift_len + 2 > self.n_weeks:
            raise ValueError("drift must start at least drift_len + 2 weeks before the end of the stream")
        # keep a stable ordering so identical requests hash identically
        self.strategies = [s for s in STRATEGIES if s in set(self.strategies)]
        return self


class Rows(BaseModel):
    rows: list[list[float]] = Field(min_length=1, max_length=20000)

    @model_validator(mode="after")
    def _shape(self):
        for r in self.rows:
            if len(r) != N_FEATURES:
                raise ValueError(f"each row needs exactly {N_FEATURES} features")
        return self


class DriftSimRequest(BaseModel):
    shift: float = Field(1.0, ge=0.0, le=3.0, description="shift in standard deviations")
    features: list[int] = Field(default_factory=lambda: [0, 1, 2])
    n: int = Field(2000, ge=200, le=10000)
    seed: int = Field(0, ge=0, le=9999)

    @model_validator(mode="after")
    def _feat(self):
        if any(f < 0 or f >= N_FEATURES for f in self.features):
            raise ValueError(f"feature indices must be in 0..{N_FEATURES - 1}")
        return self
