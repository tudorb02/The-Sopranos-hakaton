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
      <Missing href="#/verde/agro/categorie" label="Alege categoria">
        Nu ai încă o analiză.
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
        <span className="row-note">{o ? `${disp(run, loanOf(o).amountCalcId)} · dobândă ${disp(run, loanOf(o).rateCalcId)} · ${note}` : "Nu e disponibil pentru investiția cerută"}</span>
      </span>
      {kind === "VERDE" && o && funding?.recommendedOptionId === o.optionId ? <span className="status is-on">recomandat</span> : null}
    </label>
  );

  return (
    <>
      <header className="intro">
        <h1 className="page-title">Trimite cererea la bancă</h1>
        <p className="small muted">Alegi varianta, iar cererea ajunge la bancă. Banca dă aprobarea finală.</p>
      </header>

      {loading ? <Loading label="Încarc dosarul…" /> : null}
      <ErrorCard error={error} onRetry={reload} />
      {run && !funding ? (
        <Missing href="#/verde/agro/analiza" label="Înapoi la analiză">
          Analiza nu s-a terminat încă.
        </Missing>
      ) : null}

      {alreadySent ? (
        <NoteCard icon="check">
          Cererea a fost deja trimisă. <a href="#/verde/agro/dosar">Vezi statusul dosarului</a>.
        </NoteCard>
      ) : null}

      {funding ? (
        <>
          <Group label="Ce variantă trimiți">
            <div className="variants" role="radiogroup" aria-label="Varianta de credit">
              {option("CLASIC", classic, "Credit clasic", classic ? `rata ${disp(run, classic.headlineInstallmentCalcId)}` : "")}
              {option("VERDE", green, "Credit verde Raiffeisen", green ? `rata ${disp(run, green.headlineInstallmentCalcId)}` : "")}
            </div>
          </Group>

          {variant === "VERDE" && upgrade ? (
            <div className="card note-card accept-card">
              <p className="small">
                <b>Investiția cerută e sub pragul verde.</b> Dacă alegi creditul verde, accepți și schimbările propuse la investiție
                {upgradeCost ? ` (cost în plus: ${upgradeCost})` : ""}. Nu există credit verde fără ele.
              </p>
              <label className="accept-row">
                <input type="checkbox" className="check" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
                <span className="small">Accept schimbările propuse la investiție</span>
              </label>
            </div>
          ) : null}

          {variant === "VERDE" && valueOf(run, funding.comparison.netAdvantageCalcId) > 0 ? (
            <p className="small muted">
              Câștigul estimat cu creditul verde: <b className="num">{disp(run, funding.comparison.netAdvantageCalcId)}</b>.
            </p>
          ) : null}

          {report?.conditionsPrecedent.length ? (
            <Section title="Ce îți va cere banca înainte să primești banii">
              <ul className="card rows">
                {report.conditionsPrecedent.map((c) => (
                  <ValueRow key={c.conditionId} name={c.descriptionRo} value={<span className="status">{CONDITION_TIMING_RO[c.timing]}</span>} />
                ))}
              </ul>
            </Section>
          ) : null}

          {variant === "VERDE" && report?.monitoringKpis.length ? (
            <Section title="Ce te obligi să faci, cu creditul verde">
              <ul className="card rows">
                {report.monitoringKpis.map((k) => (
                  <ValueRow
                    key={k.kpiId}
                    name={calcOf(run, k.targetCalcId)?.labelRo ?? k.metric}
                    note="Ne spui cât ai economisit, ca să putem confirma estimarea"
                    value={<span className="status">{`${KPI_FREQUENCY_RO[k.frequency]}, ${KPI_FIRST_DUE_RO[k.firstDue]}`}</span>}
                  />
                ))}
              </ul>
            </Section>
          ) : null}
        </>
      ) : null}

      <ErrorCard error={problem} />
      {run?.state === "ESUAT" ? <ErrorCard error={{ code: "ANALYSIS_FAILED", message: run.error?.message ?? "Analiza s-a oprit." }} /> : null}

      <Actions>
        {alreadySent ? (
          <NextButton href="#/verde/agro/dosar">Vezi dosarul</NextButton>
        ) : (
          <NextButton href="#/verde/agro/dosar" onClick={send} busy={busy} disabled={!funding || run?.state !== "GATA" || (needsAccept && !accepted)}>
            Trimite cererea la bancă
          </NextButton>
        )}
      </Actions>
    </>
  );
}
