// The dossier after the request is sent: status, what the bank asked for, the conditions before drawdown, next steps
// and, after the 12 months, the measured impact. Refreshed every few seconds so an approval shows up by itself.

import { ErrorCard, Loading } from "../../../components/live.jsx";
import { Icon } from "../../../components/icons.jsx";
import { Group, NoteCard, ValueRow } from "../../../components/ui.jsx";
import { calcOf, disp } from "../../../lib/calc.js";
import { useRun } from "../../../lib/hooks.js";
import { CONDITION_TIMING_RO, DOC_TYPE_RO } from "../../../lib/labels.js";
import { useFlow } from "../../../lib/session.js";
import { FARMER_IMPACTS } from "./Changes.jsx";
import { Missing } from "./shared.jsx";

const REACHED = {
  TRIMIS: ["TRIMIS", "APROBAT", "MONITORIZARE"],
  APROBAT: ["APROBAT", "MONITORIZARE"],
  MONITORIZARE: ["MONITORIZARE"],
};

const HEADLINES = {
  GATA: ["The application has not been sent yet", "Your offers are ready. Choose the option and send the application to the bank."],
  TRIMIS: ["The application is with the bank", "An officer is checking it. We will tell you here if they need documents or when they approve it."],
  APROBAT: ["Your application has been approved", "The bank approved the application. Next come the conditions precedent to drawdown."],
  MONITORIZARE: ["Your application has been approved", "The credit is active. At 12 months we measure how much you saved, against the estimate."],
  ESUAT: ["The analysis stopped", "Start the analysis again or try a demo dossier."],
};

export function Dossier() {
  const { runId } = useFlow();
  const { run, loading, error, reload } = useRun(runId, "sme", { pollMs: 4000 });

  if (!runId) {
    return (
      <Missing href="#/verde/agro/documente" label="Start a dossier">
        You have not started a dossier.
      </Missing>
    );
  }
  const report = run?.agents.underwritingReport;
  const state = run?.state;
  const [headline, text] = HEADLINES[state] ?? ["Your dossier", "The analysis is in progress."];
  const pendingByCondition = new Set((run?.pendingDocuments ?? []).map((d) => d.conditionId).filter(Boolean));
  const comment = [...(run?.officerActions ?? [])].reverse().find((a) => a.commentRo);
  const steps = [
    { label: "Application sent", note: run?.submission ? `Chosen option: ${run.submission.variant === "VERDE" ? "green credit" : "classic credit"}` : "Not sent yet", done: Boolean(REACHED.TRIMIS.includes(state)) },
    { label: "Bank approval", note: REACHED.APROBAT.includes(state) ? "Approved" : "The bank is checking the dossier", done: REACHED.APROBAT.includes(state) },
    { label: "Monitoring at 12 months", note: run?.monitoring ? "Impact measured" : "After one year we measure the real savings", done: Boolean(run?.monitoring) },
  ];

  return (
    <>
      {loading ? <Loading label="Loading the dossier…" /> : null}
      <ErrorCard error={error} onRetry={reload} />

      {run ? (
        <>
          <section className="card hero-card" aria-labelledby="dossier-title">
            <p className="eyebrow">Your dossier · {run.runId}</p>
            <h1 id="dossier-title" className="card-title">
              {headline}
            </h1>
            <p className="hero-sub">{text}</p>
            {state === "GATA" ? (
              <a className="btn btn--small" href="#/verde/agro/cerere">
                Choose the option
              </a>
            ) : null}
          </section>

          <ol className="card rows">
            {steps.map((step) => (
              <li key={step.label} className="row">
                <span className={`state state--${step.done ? "done" : "waiting"}`} aria-hidden="true">
                  {step.done ? <Icon name="check" /> : null}
                </span>
                <div className="row-main">
                  <span className="row-name">{step.label}</span>
                  <span className="row-note">{step.note}</span>
                </div>
              </li>
            ))}
          </ol>

          {comment ? <NoteCard icon="mail">Message from the bank: {comment.commentRo}</NoteCard> : null}

          {run.pendingDocuments.length ? (
            <Group label="The bank asks you for these documents">
              <ul className="card rows">
                {run.pendingDocuments.map((doc) => (
                  <ValueRow
                    key={`${doc.docType}-${doc.requestedAt}`}
                    icon="file"
                    name={doc.labelRo}
                    note={DOC_TYPE_RO[doc.docType]}
                    value={<span className="status status--warn">{doc.dueDate ? `by ${doc.dueDate}` : "to send"}</span>}
                  />
                ))}
              </ul>
            </Group>
          ) : null}

          {report?.conditionsPrecedent.length && REACHED.TRIMIS.includes(state) ? (
            <Group label="Conditions precedent to drawdown">
              <ul className="card rows">
                {report.conditionsPrecedent.map((c) => (
                  <ValueRow
                    key={c.conditionId}
                    name={c.descriptionRo}
                    note={CONDITION_TIMING_RO[c.timing]}
                    value={pendingByCondition.has(c.conditionId) ? <span className="status status--warn">requested by the bank</span> : <span className="status">{c.blocking ? "mandatory" : "after installation"}</span>}
                  />
                ))}
              </ul>
            </Group>
          ) : null}

          {report?.farmerNextSteps.length ? (
            <Group label="Next steps">
              <ol className="card ticks">
                {report.farmerNextSteps.map((step) => (
                  <li key={step.conditionId ?? step.stepRo}>
                    <Icon name="check" />
                    <span>{step.stepRo}</span>
                  </li>
                ))}
              </ol>
            </Group>
          ) : null}

          {report?.impact.length ? (
            <Group label="Estimated impact, measured at 12 months">
              <ul className="card facts">
                {report.impact
                  .filter((i) => i.period === "ANNUAL" && FARMER_IMPACTS.includes(i.metric))
                  .map((i) => (
                    <li key={`${i.metric}-${i.calcId}`}>
                      <span className="fact-label">{calcOf(run, i.calcId)?.labelRo}</span>
                      <span className="fact-value num">{disp(run, i.calcId)}</span>
                    </li>
                  ))}
              </ul>
            </Group>
          ) : null}

          {run.monitoring ? (
            <Group label="The result after 12 months">
              <ul className="card facts">
                {run.monitoring.metrics.map((m) => (
                  <li key={m.metric}>
                    <span className="fact-label">{calcOf(run, m.estimatedCalcId)?.labelRo}</span>
                    <span className="fact-value num">
                      estimated {disp(run, m.estimatedCalcId)}, actual {disp(run, m.actualCalcId)}
                    </span>
                    <span className={m.withinTolerance ? "status is-on" : "status status--warn"}>{m.withinTolerance ? "confirmed" : "below the estimate"}</span>
                  </li>
                ))}
              </ul>
              {run.monitoring.impactBonusApplied ? (
                <NoteCard icon="leaf">
                  The estimate was confirmed, so your interest rate drops from {disp(run, run.monitoring.rateBeforeCalcId)} to {disp(run, run.monitoring.rateAfterCalcId)}.
                </NoteCard>
              ) : null}
            </Group>
          ) : null}
        </>
      ) : null}
    </>
  );
}
