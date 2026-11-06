import { useState } from "react";
import type { Meta, Run, ScenarioId, SimConfig } from "../types";
import { Segmented, Slider } from "./ui";

interface Props {
  meta: Meta;
  config: SimConfig;
  onChange: (c: SimConfig) => void;
  onRun: (c: SimConfig) => void;
  busy: boolean;
  runs: Run[];
  currentId?: string;
  onPickRun: (id: string) => void;
}

export default function ControlBar({ meta, config, onChange, onRun, busy, runs, currentId, onPickRun }: Props) {
  const [adv, setAdv] = useState(false);
  const set = <K extends keyof SimConfig>(k: K, v: SimConfig[K]) => onChange({ ...config, [k]: v });
  return (
    <div className="controls">
      <Segmented<ScenarioId>
        label="Drift scenario"
        value={config.scenario}
        options={meta.scenarios.map((s) => ({ value: s.id, label: s.label, hint: s.blurb }))}
        onChange={(v) => { const c = { ...config, scenario: v }; onChange(c); onRun(c); }}
      />
      <Slider label="Labels arrive after" value={config.label_delay} min={0} max={4} step={1}
        format={(v) => (v === 0 ? "same week" : `${v} wk`)} onChange={(v) => set("label_delay", v)}
        hint="Fraud labels are not known right away. Retraining and the AUC monitor can only use labelled weeks." />
      <Slider label="Input shift" value={config.drift_size} min={0} max={3} step={0.25}
        format={(v) => `${v.toFixed(2)} σ`} onChange={(v) => set("drift_size", v)} />
      <button className="btn ghost" onClick={() => setAdv(!adv)} aria-expanded={adv}>
        {adv ? "Hide settings" : "More settings"}
      </button>
      <div className="grow" />
      {runs.length > 0 && (
        <label className="field">
          <span className="field-label">Previous runs</span>
          <select value={currentId ?? ""} onChange={(e) => onPickRun(e.target.value)}
            style={{ padding: "7px 8px", border: "1px solid var(--rule)", borderRadius: 6, background: "#fff", font: "inherit", maxWidth: 230 }}>
            {runs.filter((r) => r.status === "done").map((r) => (
              <option key={r.id} value={r.id}>
                {r.config.scenario.replace(/_/g, " ")}, delay {r.config.label_delay}, shift {r.config.drift_size}, seed {r.config.seed}
              </option>
            ))}
          </select>
        </label>
      )}
      <button className="btn" disabled={busy} onClick={() => onRun(config)}>
        {busy ? "Running…" : "Run simulation"}
      </button>
      {adv && (
        <div className="adv">
          <label className="field"><span className="field-label">Random seed</span>
            <input type="number" min={0} max={9999} value={config.seed} onChange={(e) => set("seed", Number(e.target.value))} /></label>
          <Slider label="PSI threshold" value={config.psi_threshold} min={0.05} max={0.4} step={0.05}
            format={(v) => v.toFixed(2)} onChange={(v) => set("psi_threshold", v)} />
          <Slider label="Features needed for alarm" value={config.min_features} min={1} max={5} step={1}
            onChange={(v) => set("min_features", v)} />
          <Slider label="AUC drop tolerance" value={config.perf_tolerance} min={0.02} max={0.1} step={0.01}
            format={(v) => v.toFixed(2)} onChange={(v) => set("perf_tolerance", v)} />
          <Slider label="Scheduled every" value={config.schedule_every} min={2} max={8} step={1}
            format={(v) => `${v} wk`} onChange={(v) => set("schedule_every", v)} />
          <Slider label="Cool-down after retrain" value={config.cooldown} min={0} max={4} step={1}
            format={(v) => `${v} wk`} onChange={(v) => set("cooldown", v)} />
          <Slider label="Drift ramp length" value={config.drift_len} min={1} max={8} step={1}
            format={(v) => `${v} wk`} onChange={(v) => set("drift_len", v)} />
          <Slider label="Drift starts at week" value={config.drift_start} min={6} max={16} step={1}
            onChange={(v) => set("drift_start", v)} />
        </div>
      )}
    </div>
  );
}
