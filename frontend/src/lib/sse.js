// Live events of a dossier (GET /api/runs/{id}/events, contracts/events.md) over fetch streaming instead of EventSource,
// so it works the same in the browser and in Node, and so a reconnect can ask for ?after=<last seq> explicitly.
// The server closes the stream after run.completed / run.failed; any other end is a dropped connection and is retried.

import { apiUrl, errorFromResponse } from "./api.js";

export const TERMINAL_EVENTS = ["run.completed", "run.failed"];

// Parses SSE text into messages: pushes complete { id, data } blocks, returns the unfinished rest.
export function parseSse(buffer, onMessage) {
  const blocks = buffer.split(/\r?\n\r?\n/);
  const rest = blocks.pop();
  for (const block of blocks) {
    let id = null;
    const data = [];
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith(":")) continue; // comment / ping
      if (line.startsWith("id:")) id = line.slice(3).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
    }
    if (data.length) onMessage({ id, data: data.join("\n") });
  }
  return rest;
}

/**
 * Subscribes to the events of a dossier.
 * onEvent(event) gets every RunEvent once, in order (events with seq <= the last one seen are dropped).
 * onStatus("connecting" | "open" | "reconnecting" | "done" | "error", info) reports the connection.
 * Returns { close(), done } where done resolves when the stream finished for good (terminal event, 404 or close()).
 */
export function subscribeRun(runId, { after = 0, onEvent, onStatus = () => {}, retryMs = 1500, maxRetries = 20, stopOnTerminal = true } = {}) {
  let last = after;
  let closed = false;
  let controller = null;

  const done = (async () => {
    let failures = 0;
    while (!closed) {
      controller = new AbortController();
      onStatus(failures ? "reconnecting" : "connecting");
      let terminal = false;
      try {
        const res = await fetch(apiUrl(`/api/runs/${runId}/events?after=${last}`), {
          headers: { Accept: "text/event-stream" },
          signal: controller.signal,
        });
        if (!res.ok) {
          const err = await errorFromResponse(res);
          if (res.status < 500) {
            onStatus("error", err);
            return;
          }
          throw err;
        }
        onStatus("open");
        failures = 0;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { value, done: finished } = await reader.read();
          if (finished) break;
          buffer = parseSse(buffer + decoder.decode(value, { stream: true }), (message) => {
            const event = JSON.parse(message.data);
            if (event.seq <= last) return;
            last = event.seq;
            onEvent(event);
            if (TERMINAL_EVENTS.includes(event.type)) terminal = true;
          });
        }
      } catch (e) {
        if (closed) return;
        failures += 1;
        if (failures > maxRetries) {
          onStatus("error", e);
          return;
        }
      }
      if (closed) return;
      if (terminal && stopOnTerminal) {
        onStatus("done");
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, retryMs));
    }
  })();

  return {
    done,
    close() {
      closed = true;
      controller?.abort();
    },
  };
}

// Reduces events to what a screen needs: the events list and, per agent, the last status.
export function agentStates(events) {
  const states = {};
  for (const e of events) {
    if (!e.agent) continue;
    if (e.type === "agent.started") states[e.agent] = { status: "RUNNING" };
    else if (e.type === "agent.degraded") states[e.agent] = { ...states[e.agent], status: "DEGRADED", level: e.data.level };
    else if (e.type === "agent.completed") states[e.agent] = { status: "COMPLETED", source: e.data.source };
  }
  return states;
}
