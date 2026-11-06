import { useEffect, useState } from "react";
import { api } from "../api";
import { Chip, Section } from "../components/ui";
import { prettyFeature } from "../lib/format";
import type { DriftCheck, Meta } from "../types";

const PSI_MAX = 3;
const psiPos = (v: number) => Math.min(1, Math.sqrt(v / PSI_MAX)) * 100; // square-root scale keeps small values visible

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

function DriftCheckPanel({ meta }: { meta: Meta }) {
  const [shift, setShift] = useState(1);
  const [feats, setFeats] = useState<number[]>([0, 1, 2]);
  const [n, setN] = useState(2000);
  const [res, setRes] = useState<DriftCheck | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const d = useDebounced({ shift, feats, n }, 250);

  useEffect(() => {
    let live = true;
    api.driftSimulate({ shift: d.shift, features: d.feats, n: d.n, seed: 1 })
      .then((r) => { if (live) { setRes(r); setErr(null); } })
      .catch((e) => live && setErr(e.message));
    return () => { live = false; };
  }, [d]);

  const toggle = (i: number) => setFeats((f) => (f.includes(i) ? f.filter((x) => x !== i) : [...f, i]));
  const t = { psi: meta.detector.psi_threshold, min_features: meta.detector.min_features };

  return (
    <Section title="Check a batch for drift"
      note="Generate a batch of transactions, shift some features, and send it to POST /api/drift/simulate. The API compares it with the window the model was trained on.">
      <div className="panel" style={{ padding: 20 }}>
        <div style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 18 }}>
          <label className="field">
            <span className="field-label">Shift <b className="num">{shift.toFixed(2)} σ</b></span>
            <input type="range" min={0} max={3} step={0.25} value={shift} onChange={(e) => setShift(Number(e.target.value))} style={{ width: 220 }} />
          </label>
          <label className="field">
            <span className="field-label">Rows in batch</span>
            <select value={n} onChange={(e) => setN(Number(e.target.value))}
              style={{ padding: "7px 8px", border: "1px solid var(--rule)", borderRadius: 6, background: "#fff", font: "inherit" }}>
              {[500, 2000, 5000].map((v) => <option key={v} value={v}>{v.toLocaleString()}</option>)}
            </select>
          </label>
          <div className="field">
            <span className="field-label">Features to shift</span>
            <div className="feat-picks">
              {meta.features.map((f, i) => (
                <button key={f} className={`pill sm ${feats.includes(i) ? "on" : ""}`} aria-pressed={feats.includes(i)} onClick={() => toggle(i)}>
                  {prettyFeature(f)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {err && <div className="error">{err}</div>}
        {res && (
          <>
            <div className={`alarmbar ${res.alarm ? "on" : "off"}`} role="status">
              <strong>{res.alarm ? "Drift alarm" : "No alarm"}</strong>
              <span>
                {res.alarm
                  ? `${res.drifted_features.length} features drifted (rule: ${t.min_features} or more). Retraining would trigger.`
                  : res.drifted_features.length
                    ? `Only ${res.drifted_features.length} feature drifted. The rule needs ${t.min_features}, so nothing triggers.`
                    : "Every feature is within its PSI and KS limits."}
              </span>
              <span style={{ marginLeft: "auto" }} className="num">
                mean risk score {res.mean_score.toFixed(3)} <span style={{ color: "var(--ink-3)" }}>(launch {res.reference_mean_score.toFixed(3)})</span>
              </span>
            </div>
            <div style={{ marginTop: 14, maxWidth: 760 }}>
              {res.features.map((f) => (
                <div className="psirow" key={f.name}>
                  <span className={`nm ${f.drifted ? "hot" : ""}`}>{prettyFeature(f.name)}</span>
                  <div className="meter" title={`PSI ${f.psi}`}>
                    <i style={{ width: `${psiPos(f.psi)}%`, background: f.drifted ? "var(--alarm)" : "#8593a3" }} />
                    <u style={{ left: `${psiPos(t.psi)}%`, background: "var(--alarm)" }} title={`PSI threshold ${t.psi}`} />
                  </div>
                  <span className="num" style={{ textAlign: "right" }}>{f.psi.toFixed(2)}</span>
                </div>
              ))}
              <p className="note" style={{ fontSize: 12, marginTop: 6 }}>Red tick: PSI threshold {t.psi}. Bar length uses a square-root scale, so small values stay visible.</p>
            </div>
          </>
        )}
      </div>
    </Section>
  );
}

const PRESETS: Record<string, number[]> = {
  "Typical purchase": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  "Looks risky": [2.4, -1.6, 2, 1.6, -1.6, 1.4, 0.5, -1, 0.5, 0],
};

function ScorePanel({ meta }: { meta: Meta }) {
  const [row, setRow] = useState<number[]>(PRESETS["Typical purchase"]);
  const [out, setOut] = useState<{ score: number; risk: "low" | "medium" | "high" } | null>(null);
  const d = useDebounced(row, 200);
  useEffect(() => {
    let live = true;
    api.predict([d]).then((r) => live && setOut(r.predictions[0])).catch(() => undefined);
    return () => { live = false; };
  }, [d]);
  return (
    <Section title="Score a transaction"
      note="Features are standardised: 0 is average, 2 is two standard deviations above. This calls POST /api/predict on the model trained at launch.">
      <div className="panel" style={{ padding: 20 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
          {Object.entries(PRESETS).map(([k, v]) => <button key={k} className="pill sm" onClick={() => setRow(v)}>{k}</button>)}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
            <span className="num" style={{ fontSize: 22, fontWeight: 600 }}>{out ? out.score.toFixed(3) : "…"}</span>
            {out && <span className={`risk ${out.risk}`}>{out.risk} risk</span>}
          </div>
        </div>
        <div className="sliders">
          {meta.features.map((f, i) => (
            <label className="field" key={f}>
              <span className="field-label">{prettyFeature(f)} <b className="num">{row[i].toFixed(1)}</b></span>
              <input type="range" min={-3} max={3} step={0.1} value={row[i]}
                onChange={(e) => setRow(row.map((v, j) => (j === i ? Number(e.target.value) : v)))} />
            </label>
          ))}
        </div>
        <div style={{ marginTop: 14 }}><Chip tone="muted">low under 0.2 · medium 0.2 to 0.5 · high 0.5 and up</Chip></div>
      </div>
    </Section>
  );
}

export default function Playground({ meta }: { meta: Meta }) {
  return (
    <div className="page">
      <div className="headline-wrap">
        <h1 className="headline">Try the monitoring API on your own data.</h1>
        <p className="sub">Everything on this page is a live call to the FastAPI service. The same endpoints are documented at /docs.</p>
      </div>
      <DriftCheckPanel meta={meta} />
      <ScorePanel meta={meta} />
    </div>
  );
}
