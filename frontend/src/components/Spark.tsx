import { useWidth } from "../lib/hooks";

export default function Spark({ values, weeks, threshold, selected }: {
  values: number[]; weeks: number[]; threshold: number; selected: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const W = Math.max(width, 240), H = 90, pad = { l: 30, r: 4, t: 8, b: 18 };
  const max = Math.max(threshold * 2, ...values) * 1.05;
  const x = (i: number) => pad.l + (i / (values.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const si = weeks.indexOf(selected);
  return (
    <div ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="PSI over time for this feature">
        <line x1={pad.l} x2={W - pad.r} y1={y(threshold)} y2={y(threshold)} stroke="#e5484d" strokeDasharray="3 3" />
        <text x={pad.l - 4} y={y(threshold) + 3} fontSize={10} textAnchor="end" fill="#c23338">{threshold}</text>
        <polyline fill="none" stroke="#2d4bff" strokeWidth={2} strokeLinejoin="round"
          points={values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
        {si >= 0 && <circle cx={x(si)} cy={y(values[si])} r={4} fill="#101a26" />}
        <text x={pad.l} y={H - 3} fontSize={10} fill="#7b8999">week {weeks[0]}</text>
        <text x={W - pad.r} y={H - 3} fontSize={10} fill="#7b8999" textAnchor="end">week {weeks[weeks.length - 1]}</text>
      </svg>
    </div>
  );
}
