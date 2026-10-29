// Panel 4: the credit structuring: classic against green, the decomposition of the green interest, the repayment
// schedule, DSCR and the net advantage. The pricing parameters are demo ones (README §13).

import { CalcLine, Panel, Tag } from "../../../components/officer.jsx";
import { monthsText, RepaymentChart } from "../../../components/live.jsx";
import { calcOf, disp, loanOf, optionFor } from "../../../lib/calc.js";
import { AFFORDABILITY_RO, COLLATERAL_OFFICER, DRIVER_RO, RATE_COMPONENT_RO, SCHEDULE_TYPE_RO } from "../../../lib/labels.js";

export function CreditPanel({ run }) {
  const funding = run.agents.fundingRecommendation;
  if (!funding) {
    return (
      <Panel n={4} title="Credit structuring">
        <p className="small muted">Agent 2 has not finished yet.</p>
      </Panel>
    );
  }
  const classic = optionFor(funding, "CLASIC");
  const green = optionFor(funding, "VERDE") ?? funding.options.find((o) => o.kind !== "STANDARD");
  const cl = loanOf(classic);
  const gl = loanOf(green);
  const guarantee = green?.fundingStack.find((i) => i.type === "GUARANTEE");
  const cmp = funding.comparison;

  const cell = (option, loan, pick) => (option ? pick(option, loan) : "—");
  const rows = [
    ["Investment", (o) => disp(run, o.investmentCalcId)],
    ["Credit amount", (o, l) => disp(run, l.amountCalcId)],
    ["Interest rate", (o, l) => disp(run, l.rateCalcId)],
    ["Term", (o, l) => disp(run, l.termCalcId)],
    ["Repayment", (o, l) => SCHEDULE_TYPE_RO[l.repayment.scheduleType]],
    ["Instalment", (o, l) => `${disp(run, l.repayment.installmentCalcId)}${l.repayment.paymentMonths ? ` (${monthsText(l.repayment.paymentMonths)})` : ""}`],
    ["Grace period", (o, l) => (l.repayment.graceCalcId ? disp(run, l.repayment.graceCalcId) : "—")],
    ["Collateral", (o) => o.collateral.map((c) => COLLATERAL_OFFICER[c] ?? c).join(", ")],
    ["Total paid", (o) => disp(run, o.totals.totalPaymentsCalcId)],
    ["Interest paid", (o) => disp(run, o.totals.totalInterestCalcId)],
    ["Mortgage cost", (o) => (o.totals.collateralCostsCalcId ? disp(run, o.totals.collateralCostsCalcId) : "—")],
    ["Savings over the term", (o) => disp(run, o.totals.savingsOverHorizonCalcId)],
    ["Net cost", (o) => disp(run, o.totals.netCostCalcId)],
    ["DSCR", (o) => disp(run, o.affordability.dscrCalcId)],
    ["Affordability", (o) => `${AFFORDABILITY_RO[o.affordability.status]}: ${o.affordability.noteRo}`],
  ];

  const decomposition = (green?.rateBreakdown.components ?? []).map((g) => {
    const c = classic?.rateBreakdown.components.find((x) => x.component === g.component);
    const delta = cmp.rateDifference.find((x) => x.component === g.component);
    return { component: g.component, classic: c?.calcId, green: g.calcId, delta: delta?.deltaCalcId };
  });
  // components present only at the classic credit still belong to the table
  for (const c of classic?.rateBreakdown.components ?? []) {
    if (!decomposition.some((d) => d.component === c.component)) {
      decomposition.push({ component: c.component, classic: c.calcId, green: null, delta: cmp.rateDifference.find((x) => x.component === c.component)?.deltaCalcId });
    }
  }

  return (
    <Panel
      n={4}
      title="Credit structuring"
      wide
      aside={
        <span className="panel-aside">
          <Tag tone="warn">demo parameters</Tag>
        </span>
      }
    >
      <div className="advantage">
        <span className="small muted">Net advantage of the green credit</span>
        <b className="big num">{disp(run, cmp.netAdvantageCalcId)}</b>
        <span className="small muted">over {disp(run, cmp.horizonCalcId)}</span>
        <span className="drivers small">
          {cmp.drivers.map((d) => (
            <span key={d.driver}>
              {DRIVER_RO[d.driver]}: <b className="num">{disp(run, d.calcId)}</b>
            </span>
          ))}
        </span>
      </div>

      <div className="grid-2">
        <div>
          <h3 className="sub-title">Classic vs. green</h3>
          <table className="table">
            <thead>
              <tr>
                <th />
                <th>Classic (A)</th>
                <th>Green ({green?.optionId ?? "—"})</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, pick]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td className="num">{cell(classic, cl, pick)}</td>
                  <td className="num">{cell(green, gl, pick)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {guarantee ? (
            <p className="small">
              Guarantee: <b className="num">{disp(run, guarantee.amountCalcId)}</b>, coverage <b className="num">{disp(run, guarantee.coverageCalcId)}</b> ({guarantee.productId})
            </p>
          ) : null}
        </div>

        <div>
          <h3 className="sub-title">Why the green interest rate is lower</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Component</th>
                <th>Classic</th>
                <th>Green</th>
                <th>Difference</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Index (EURIBOR 3M)</td>
                <td className="num">{disp(run, classic?.rateBreakdown.indexCalcId)}</td>
                <td className="num">{disp(run, green?.rateBreakdown.indexCalcId)}</td>
                <td />
              </tr>
              {decomposition.map((d) => (
                <tr key={d.component} title={calcOf(run, d.green ?? d.classic)?.formula}>
                  <td>{RATE_COMPONENT_RO[d.component] ?? d.component}</td>
                  <td className="num">{d.classic ? disp(run, d.classic) : "—"}</td>
                  <td className="num">{d.green ? disp(run, d.green) : "—"}</td>
                  <td className="num">
                    <b>{d.delta ? disp(run, d.delta) : "—"}</b>
                  </td>
                </tr>
              ))}
              <tr>
                <td>Margin</td>
                <td className="num">{disp(run, classic?.rateBreakdown.marginCalcId)}</td>
                <td className="num">{disp(run, green?.rateBreakdown.marginCalcId)}</td>
                <td />
              </tr>
              <tr className="row-total">
                <td>
                  <b>Interest rate</b>
                </td>
                <td className="num">
                  <b>{disp(run, classic?.rateBreakdown.rateCalcId)}</b>
                </td>
                <td className="num">
                  <b>{disp(run, green?.rateBreakdown.rateCalcId)}</b>
                </td>
                <td className="num">
                  <b>{disp(run, cmp.rateDifferenceCalcId)}</b>
                </td>
              </tr>
            </tbody>
          </table>
          <CalcLine calc={calcOf(run, green?.rateBreakdown.rateCalcId)} />
          <CalcLine calc={calcOf(run, cmp.upgradePaybackCalcId)} />
        </div>
      </div>

      {gl && calcOf(run, gl.repayment.scheduleCalcId)?.series ? (
        <>
          <h3 className="sub-title">Repayment calendar, green credit (first 12 months)</h3>
          <RepaymentChart
            green={calcOf(run, gl.repayment.scheduleCalcId).series}
            classic={cl ? calcOf(run, cl.repayment.scheduleCalcId)?.series : null}
            ariaLabel="Repayment calendar: the green credit by month; the dotted line is the classic credit instalment"
          />
          <p className="small muted">
            Bars: the green credit instalment per month; dotted line: the equal instalment of the classic credit. Total paid: {disp(run, green.totals.totalPaymentsCalcId)}.
          </p>
        </>
      ) : null}

      <h3 className="sub-title">Programmes checked</h3>
      <table className="table table--tight">
        <tbody>
          {funding.programChecks.map((p) => (
            <tr key={p.programCode}>
              <td>
                <b>{p.programCode}</b>
              </td>
              <td>
                <Tag tone={p.result === "ELIGIBLE" ? "ok" : p.result === "NOT_ELIGIBLE" ? "bad" : "warn"}>{p.result}</Tag>
              </td>
              <td>session {p.session}</td>
              <td className="small">{p.noteRo}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="small muted">{funding.grantOutlook.messageRo}</p>
      {funding.officerNotesRo ? <p className="small">Notes for the bank: {funding.officerNotesRo}</p> : null}
    </Panel>
  );
}
