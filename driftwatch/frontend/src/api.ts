import type { Benchmark, DriftCheck, Meta, Run, SimConfig } from "./types";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch { /* keep status text */ }
    throw new Error(detail);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const api = {
  meta: () => req<Meta>("/api/meta"),
  createRun: (config: Partial<SimConfig>) =>
    req<Run>("/api/simulations", { method: "POST", body: JSON.stringify(config) }),
  getRun: (id: string) => req<Run>(`/api/simulations/${id}`),
  listRuns: () => req<Run[]>("/api/simulations"),
  benchmark: () => req<Benchmark>("/api/benchmark"),
  driftSimulate: (body: { shift: number; features: number[]; n: number; seed: number }) =>
    req<DriftCheck>("/api/drift/simulate", { method: "POST", body: JSON.stringify(body) }),
  predict: (rows: number[][]) =>
    req<{ predictions: { score: number; risk: "low" | "medium" | "high" }[] }>("/api/predict", {
      method: "POST", body: JSON.stringify({ rows }),
    }),
};
