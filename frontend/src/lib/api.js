// Client of the GreenStruct Agro API (contracts/openapi.yaml). Plain fetch, no dependencies; it also runs in Node
// (scripts/smoke.mjs). Errors are always ApiError: `code` is the stable code of the contract ({error:{code,message}}) or
// NETWORK / UNAVAILABLE when the backend cannot be reached, and `message` is Romanian, ready to show.

let base = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) || "";

// The base URL of the API; empty = same origin (the Vite dev server proxies /api to the backend).
export function setApiBase(url) {
  base = url.replace(/\/$/, "");
}

export const apiUrl = (path) => `${base}${path}`;

export class ApiError extends Error {
  constructor(code, message, { status = 0, details = [] } = {}) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const NETWORK_MESSAGE = "Nu mă pot conecta la server. Verifică dacă aplicația pornește (backend-ul) și încearcă din nou.";
const UNAVAILABLE_MESSAGE = "Serverul nu răspunde acum. Încearcă din nou în câteva clipe.";

// The ApiError for a response that is not 2xx.
export async function errorFromResponse(res) {
  let body = null;
  try {
    body = await res.json();
  } catch {
    // not JSON: a proxy error page or an empty body
  }
  if (body?.error?.code) {
    return new ApiError(body.error.code, body.error.message, { status: res.status, details: body.error.details });
  }
  if (res.status >= 500) return new ApiError("UNAVAILABLE", UNAVAILABLE_MESSAGE, { status: res.status });
  return new ApiError("INTERNAL", "A apărut o eroare. Reîncearcă.", { status: res.status });
}

async function request(path, { method = "GET", json, form, signal } = {}) {
  const init = { method, signal, headers: { Accept: "application/json" } };
  if (json !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(json);
  } else if (form) {
    init.body = form;
  }
  let res;
  try {
    res = await fetch(apiUrl(path), init);
  } catch (e) {
    if (e?.name === "AbortError") throw e;
    throw new ApiError("NETWORK", NETWORK_MESSAGE);
  }
  if (!res.ok) throw await errorFromResponse(res);
  return res.json();
}

export const getModules = (opts) => request("/api/modules", opts);
export const getFarm = (cui, opts) => request(`/api/farms/${encodeURIComponent(cui)}`, opts);
export const createDemoRun = (scenario, opts) => request(`/api/runs/demo/${encodeURIComponent(scenario)}`, { method: "POST", ...opts });
// view: "sme" = what the SME sees (no funds, no officer notes), "full" = the dossier as the bank gets it.
export const getRun = (runId, view = "full", opts) => request(`/api/runs/${runId}?view=${view}`, opts);
export const submitRun = (runId, variant) => request(`/api/runs/${runId}/submit`, { method: "POST", json: { variant } });
export const approveRun = (runId, { officerId, commentRo, acceptedConditionIds }) =>
  request(`/api/runs/${runId}/approve`, { method: "POST", json: { officerId, commentRo, acceptedConditionIds } });
export const requestDocuments = (runId, { officerId, messageRo, documents }) =>
  request(`/api/runs/${runId}/request-documents`, { method: "POST", json: { officerId, messageRo, documents } });
export const simulateMonitoring = (runId) => request(`/api/runs/${runId}/simulate-monitoring`, { method: "POST" });
export const getPortfolio = (opts) => request("/api/portfolio", opts);
export const getBedrockHealth = (opts) => request("/api/health/bedrock", opts);
export const reportUrl = (runId) => apiUrl(`/api/runs/${runId}/report.pdf`);

// POST /api/classify: the category of the investment, found from the offer. Resolves with { moduleId } (null if unknown).
export function classifyOffer(file) {
  const form = new FormData();
  form.append("document", file, file.name);
  return request("/api/classify", { method: "POST", form });
}

// POST /api/runs (multipart). documents: [{ docType, file }]; the manifest keeps the same order as the files.
export function createRun({ cui, moduleId, parcelIds, questionnaire, documents, consents }) {
  const form = new FormData();
  const json = (value) => new Blob([JSON.stringify(value)], { type: "application/json" });
  form.append("cui", cui);
  form.append("moduleId", moduleId);
  form.append("parcelIds", json(parcelIds));
  form.append("questionnaire", json(questionnaire));
  form.append("documentManifest", json(documents.map(({ docType, file }) => ({ fileName: file.name, docType }))));
  if (consents) form.append("consents", json(consents));
  for (const { file } of documents) form.append("documents", file, file.name);
  return request("/api/runs", { method: "POST", form });
}
