// Panel 5: the green report: decision and tier, criterion and threshold, DNSH, the proposed fund with its requirements
// ticked and the alternatives, the green-bond category, the conditions before drawdown, the risks and the KPIs.

import { Panel, Tag } from "../../../components/officer.jsx";
import { calcOf, disp } from "../../../lib/calc.js";
import {
  BOND_CATEGORY_RO,
  CONDITION_TIMING_RO,
  DECISION_RO,
  DNSH_OBJECTIVE_RO,
  DNSH_STATUS_RO,
  FUND_NAMES,
  FUND_ROLE_RO,
  FUND_STATUS_RO,
  KPI_FIRST_DUE_RO,
  KPI_FREQUENCY_RO,
  KPI_SOURCE_RO,
  LABEL_RO,
  REQUIREMENT_RO,
  REQUIREMENT_STATUS_RO,
  SEVERITY_RO,
  TIER_OFFICER,
} from "../../../lib/labels.js";

const GLYPH = { MET: "✓", TO_CONFIRM: "?", NOT_MET: "✗" };
const reqTone = (s) => (s === "MET" ? "ok" : s === "TO_CONFIRM" ? "warn" : "bad");

export function ReportPanel({ run }) {
  const report = run.agents.underwritingReport;
  const funding = run.agents.fundingRecommendation;
  if (!report || !funding) {
    return (
      <Panel n={5} title="Green report">
        <p className="small muted">Agent 3 has not finished yet.</p>
      </Panel>
    );
  }
  const crit = report.criterion;
  return (
    <Panel
      n={5}
      title="Green report"
      wide
      aside={
        <span className="panel-aside">
          <Tag tone={report.decision === "NOT_ELIGIBLE" ? "bad" : report.decision === "ELIGIBLE_GREEN" ? "ok" : "warn"}>{DECISION_RO[report.decision]}</Tag>
          <Tag tone="ok">{TIER_OFFICER[funding.greenTier.tier]}</Tag>
        </span>
      }
    >
      <p className="small">{report.committeeSummaryRo}</p>

      <div className="grid-2">
        <div>
          <h3 className="sub-title">Criterion and threshold</h3>
          <p className="small">
            {crit.indicator}: <b className="num">{disp(run, crit.valueCalcId)}</b> against the threshold <b className="num">{disp(run, crit.thresholdCalcId)}</b>{" "}
            <Tag tone={crit.result === "PASS" ? "ok" : "bad"}>{crit.result === "PASS" ? "passes" : "fails"}</Tag>
          </p>
          <p className="small muted">{crit.sourceRo}</p>
          <p className="small muted">
            Green tier: {TIER_OFFICER[funding.greenTier.tier]}
            {funding.greenTier.verdePlusMinCalcId ? ` (Green Plus from ${disp(run, funding.greenTier.verdePlusMinCalcId)})` : ""} · requested indicator{" "}
            {disp(run, funding.greenTier.requestedIndicatorCalcId)}, financed {disp(run, funding.greenTier.financedIndicatorCalcId)}
          </p>

          <h3 className="sub-title">DNSH</h3>
          <table className="table table--tight">
            <tbody>
              {report.dnsh.map((d) => (
                <tr key={d.objective}>
                  <td>{DNSH_OBJECTIVE_RO[d.objective]}</td>
                  <td>
                    <Tag tone={d.status === "PASS" ? "ok" : d.status === "FAIL" ? "bad" : "warn"}>{DNSH_STATUS_RO[d.status]}</Tag>
                  </td>
                  <td className="small">{d.justificationRo}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="small muted">Substantial contribution: {DNSH_OBJECTIVE_RO[report.substantialContribution] ?? report.substantialContribution}</p>

          <h3 className="sub-title">Component labelling</h3>
          <table className="table table--tight">
            <tbody>
              {report.componentLabels.map((c) => (
                <tr key={c.componentId}>
                  <td>{c.componentId.replace(/^cmp_/, "")}</td>
                  <td>
                    <Tag tone={c.label === "NONE" ? "info" : "ok"}>{LABEL_RO[c.label]}</Tag>
                  </td>
                  <td className="num">{disp(run, c.amountCalcId)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="small muted">
            Green share: {disp(run, report.greenShare.greenSharePctCalcId)} ({disp(run, report.greenShare.greenAmountCalcId)} green, {disp(run, report.greenShare.transitionAmountCalcId)} transition)
          </p>
        </div>

        <div>
          <h3 className="sub-title">Proposed fund</h3>
          <p>
            <Tag tone="ok">{report.fund.fundId}</Tag> <b>{FUND_NAMES[report.fund.fundId] ?? report.fund.fundId}</b> <span className="muted small">({FUND_ROLE_RO[report.fund.role]})</span>
          </p>
          <ul className="reqs">
            {report.fund.requirements.map((r) => (
              <li key={r.requirementId}>
                <span className={`req-glyph is-${reqTone(r.status)}`} aria-label={REQUIREMENT_STATUS_RO[r.status]}>
                  {GLYPH[r.status]}
                </span>
                <span>
                  <b>{REQUIREMENT_RO[r.requirementId]}</b> <span className="muted small">({r.level === "REQUIRED" ? "required" : "likely"})</span>
                  <br />
                  <span className="small">{r.noteRo}</span>
                </span>
              </li>
            ))}
          </ul>
          {report.fund.alternatives?.length ? (
            <>
              <h3 className="sub-title">Alternatives</h3>
              <ul className="plain-list small">
                {report.fund.alternatives.map((a) => (
                  <li key={a.fundId}>
                    <b>{a.fundId}</b> {FUND_NAMES[a.fundId]} · <Tag tone={a.status === "AVAILABLE" ? "ok" : a.status === "TO_CONFIRM" ? "warn" : "info"}>{FUND_STATUS_RO[a.status]}</Tag> <span className="muted">{a.noteRo}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <h3 className="sub-title">Green bond category (F2)</h3>
          <p className="small">
            <b>{BOND_CATEGORY_RO[report.greenBond.category]}</b> · <Tag tone={report.greenBond.status === "ELIGIBLE" ? "ok" : "warn"}>{report.greenBond.status === "TO_CONFIRM" ? "to be confirmed" : report.greenBond.status}</Tag>
          </p>
          <p className="small muted">{report.greenBond.noteRo}</p>
        </div>
      </div>

      <div className="grid-2">
        <div>
          <h3 className="sub-title">Conditions precedent to drawdown</h3>
          <ul className="plain-list small">
            {report.conditionsPrecedent.map((c) => (
              <li key={c.conditionId}>
                <Tag tone={c.blocking ? "warn" : "info"}>{c.blocking ? "blocking" : "informative"}</Tag> {c.descriptionRo} <span className="muted">({CONDITION_TIMING_RO[c.timing]})</span>
              </li>
            ))}
          </ul>
          <h3 className="sub-title">Risks</h3>
          <ul className="plain-list small">
            {report.risks.map((r) => (
              <li key={r.category}>
                <Tag tone={r.severity === "HIGH" ? "bad" : r.severity === "MEDIUM" ? "warn" : "info"}>{SEVERITY_RO[r.severity]}</Tag> {r.descriptionRo}
                <br />
                <span className="muted">Mitigation: {r.mitigationRo}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="sub-title">Monitoring KPIs</h3>
          <table className="table table--tight">
            <tbody>
              {report.monitoringKpis.map((k) => (
                <tr key={k.kpiId}>
                  <td>{calcOf(run, k.targetCalcId)?.labelRo ?? k.metric}</td>
                  <td className="num">target {disp(run, k.targetCalcId)}</td>
                  <td>
                    {KPI_FREQUENCY_RO[k.frequency]}, {KPI_FIRST_DUE_RO[k.firstDue]}
                  </td>
                  <td>{KPI_SOURCE_RO[k.dataSource]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3 className="sub-title">Estimated impact</h3>
          <table className="table table--tight">
            <tbody>
              {report.impact.map((i) => (
                <tr key={`${i.metric}-${i.calcId}`}>
                  <td>{calcOf(run, i.calcId)?.labelRo ?? i.metric}</td>
                  <td className="num">{disp(run, i.calcId)}</td>
                  <td className="muted small">{i.period === "ANNUAL" ? "per year" : "over the credit term"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Panel>
  );
}
