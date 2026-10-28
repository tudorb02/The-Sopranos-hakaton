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
      installment: seasonal ? `${disp(run, loan.repayment.installmentCalcId)} în ${monthsText(loan.repayment.paymentMonths)}` : `${disp(run, loan.repayment.installmentCalcId)} pe lună`,
      grace: loan.repayment.graceCalcId ? disp(run, loan.repayment.graceCalcId) : "Fără",
      collateral: option.collateral.includes("GUARANTEE_INVESTEU_FEI") ? "Fără ipotecă, datorită unei garanții europene" : option.collateral.includes("MORTGAGE") ? "Ipotecă" : "—",
      interest: disp(run, totals.totalInterestCalcId),
      savings: disp(run, totals.savingsOverHorizonCalcId),
      savingsLabel: calcOf(run, totals.savingsOverHorizonCalcId)?.labelRo ?? "Economii în perioada creditului",
      affordability: option.affordability.noteRo,
    };
  };
  const a = cell(classic);
  const b = cell(green);
  const rows = [
    ["Suma creditului", a?.amount, b?.amount],
    ["Dobânda pe an", a?.rate, b?.rate],
    ["Durata", a?.term, b?.term],
    ["Rata", a?.installment, b?.installment],
    ["Perioadă fără rate", a?.grace, b?.grace],
    ["Garanția", a?.collateral, b?.collateral],
    ["Dobânzi plătite în total", a?.interest, b?.interest],
    [a?.savingsLabel ?? b?.savingsLabel ?? "Economii", a?.savings, b?.savings],
    ["Ratele față de încasările tale", a?.affordability, b?.affordability],
  ];
  return rows.map(([label, x, y]) => ({ label, a: x ?? "—", b: y ?? "Nu e disponibil acum" }));
}

function Compare({ rows }) {
  return (
    <div className="card compare" role="table" aria-label="Creditul clasic și creditul verde">
      <div className="compare-head" role="row">
        <span className="sr-only" role="columnheader">
          Ce compari
        </span>
        <span role="columnheader">Credit clasic</span>
        <span role="columnheader" className="is-green">
          <Icon name="leaf" />
          Credit verde
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
      <Missing href="#/verde/agro/categorie" label="Alege categoria">
        Nu ai încă o analiză. Alege o categorie și trimite dosarul, sau pornește un dosar demo.
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
      {loading ? <Loading label="Încarc ofertele…" /> : null}
      <ErrorCard error={error} onRetry={reload} />
      {run && !ready ? (
        <Missing href="#/verde/agro/analiza" label="Înapoi la analiză">
          Analiza nu s-a terminat încă.
        </Missing>
      ) : null}
      {run?.state === "ESUAT" ? <ErrorCard error={{ code: "ANALYSIS_FAILED", message: run.error?.message ?? "Analiza s-a oprit." }} /> : null}

      {ready ? (
        <>
          <section className="card card--yellow hero-card" aria-labelledby="offer-title">
            <p className="eyebrow">Ofertele tale</p>
            <h1 id="offer-title" className="hero-label">
              {wins ? "Câștigi" : "Creditul clasic e varianta potrivită acum"}
            </h1>
            {wins ? (
              <p className="hero-big num">
                {disp(run, funding.comparison.netAdvantageCalcId)}
                <span className="hero-big-sub"> alegând creditul verde</span>
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

          <Section title="Creditul clasic și creditul verde">
            <Compare rows={offerRows(run, classic, green)} />
            <p className="small muted">
              Dobânda și ratele sunt calculate de bancă pe baza unor parametri demonstrativi. Oferta finală o confirmă banca la aprobare.
            </p>
          </Section>

          {seasonalSchedule ? (
            <Section title="Ratele creditului verde, într-un an">
              <div className="card">
                <RepaymentChart
                  green={seasonalSchedule}
                  classic={classicSchedule}
                  ariaLabel={`Creditul verde: ${disp(run, greenLoan.repayment.installmentCalcId)} în lunile ${monthsText(greenLoan.repayment.paymentMonths)}. Creditul clasic: ${disp(run, loanOf(classic).repayment.installmentCalcId)} pe lună.`}
                />
                <p className="small muted">
                  Barele: creditul verde, {disp(run, greenLoan.repayment.installmentCalcId)} doar în lunile cu încasări ({monthsText(greenLoan.repayment.paymentMonths)}), după{" "}
                  {disp(run, greenLoan.repayment.graceCalcId)} fără rate. Linia punctată: creditul clasic, {disp(run, loanOf(classic).repayment.installmentCalcId)} în fiecare lună.
                </p>
              </div>
            </Section>
          ) : null}

          {green?.collateral.includes("GUARANTEE_INVESTEU_FEI") ? (
            <NoteCard icon="shield">Creditul verde se acordă fără ipotecă, datorită unei garanții europene.</NoteCard>
          ) : null}

          <NoteCard icon="lock">Oferta nu e o promisiune de aprobare. Banca verifică dosarul și dă aprobarea finală.</NoteCard>
        </>
      ) : null}

      <Actions>
        <NextButton href="#/verde/agro/schimbari" disabled={!ready}>
          Vezi ce să schimbi
        </NextButton>
      </Actions>
    </>
  );
}
