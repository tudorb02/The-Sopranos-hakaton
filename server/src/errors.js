export class ApiError extends Error {
  constructor(status, message, code = "invalid_request") { super(message); this.status = status; this.code = code; }
}
export const requireValue = (condition, message, status = 400) => { if (!condition) throw new ApiError(status, message); };
export const exactKeys = (body, keys) => requireValue(body && typeof body === "object" && !Array.isArray(body) && Object.keys(body).every((key) => keys.includes(key)), "Câmpuri neacceptate în cerere.");
export const textValue = (value, max = 1000) => typeof value === "string" && value.length <= max;
