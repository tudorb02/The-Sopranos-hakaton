// Panel 3: the technical analysis: the green indicator of the requested investment against the green configuration,
// and the impact per year.

import { CalcLine, Panel, Tag } from "../../../components/officer.jsx";
import { calcOf, disp } from "../../../lib/calc.js";
import { DNSH_OBJECTIVE_RO, DNSH_STATUS_RO, RECOMMENDATION_TYPE_RO } from "../../../lib/labels.js";

export function TechnicalPanel({ run }) {
  const tech = run.agents.technicalAssessment;
  if (!tech) {
    return (
      <Panel n={3} title="Technical analysis">
        <p className="small muted">Agent 1 has not finished yet.</p>
      </Panel>
    );
  }
  const initial = tech.configurations.find((c) => c.configId === tech.initialConfigId);
  const recommended = tech.configurations.find((c) => c.configId === tech.recommendedConfigId);
  const same = initial?.configId === recommended?.configId;
  const metrics = [...new Set([...initial.impacts, ...recommended.impacts].map((i) => i.metric))];
  const of = (config, metric) => config.impacts.find((i) => i.metric === metric)?.calcId;

  return (
    <Panel n={3} title="Technical analysis" wide aside={<Tag>{RECOMMENDATION_TYPE_RO[tech.recommendationType]}</Tag>}>
      <p className="small">{tech.summaryRo}</p>
      <div className="grid-2">
        <div>
          <h3 className="sub-title">Green indicator ({tech.indicator})</h3>
          <table className="table">
            <thead>
              <tr>
                <th />
                <th>Requested investment</th>
                <th>{same ? "—" : "Green configuration"}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Components</td>
                <td>
                  {initial.components.map((c) => (
                    <div key={c.componentId}>{c.nameRo}</div>
                  ))}
                </td>
                <td>
                  {same
                    ? "the same"
                    : recommended.components.map((c) => (
                        <div key={c.componentId}>
                          {c.nameRo} {c.source === "CATALOG_UPGRADE" ? <Tag tone="ok">upgrade</Tag> : null}
                        </div>
                      ))}
                </td>
              </tr>
              <tr>
                <td>Total cost</td>
                <td className="num">{disp(run, initial.totalCostCalcId)}</td>
                <td className="num">{same ? "—" : disp(run, recommended.totalCostCalcId)}</td>
              </tr>
              {!same ? (
                <tr>
                  <td>Upgrade cost</td>
                  <td>—</td>
                  <td className="num">{disp(run, recommended.upgradeCostCalcId)}</td>
                </tr>
              ) : null}
              <tr>
                <td>Indicator</td>
                <td className="num">
                  <b>{disp(run, initial.indicatorCalcId)}</b>
                </td>
                <td className="num">
                  <b>{same ? "—" : disp(run, recommended.indicatorCalcId)}</b>
                </td>
              </tr>
              <tr>
                <td>Threshold</td>
                <td colSpan={2} className="num">
                  {disp(run, tech.threshold.thresholdCalcId)}
                </td>
              </tr>
              <tr>
                <td>Result</td>
                <td>
                  <Tag tone={initial.thresholdResult === "PASS" ? "ok" : "bad"}>{initial.thresholdResult === "PASS" ? "passes" : "fails"}</Tag>
                </td>
                <td>{same ? "—" : <Tag tone={recommended.thresholdResult === "PASS" ? "ok" : "bad"}>{recommended.thresholdResult === "PASS" ? "passes" : "fails"}</Tag>}</td>
              </tr>
            </tbody>
          </table>
          <CalcLine calc={calcOf(run, tech.threshold.thresholdCalcId)} />
          <p className="small muted">{tech.threshold.sourceRo}</p>
        </div>
        <div>
          <h3 className="sub-title">Impact per year</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Requested</th>
                <th>{same ? "" : "Green"}</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((metric) => {
                const label = calcOf(run, of(recommended, metric) ?? of(initial, metric))?.labelRo ?? metric;
                return (
                  <tr key={metric}>
                    <td>{label}</td>
                    <td className="num">{of(initial, metric) ? disp(run, of(initial, metric)) : "—"}</td>
                    <td className="num">{same ? "" : of(recommended, metric) ? disp(run, of(recommended, metric)) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <h3 className="sub-title">Current situation</h3>
          {tech.baseline.metrics.map((m) => (
            <CalcLine key={m.calcId} calc={calcOf(run, m.calcId)} />
          ))}
          <h3 className="sub-title">DNSH checks (from the documents)</h3>
          <ul className="plain-list small">
            {tech.dnshChecks.map((d) => (
              <li key={d.objective}>
                <Tag tone={d.status === "PASS" ? "ok" : d.status === "FAIL" ? "bad" : "warn"}>{DNSH_STATUS_RO[d.status]}</Tag> {DNSH_OBJECTIVE_RO[d.objective]}: {d.noteRo}
              </li>
            ))}
          </ul>
          {tech.missingFields.length ? <p className="small field-error">Missing data: {tech.missingFields.join(", ")}</p> : null}
        </div>
      </div>
      {run.agents.extractions.length ? (
        <>
          <h3 className="sub-title">Documents read</h3>
          <ul className="plain-list small">
            {run.agents.extractions.map((x) => (
              <li key={x.documentId}>
                {x.documentType} · {x.supplierName ?? "—"} · {x.documentFields.length} fields
                {x.warnings?.length ? <span className="muted"> · {x.warnings.join("; ")}</span> : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </Panel>
  );
}
