import type { StrategyId } from "../types";

export const STRATEGY_COLOR: Record<StrategyId, string> = {
  frozen: "#8593A3",
  scheduled: "#D9901A",
  drift_triggered: "#2D4BFF",
  performance_triggered: "#B04CC9",
  hybrid: "#0F9D8A",
  weekly_oracle: "#101A26",
};
export const STRATEGY_DASH: Partial<Record<StrategyId, string>> = { weekly_oracle: "2 4" };
export const ALARM = "#E5484D";

/** PSI -> heat colour. Quiet below the threshold, then amber to red. */
export function psiColor(psi: number, threshold: number): string {
  if (psi < threshold * 0.5) return "#E9EDF2";
  if (psi < threshold) return "#DDE3EA";
  const t = Math.min(1, (psi - threshold) / (0.6 - threshold));
  // light amber -> vermilion
  const a = [248, 203, 120], b = [214, 53, 60];
  const c = a.map((x, i) => Math.round(x + (b[i] - x) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
