export type StrategyId =
  | "frozen" | "scheduled" | "drift_triggered" | "performance_triggered" | "hybrid" | "weekly_oracle";
export type ScenarioId = "mixed" | "covariate_only" | "concept_only";

export interface Meta {
  features: string[];
  scenarios: { id: ScenarioId; label: string; blurb: string }[];
  strategies: { id: StrategyId; label: string; blurb: string }[];
  train_weeks: number;
  detector: { psi_threshold: number; ks_alpha: number; min_features: number };
}

export interface SimConfig {
  scenario: ScenarioId;
  strategies: StrategyId[];
  seed: number;
  n_weeks: number;
  n_per_week: number;
  drift_start: number;
  drift_len: number;
  drift_size: number;
  label_delay: number;
  psi_threshold: number;
  min_features: number;
  perf_tolerance: number;
  schedule_every: number;
  cooldown: number;
}

export interface WeekRecord {
  week: number;
  auc: number;
  model_version: number;
  feature_alarm: boolean;
  performance_alarm: boolean;
  drifted_features: number[];
  monitor_auc: number | null;
  retrained: boolean;
}

export interface StrategySummary {
  pre_drift_auc: number;
  post_drift_auc: number;
  worst_auc: number;
  worst_week: number;
  weeks_degraded: number;
  retrains: number;
  final_auc: number;
  first_alarm_week: number | null;
}

export interface StrategyRun {
  records: WeekRecord[];
  retrain_weeks: number[];
  baseline_auc: number;
  summary: StrategySummary;
}

export interface FeatureWeek {
  week: number;
  psi: number[];
  ks_p: number[];
  drifted: number[];
  alarm: boolean;
  shares: number[][];
}

export interface RunResult {
  strategies: Partial<Record<StrategyId, StrategyRun>>;
  feature_drift: FeatureWeek[];
  positive_rate: number[];
  first_week: number;
  config: SimConfig;
}

export interface Run {
  id: string;
  created_at: string;
  status: "queued" | "running" | "done" | "failed";
  config: SimConfig;
  summary: Partial<Record<StrategyId, StrategySummary>> | null;
  progress: number;
  error: string | null;
  result?: RunResult;
}

export interface BenchStrategy {
  pre_drift_auc: number;
  post_drift_auc: number;
  post_drift_auc_ci95: number;
  retrains: number;
  weeks_degraded: number;
  auc_by_week: number[];
}
export interface BenchDetector {
  detection_rate: number;
  mean_weeks_to_detect: number | null;
  false_alarm_weeks_per_run: number;
}
export interface Benchmark {
  n_seeds: number;
  drift_start_week: number;
  first_week: number;
  scenarios: Record<ScenarioId, {
    strategies: Record<StrategyId, BenchStrategy>;
    detectors: { feature: BenchDetector; performance: BenchDetector };
  }>;
  label_delay: {
    n_seeds: number;
    strategies: StrategyId[];
    scenarios: Record<string, ({ label_delay: number } & Record<string, number>)[]>;
  };
}

export interface DriftCheck {
  n_rows: number;
  alarm: boolean;
  drifted_features: string[];
  features: { name: string; psi: number; ks_p: number; drifted: boolean; shares: number[] }[];
  thresholds: { psi: number; ks_alpha: number; min_features: number };
  mean_score: number;
  reference_mean_score: number;
  shifted_features?: string[];
  shift?: number;
}
