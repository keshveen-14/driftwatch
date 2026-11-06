export const fmt3 = (v: number) => v.toFixed(3);
export const fmt2 = (v: number) => v.toFixed(2);
export const signed = (v: number, d = 3) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(d);
export const pct = (v: number, d = 0) => (v * 100).toFixed(d) + "%";
export const prettyFeature = (n: string) => n.replace(/_/g, " ");
