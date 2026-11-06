import { useEffect, useState } from "react";
import DistChart from "../components/DistChart";
import Heatmap from "../components/Heatmap";
import Spark from "../components/Spark";
import { Chip, Empty, Section } from "../components/ui";
import { prettyFeature } from "../lib/format";
import type { Meta, Run } from "../types";

export default function Features({ meta, run }: { meta: Meta; run: Run | null }) {
  const result = run?.status === "done" ? run.result : undefined;
  const [sel, setSel] = useState({ f: 0, w: 0 });
  const runId = run?.id;
  useEffect(() => {
    if (!result) return;
    // Open on the loudest cell so the page starts with something to look at.
    let best = { f: 0, w: result.feature_drift[result.feature_drift.length - 1].week, v: -1 };
    for (const wk of result.feature_drift) wk.psi.forEach((v, f) => { if (v > best.v) best = { f, w: wk.week, v }; });
    setSel({ f: best.f, w: best.w });
  }, [runId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!result) {
    return <div className="page"><div className="skeleton" style={{ height: 420 }} /></div>;
  }
  const cfg = result.config;
  const weeks = result.feature_drift;
  const cur = weeks.find((w) => w.week === sel.w) ?? weeks[weeks.length - 1];
  const alarmWeeks = weeks.filter((w) => w.alarm).length;
  const anyDrift = weeks.some((w) => w.psi.some((p) => p >= cfg.psi_threshold));
  const name = meta.features[sel.f];

  return (
    <div className="page">
      <div className="headline-wrap">
        <h1 className="headline">
          {anyDrift
            ? `Input drift raised ${alarmWeeks} alarms, starting the week drift began.`
            : "Every input looks stable, yet the model is getting worse."}
        </h1>
        <p className="sub">
          {anyDrift
            ? "PSI compares each week with the launch window, decile by decile. A feature counts as drifted when PSI and a KS test both agree."
            : "In concept drift the label rule changes while input distributions stay put. Feature monitors cannot see it. That is why the Hybrid policy also watches labelled AUC."}
        </p>
      </div>

      <div className="split">
        <div className="panel heat">
          <Heatmap features={meta.features} weeks={weeks} threshold={cfg.psi_threshold} driftStart={cfg.drift_start}
            sel={sel} onSelect={setSel} />
          <div className="legend" style={{ padding: "10px 4px 2px 150px" }}>
            <span>stable</span><span className="ramp" /><span>PSI 0.6+</span>
            <span style={{ marginLeft: 12 }}>● drifted: PSI ≥ {cfg.psi_threshold} and KS p &lt; 0.01</span>
          </div>
        </div>

        <aside className="panel dist">
          <h3 style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em" }}>{prettyFeature(name)}, week {cur.week}</h3>
          <p className="note" style={{ fontSize: 13 }}>
            Share of this week's transactions in each decile of the launch distribution.
          </p>
          <DistChart shares={cur.shares[sel.f]} />
          <dl className="kv">
            <dt>PSI</dt><dd>{cur.psi[sel.f].toFixed(3)}</dd>
            <dt>KS p-value</dt><dd>{cur.ks_p[sel.f] < 0.001 ? "< 0.001" : cur.ks_p[sel.f].toFixed(3)}</dd>
            <dt>Status</dt><dd>{cur.drifted.includes(sel.f) ? <Chip tone="alarm">drifted</Chip> : <Chip tone="ok">stable</Chip>}</dd>
          </dl>
          <h3 style={{ fontSize: 13, fontWeight: 600, margin: "18px 0 4px" }}>PSI over time</h3>
          <Spark values={weeks.map((w) => w.psi[sel.f])} weeks={weeks.map((w) => w.week)} threshold={cfg.psi_threshold} selected={cur.week} />
        </aside>
      </div>

      <Section title="What the alarm rule does"
        note={`An alarm needs at least ${cfg.min_features} features drifted at once. This keeps one noisy feature from triggering a retrain. Across the stable weeks before drift, the rule raised ${weeks.filter((w) => w.week < cfg.drift_start && w.alarm).length} false alarms.`}>
        {!anyDrift && <Empty title="Nothing to see here, and that is the point">Switch to Mixed drift to watch the monitor fire.</Empty>}
      </Section>
    </div>
  );
}
