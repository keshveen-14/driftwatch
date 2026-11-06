import { psiColor } from "../lib/colors";
import { prettyFeature } from "../lib/format";
import type { FeatureWeek } from "../types";

interface Props {
  features: string[];
  weeks: FeatureWeek[];
  threshold: number;
  driftStart: number;
  sel: { f: number; w: number };
  onSelect: (s: { f: number; w: number }) => void;
}

const CELL_W = 34, CELL_H = 30, LEFT = 150, TOP = 46;

export default function Heatmap({ features, weeks, threshold, driftStart, sel, onSelect }: Props) {
  const W = LEFT + weeks.length * CELL_W + 8;
  const H = TOP + features.length * CELL_H + 8;
  const col = (i: number) => LEFT + i * CELL_W;
  const driftCol = weeks.findIndex((w) => w.week >= driftStart);
  return (
    <svg width={W} height={H} role="grid" aria-label="Population stability index by feature and week">
      {/* alarm lane */}
      <text x={LEFT - 10} y={TOP - 12} textAnchor="end">input alarm</text>
      {weeks.map((w, i) => (
        <g key={w.week} className="wk">
          <text x={col(i) + CELL_W / 2} y={TOP - 28} textAnchor="middle">{w.week}</text>
          <rect x={col(i) + 2} y={TOP - 22} width={CELL_W - 4} height={14} rx={3}
            fill={w.alarm ? "#e5484d" : "#e1e6ec"} opacity={w.alarm ? 1 : 0.6}>
            <title>{w.alarm ? `Week ${w.week}: alarm, ${w.drifted.length} features drifted` : `Week ${w.week}: no alarm`}</title>
          </rect>
        </g>
      ))}
      {features.map((name, f) => (
        <g key={name}>
          <text x={LEFT - 10} y={TOP + f * CELL_H + CELL_H / 2 + 4} textAnchor="end">{prettyFeature(name)}</text>
          {weeks.map((w, i) => {
            const selected = sel.f === f && sel.w === w.week;
            return (
              <g key={w.week} role="gridcell" tabIndex={-1} style={{ cursor: "pointer" }} onClick={() => onSelect({ f, w: w.week })}>
                <rect x={col(i) + 1} y={TOP + f * CELL_H + 1} width={CELL_W - 2} height={CELL_H - 2} rx={3}
                  fill={psiColor(w.psi[f], threshold)} stroke={selected ? "#101a26" : "none"} strokeWidth={2.2}>
                  <title>{`${prettyFeature(name)}, week ${w.week}: PSI ${w.psi[f].toFixed(3)}`}</title>
                </rect>
                {w.drifted.includes(f) && <circle cx={col(i) + CELL_W / 2} cy={TOP + f * CELL_H + CELL_H / 2} r={2.4} fill="#fff" />}
              </g>
            );
          })}
        </g>
      ))}
      {driftCol >= 0 && (
        <g>
          <line x1={col(driftCol)} x2={col(driftCol)} y1={TOP - 4} y2={H - 6} stroke="#d9901a" strokeWidth={1.6} strokeDasharray="4 3" />
        </g>
      )}
    </svg>
  );
}
