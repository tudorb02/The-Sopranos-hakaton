import assert from "node:assert/strict";
import { afterEach, test } from "./runtime.js";
import { amountMinor, request } from "../../frontend/src/lib/api.js";
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test("client converts user-entered money exactly and rejects invalid input", () => {
  assert.equal(amountMinor("17,29"), 1729); assert.equal(amountMinor("0.01"), 1);
  for (const value of ["-1", "0", "1.234", "text", "9007199254740992"]) assert.throws(() => amountMinor(value));
});
test("client handles successful JSON and empty delete responses", async () => {
  globalThis.fetch = async (_url, options) => { assert.equal(options.method, "POST"); assert.equal(options.headers["Content-Type"], "application/json"); return new Response('{"saved":true}', { status: 200 }); };
  assert.deepEqual(await request("/test", { method: "POST", body: { test: true } }), { saved: true });
  globalThis.fetch = async () => new Response(null, { status: 204 });
  assert.equal(await request("/test", { method: "DELETE" }), null);
});
test("client exposes safe API errors and a useful offline error", async () => {
  globalThis.fetch = async () => new Response('{"error":{"message":"Încearcă din nou","code":"conflict"}}', { status: 409 });
  await assert.rejects(request("/test"), (error) => error.status === 409 && error.code === "conflict");
  globalThis.fetch = async () => { throw new Error("private network details"); };
  await assert.rejects(request("/test"), (error) => error.message.includes("conexiunea") && !error.message.includes("private"));
});
test("client aborts requests on cancellation and timeout", async () => {
  globalThis.fetch = async (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    if (signal.aborted) reject(new Error("aborted"));
  });
  await assert.rejects(request("/test", { timeout: 5 }), (error) => error.message.includes("prea mult"));
  const controller = new AbortController(); const pending = request("/test", { signal: controller.signal }); controller.abort();
  await assert.rejects(pending);
});
