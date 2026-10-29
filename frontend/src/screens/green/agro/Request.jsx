// Step 9: choose the variant and send the request to the bank (POST /api/runs/{id}/submit).

import { useState } from "react";

import { Actions, ErrorCard, Loading, NextButton } from "../../../components/live.jsx";
import { Group, NoteCard, Section, ValueRow } from "../../../components/ui.jsx";
import { submitRun } from "../../../lib/api.js";
import { calcOf, disp, loanOf, optionFor, valueOf } from "../../../lib/calc.js";
import { useRun } from "../../../lib/hooks.js";
import { CONDITION_TIMING_RO, KPI_FIRST_DUE_RO, KPI_FREQUENCY_RO } from "../../../lib/labels.js";
import { useFlow } from "../../../lib/session.js";
import { Missing } from "./shared.jsx";

export function Request() {
  const { runId } = useFlow();
  const { run, loading, error, reload, replace } = useRun(runId, "sme");
  const [choice, setChoice] = useState(null);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);

  if (!runId) {
    return (
      <Missing href="#/verde/agro/documente" label="Upload the offer">
        You do not have an analysis yet.
      </Missing>
    );
  }

  const funding = run?.agents.fundingRecommendation;
  const report = run?.agents.underwritingReport;
  const classic = optionFor(funding, "CLASIC");
  const green = optionFor(funding, "VERDE");
  const variant = choice ?? (green ? "VERDE" : "CLASIC");
  const upgrade = Boolean(funding?.greenTier.upgradeNeeded);
  const alreadySent = run && !["GATA"].includes(run.state) && run.state !== "ESUAT" && Boolean(run.submission);
  const needsAccept = variant === "VERDE" && upgrade;
  const upgradeCost = (() => {
    const tech = run?.agents.technicalAssessment;
    const rec = tech?.configurations.find((c) => c.configId === tech.recommendedConfigId);
    return rec?.upgradeCostCalcId ? disp(run, rec.upgradeCostCalcId) : null;
  })();

  const send = async () => {
    setBusy(true);
    setProblem(null);
    try {
      replace(await submitRun(runId, variant));
      return true;
    } catch (e) {
      setProblem(e);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const option = (kind, o, title, note) => (
    <label className="card variant" key={kind}>
      <input type="radio" className="radio" name="variant" checked={variant === kind} disabled={!o} onChange={() => setChoice(kind)} />
      <span className="row-main">
        <span className="row-name">{title}</span>
        <span className="row-note">{o ? `${disp(run, loanOf(o).amountCalcId)} · interest rate ${disp(run, loanOf(o).rateCalcId)} · ${note}` : "Not available for the requested investment"}</span>
      </span>
      {kind === "VERDE" && o && funding?.recommendedOptionId === o.optionId ? <span className="status is-on">recommended</span> : null}
    </label>
  );

  return (
    <>
      <header className="intro">
        <h1 className="page-title">Send the application to the bank</h1>
        <p className="small muted">You choose the option and the application goes to the bank. The bank gives the final approval.</p>
      </header>

      {loading ? <Loading label="Loading the dossier…" /> : null}
      <ErrorCard error={error} onRetry={reload} />
      {run && !funding ? (
        <Missing href="#/verde/agro/analiza" label="Back to the analysis">
          The analysis has not finished yet.
        </Missing>
      ) : null}

      {alreadySent ? (
        <NoteCard icon="check">
          The application has already been sent. <a href="#/verde/agro/dosar">See the dossier status</a>.
        </NoteCard>
      ) : null}

      {funding ? (
        <>
          <Group label="Which option you send">
            <div className="variants" role="radiogroup" aria-label="Credit option">
              {option("CLASIC", classic, "Classic credit", classic ? `instalment ${disp(run, classic.headlineInstallmentCalcId)}` : "")}
              {option("VERDE", green, "Raiffeisen green credit", green ? `instalment ${disp(run, green.headlineInstallmentCalcId)}` : "")}
            </div>
          </Group>

          {variant === "VERDE" && upgrade ? (
            <div className="card note-card accept-card">
              <p className="small">
                <b>The requested investment is below the green threshold.</b> If you choose the green credit, you also accept the proposed changes to the investment
                {upgradeCost ? ` (extra cost: ${upgradeCost})` : ""}. There is no green credit without them.
              </p>
              <label className="accept-row">
                <input type="checkbox" className="check" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
                <span className="small">I accept the proposed changes to the investment</span>
              </label>
            </div>
          ) : null}

          {variant === "VERDE" && valueOf(run, funding.comparison.netAdvantageCalcId) > 0 ? (
            <p className="small muted">
              Estimated gain with the green credit: <b className="num">{disp(run, funding.comparison.netAdvantageCalcId)}</b>.
            </p>
          ) : null}

          {report?.conditionsPrecedent.length ? (
            <Section title="What the bank will ask for before you get the money">
              <ul className="card rows">
                {report.conditionsPrecedent.map((c) => (
                  <ValueRow key={c.conditionId} name={c.descriptionRo} value={<span className="status">{CONDITION_TIMING_RO[c.timing]}</span>} />
                ))}
              </ul>
            </Section>
          ) : null}

          {variant === "VERDE" && report?.monitoringKpis.length ? (
            <Section title="What you commit to do, with the green credit">
              <ul className="card rows">
                {report.monitoringKpis.map((k) => (
                  <ValueRow
                    key={k.kpiId}
                    name={calcOf(run, k.targetCalcId)?.labelRo ?? k.metric}
                    note="You tell us how much you saved, so we can confirm the estimate"
                    value={<span className="status">{`${KPI_FREQUENCY_RO[k.frequency]}, ${KPI_FIRST_DUE_RO[k.firstDue]}`}</span>}
                  />
                ))}
              </ul>
            </Section>
          ) : null}
        </>
      ) : null}

      <ErrorCard error={problem} />
      {run?.state === "ESUAT" ? <ErrorCard error={{ code: "ANALYSIS_FAILED", message: run.error?.message ?? "The analysis stopped." }} /> : null}

      <Actions>
        {alreadySent ? (
          <NextButton href="#/verde/agro/dosar">See the dossier</NextButton>
        ) : (
          <NextButton href="#/verde/agro/dosar" onClick={send} busy={busy} disabled={!funding || run?.state !== "GATA" || (needsAccept && !accepted)}>
            Send the application to the bank
          </NextButton>
        )}
      </Actions>
    </>
  );
}
