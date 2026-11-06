import { STRATEGY_COLOR } from "../lib/colors";
import { fmt3, signed } from "../lib/format";
import type { Meta, RunResult, StrategyId } from "../types";

interface Props {
  meta: Meta;
  result: RunResult;
  visible: Set<StrategyId>;
  onToggle: (id: StrategyId) => void;
}

export default function Scoreboard({ meta, result, visible, onToggle }: Props) {
  const ids = meta.strategies.map((s) => s.id).filter((id) => result.strategies[id]);
  const frozen = result.strategies.frozen?.summary.post_drift_auc;
  const lo = 0.6, hi = 0.9;
  const bar = (v: number) => `${Math.max(0, Math.min(1, (v - lo) / (hi - lo))) * 100}%`;
  const launch = result.strategies[ids[0]]!.summary.pre_drift_auc;
  return (
    <table className="board">
      <thead>
        <tr>
          <th>Retraining policy</th>
          <th>Mean AUC after drift starts</th>
          <th className="r">vs frozen</th>
          <th className="r">Worst week</th>
          <th className="r">Weeks degraded</th>
          <th className="r">Retrains</th>
          <th className="r">First alarm</th>
        </tr>
      </thead>
      <tbody>
        {ids.map((id) => {
          const s = result.strategies[id]!.summary;
          const info = meta.strategies.find((m) => m.id === id)!;
          const on = visible.has(id);
          return (
            <tr key={id} className={on ? "on" : "off"} onClick={() => onToggle(id)}>
              <td>
                <div className="pol">
                  <button className="swatch" aria-pressed={on} aria-label={`Show ${info.label} on chart`}
                    style={{ color: STRATEGY_COLOR[id], borderColor: STRATEGY_COLOR[id], background: "transparent", padding: 0 }}
                    onClick={(e) => { e.stopPropagation(); onToggle(id); }}><i /></button>
                  <span>{info.label}<small>{info.blurb}</small></span>
                </div>
              </td>
              <td>
                <div className="auccell">
                  <span>{fmt3(s.post_drift_auc)}</span>
                  <div className="meter"><i style={{ width: bar(s.post_drift_auc), background: STRATEGY_COLOR[id] }} /><u style={{ left: bar(launch) }} title="AUC before drift" /></div>
                </div>
              </td>
              <td className="r num">{id === "frozen" || frozen === undefined ? "–" : signed(s.post_drift_auc - frozen)}</td>
              <td className="r num">{fmt3(s.worst_auc)} <span style={{ color: "var(--ink-3)" }}>wk {s.worst_week}</span></td>
              <td className="r num">{s.weeks_degraded}</td>
              <td className="r num">{s.retrains}</td>
              <td className="r num">{s.first_alarm_week === null ? "none" : `wk ${s.first_alarm_week}`}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
