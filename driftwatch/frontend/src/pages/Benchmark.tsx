import { useEffect, useState } from "react";
import { api } from "../api";
import { CurveChart, Tradeoff } from "../components/Charts";
import { Empty, Section } from "../components/ui";
import { STRATEGY_COLOR } from "../lib/colors";
import { fmt3, signed } from "../lib/format";
import type { Benchmark as Bench, Meta, ScenarioId, StrategyId } from "../types";

export default function Benchmark({ meta }: { meta: Meta }) {
  const [data, setData] = useState<Bench | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sc, setSc] = useState<ScenarioId>("concept_only");
  useEffect(() => { api.benchmark().then(setData).catch((e) => setErr(e.message)); }, []);

  if (err) return <div className="page"><div className="panel"><Empty title="Benchmark not generated yet">{err}</Empty></div></div>;
  if (!data) return <div className="page"><div className="skeleton" style={{ height: 420 }} /></div>;

  const label = (id: string) => meta.strategies.find((s) => s.id === id)?.label ?? id;
  const ids = meta.strategies.map((s) => s.id);
  const cur = data.scenarios[sc];
  const concept = data.scenarios.concept_only;
  const frozen = cur.strategies.frozen.post_drift_auc;
  const weeks = cur.strategies.frozen.auc_by_week.map((_, i) => data.first_week + i);
  const lo = 0.6, hi = 0.9;
  const bar = (v: number) => `${Math.max(0, Math.min(1, (v - lo) / (hi - lo))) * 100}%`;
  const pts = ids.map((id) => ({
    id, label: label(id), x: cur.strategies[id].retrains, y: cur.strategies[id].post_drift_auc, ci: cur.strategies[id].post_drift_auc_ci95,
  }));
  const det = cur.detectors;
  const dFmt = (v: number | null) => (v === null ? "never" : v === 0 ? "same week" : `${v.toFixed(1)} wk`);

  return (
    <div className="page">
      <div className="headline-wrap">
        <h1 className="headline">
          Watching inputs alone missed {Math.round((1 - concept.detectors.feature.detection_rate) * 100)}% of concept drift. A labelled-AUC monitor caught it within {concept.detectors.performance.mean_weeks_to_detect?.toFixed(0)} week.
        </h1>
        <p className="sub">
          Every number here is the mean of {data.n_seeds} random seeds on a synthetic stream with a known drift start, with 95% confidence intervals.
          Hybrid reached {fmt3(concept.strategies.hybrid.post_drift_auc)} AUC under concept drift with {concept.strategies.hybrid.retrains} retrains,
          against {fmt3(concept.strategies.scheduled.post_drift_auc)} for a {concept.strategies.scheduled.retrains}-retrain schedule.
        </p>
      </div>

      <div className="tabs" role="tablist" aria-label="Scenario">
        {meta.scenarios.map((s) => (
          <button key={s.id} role="tab" aria-selected={sc === s.id} className={`pill ${sc === s.id ? "on" : ""}`} onClick={() => setSc(s.id)}>
            {s.label}
          </button>
        ))}
      </div>
      <p className="note" style={{ margin: "10px 0 18px" }}>{meta.scenarios.find((s) => s.id === sc)?.blurb}</p>

      <div className="grid2">
        <div className="panel chartbox">
          <h3>Cost against accuracy</h3>
          <p className="note">Up and to the left is better: higher AUC for fewer retrains. Whiskers are 95% intervals.</p>
          <Tradeoff pts={pts} yMin={0.6} yMax={0.9} />
        </div>
        <div className="panel chartbox">
          <h3>Mean AUC by week</h3>
          <p className="note">Drift starts at week {data.drift_start_week}. The line is the average over {data.n_seeds} seeds.</p>
          <CurveChart xs={weeks} xLabel="week" yMin={0.6} yMax={0.9} vline={data.drift_start_week} vlabel="drift starts"
            series={(["frozen", "scheduled", "drift_triggered", "hybrid", "weekly_oracle"] as StrategyId[]).map((id) => ({
              id, label: label(id), values: cur.strategies[id].auc_by_week }))} />
        </div>
      </div>

      <Section title="Results table">
        <table className="board">
          <thead><tr>
            <th>Policy</th><th>Mean AUC after drift ± 95% CI</th><th className="r">vs frozen</th>
            <th className="r">Weeks degraded</th><th className="r">Retrains</th>
          </tr></thead>
          <tbody>
            {ids.map((id) => {
              const s = cur.strategies[id];
              return (
                <tr key={id} style={{ cursor: "default" }}>
                  <td><div className="pol"><i className="dot" style={{ background: STRATEGY_COLOR[id] }} />{label(id)}</div></td>
                  <td><div className="auccell" style={{ gridTemplateColumns: "130px 1fr" }}>
                    <span>{fmt3(s.post_drift_auc)} <small style={{ color: "var(--ink-3)", fontWeight: 400 }}>± {s.post_drift_auc_ci95.toFixed(3)}</small></span>
                    <div className="meter"><i style={{ width: bar(s.post_drift_auc), background: STRATEGY_COLOR[id] }} /><u style={{ left: bar(s.pre_drift_auc) }} /></div>
                  </div></td>
                  <td className="r num">{id === "frozen" ? "–" : signed(s.post_drift_auc - frozen)}</td>
                  <td className="r num">{s.weeks_degraded}</td>
                  <td className="r num">{s.retrains}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>

      <Section title="Which monitor catches the drift?"
        note="Measured on the launch model, so the reference never changes. Pre-drift weeks are the stable ones, so any alarm there is a false alarm.">
        <table className="board">
          <thead><tr><th>Monitor</th><th className="r">Runs where drift was caught</th><th className="r">Time to detect</th><th className="r">False-alarm weeks per run</th></tr></thead>
          <tbody>
            {([["Input drift (PSI + KS)", det.feature], ["Labelled AUC drop", det.performance]] as const).map(([name, d]) => (
              <tr key={name} style={{ cursor: "default" }}>
                <td className="pol">{name}</td>
                <td className="r num">{Math.round(d.detection_rate * 100)}%</td>
                <td className="r num">{dFmt(d.mean_weeks_to_detect)}</td>
                <td className="r num">{d.false_alarm_weeks_per_run.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="What late labels cost"
        note={`In fraud, the true label can take weeks to arrive. Retraining and the AUC monitor can only use labelled weeks, so every policy gets worse as labels slow down. Mean over ${data.label_delay.n_seeds} seeds.`}>
        <div className="grid2">
          {(["mixed", "concept_only"] as const).map((k) => {
            const rows = data.label_delay.scenarios[k];
            return (
              <div className="panel chartbox" key={k}>
                <h3>{meta.scenarios.find((s) => s.id === k)?.label}</h3>
                <p className="note">Mean AUC after drift against weeks until labels arrive.{k === "mixed" && " Drift-triggered and Hybrid are identical here, so one line covers the other."}</p>
                <CurveChart xs={rows.map((r) => r.label_delay)} xLabel="weeks until labels arrive" yMin={0.65} yMax={0.9}
                  series={data.label_delay.strategies.map((id) => ({ id, label: label(id), values: rows.map((r) => r[id]) }))} />
              </div>
            );
          })}
        </div>
      </Section>

      <div className="callout warn" style={{ marginTop: 34 }}>
        <strong>Read with care.</strong> The data is synthetic, thresholds were set by hand rather than tuned, and drift size and timing are fixed per scenario.
        The ranking of policies is the finding. The absolute AUC values will not transfer to a real system.
      </div>
    </div>
  );
}
