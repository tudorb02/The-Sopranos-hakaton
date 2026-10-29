// React hooks over the API client: one-shot loads, the dossier (with optional polling) and its live events.

import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, getFarm, getModules, getRun } from "./api.js";
import { subscribeRun } from "./sse.js";

// Runs `fn(signal)` when `key` changes. Returns { data, error, loading, reload }.
export function useAsync(fn, key) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    fnRef
      .current(controller.signal)
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((error) => {
        if (error?.name === "AbortError") return;
        setState({ data: null, error: error instanceof ApiError ? error : new ApiError("INTERNAL", "Something went wrong. Try again."), loading: false });
      });
    return () => controller.abort();
  }, [key, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

// Categories and farms rarely change during a session: keep the answers in memory.
const cache = new Map();
function cached(key, load) {
  if (!cache.has(key)) {
    cache.set(
      key,
      load().catch((e) => {
        cache.delete(key);
        throw e;
      }),
    );
  }
  return cache.get(key);
}

export const useModules = () => useAsync(() => cached("modules", () => getModules()), "modules");

// The farm of a CUI; idle (data null, no error) while the CUI is empty.
export function useFarm(cui) {
  const state = useAsync(() => (cui ? cached(`farm:${cui}`, () => getFarm(cui)) : Promise.resolve(null)), cui || "");
  return { ...state, idle: !cui };
}

// The dossier as one of the two views. pollMs > 0 refreshes it while the screen is open (the officer may act meanwhile).
export function useRun(runId, view, { pollMs = 0 } = {}) {
  const [state, setState] = useState({ run: null, error: null, loading: Boolean(runId) });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!runId) {
      setState({ run: null, error: null, loading: false });
      return undefined;
    }
    let alive = true;
    const controller = new AbortController();
    const load = (first) => {
      if (first) setState((s) => ({ ...s, loading: true }));
      getRun(runId, view, { signal: controller.signal })
        .then((run) => alive && setState({ run, error: null, loading: false }))
        .catch((error) => {
          if (!alive || error?.name === "AbortError") return;
          // a failed poll keeps the last good dossier on screen
          setState((s) => (first || !s.run ? { run: null, error, loading: false } : s));
        });
    };
    load(true);
    const timer = pollMs > 0 ? setInterval(() => load(false), pollMs) : null;
    return () => {
      alive = false;
      controller.abort();
      if (timer) clearInterval(timer);
    };
  }, [runId, view, pollMs, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const replace = useCallback((run) => setState({ run, error: null, loading: false }), []);
  return { ...state, reload, replace };
}

// The live events of a dossier. status: connecting | open | reconnecting | done | error.
export function useRunEvents(runId, { enabled = true } = {}) {
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState({ state: "connecting", error: null });

  useEffect(() => {
    if (!runId || !enabled) return undefined;
    setEvents([]);
    setStatus({ state: "connecting", error: null });
    const subscription = subscribeRun(runId, {
      onEvent: (event) => setEvents((list) => (list.some((e) => e.seq === event.seq) ? list : [...list, event])),
      onStatus: (state, error) => setStatus({ state, error: error ?? null }),
    });
    return () => subscription.close();
  }, [runId, enabled]);

  return { events, status };
}
