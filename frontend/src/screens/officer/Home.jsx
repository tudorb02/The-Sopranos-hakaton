// #/ofiter: open a dossier by id, load a demo dossier, see the recent ones and the portfolio.

import { useEffect, useState } from "react";

import { ErrorCard } from "../../components/live.jsx";
import { OfficerFrame, Panel, Tag } from "../../components/officer.jsx";
import { createDemoRun, getBedrockHealth, getRun } from "../../lib/api.js";
import { useAsync } from "../../lib/hooks.js";
import { DEMO_FARMS, STATE_RO } from "../../lib/labels.js";
import { currentRunId, recentRuns, rememberRun } from "../../lib/session.js";
import { PortfolioPanel } from "./panels/Portfolio.jsx";

const MODULE_NAMES = { irigatii: "Irrigation", energie: "Farm energy", utilaje: "Machinery and precision", zootehnie: "Livestock and biogas", post_recolta: "Post-harvest", ecologic: "Organic" };

function RecentRow({ runId }) {
  const [info, setInfo] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    getRun(runId, "sme", { signal: controller.signal })
      .then((run) => setInfo({ name: run.farm.company.name, moduleId: run.moduleId, state: run.state }))
      .catch((error) => error?.name !== "AbortError" && setInfo({ gone: true }));
    return () => controller.abort();
  }, [runId]);
  return (
    <tr>
      <td className="num">{runId}</td>
      <td>{info?.name ?? (info?.gone ? "Dossier unavailable (backend restarted?)" : "…")}</td>
      <td>{info?.moduleId ? MODULE_NAMES[info.moduleId] : ""}</td>
      <td>{info?.state ? <Tag>{STATE_RO[info.state]}</Tag> : null}</td>
      <td>
        {info?.gone ? null : (
          <a className="btn btn--outline btn--small" href={`#/ofiter/dosar/${runId}`} onClick={() => rememberRun(runId)}>
            Open
          </a>
        )}
      </td>
    </tr>
  );
}

export function OfficerHome() {
  const [id, setId] = useState(currentRunId() ?? "");
  const [scenario, setScenario] = useState("irigatii");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const health = useAsync((signal) => getBedrockHealth({ signal }), "health");

  const open = (runId) => {
    rememberRun(runId);
    window.location.hash = `/ofiter/dosar/${runId}`;
  };

  const loadDemo = async () => {
    setBusy(true);
    setError(null);
    try {
      open((await createDemoRun(scenario)).runId);
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  };

  const valid = /^run_[0-9a-z]{12}$/.test(id.trim());

  return (
    <OfficerFrame page="home" title="Green credit dossiers" subtitle="Open a dossier by id, or load the demo dossier of a category.">
      <div className="panels">
        <Panel n={1} title="Open a dossier">
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (valid) open(id.trim());
            }}
          >
            <div className="field">
              <label htmlFor="run-id">Dossier id</label>
              <div className="input">
                <input id="run-id" placeholder="run_xxxxxxxxxxxx" value={id} onChange={(e) => setId(e.target.value)} />
              </div>
            </div>
            <button type="submit" className="btn btn--small" disabled={!valid}>
              Open
            </button>
          </form>

          <h3 className="sub-title">Or load a demo dossier</h3>
          <div className="inline-form">
            <div className="field">
              <label htmlFor="scenario">Category</label>
              <div className="input input--select">
                <select id="scenario" value={scenario} onChange={(e) => setScenario(e.target.value)}>
                  {DEMO_FARMS.map((f) => (
                    <option key={f.moduleId} value={f.moduleId}>
                      {MODULE_NAMES[f.moduleId]} · {f.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button type="button" className="btn btn--small" onClick={loadDemo} disabled={busy}>
              {busy ? "Loading…" : "Load the demo dossier"}
            </button>
          </div>
          <ErrorCard error={error} />
          <p className="small muted">
            The dossier starts the analysis by the 3 agents. For the officer to approve, the SME must have sent the application (SME zone, step 7).
          </p>
        </Panel>

        <Panel n={2} title="Recent dossiers (from this session)">
          {recentRuns().length ? (
            <table className="table">
              <tbody>
                {recentRuns().map((runId) => (
                  <RecentRow key={runId} runId={runId} />
                ))}
              </tbody>
            </table>
          ) : (
            <p className="small muted">No dossiers yet.</p>
          )}
          <p className="small muted">
            Bedrock agents:{" "}
            {health.data ? <Tag tone={health.data.status === "UP" ? "ok" : "warn"}>{health.data.status === "UP" ? "on" : "off, running from recordings"}</Tag> : "…"}{" "}
            {health.data ? `· mode ${health.data.mode}` : ""}
          </p>
          <ErrorCard error={health.error} onRetry={health.reload} />
        </Panel>

        <PortfolioPanel />
      </div>
    </OfficerFrame>
  );
}
