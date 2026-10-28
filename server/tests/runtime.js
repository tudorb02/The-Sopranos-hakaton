export const offline = process.env.BUSOLA_OFFLINE_TESTS === "1";
const runner = offline ? await import("node:test") : await import("vitest");
export const { describe, test, beforeEach, afterEach } = runner;
export const request = offline ? (await import("./in-process-http.js")).inProcessRequest : (await import("supertest")).default;
