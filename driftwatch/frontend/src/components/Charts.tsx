import { useWidth } from "../lib/hooks";
import { STRATEGY_COLOR, STRATEGY_DASH } from "../lib/colors";
import type { StrategyId } from "../types";

export interface Series { id: StrategyId; label: string; values: number[] }

/** Multi-line chart on a numeric x axis. */
export function CurveChart({ xs, series, vline, vlabel, xLabel, yMin, yMax, height = 250 }: {
  xs: number[]; series: Series[]; vline?: number; vlabel?: string; xLabel: string; yMin: number; yMax: number; height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const W = Math.max(width, 280), H = height, m = { l: 40, r: 14, t: 10, b: 34 };
  const x = (v: number) => m.l + ((v - xs[0]) / (xs[xs.length - 1] - xs[0])) * (W - m.l - m.r);
  const y = (v: number) => m.t + (1 - (v - yMin) / (yMax - yMin)) * (H - m.t - m.b);
  const yt: number[] = [];
  for (let v = yMin; v <= yMax + 1e-9; v += 0.05) yt.push(Math.round(v * 100) / 100);
  const step = xs.length > 12 ? 2 : 1;
  return (
    <div ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} className="axis" role="img">
        {yt.map((v) => (
          <g key={v}>
            <line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} stroke="#d3dae2" strokeWidth={0.8} />
            <text x={m.l - 8} y={y(v) + 4} textAnchor="end">{v.toFixed(2)}</text>
          </g>
        ))}
        {xs.filter((_, i) => i % step === 0).map((v) => (
          <text key={v} x={x(v)} y={H - m.b + 16} textAnchor="middle">{v}</text>
        ))}
        <text x={(m.l + W - m.r) / 2} y={H - 4} textAnchor="middle">{xLabel}</text>
        {vline !== undefined && (
          <g>
            <line x1={x(vline)} x2={x(vline)} y1={m.t} y2={H - m.b} stroke="#d9901a" strokeDasharray="4 4" />
            {vlabel && <text x={x(vline) + 5} y={m.t + 10} fill="#7b8999">{vlabel}</text>}
          </g>
        )}
        {series.map((s) => (
          <polyline key={s.id} fill="none" stroke={STRATEGY_COLOR[s.id]} strokeWidth={s.id === "hybrid" ? 3 : 2}
            strokeDasharray={STRATEGY_DASH[s.id]} strokeLinejoin="round" strokeLinecap="round"
            points={s.values.map((v, i) => `${x(xs[i])},${y(v)}`).join(" ")}>
            <title>{s.label}</title>
          </polyline>
        ))}
        {series.map((s) => s.values.length <= 6 && s.values.map((v, i) => (
          <circle key={`${s.id}${i}`} cx={x(xs[i])} cy={y(v)} r={3.5} fill={STRATEGY_COLOR[s.id]} stroke="#fff" />
        )))}
      </svg>
      <div className="legend" style={{ flexWrap: "wrap", gap: "4px 16px", paddingLeft: 40 }}>
        {series.map((s) => (
          <span key={s.id} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <i style={{ width: 14, height: 3, background: STRATEGY_COLOR[s.id], display: "inline-block", borderRadius: 2 }} />{s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export interface Pt { id: StrategyId; label: string; x: number; y: number; ci: number }

/** Cost (retrains) against accuracy (AUC after drift), with 95% interval whiskers. */
export function Tradeoff({ pts, yMin, yMax }: { pts: Pt[]; yMin: number; yMax: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const W = Math.max(width, 280), H = 280, m = { l: 44, r: 150, t: 20, b: 40 };
  const xMax = Math.max(...pts.map((p) => p.x), 1) * 1.1;
  const x = (v: number) => m.l + (v / xMax) * (W - m.l - m.r);
  const y = (v: number) => m.t + (1 - (v - yMin) / (yMax - yMin)) * (H - m.t - m.b);
  const yt: number[] = [];
  for (let v = yMin; v <= yMax + 1e-9; v += 0.05) yt.push(Math.round(v * 100) / 100);
  // Points that land on top of each other share one label; labels are then pushed apart vertically.
  const groups: { x: number; y: number; names: string[] }[] = [];
  for (const p of pts) {
    const g = groups.find((q) => Math.abs(x(p.x) - q.x) < 7 && Math.abs(y(p.y) - q.y) < 7);
    if (g) g.names.push(p.label); else groups.push({ x: x(p.x), y: y(p.y), names: [p.label] });
  }
  groups.sort((a, b) => a.y - b.y);
  const labels: { x: number; y: number; text: string }[] = [];
  for (const g of groups) {
    const prev = labels[labels.length - 1];
    labels.push({ x: g.x, y: prev && g.y - prev.y < 15 ? prev.y + 15 : g.y, text: g.names.join(" · ") });
  }
  return (
    <div ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} className="axis" role="img"
        aria-label="Retrains against AUC after drift, per policy">
        {yt.map((v) => (
          <g key={v}>
            <line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} stroke="#d3dae2" strokeWidth={0.8} />
            <text x={m.l - 8} y={y(v) + 4} textAnchor="end">{v.toFixed(2)}</text>
          </g>
        ))}
        {[0, 5, 10, 15, 20].filter((v) => v <= xMax).map((v) => (
          <text key={v} x={x(v)} y={H - m.b + 16} textAnchor="middle">{v}</text>
        ))}
        <text x={(m.l + W - m.r) / 2} y={H - 6} textAnchor="middle">retrains in 21 weeks (cost)</text>
        <text x={m.l - 8} y={m.t - 12} textAnchor="end">AUC</text>
        {pts.map((p) => (
          <g key={p.id}>
            <line x1={x(p.x)} x2={x(p.x)} y1={y(p.y - p.ci)} y2={y(p.y + p.ci)} stroke={STRATEGY_COLOR[p.id]} strokeWidth={2} />
            <circle cx={x(p.x)} cy={y(p.y)} r={6.5} fill={STRATEGY_COLOR[p.id]} stroke="#fff" strokeWidth={2}>
              <title>{`${p.label}: AUC ${p.y.toFixed(3)} ± ${p.ci.toFixed(3)}, ${p.x} retrains`}</title>
            </circle>
          </g>
        ))}
        {labels.map((l) => (
          <text key={l.text} x={l.x + 12} y={l.y + 4} style={{ fill: "#101a26", fontSize: 12, fontWeight: 550, stroke: "#f8f9fb", strokeWidth: 4, paintOrder: "stroke" }}>{l.text}</text>
        ))}
      </svg>
    </div>
  );
}
