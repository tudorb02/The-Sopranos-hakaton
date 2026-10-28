// What the browser remembers between the screens of the green flow: the draft of the request (company, category,
// parcels, answers) and the current dossier id, so one person can switch between the SME and the officer role.
// sessionStorage holds the draft; chosen files stay in memory (a File cannot be stored).

import { useSyncExternalStore } from "react";

const FLOW_KEY = "gs.flow";
const RUN_KEY = "gs.runId";
const RECENT_KEY = "gs.recentRuns";

const EMPTY_FLOW = { cui: "", consents: { apia: false, openBanking: false }, moduleId: null, parcelIds: null, answers: {}, runId: null };

function read(key, fallback) {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

let flow = { ...EMPTY_FLOW, ...read(FLOW_KEY, {}) };
let files = []; // [{ docType, file }]
const listeners = new Set();

function emit() {
  try {
    window.sessionStorage.setItem(FLOW_KEY, JSON.stringify(flow));
  } catch {
    // storage unavailable (private mode): the draft lives in memory only
  }
  listeners.forEach((fn) => fn());
}

export const getFlow = () => flow;

export function patchFlow(patch) {
  flow = { ...flow, ...patch };
  emit();
}

export function resetFlow(keep = {}) {
  flow = { ...EMPTY_FLOW, ...keep };
  files = [];
  emit();
}

export function useFlow() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => flow,
  );
}

export const getFiles = () => files;

// One file per document type; choosing again replaces it, null removes it.
export function setFile(docType, file) {
  files = files.filter((f) => f.docType !== docType);
  if (file) files = [...files, { docType, file }];
  listeners.forEach((fn) => fn());
}

// ---- current dossier (shared by the SME and the officer screens) ----

export function currentRunId() {
  try {
    return window.sessionStorage.getItem(RUN_KEY) || flow.runId || null;
  } catch {
    return flow.runId;
  }
}

export function rememberRun(runId) {
  try {
    window.sessionStorage.setItem(RUN_KEY, runId);
    const recent = [runId, ...JSON.parse(window.localStorage.getItem(RECENT_KEY) || "[]").filter((id) => id !== runId)].slice(0, 8);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
  } catch {
    // storage unavailable
  }
  if (flow.runId !== runId) patchFlow({ runId });
}

export function recentRuns() {
  try {
    return JSON.parse(window.localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
}
