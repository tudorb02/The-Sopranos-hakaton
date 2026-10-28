// Panel 6: the officer's actions: Aprobă (only from TRIMIS), Cere documente, the PDF report and "Simulează 12 luni".

import { useState } from "react";

import { ErrorCard } from "../../../components/live.jsx";
import { Panel, Tag } from "../../../components/officer.jsx";
import { approveRun, reportUrl, requestDocuments, simulateMonitoring } from "../../../lib/api.js";
import { calcOf, disp } from "../../../lib/calc.js";
import { DOC_TYPE_RO, STATE_RO } from "../../../lib/labels.js";

const OFFICER_ID = "ofiter.demo";
const EMPTY_DOC = { docType: "OFFER", labelRo: "", conditionId: "", dueDate: "" };

function MonitoringResult({ run }) {
  const m = run.monitoring;
  if (!m) return null;
  return (
    <div className="monitoring">
      <h3 className="sub-title">Rezultatul după 12 luni {m.simulated ? <Tag tone="warn">simulat</Tag> : null}</h3>
      <table className="table table--tight">
        <thead>
          <tr>
            <th>Metrică</th>
            <th>Estimat</th>
            <th>Real</th>
            <th>Abatere</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {m.metrics.map((x) => (
            <tr key={x.metric}>
              <td>{calcOf(run, x.estimatedCalcId)?.labelRo ?? x.metric}</td>
              <td className="num">{disp(run, x.estimatedCalcId)}</td>
              <td className="num">{disp(run, x.actualCalcId)}</td>
              <td className="num">{disp(run, x.deviationPctCalcId)}</td>
              <td>
                <Tag tone={x.withinTolerance ? "ok" : "bad"}>{x.withinTolerance ? "în toleranță" : "în afara toleranței"}</Tag>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="small">
        Estimare confirmată: <Tag tone={m.confirmed ? "ok" : "bad"}>{m.confirmed ? "da" : "nu"}</Tag> · bonus de impact aplicat:{" "}
        <Tag tone={m.impactBonusApplied ? "ok" : "info"}>{m.impactBonusApplied ? "da" : "nu"}</Tag>
      </p>
      <p className="small">
        Dobânda: <b className="num">{disp(run, m.rateBeforeCalcId)}</b> → <b className="num">{disp(run, m.rateAfterCalcId)}</b> (bonus {disp(run, m.bonusPpCalcId)}). Bonusul de impact e o propunere de produs, nu un produs Raiffeisen existent.
      </p>
    </div>
  );
}

export function ActionsPanel({ run, onRun, onChanged }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [comment, setComment] = useState("");
  const [officerId, setOfficerId] = useState(OFFICER_ID);
  const [docs, setDocs] = useState([{ ...EMPTY_DOC }]);
  const [message, setMessage] = useState("");
  const [skipped, setSkipped] = useState(new Set());

  const state = run.state;
  const report = run.agents.underwritingReport;
  const conditions = report?.conditionsPrecedent ?? [];
  const canDecide = state === "TRIMIS";
  const approved = state === "APROBAT" || state === "MONITORIZARE";
  const canSimulate = state === "MONITORIZARE" && !run.monitoring && run.submission?.variant === "VERDE";

  const act = async (name, fn) => {
    setBusy(name);
    setError(null);
    try {
      onRun(await fn());
      onChanged?.();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  };

  const approve = () => {
    const accepted = conditions.filter((c) => !skipped.has(c.conditionId)).map((c) => c.conditionId);
    return act("approve", () =>
      approveRun(run.runId, { officerId, commentRo: comment || undefined, acceptedConditionIds: skipped.size ? accepted : undefined }),
    );
  };

  const sendRequest = () => {
    const documents = docs
      .filter((d) => d.labelRo.trim())
      .map((d) => ({ docType: d.docType, labelRo: d.labelRo.trim(), ...(d.conditionId ? { conditionId: d.conditionId } : {}), ...(d.dueDate ? { dueDate: d.dueDate } : {}) }));
    return act("request", async () => {
      const result = await requestDocuments(run.runId, { officerId, messageRo: message || undefined, documents });
      setDocs([{ ...EMPTY_DOC }]);
      setMessage("");
      return result;
    });
  };

  const setDoc = (i, patch) => setDocs((list) => list.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  return (
    <Panel n={6} title="Acțiuni" wide aside={<Tag tone={approved ? "ok" : state === "TRIMIS" ? "warn" : "info"}>{STATE_RO[state] ?? state}</Tag>}>
      {!canDecide && !approved ? (
        <p className="small field-error">
          Dosarul e în starea „{STATE_RO[state] ?? state}”. Ofițerul poate aproba doar după ce IMM-ul a trimis cererea (zona IMM, pasul 9, starea „Trimis la bancă”).
        </p>
      ) : null}
      <ErrorCard error={error} />

      <div className="grid-2">
        <div>
          <h3 className="sub-title">Decizia</h3>
          <div className="field">
            <label htmlFor="officer-id">Ofițer</label>
            <div className="input">
              <input id="officer-id" value={officerId} onChange={(e) => setOfficerId(e.target.value)} maxLength={60} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="approve-comment">Comentariu pentru dosar</label>
            <div className="input input--area">
              <textarea id="approve-comment" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} />
            </div>
          </div>
          {conditions.length && canDecide ? (
            <ul className="plain-list small">
              {conditions.map((c) => (
                <li key={c.conditionId}>
                  <label>
                    <input
                      type="checkbox"
                      className="check"
                      checked={!skipped.has(c.conditionId)}
                      onChange={(e) =>
                        setSkipped((s) => {
                          const next = new Set(s);
                          if (e.target.checked) next.delete(c.conditionId);
                          else next.add(c.conditionId);
                          return next;
                        })
                      }
                    />{" "}
                    păstrez condiția: {c.descriptionRo}
                  </label>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="btn-row">
            <button type="button" className="btn" disabled={!canDecide || busy !== null || !officerId.trim()} onClick={approve}>
              {busy === "approve" ? "Se aprobă…" : "Aprobă"}
            </button>
            {approved ? (
              <a className="btn btn--outline" href={reportUrl(run.runId)} target="_blank" rel="noreferrer">
                Descarcă raportul PDF
              </a>
            ) : (
              <button type="button" className="btn btn--outline" disabled title="Raportul PDF e disponibil după aprobare">
                Descarcă raportul PDF
              </button>
            )}
          </div>
          <div className="btn-row">
            <button type="button" className="btn btn--outline" disabled={!canSimulate || busy !== null} onClick={() => act("simulate", () => simulateMonitoring(run.runId))}>
              {busy === "simulate" ? "Se simulează…" : "Simulează 12 luni"}
            </button>
            {!canSimulate && !run.monitoring ? <span className="small muted">disponibil după aprobare, pentru un credit verde</span> : null}
          </div>
          <MonitoringResult run={run} />
        </div>

        <div>
          <h3 className="sub-title">Cere documente</h3>
          <div className="field">
            <label htmlFor="request-message">Mesaj pentru fermier</label>
            <div className="input input--area">
              <textarea id="request-message" rows={2} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} />
            </div>
          </div>
          {docs.map((d, i) => (
            <div key={i} className="doc-form">
              <div className="input input--select">
                <select aria-label="Tipul documentului" value={d.docType} onChange={(e) => setDoc(i, { docType: e.target.value })}>
                  {Object.entries(DOC_TYPE_RO).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="input">
                <input aria-label="Ce document ceri, pe înțelesul fermierului" placeholder="Ce document ceri" value={d.labelRo} maxLength={200} onChange={(e) => setDoc(i, { labelRo: e.target.value })} />
              </div>
              <div className="input input--select">
                <select aria-label="Condiția legată" value={d.conditionId} onChange={(e) => setDoc(i, { conditionId: e.target.value })}>
                  <option value="">fără condiție</option>
                  {conditions.map((c) => (
                    <option key={c.conditionId} value={c.conditionId}>
                      {c.conditionId}
                    </option>
                  ))}
                </select>
              </div>
              <div className="input">
                <input aria-label="Termen" type="date" value={d.dueDate} onChange={(e) => setDoc(i, { dueDate: e.target.value })} />
              </div>
              {docs.length > 1 ? (
                <button type="button" className="btn btn--text btn--small" onClick={() => setDocs((list) => list.filter((_, j) => j !== i))}>
                  Șterge
                </button>
              ) : null}
            </div>
          ))}
          <div className="btn-row">
            <button type="button" className="btn btn--text btn--small" disabled={docs.length >= 10} onClick={() => setDocs((list) => [...list, { ...EMPTY_DOC }])}>
              + Alt document
            </button>
            <button type="button" className="btn btn--outline" disabled={!canDecide || busy !== null || !docs.some((d) => d.labelRo.trim())} onClick={sendRequest}>
              {busy === "request" ? "Se trimite…" : "Cere documente"}
            </button>
          </div>

          {run.pendingDocuments.length ? (
            <>
              <h3 className="sub-title">Documente cerute, în așteptare</h3>
              <ul className="plain-list small">
                {run.pendingDocuments.map((p) => (
                  <li key={`${p.docType}-${p.requestedAt}`}>
                    {p.labelRo} <span className="muted">({DOC_TYPE_RO[p.docType]}{p.conditionId ? `, ${p.conditionId}` : ""}{p.dueDate ? `, până la ${p.dueDate}` : ""})</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {run.officerActions.length ? (
            <>
              <h3 className="sub-title">Istoric</h3>
              <ul className="plain-list small">
                {run.officerActions.map((a) => (
                  <li key={a.at + a.action}>
                    {a.action === "APPROVE" ? "Aprobat" : "Documente cerute"} de {a.officerId}
                    {a.commentRo ? `: ${a.commentRo}` : ""}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}
