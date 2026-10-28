// The live analysis as the SME reads it: short plain lines instead of the raw events. Fund names, pricing and the
// debt-service ratio never reach this zone (README §13), even if an event message mentions them.

import { NEUTRAL_TOOL_LINE, SME_HIDDEN, TOOL_LINES_SME } from "./labels.js";

const clean = (text) => text.replace(/^[^\p{L}\p{N}]+/u, "").trim();

// One line per tool call / thought / degraded step / failure. -> [{ key, agent, text, tone }]
export function farmerFeed(events) {
  const lines = [];
  for (const e of events) {
    let text = null;
    let tone;
    if (e.type === "agent.tool_call") {
      const tool = e.data.tool;
      text = tool in TOOL_LINES_SME ? (TOOL_LINES_SME[tool] ?? clean(e.message)) : NEUTRAL_TOOL_LINE;
    } else if (e.type === "agent.thought") {
      text = clean(e.data.text ?? e.message);
    } else if (e.type === "agent.degraded") {
      text = clean(e.message);
      tone = "warn";
    } else if (e.type === "run.failed") {
      text = e.data.messageRo ?? clean(e.message);
      tone = "warn";
    }
    if (!text) continue;
    if (SME_HIDDEN.test(text)) text = e.type === "agent.degraded" ? "Folosesc o analiză salvată, ca să nu te las să aștepți." : NEUTRAL_TOOL_LINE;
    const previous = lines.at(-1);
    if (previous && previous.text === text && previous.agent === e.agent) continue; // the same step twice in a row
    lines.push({ key: e.seq, agent: e.agent, text, tone });
  }
  return lines;
}

// The state of each agent for the three-row list: PENDING until it starts.
export function agentRows(events, agents) {
  const states = {};
  for (const e of events) {
    if (!e.agent) continue;
    if (e.type === "agent.started") states[e.agent] = { status: "RUNNING" };
    else if (e.type === "agent.degraded") states[e.agent] = { ...states[e.agent], status: "DEGRADED", note: e.message };
    else if (e.type === "agent.completed") states[e.agent] = { status: states[e.agent]?.status === "DEGRADED" ? "DEGRADED" : "COMPLETED", note: states[e.agent]?.note };
  }
  const failed = events.find((e) => e.type === "run.failed");
  return agents.map((a) => {
    let st = states[a.id] ?? { status: "PENDING" };
    if (failed && st.status === "RUNNING") st = { status: "FAILED" };
    return { id: a.id, name: a.name, desc: a.note, ...st };
  });
}
