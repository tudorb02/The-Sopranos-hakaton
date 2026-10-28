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
  GATA: ["Cererea nu e trimisă încă", "Ai ofertele gata. Alege varianta și trimite cererea la bancă."],
  TRIMIS: ["Cererea e la bancă", "Un ofițer o verifică. Te anunțăm aici dacă are nevoie de documente sau când o aprobă."],
  APROBAT: ["Cererea ta a fost aprobată", "Banca a aprobat cererea. Urmează condițiile dinainte de tragere."],
  MONITORIZARE: ["Cererea ta a fost aprobată", "Creditul e activ. La 12 luni măsurăm cât ai economisit, față de estimare."],
  ESUAT: ["Analiza s-a oprit", "Pornește din nou analiza sau încearcă un dosar demo."],
};

export function Dossier() {
  const { runId } = useFlow();
  const { run, loading, error, reload } = useRun(runId, "sme", { pollMs: 4000 });

  if (!runId) {
    return (
      <Missing href="#/verde/agro/categorie" label="Începe un dosar">
        Nu ai niciun dosar început.
      </Missing>
    );
  }
  const report = run?.agents.underwritingReport;
  const state = run?.state;
  const [headline, text] = HEADLINES[state] ?? ["Dosarul tău", "Analiza este în curs."];
  const pendingByCondition = new Set((run?.pendingDocuments ?? []).map((d) => d.conditionId).filter(Boolean));
  const comment = [...(run?.officerActions ?? [])].reverse().find((a) => a.commentRo);
  const steps = [
    { label: "Cererea trimisă", note: run?.submission ? `Varianta aleasă: ${run.submission.variant === "VERDE" ? "credit verde" : "credit clasic"}` : "Încă netrimisă", done: Boolean(REACHED.TRIMIS.includes(state)) },
    { label: "Aprobarea băncii", note: REACHED.APROBAT.includes(state) ? "Aprobat" : "Banca verifică dosarul", done: REACHED.APROBAT.includes(state) },
    { label: "Monitorizare la 12 luni", note: run?.monitoring ? "Impact măsurat" : "După un an măsurăm economiile reale", done: Boolean(run?.monitoring) },
  ];

  return (
    <>
      {loading ? <Loading label="Încarc dosarul…" /> : null}
      <ErrorCard error={error} onRetry={reload} />

      {run ? (
        <>
          <section className="card hero-card" aria-labelledby="dossier-title">
            <p className="eyebrow">Dosarul tău · {run.runId}</p>
            <h1 id="dossier-title" className="card-title">
              {headline}
            </h1>
            <p className="hero-sub">{text}</p>
            {state === "GATA" ? (
              <a className="btn btn--small" href="#/verde/agro/cerere">
                Alege varianta
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

          {comment ? <NoteCard icon="mail">Mesajul băncii: {comment.commentRo}</NoteCard> : null}

          {run.pendingDocuments.length ? (
            <Group label="Banca îți cere aceste documente">
              <ul className="card rows">
                {run.pendingDocuments.map((doc) => (
                  <ValueRow
                    key={`${doc.docType}-${doc.requestedAt}`}
                    icon="file"
                    name={doc.labelRo}
                    note={DOC_TYPE_RO[doc.docType]}
                    value={<span className="status status--warn">{doc.dueDate ? `până la ${doc.dueDate}` : "de trimis"}</span>}
                  />
                ))}
              </ul>
            </Group>
          ) : null}

          {report?.conditionsPrecedent.length && REACHED.TRIMIS.includes(state) ? (
            <Group label="Condiții înainte de tragere">
              <ul className="card rows">
                {report.conditionsPrecedent.map((c) => (
                  <ValueRow
                    key={c.conditionId}
                    name={c.descriptionRo}
                    note={CONDITION_TIMING_RO[c.timing]}
                    value={pendingByCondition.has(c.conditionId) ? <span className="status status--warn">cerut de bancă</span> : <span className="status">{c.blocking ? "obligatoriu" : "după instalare"}</span>}
                  />
                ))}
              </ul>
            </Group>
          ) : null}

          {report?.farmerNextSteps.length ? (
            <Group label="Pașii următori">
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
            <Group label="Impactul estimat, măsurat la 12 luni">
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
            <Group label="Rezultatul după 12 luni">
              <ul className="card facts">
                {run.monitoring.metrics.map((m) => (
                  <li key={m.metric}>
                    <span className="fact-label">{calcOf(run, m.estimatedCalcId)?.labelRo}</span>
                    <span className="fact-value num">
                      estimat {disp(run, m.estimatedCalcId)}, real {disp(run, m.actualCalcId)}
                    </span>
                    <span className={m.withinTolerance ? "status is-on" : "status status--warn"}>{m.withinTolerance ? "confirmat" : "sub estimare"}</span>
                  </li>
                ))}
              </ul>
              {run.monitoring.impactBonusApplied ? (
                <NoteCard icon="leaf">
                  Estimarea s-a confirmat, deci dobânda ta scade de la {disp(run, run.monitoring.rateBeforeCalcId)} la {disp(run, run.monitoring.rateAfterCalcId)}.
                </NoteCard>
              ) : null}
            </Group>
          ) : null}
        </>
      ) : null}
    </>
  );
}
