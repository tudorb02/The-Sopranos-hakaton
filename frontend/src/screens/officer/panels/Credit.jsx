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
      <Panel n={4} title="Structurarea creditului">
        <p className="small muted">Agentul 2 nu a terminat încă.</p>
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
    ["Investiția", (o) => disp(run, o.investmentCalcId)],
    ["Suma creditului", (o, l) => disp(run, l.amountCalcId)],
    ["Dobânda", (o, l) => disp(run, l.rateCalcId)],
    ["Durata", (o, l) => disp(run, l.termCalcId)],
    ["Rambursare", (o, l) => SCHEDULE_TYPE_RO[l.repayment.scheduleType]],
    ["Rata", (o, l) => `${disp(run, l.repayment.installmentCalcId)}${l.repayment.paymentMonths ? ` (${monthsText(l.repayment.paymentMonths)})` : ""}`],
    ["Grație", (o, l) => (l.repayment.graceCalcId ? disp(run, l.repayment.graceCalcId) : "—")],
    ["Garanții", (o) => o.collateral.map((c) => COLLATERAL_OFFICER[c] ?? c).join(", ")],
    ["Total plătit", (o) => disp(run, o.totals.totalPaymentsCalcId)],
    ["Dobânzi plătite", (o) => disp(run, o.totals.totalInterestCalcId)],
    ["Costul ipotecii", (o) => (o.totals.collateralCostsCalcId ? disp(run, o.totals.collateralCostsCalcId) : "—")],
    ["Economii pe perioadă", (o) => disp(run, o.totals.savingsOverHorizonCalcId)],
    ["Cost net", (o) => disp(run, o.totals.netCostCalcId)],
    ["DSCR", (o) => disp(run, o.affordability.dscrCalcId)],
    ["Capacitate de plată", (o) => `${AFFORDABILITY_RO[o.affordability.status]}: ${o.affordability.noteRo}`],
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
      title="Structurarea creditului"
      wide
      aside={
        <span className="panel-aside">
          <Tag tone="warn">parametri demo</Tag>
        </span>
      }
    >
      <div className="advantage">
        <span className="small muted">Avantajul net al creditului verde</span>
        <b className="big num">{disp(run, cmp.netAdvantageCalcId)}</b>
        <span className="small muted">pe {disp(run, cmp.horizonCalcId)}</span>
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
          <h3 className="sub-title">Clasic vs. verde</h3>
          <table className="table">
            <thead>
              <tr>
                <th />
                <th>Clasic (A)</th>
                <th>Verde ({green?.optionId ?? "—"})</th>
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
              Garanție: <b className="num">{disp(run, guarantee.amountCalcId)}</b>, acoperire <b className="num">{disp(run, guarantee.coverageCalcId)}</b> ({guarantee.productId})
            </p>
          ) : null}
        </div>

        <div>
          <h3 className="sub-title">De ce e mai mică dobânda verde</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Componentă</th>
                <th>Clasic</th>
                <th>Verde</th>
                <th>Diferență</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Indice (EURIBOR 3M)</td>
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
                <td>Marjă</td>
                <td className="num">{disp(run, classic?.rateBreakdown.marginCalcId)}</td>
                <td className="num">{disp(run, green?.rateBreakdown.marginCalcId)}</td>
                <td />
              </tr>
              <tr className="row-total">
                <td>
                  <b>Dobânda</b>
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
          <h3 className="sub-title">Calendarul ratelor, creditul verde (primele 12 luni)</h3>
          <RepaymentChart
            green={calcOf(run, gl.repayment.scheduleCalcId).series}
            classic={cl ? calcOf(run, cl.repayment.scheduleCalcId)?.series : null}
            ariaLabel="Calendarul ratelor: creditul verde pe luni; linia punctată e rata creditului clasic"
          />
          <p className="small muted">
            Barele: rata creditului verde pe lună; linia punctată: rata egală a creditului clasic. Total plătit: {disp(run, green.totals.totalPaymentsCalcId)}.
          </p>
        </>
      ) : null}

      <h3 className="sub-title">Programe verificate</h3>
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
              <td>sesiune {p.session}</td>
              <td className="small">{p.noteRo}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="small muted">{funding.grantOutlook.messageRo}</p>
      {funding.officerNotesRo ? <p className="small">Note pentru bancă: {funding.officerNotesRo}</p> : null}
    </Panel>
  );
}
