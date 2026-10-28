const configured = process.env.EXPO_PUBLIC_API_URL;
const developmentWeb = typeof __DEV__ !== "undefined" && __DEV__ && globalThis.location;
const base = (configured ?? (developmentWeb ? `${globalThis.location.protocol}//${globalThis.location.hostname}:3001/api/demo/v1` : globalThis.location ? "/api/demo/v1" : "http://localhost:3001/api/demo/v1")).replace(/\/$/, "");

export class ApiError extends Error {
  constructor(message, status = 0, code = "network_error") { super(message); this.status = status; this.code = code; }
}

export async function request(path, { method = "GET", body, signal, timeout = 15000, headers = {} } = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`${base}${path}`, { method, signal: controller.signal,
      headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const data = response.status === 204 ? null : await response.json();
    if (!response.ok) throw new ApiError(data?.error?.message ?? "Nu pot încărca datele. Încearcă din nou.", response.status, data?.error?.code);
    return data;
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error instanceof ApiError) throw error;
    throw new ApiError(controller.signal.aborted ? "Conexiunea durează prea mult. Încearcă din nou." : "Nu pot contacta serverul. Verifică conexiunea și încearcă din nou.");
  } finally { clearTimeout(timer); signal?.removeEventListener("abort", abort); }
}

export const personaPath = (id, path = "") => `/personas/${encodeURIComponent(id)}${path}`;
export function amountMinor(value) {
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(String(value).trim());
  if (!match) throw new Error("Completează o sumă pozitivă, cu maximum două zecimale.");
  const amount = BigInt(match[1]) * 100n + BigInt((match[2] ?? "").padEnd(2, "0"));
  if (amount <= 0n || amount > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Suma este în afara limitelor acceptate.");
  return Number(amount);
}
