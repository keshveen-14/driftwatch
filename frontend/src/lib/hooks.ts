import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { Run, SimConfig } from "../types";

/** Measure an element's width so SVG charts can redraw crisply at any size. */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    setWidth(Math.round(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/** Queue a simulation and poll until it finishes. Identical configs return instantly (cached). */
export function useRunner() {
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const token = useRef(0);

  const launch = useCallback(async (config: Partial<SimConfig>) => {
    const mine = ++token.current;
    setBusy(true);
    setError(null);
    try {
      let r = await api.createRun(config);
      if (mine !== token.current) return;
      setRun(r.status === "done" ? await api.getRun(r.id) : r);
      while (r.status !== "done") {
        if (r.status === "failed") throw new Error(r.error ?? "simulation failed");
        await new Promise((res) => setTimeout(res, 600));
        r = await api.getRun(r.id);
        if (mine !== token.current) return;
        setRun(r);
      }
      setRun(await api.getRun(r.id));
    } catch (e) {
      if (mine === token.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (mine === token.current) setBusy(false);
    }
  }, []);

  const show = useCallback(async (id: string) => {
    token.current++;
    setBusy(false);
    setError(null);
    try { setRun(await api.getRun(id)); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, []);

  return { run, busy, error, launch, show };
}

export function useHashRoute(routes: string[], fallback: string) {
  const read = () => {
    const h = window.location.hash.replace(/^#\/?/, "");
    return routes.includes(h) ? h : fallback;
  };
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return route;
}
