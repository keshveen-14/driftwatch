import { useWidth } from "../lib/hooks";

/** Share of this week's rows in each reference decile. A stable feature sits on the 10% line. */
export default function DistChart({ shares }: { shares: number[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const W = Math.max(width, 240), H = 150, pad = { l: 30, r: 4, t: 8, b: 20 };
  const n = shares.length;
  const max = Math.max(0.3, ...shares) * 1.08;
  const bw = (W - pad.l - pad.r) / n;
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  return (
    <div ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Distribution of this week's values across reference deciles">
        {[0, 0.1, 0.2, 0.3].filter((v) => v <= max).map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="#d3dae2" strokeWidth={0.8} />
            <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" fontSize={10} fill="#7b8999">{Math.round(v * 100)}%</text>
          </g>
        ))}
        {shares.map((s, i) => (
          <rect key={i} x={pad.l + i * bw + 2} y={y(s)} width={bw - 4} height={Math.max(0, y(0) - y(s))} rx={2}
            fill={Math.abs(s - 0.1) > 0.05 ? "#e5484d" : "#8593a3"} opacity={0.9}>
            <title>{`Decile ${i + 1}: ${(s * 100).toFixed(1)}% of rows (reference: 10%)`}</title>
          </rect>
        ))}
        <line x1={pad.l} x2={W - pad.r} y1={y(0.1)} y2={y(0.1)} stroke="#101a26" strokeDasharray="4 3" />
        <text x={pad.l} y={H - 4} fontSize={10} fill="#7b8999">lowest reference decile</text>
        <text x={W - pad.r} y={H - 4} fontSize={10} fill="#7b8999" textAnchor="end">highest</text>
      </svg>
    </div>
  );
}
