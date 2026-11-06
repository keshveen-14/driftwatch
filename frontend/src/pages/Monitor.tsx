import { useEffect, useState } from "react";
import Inspector from "../components/Inspector";
import Scoreboard from "../components/Scoreboard";
import Timeline from "../components/Timeline";
import { Section } from "../components/ui";
import { usePrefersReducedMotion } from "../lib/hooks";
import { insight } from "../lib/insight";
import type { Meta, Run, StrategyId } from "../types";

const DEFAULT_VISIBLE: StrategyId[] = ["frozen", "scheduled", "drift_triggered", "hybrid", "weekly_oracle"];

export default function Monitor({ meta, run }: { meta: Meta; run: Run | null }) {
  const reduced = usePrefersReducedMotion();
  const [visible, setVisible] = useState<Set<StrategyId>>(new Set(DEFAULT_VISIBLE));
  const [week, setWeek] = useState(0);
  const [playing, setPlaying] = useState(false);
  const result = run?.status === "done" ? run.result : undefined;
  const runId = run?.id;
  const first = result?.first_week ?? 3;
  const last = result ? result.config.n_weeks - 1 : 0;

  // A new run replays itself once, so the drift unfolds in front of you.
  useEffect(() => {
    if (!result) return;
    if (reduced) { setWeek(last); setPlaying(false); return; }
    setWeek(first);
    setPlaying(true);
  }, [runId, reduced]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setWeek((w) => {
        if (w >= last) { setPlaying(false); return last; }
        return w + 1;
      });
    }, 420);
    return () => clearInterval(t);
  }, [playing, last]);

  if (!run || !result) {
    return (
      <div className="page">
        <div className="skeleton" style={{ height: 44, width: "60%", marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 420 }} />
        <p className="note" style={{ marginTop: 16 }}>
          {run ? `Simulating 24 weeks of transactions across ${meta.strategies.length} policies… ${Math.round(run.progress * 100)}%` : "Starting…"}
        </p>
      </div>
    );
  }

  const toggle = (id: StrategyId) =>
    setVisible((v) => { const n = new Set(v); if (n.has(id)) { if (n.size > 1) n.delete(id); } else n.add(id); return n; });
  const { headline, sub } = insight(run, meta);
  const sc = meta.scenarios.find((s) => s.id === result.config.scenario);
  const atEnd = week >= last;

  return (
    <div className="page">
      <div className="headline-wrap">
        <h1 className="headline">{headline}</h1>
        <p className="sub">{sub}</p>
      </div>

      <div className="split">
        <div className="panel">
          <Timeline result={result} visible={visible} week={week} onWeek={(w) => { setPlaying(false); setWeek(w); }} />
          <div className="transport">
            <button className="play" aria-label={playing ? "Pause replay" : atEnd ? "Replay from the start" : "Play replay"}
              onClick={() => { if (atEnd) { setWeek(first); setPlaying(true); } else setPlaying(!playing); }}>
              {playing
                ? <svg width="12" height="12" viewBox="0 0 12 12"><rect x="1.5" y="1" width="3" height="10" fill="#fff" /><rect x="7.5" y="1" width="3" height="10" fill="#fff" /></svg>
                : <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2.5 1 L11 6 L2.5 11 Z" fill="#fff" /></svg>}
            </button>
            <input type="range" min={first} max={last} value={week} aria-label="Week"
              onChange={(e) => { setPlaying(false); setWeek(Number(e.target.value)); }} />
            <span className="wk">Week {week}</span>
          </div>
        </div>
        <Inspector meta={meta} result={result} week={week} visible={visible} />
      </div>

      <Section title="How each policy did"
        note={<>{sc?.blurb} Click a row to show or hide it on the chart. The tick on each bar marks AUC before drift.</>}>
        <Scoreboard meta={meta} result={result} visible={visible} onToggle={toggle} />
      </Section>

      <footer className="foot">
        Synthetic card-transaction stream: {result.config.n_weeks} weeks, {result.config.n_per_week.toLocaleString()} rows a week, 10 features.
        Drift is injected at week {result.config.drift_start}, so detection time and false alarms can be scored exactly. One seed shown here;
        the Benchmark tab averages {" "}many.
      </footer>
    </div>
  );
}
