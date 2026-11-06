import type { Meta, Run } from "../types";

const f3 = (v: number) => v.toFixed(3);

/** One sentence on what this run shows, written from the numbers. */
export function insight(run: Run, meta: Meta): { headline: string; sub: string } {
  const s = run.summary ?? {};
  const label = (id: string) => meta.strategies.find((m) => m.id === id)?.label ?? id;
  const fz = s.frozen, dt = s.drift_triggered, hy = s.hybrid, sc = s.scheduled;
  if (fz && dt && hy && dt.retrains === 0 && hy.retrains > 0) {
    return {
      headline: `Input monitors stayed silent. The hybrid policy still recovered AUC from ${f3(fz.post_drift_auc)} to ${f3(hy.post_drift_auc)}.`,
      sub: `PSI and KS only see inputs, and here the inputs never changed. Watching labelled AUC caught the drop and retrained ${hy.retrains} times.`,
    };
  }
  if (fz && hy && sc) {
    return {
      headline: `A frozen model falls from ${f3(fz.pre_drift_auc)} to ${f3(fz.post_drift_auc)} AUC. Hybrid retraining holds ${f3(hy.post_drift_auc)}.`,
      sub: `That took ${hy.retrains} retrains. ${label("scheduled")} retraining reached ${f3(sc.post_drift_auc)} with ${sc.retrains}.`,
    };
  }
  const best = Object.entries(s).sort((a, b) => b[1].post_drift_auc - a[1].post_drift_auc)[0];
  return {
    headline: best ? `${label(best[0])} scored best after drift: ${f3(best[1].post_drift_auc)} AUC.` : "Run a simulation to begin.",
    sub: "Select more policies to compare them.",
  };
}
