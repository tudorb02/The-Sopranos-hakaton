// #/ofiter: open a dossier by id, load a demo dossier, see the recent ones and the portfolio.

import { useEffect, useState } from "react";

import { ErrorCard } from "../../components/live.jsx";
import { OfficerFrame, Panel, Tag } from "../../components/officer.jsx";
import { createDemoRun, getBedrockHealth, getRun } from "../../lib/api.js";
import { useAsync } from "../../lib/hooks.js";
import { DEMO_FARMS, STATE_RO } from "../../lib/labels.js";
import { currentRunId, recentRuns, rememberRun } from "../../lib/session.js";
import { PortfolioPanel } from "./panels/Portfolio.jsx";

const MODULE_NAMES = { irigatii: "Irigații", energie: "Energie la fermă", utilaje: "Utilaje și precizie", zootehnie: "Zootehnie și biogaz", post_recolta: "Post-recoltă", ecologic: "Ecologic" };

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
      <td>{info?.name ?? (info?.gone ? "Dosar indisponibil (backend repornit?)" : "…")}</td>
      <td>{info?.moduleId ? MODULE_NAMES[info.moduleId] : ""}</td>
      <td>{info?.state ? <Tag>{STATE_RO[info.state]}</Tag> : null}</td>
      <td>
        {info?.gone ? null : (
          <a className="btn btn--outline btn--small" href={`#/ofiter/dosar/${runId}`} onClick={() => rememberRun(runId)}>
            Deschide
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
    <OfficerFrame page="home" title="Dosarele de credit verde" subtitle="Deschide un dosar după id, sau încarcă dosarul demo al unei categorii.">
      <div className="panels">
        <Panel n={1} title="Deschide un dosar">
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (valid) open(id.trim());
            }}
          >
            <div className="field">
              <label htmlFor="run-id">Id-ul dosarului</label>
              <div className="input">
                <input id="run-id" placeholder="run_xxxxxxxxxxxx" value={id} onChange={(e) => setId(e.target.value)} />
              </div>
            </div>
            <button type="submit" className="btn btn--small" disabled={!valid}>
              Deschide
            </button>
          </form>

          <h3 className="sub-title">Sau încarcă un dosar demo</h3>
          <div className="inline-form">
            <div className="field">
              <label htmlFor="scenario">Categoria</label>
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
              {busy ? "Se încarcă…" : "Încarcă dosarul demo"}
            </button>
          </div>
          <ErrorCard error={error} />
          <p className="small muted">
            Dosarul pornește analiza celor 3 agenți. Ca ofițerul să poată aproba, IMM-ul trebuie să fi trimis cererea (zona IMM, pasul 9).
          </p>
        </Panel>

        <Panel n={2} title="Dosare recente (din această sesiune)">
          {recentRuns().length ? (
            <table className="table">
              <tbody>
                {recentRuns().map((runId) => (
                  <RecentRow key={runId} runId={runId} />
                ))}
              </tbody>
            </table>
          ) : (
            <p className="small muted">Niciun dosar încă.</p>
          )}
          <p className="small muted">
            Agenți Bedrock:{" "}
            {health.data ? <Tag tone={health.data.status === "UP" ? "ok" : "warn"}>{health.data.status === "UP" ? "pornit" : "oprit, rulează din înregistrări"}</Tag> : "…"}{" "}
            {health.data ? `· mod ${health.data.mode}` : ""}
          </p>
          <ErrorCard error={health.error} onRetry={health.reload} />
        </Panel>

        <PortfolioPanel />
      </div>
    </OfficerFrame>
  );
}
