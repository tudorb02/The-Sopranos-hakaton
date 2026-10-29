// Panel 2: the agents' steps, live: every tool call with its input and result, the figures with formula and source,
// the agent's thoughts, and the LIVE / CACHE / GOLDEN badge of each agent with the degraded steps.

import { calcsFromEvents } from "../../../lib/calc.js";
import { AGENTS_OFFICER } from "../../../lib/labels.js";
import { CalcLine, Panel, SourceTag, Tag } from "../../../components/officer.jsx";

const json = (value) => JSON.stringify(value, null, 1);

function ToolStep({ call, result }) {
  const failed = result?.data.status === "ERROR";
  return (
    <details className={`step${failed ? " is-bad" : ""}`}>
      <summary>
        <span className="step-tool">{call.data.tool}</span>
        <span className="step-msg">{result?.message ?? call.message}</span>
        {result ? <span className="small muted num">{result.data.durationMs} ms</span> : <Tag>in progress</Tag>}
        {failed ? <Tag tone="bad">error</Tag> : null}
      </summary>
      <div className="step-body">
        <p className="small muted">Input</p>
        <pre className="code">{json(call.data.input)}</pre>
        {result?.data.calcs?.length ? (
          <>
            <p className="small muted">Figures calculated by the engine</p>
            {result.data.calcs.map((c) => (
              <CalcLine key={c.calcId} calc={c} />
            ))}
          </>
        ) : null}
        {result && Object.keys(result.data.result ?? {}).length ? (
          <>
            <p className="small muted">Result</p>
            <pre className="code">{json(result.data.result)}</pre>
          </>
        ) : null}
        {result?.data.errors?.length ? (
          <ul className="plain-list small">
            {result.data.errors.map((e) => (
              <li key={e.path + e.messageRo}>
                {e.path}: {e.messageRo}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </details>
  );
}

export function StepsPanel({ run, events, status }) {
  const results = new Map(events.filter((e) => e.type === "agent.tool_result").map((e) => [e.data.toolUseId, e]));
  const live = status.state === "open" || status.state === "connecting" || status.state === "reconnecting";
  const eventCalcs = Object.keys(calcsFromEvents(events)).length;
  return (
    <Panel
      n={2}
      title="Agent steps"
      wide
      aside={
        <span className="panel-aside">
          <Tag tone={live ? "warn" : "ok"}>{live ? `● live (${status.state})` : "finished"}</Tag>
          <span className="small muted">
            {events.length} events · {eventCalcs} figures
          </span>
        </span>
      }
    >
      {status.state === "error" ? <p className="small field-error">The live stream could not be read: {status.error?.message}</p> : null}
      <div className="agents">
        {Object.entries(AGENTS_OFFICER).map(([agent, name]) => {
          const mine = events.filter((e) => e.agent === agent);
          const st = run.agentStatus.find((a) => a.agent === agent);
          const items = [];
          for (const e of mine) {
            if (e.type === "agent.tool_call") items.push({ key: e.seq, node: <ToolStep call={e} result={results.get(e.data.toolUseId)} /> });
            else if (e.type === "agent.thought") items.push({ key: e.seq, node: <p className="thought">{e.data.text}</p> });
            else if (e.type === "agent.degraded")
              items.push({
                key: e.seq,
                node: (
                  <p className="degraded">
                    <Tag tone="warn">degraded · {e.data.level}</Tag> {e.data.detailRo ?? e.message}
                  </p>
                ),
              });
          }
          return (
            <section key={agent} className="agent-block">
              <div className="agent-head">
                <h3 className="sub-title">{name}</h3>
                <span className="panel-aside">
                  {st?.status ? <Tag tone={st.status === "FAILED" ? "bad" : st.status === "DEGRADED" ? "warn" : st.status === "COMPLETED" ? "ok" : "info"}>{st.status}</Tag> : null}
                  <SourceTag mode={st?.source} />
                </span>
              </div>
              {items.length ? items.map((i) => <div key={i.key}>{i.node}</div>) : <p className="small muted">No steps yet.</p>}
            </section>
          );
        })}
      </div>
      {run.error ? (
        <p className="small field-error">
          The dossier failed at {run.error.failedStep}: {run.error.message}
        </p>
      ) : null}
    </Panel>
  );
}
