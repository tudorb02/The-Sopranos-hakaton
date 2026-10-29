// Panel 6: the officer's actions: Approve (only from TRIMIS), Request documents, the PDF report and "Simulate 12 months".

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
      <h3 className="sub-title">The result after 12 months {m.simulated ? <Tag tone="warn">simulated</Tag> : null}</h3>
      <table className="table table--tight">
        <thead>
          <tr>
            <th>Metric</th>
            <th>Estimated</th>
            <th>Actual</th>
            <th>Deviation</th>
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
                <Tag tone={x.withinTolerance ? "ok" : "bad"}>{x.withinTolerance ? "within tolerance" : "outside tolerance"}</Tag>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="small">
        Estimate confirmed: <Tag tone={m.confirmed ? "ok" : "bad"}>{m.confirmed ? "yes" : "no"}</Tag> · impact bonus applied:{" "}
        <Tag tone={m.impactBonusApplied ? "ok" : "info"}>{m.impactBonusApplied ? "yes" : "no"}</Tag>
      </p>
      <p className="small">
        Interest rate: <b className="num">{disp(run, m.rateBeforeCalcId)}</b> → <b className="num">{disp(run, m.rateAfterCalcId)}</b> (bonus {disp(run, m.bonusPpCalcId)}). The impact bonus is a product proposal, not an existing Raiffeisen product.
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
    <Panel n={6} title="Actions" wide aside={<Tag tone={approved ? "ok" : state === "TRIMIS" ? "warn" : "info"}>{STATE_RO[state] ?? state}</Tag>}>
      {!canDecide && !approved ? (
        <p className="small field-error">
          The dossier is in the state “{STATE_RO[state] ?? state}”. The officer can approve only after the SME has sent the application (SME zone, step 7, state “Sent to the bank”).
        </p>
      ) : null}
      <ErrorCard error={error} />

      <div className="grid-2">
        <div>
          <h3 className="sub-title">Decision</h3>
          <div className="field">
            <label htmlFor="officer-id">Officer</label>
            <div className="input">
              <input id="officer-id" value={officerId} onChange={(e) => setOfficerId(e.target.value)} maxLength={60} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="approve-comment">Comment for the dossier</label>
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
                    keep the condition: {c.descriptionRo}
                  </label>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="btn-row">
            <button type="button" className="btn" disabled={!canDecide || busy !== null || !officerId.trim()} onClick={approve}>
              {busy === "approve" ? "Approving…" : "Approve"}
            </button>
            {approved ? (
              <a className="btn btn--outline" href={reportUrl(run.runId)} target="_blank" rel="noreferrer">
                Download the PDF report
              </a>
            ) : (
              <button type="button" className="btn btn--outline" disabled title="The PDF report is available after approval">
                Download the PDF report
              </button>
            )}
          </div>
          <div className="btn-row">
            <button type="button" className="btn btn--outline" disabled={!canSimulate || busy !== null} onClick={() => act("simulate", () => simulateMonitoring(run.runId))}>
              {busy === "simulate" ? "Simulating…" : "Simulate 12 months"}
            </button>
            {!canSimulate && !run.monitoring ? <span className="small muted">available after approval, for a green credit</span> : null}
          </div>
          <MonitoringResult run={run} />
        </div>

        <div>
          <h3 className="sub-title">Request documents</h3>
          <div className="field">
            <label htmlFor="request-message">Message for the farmer</label>
            <div className="input input--area">
              <textarea id="request-message" rows={2} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} />
            </div>
          </div>
          {docs.map((d, i) => (
            <div key={i} className="doc-form">
              <div className="input input--select">
                <select aria-label="Document type" value={d.docType} onChange={(e) => setDoc(i, { docType: e.target.value })}>
                  {Object.entries(DOC_TYPE_RO).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="input">
                <input aria-label="Which document you request, in plain words for the farmer" placeholder="Which document you request" value={d.labelRo} maxLength={200} onChange={(e) => setDoc(i, { labelRo: e.target.value })} />
              </div>
              <div className="input input--select">
                <select aria-label="Linked condition" value={d.conditionId} onChange={(e) => setDoc(i, { conditionId: e.target.value })}>
                  <option value="">no condition</option>
                  {conditions.map((c) => (
                    <option key={c.conditionId} value={c.conditionId}>
                      {c.conditionId}
                    </option>
                  ))}
                </select>
              </div>
              <div className="input">
                <input aria-label="Due date" type="date" value={d.dueDate} onChange={(e) => setDoc(i, { dueDate: e.target.value })} />
              </div>
              {docs.length > 1 ? (
                <button type="button" className="btn btn--text btn--small" onClick={() => setDocs((list) => list.filter((_, j) => j !== i))}>
                  Remove
                </button>
              ) : null}
            </div>
          ))}
          <div className="btn-row">
            <button type="button" className="btn btn--text btn--small" disabled={docs.length >= 10} onClick={() => setDocs((list) => [...list, { ...EMPTY_DOC }])}>
              + Another document
            </button>
            <button type="button" className="btn btn--outline" disabled={!canDecide || busy !== null || !docs.some((d) => d.labelRo.trim())} onClick={sendRequest}>
              {busy === "request" ? "Sending…" : "Request documents"}
            </button>
          </div>

          {run.pendingDocuments.length ? (
            <>
              <h3 className="sub-title">Requested documents, pending</h3>
              <ul className="plain-list small">
                {run.pendingDocuments.map((p) => (
                  <li key={`${p.docType}-${p.requestedAt}`}>
                    {p.labelRo} <span className="muted">({DOC_TYPE_RO[p.docType]}{p.conditionId ? `, ${p.conditionId}` : ""}{p.dueDate ? `, by ${p.dueDate}` : ""})</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {run.officerActions.length ? (
            <>
              <h3 className="sub-title">History</h3>
              <ul className="plain-list small">
                {run.officerActions.map((a) => (
                  <li key={a.at + a.action}>
                    {a.action === "APPROVE" ? "Approved" : "Documents requested"} by {a.officerId}
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
