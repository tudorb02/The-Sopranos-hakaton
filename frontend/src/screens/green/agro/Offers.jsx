// Step 7: the two offers, from RunView(view=sme). Every figure is the `display` of a calc. The SME never sees the funds,
// the debt-service ratio or the breakdown of the interest (README §13).

import { Actions, ErrorCard, Loading, monthsText, NextButton, RepaymentChart } from "../../../components/live.jsx";
import { Icon } from "../../../components/icons.jsx";
import { NoteCard, Section } from "../../../components/ui.jsx";
import { calcOf, disp, loanOf, optionFor, valueOf } from "../../../lib/calc.js";
import { useRun } from "../../../lib/hooks.js";
import { TIER_SME } from "../../../lib/labels.js";
import { useFlow } from "../../../lib/session.js";
import { Missing } from "./shared.jsx";

// The rows of the comparison table, as plain strings built from displays.
export function offerRows(run, classic, green) {
  const cell = (option) => {
    if (!option) return null;
    const loan = loanOf(option);
    const seasonal = loan.repayment.scheduleType === "SEASONAL";
    const totals = option.totals;
    return {
      amount: disp(run, loan.amountCalcId),
      rate: disp(run, loan.rateCalcId),
      term: disp(run, loan.termCalcId),
      installment: seasonal ? `${disp(run, loan.repayment.installmentCalcId)} in ${monthsText(loan.repayment.paymentMonths)}` : `${disp(run, loan.repayment.installmentCalcId)} per month`,
      grace: loan.repayment.graceCalcId ? disp(run, loan.repayment.graceCalcId) : "None",
      collateral: option.collateral.includes("GUARANTEE_INVESTEU_FEI") ? "No mortgage, thanks to a European guarantee" : option.collateral.includes("MORTGAGE") ? "Mortgage" : "—",
      interest: disp(run, totals.totalInterestCalcId),
      savings: disp(run, totals.savingsOverHorizonCalcId),
      savingsLabel: calcOf(run, totals.savingsOverHorizonCalcId)?.labelRo ?? "Savings over the credit term",
      affordability: option.affordability.noteRo,
    };
  };
  const a = cell(classic);
  const b = cell(green);
  const rows = [
    ["Credit amount", a?.amount, b?.amount],
    ["Interest rate per year", a?.rate, b?.rate],
    ["Term", a?.term, b?.term],
    ["Instalment", a?.installment, b?.installment],
    ["Period without instalments", a?.grace, b?.grace],
    ["Collateral", a?.collateral, b?.collateral],
    ["Total interest paid", a?.interest, b?.interest],
    [a?.savingsLabel ?? b?.savingsLabel ?? "Savings", a?.savings, b?.savings],
    ["Instalments compared with your income", a?.affordability, b?.affordability],
  ];
  return rows.map(([label, x, y]) => ({ label, a: x ?? "—", b: y ?? "Not available now" }));
}

function Compare({ rows }) {
  return (
    <div className="card compare" role="table" aria-label="The classic credit and the green credit">
      <div className="compare-head" role="row">
        <span className="sr-only" role="columnheader">
          What you compare
        </span>
        <span role="columnheader">Classic credit</span>
        <span role="columnheader" className="is-green">
          <Icon name="leaf" />
          Green credit
        </span>
      </div>
      {rows.map((row) => (
        <div key={row.label} className="compare-row" role="row">
          <span className="compare-label" role="rowheader">
            {row.label}
          </span>
          <span role="cell">{row.a}</span>
          <span role="cell" className="is-green">
            {row.b}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Offers() {
  const { runId } = useFlow();
  const { run, loading, error, reload } = useRun(runId, "sme");

  if (!runId) {
    return (
      <Missing href="#/verde/agro/documente" label="Upload the offer">
        You do not have an analysis yet. Upload the offer and send the dossier, or start a demo dossier.
      </Missing>
    );
  }

  const funding = run?.agents.fundingRecommendation;
  const ready = Boolean(funding);
  const classic = optionFor(funding, "CLASIC");
  const green = optionFor(funding, "VERDE");
  const tier = funding ? TIER_SME[funding.greenTier.tier] : null;
  const advantage = funding ? valueOf(run, funding.comparison.netAdvantageCalcId) : null;
  const wins = Boolean(green) && advantage > 0;

  const greenLoan = loanOf(green);
  const seasonalSchedule = greenLoan ? calcOf(run, greenLoan.repayment.scheduleCalcId)?.series : null;
  const classicSchedule = classic ? calcOf(run, loanOf(classic).repayment.scheduleCalcId)?.series : null;

  return (
    <>
      {loading ? <Loading label="Loading the offers…" /> : null}
      <ErrorCard error={error} onRetry={reload} />
      {run && !ready ? (
        <Missing href="#/verde/agro/analiza" label="Back to the analysis">
          The analysis has not finished yet.
        </Missing>
      ) : null}
      {run?.state === "ESUAT" ? <ErrorCard error={{ code: "ANALYSIS_FAILED", message: run.error?.message ?? "The analysis stopped." }} /> : null}

      {ready ? (
        <>
          <section className="card card--yellow hero-card" aria-labelledby="offer-title">
            <p className="eyebrow">Your offers</p>
            <h1 id="offer-title" className="hero-label">
              {wins ? "You gain" : "The classic credit is the right option for now"}
            </h1>
            {wins ? (
              <p className="hero-big num">
                {disp(run, funding.comparison.netAdvantageCalcId)}
                <span className="hero-big-sub"> by choosing the green credit</span>
              </p>
            ) : (
              <p className="hero-sub">{funding.farmerExplanationRo}</p>
            )}
            <p className="hero-alert">
              <Icon name="leaf" />
              <span>
                <b>{tier.name}</b> · {tier.text}
              </span>
            </p>
          </section>

          <Section title="The classic credit and the green credit">
            <Compare rows={offerRows(run, classic, green)} />
            <p className="small muted">
              The bank calculates the interest rate and instalments from demo parameters. The bank confirms the final offer at approval.
            </p>
          </Section>

          {seasonalSchedule ? (
            <Section title="The green credit instalments over one year">
              <div className="card">
                <RepaymentChart
                  green={seasonalSchedule}
                  classic={classicSchedule}
                  ariaLabel={`The green credit: ${disp(run, greenLoan.repayment.installmentCalcId)} in ${monthsText(greenLoan.repayment.paymentMonths)}. The classic credit: ${disp(run, loanOf(classic).repayment.installmentCalcId)} per month.`}
                />
                <p className="small muted">
                  Bars: the green credit, {disp(run, greenLoan.repayment.installmentCalcId)} only in the months with income ({monthsText(greenLoan.repayment.paymentMonths)}), after{" "}
                  {disp(run, greenLoan.repayment.graceCalcId)} without instalments. Dotted line: the classic credit, {disp(run, loanOf(classic).repayment.installmentCalcId)} every month.
                </p>
              </div>
            </Section>
          ) : null}

          {green?.collateral.includes("GUARANTEE_INVESTEU_FEI") ? (
            <NoteCard icon="shield">The green credit is granted without a mortgage, thanks to a European guarantee.</NoteCard>
          ) : null}

          <NoteCard icon="lock">The offer is not a promise of approval. The bank checks the dossier and gives the final approval.</NoteCard>
        </>
      ) : null}

      <Actions>
        <NextButton href="#/verde/agro/schimbari" disabled={!ready}>
          See what to change
        </NextButton>
      </Actions>
    </>
  );
}
