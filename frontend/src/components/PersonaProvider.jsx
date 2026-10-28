import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PersonaApiContext, PersonaContext } from "../persona.js";
import { personaPath, request } from "../lib/api.js";
import { useRouter } from "../router.jsx";

export function PersonaProvider({ id, children }) {
  const { route } = useRouter();
  const active = !["login", "login/pj", "firma", "verde"].includes(route) && !route.startsWith("verde/");
  const activeRoute = useRef(active);
  activeRoute.current = active;
  const [state, setState] = useState({ id, status: "loading", data: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const activeId = useRef(id), working = useRef(false), submitRef = useRef(null), loadRef = useRef(null);
  const requests = useRef(new Map());
  activeId.current = id;

  const reload = useCallback(async () => {
    if (!activeRoute.current) return false;
    loadRef.current?.abort();
    const controller = new AbortController();
    loadRef.current = controller;
    try {
      const catalog = await request("/catalog", { signal: controller.signal });
      let data, preferences = {}, metrics = {}, enabled = true;
      try {
        data = await request(personaPath(id), { signal: controller.signal });
        preferences = await request(personaPath(id, "/preferences"), { signal: controller.signal });
        metrics = await request(personaPath(id, "/metrics"), { signal: controller.signal });
      } catch (error) {
        if (error.status !== 410) throw error;
        enabled = false;
        data = await request(personaPath(id, "/products"), { signal: controller.signal });
      }
      if (controller.signal.aborted || activeId.current !== id) return false;
      setState({ id, status: "ready", enabled, preferences, metrics, data: { ...catalog, ...data,
        legal: { ...catalog.legal, screenPrivacy: preferences.privacy ?? catalog.legal.screenPrivacy } } });
      return true;
    } catch (error) {
      if (!controller.signal.aborted && activeId.current === id) setState((old) => old.id === id && old.data ? { ...old, error } : { id, status: "error", error, data: null });
      return false;
    }
  }, [id]);

  useEffect(() => {
    if (!active) return;
    working.current = false; submitRef.current = null; setBusy(false); setError(null);
    reload();
    return () => loadRef.current?.abort();
  }, [reload, active]);

  const mutate = useCallback(async (path, body, method = "PATCH") => {
    if (working.current) return false;
    const owner = id;
    const key = JSON.stringify([id, method, path, body]);
    if (!requests.current.has(key)) requests.current.set(key, globalThis.crypto?.randomUUID?.() ?? `demo-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    working.current = true; setBusy(true); setError(null);
    try {
      await request(personaPath(id, path), { method, body, headers: { "Idempotency-Key": requests.current.get(key) } });
      if (activeId.current !== owner) return false;
      const loaded = await reload();
      if (loaded) requests.current.delete(key);
      else setError(new Error("Modificarea a fost salvată, dar nu pot reîncărca datele. Încearcă din nou."));
      return loaded;
    } catch (error) {
      if (activeId.current === owner) setError(error);
      return false;
    } finally {
      if (activeId.current === owner) { working.current = false; setBusy(false); }
    }
  }, [id, reload]);

  const registerSubmit = useCallback((handler) => {
    submitRef.current = handler;
    return () => { if (submitRef.current === handler) submitRef.current = null; };
  }, []);
  const submit = useCallback(async () => submitRef.current ? submitRef.current() : true, []);
  const current = state.id === id ? state : { id, status: "loading", data: null };
  const api = useMemo(() => ({ id, status: current.status, enabled: current.enabled, preferences: current.preferences, metrics: current.metrics,
    loadError: current.error, busy, error, reload, mutate, registerSubmit, submit, reportError: setError }),
  [id, current.status, current.enabled, current.preferences, current.metrics, current.error, busy, error, reload, mutate, registerSubmit, submit]);
  return <PersonaApiContext.Provider value={api}><PersonaContext.Provider value={current.data}>{children}</PersonaContext.Provider></PersonaApiContext.Provider>;
}
