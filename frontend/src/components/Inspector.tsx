import { STRATEGY_COLOR } from "../lib/colors";
import { fmt3, prettyFeature, signed } from "../lib/format";
import type { Meta, RunResult, StrategyId } from "../types";
import { Chip } from "./ui";

interface Props { meta: Meta; result: RunResult; week: number; visible: Set<StrategyId>; }

export default function Inspector({ meta, result, week, visible }: Props) {
  const cfg = result.config;
  const ramp = Math.max(0, Math.min(1, (week - cfg.drift_start + 1) / cfg.drift_len));
  const fd = result.feature_drift.find((f) => f.week === week);
  const launch = result.strategies.frozen?.summary.pre_drift_auc ?? 0.845;
  const lo = 0.6, hi = 0.9;
  const ids = meta.strategies.map((s) => s.id).filter((id) => result.strategies[id] && visible.has(id));
  const drifted = fd ? fd.drifted.map((j) => ({ j, psi: fd.psi[j] })).sort((a, b) => b.psi - a.psi) : [];
  return (
    <aside className="panel inspector" aria-live="polite">
      <div className="big num">Week {week}</div>
      <div className="cap">
        {ramp === 0 ? "Before drift" : ramp < 1 ? `Drift ramping in, ${Math.round(ramp * 100)}% of full effect` : "Drift at full effect"}
        {cfg.label_delay > 0 && ` · labels for weeks up to ${Math.max(0, week - cfg.label_delay)} known`}
      </div>
      <ul>
        {ids.map((id) => {
          const r = result.strategies[id]!.records.find((x) => x.week === week);
          if (!r) return null;
          const info = meta.strategies.find((m) => m.id === id)!;
          return (
            <li key={id} className="irow">
              <span className="dot" style={{ background: STRATEGY_COLOR[id] }} />
              <span className="name">{info.label}</span>
              <span className="val">{fmt3(r.auc)}</span>
              <div className="bar" title={`${signed(r.auc - launch)} vs launch`}>
                <i style={{ width: `${Math.max(0, Math.min(1, (r.auc - lo) / (hi - lo))) * 100}%`, background: STRATEGY_COLOR[id] }} />
              </div>
              <div className="meta">
                <span>model v{r.model_version}</span>
                {r.retrained && <Chip tone="info">retrained</Chip>}
                {r.feature_alarm && <Chip tone="alarm">input alarm</Chip>}
                {r.performance_alarm && <Chip tone="alarm">AUC alarm</Chip>}
              </div>
            </li>
          );
        })}
      </ul>
      <h3>Inputs drifting this week</h3>
      {drifted.length === 0 ? (
        <p className="note" style={{ margin: 0 }}>None crossed both the PSI and KS thresholds.</p>
      ) : (
        <div className="chips">
          {drifted.map(({ j, psi }) => (
            <Chip key={j} tone="alarm" title={`PSI ${psi.toFixed(3)}`}>{prettyFeature(meta.features[j])} · {psi.toFixed(2)}</Chip>
          ))}
        </div>
      )}
    </aside>
  );
}
