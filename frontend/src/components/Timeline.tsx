import { useCallback, useRef } from "react";
import { ALARM, STRATEGY_COLOR, STRATEGY_DASH } from "../lib/colors";
import { useWidth } from "../lib/hooks";
import type { RunResult, StrategyId } from "../types";

interface Props {
  result: RunResult;
  visible: Set<StrategyId>;
  week: number;
  onWeek: (w: number) => void;
}

const H = 400;
const M = { l: 84, r: 18, t: 22, b: 70 };

/** Model health over time: one line per retraining policy, with the drift ramp, retrain markers,
 *  monitor alarms and a scrubber that replays the stream week by week. */
export default function Timeline({ result, visible, week, onWeek }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement>(null);
  const cfg = result.config;
  const ids = Object.keys(result.strategies) as StrategyId[];
  const first = result.first_week;
  const last = cfg.n_weeks - 1;
  const W = Math.max(width, 320);

  const all = ids.flatMap((id) => result.strategies[id]!.records.map((r) => r.auc));
  const yMin = Math.floor((Math.min(...all) - 0.015) * 20) / 20;
  const yMax = Math.min(1, Math.ceil((Math.max(...all) + 0.008) * 20) / 20);
  const x = (w: number) => M.l + ((w - first) / (last - first)) * (W - M.l - M.r);
  const y = (v: number) => M.t + (1 - (v - yMin) / (yMax - yMin)) * (H - M.t - M.b);

  const ref0 = result.strategies.frozen ?? result.strategies[ids[0]]!;
  const preMean = ref0.summary.pre_drift_auc;
  const floor = preMean - 0.03;

  const setFromPointer = useCallback((clientX: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * W;
    const w = Math.round(first + ((px - M.l) / (W - M.l - M.r)) * (last - first));
    onWeek(Math.max(first, Math.min(last, w)));
  }, [W, first, last, onWeek]);

  const yTicks: number[] = [];
  for (let v = yMin; v <= yMax + 1e-9; v += 0.05) yTicks.push(Math.round(v * 100) / 100);
  const xTicks: number[] = [];
  for (let w = first; w <= last; w += 2) xTicks.push(w);

  const rampEnd = Math.min(last, cfg.drift_start + cfg.drift_len - 1);
  const laneY1 = H - M.b + 34;
  const laneY2 = H - M.b + 52;

  return (
    <div className="timeline" ref={ref}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} height={H} role="img"
        aria-label="Model AUC by week for each retraining policy">
        {/* drift ramp */}
        <rect x={x(cfg.drift_start)} y={M.t} width={Math.max(0, x(rampEnd) - x(cfg.drift_start))} height={H - M.t - M.b}
          fill="#d9901a" opacity={0.11} />
        <line x1={x(cfg.drift_start)} x2={x(cfg.drift_start)} y1={M.t} y2={H - M.b} stroke="#d9901a" strokeDasharray="4 4" />
        <text className="tag" x={x(cfg.drift_start) + 6} y={M.t + 12}>drift starts, week {cfg.drift_start}</text>

        {/* grid + y axis */}
        <g className="axis">
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="#d3dae2" strokeWidth={0.8} />
              <text x={M.l - 10} y={y(v) + 4} textAnchor="end">{v.toFixed(2)}</text>
            </g>
          ))}
          <text x={M.l - 10} y={M.t - 16} textAnchor="end">AUC</text>
          {xTicks.map((w) => (
            <text key={w} x={x(w)} y={H - M.b + 16} textAnchor="middle">{w}</text>
          ))}
          <text x={W - M.r} y={H - M.b + 16} textAnchor="end" opacity={0}>.</text>
        </g>

        {/* alert floor */}
        <line x1={M.l} x2={W - M.r} y1={y(floor)} y2={y(floor)} stroke="#e5484d" strokeDasharray="2 5" opacity={0.7} />
        <text className="tag" x={M.l + 6} y={y(floor) + 14} fill="#c23338" style={{ fill: "#c23338" }}>
          alert floor, 0.03 below launch AUC
        </text>

        {/* lines */}
        {[...ids].sort((a, b) => Number(b === "hybrid") - Number(a === "hybrid")).filter((id) => visible.has(id)).map((id) => {
          const recs = result.strategies[id]!.records;
          const color = STRATEGY_COLOR[id];
          const dash = STRATEGY_DASH[id];
          const pts = (rs: typeof recs) => rs.map((r) => `${x(r.week)},${y(r.auc)}`).join(" ");
          const shown = recs.filter((r) => r.week <= week);
          const head = shown[shown.length - 1];
          return (
            <g key={id}>
              <polyline points={pts(recs)} fill="none" stroke={color} strokeWidth={1.4} opacity={0.18} strokeDasharray={dash} />
              <polyline points={pts(shown)} fill="none" stroke={color} strokeWidth={id === "hybrid" ? 3 : 2}
                strokeLinejoin="round" strokeLinecap="round" strokeDasharray={dash} />
              {id !== "weekly_oracle" && shown.filter((r) => r.retrained).map((r) => (
                <path key={r.week} transform={`translate(${x(r.week)},${y(r.auc)})`} d="M0,-6 L6,0 L0,6 L-6,0 Z"
                  fill="#fff" stroke={color} strokeWidth={2}>
                  <title>{`${id.replace(/_/g, " ")} retrained after week ${r.week}`}</title>
                </path>
              ))}
              {head && <circle cx={x(head.week)} cy={y(head.auc)} r={4.5} fill={color} stroke="#fff" strokeWidth={1.5} />}
            </g>
          );
        })}

        {/* alarm lanes (launch model, fixed reference) */}
        <g>
          <text className="tag" x={M.l - 10} y={laneY1 + 9} textAnchor="end">input alarm</text>
          <text className="tag" x={M.l - 10} y={laneY2 + 9} textAnchor="end">AUC alarm</text>
          <rect x={M.l} y={laneY1} width={W - M.l - M.r} height={12} fill="#e1e6ec" opacity={0.6} rx={2} />
          <rect x={M.l} y={laneY2} width={W - M.l - M.r} height={12} fill="#e1e6ec" opacity={0.6} rx={2} />
          {ref0.records.filter((r) => r.week <= week).map((r) => (
            <g key={r.week}>
              {r.feature_alarm && <rect x={x(r.week) - 5} y={laneY1} width={10} height={12} fill={ALARM} rx={2} />}
              {r.performance_alarm && <rect x={x(r.week) - 5} y={laneY2} width={10} height={12} fill={ALARM} rx={2} />}
            </g>
          ))}
        </g>

        {/* scrubber */}
        <line x1={x(week)} x2={x(week)} y1={M.t - 6} y2={laneY2 + 12} stroke="#101a26" strokeWidth={1.2} />
        <rect x={x(week) - 14} y={M.t - 20} width={28} height={16} rx={8} fill="#101a26" />
        <text x={x(week)} y={M.t - 8} textAnchor="middle" fontSize={11} fontWeight={600} fill="#fff"
          style={{ fill: "#fff", fontVariantNumeric: "tabular-nums" }}>{week}</text>
        <rect x={M.l - 6} y={M.t - 20} width={W - M.l - M.r + 12} height={H - M.t + 20 - 6} fill="transparent"
          style={{ cursor: "ew-resize" }}
          onPointerDown={(e) => { (e.target as Element).setPointerCapture(e.pointerId); setFromPointer(e.clientX); }}
          onPointerMove={(e) => { if (e.buttons === 1) setFromPointer(e.clientX); }} />
      </svg>
    </div>
  );
}
