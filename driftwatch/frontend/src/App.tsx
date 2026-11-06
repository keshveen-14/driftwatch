import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import ControlBar from "./components/ControlBar";
import { useHashRoute, useRunner } from "./lib/hooks";
import Benchmark from "./pages/Benchmark";
import Features from "./pages/Features";
import Monitor from "./pages/Monitor";
import Playground from "./pages/Playground";
import type { Meta, Run, SimConfig } from "./types";

const ROUTES = ["monitor", "features", "benchmark", "playground"];
const LABELS: Record<string, string> = {
  monitor: "Monitor", features: "Features", benchmark: "Benchmark", playground: "Playground",
};

const DEFAULTS: SimConfig = {
  scenario: "mixed", strategies: ["frozen", "scheduled", "drift_triggered", "performance_triggered", "hybrid", "weekly_oracle"],
  seed: 0, n_weeks: 24, n_per_week: 2000, drift_start: 10, drift_len: 4, drift_size: 1.5, label_delay: 0,
  psi_threshold: 0.1, min_features: 2, perf_tolerance: 0.04, schedule_every: 4, cooldown: 2,
};

function Logo() {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="7" fill="#243247" />
      <path d="M5 11 L12 11 L17 22 L27 22" fill="none" stroke="#6F86FF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="17" cy="22" r="3" fill="#E5484D" />
    </svg>
  );
}

export default function App() {
  const route = useHashRoute(ROUTES, "monitor");
  const [meta, setMeta] = useState<Meta | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [config, setConfig] = useState<SimConfig>(DEFAULTS);
  const [runs, setRuns] = useState<Run[]>([]);
  const { run, busy, error, launch, show } = useRunner();

  const refreshRuns = useCallback(() => api.listRuns().then(setRuns).catch(() => undefined), []);

  useEffect(() => {
    api.meta().then(setMeta).catch((e) => setMetaError(e.message));
    launch(DEFAULTS).then(refreshRuns);
  }, [launch, refreshRuns]);

  const onRun = useCallback((c: SimConfig) => { launch(c).then(refreshRuns); }, [launch, refreshRuns]);
  const onPickRun = useCallback((id: string) => {
    const r = runs.find((x) => x.id === id);
    if (r) setConfig(r.config);
    show(id);
  }, [runs, show]);

  const needsControls = route === "monitor" || route === "features";

  return (
    <>
      <header className="topbar">
        <a className="brand" href="#/monitor"><Logo /><span>DriftWatch</span></a>
        <nav className="nav" aria-label="Sections">
          {ROUTES.map((r) => (
            <a key={r} href={`#/${r}`} aria-current={route === r ? "page" : undefined}>{LABELS[r]}</a>
          ))}
        </nav>
        <div className="spacer" />
        <a className="ext" href="/docs" target="_blank" rel="noreferrer">API docs</a>
      </header>
      {busy && <div className="progress" role="progressbar" aria-label="Simulation progress"><i style={{ width: `${Math.max(6, (run?.progress ?? 0) * 100)}%` }} /></div>}

      {metaError && <div className="page"><div className="error">Cannot reach the API: {metaError}. Start the backend with <code>make dev</code>.</div></div>}
      {meta && needsControls && (
        <ControlBar meta={meta} config={config} onChange={setConfig} onRun={onRun} busy={busy}
          runs={runs} currentId={run?.id} onPickRun={onPickRun} />
      )}
      {error && <div className="page" style={{ paddingBottom: 0 }}><div className="error">{error}</div></div>}

      {meta && route === "monitor" && <Monitor meta={meta} run={run} />}
      {meta && route === "features" && <Features meta={meta} run={run} />}
      {meta && route === "benchmark" && <Benchmark meta={meta} />}
      {meta && route === "playground" && <Playground meta={meta} />}
    </>
  );
}
