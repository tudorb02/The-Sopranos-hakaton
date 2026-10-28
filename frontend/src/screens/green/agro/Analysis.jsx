// Step 6: the live analysis. The three agents (named for the farmer) and short plain lines, from the SSE stream.

import { Actions, ErrorCard, Loading, NextButton } from "../../../components/live.jsx";
import { Icon } from "../../../components/icons.jsx";
import { NoteCard, Section } from "../../../components/ui.jsx";
import { agentRows, farmerFeed } from "../../../lib/feed.js";
import { useRun, useRunEvents } from "../../../lib/hooks.js";
import { AGENTS_SME } from "../../../lib/labels.js";
import { useFlow } from "../../../lib/session.js";
import { Missing } from "./shared.jsx";

const STATUS_NOTE = {
  PENDING: "Așteaptă",
  RUNNING: "Lucrează…",
  COMPLETED: "Gata",
  DEGRADED: "Gata, din analiza salvată",
  FAILED: "S-a oprit",
};

export function Analysis() {
  const { runId } = useFlow();
  const { events, status } = useRunEvents(runId);

  const completed = events.find((e) => e.type === "run.completed");
  const failed = events.find((e) => e.type === "run.failed");
  const sme = useRun(completed ? runId : null, "sme");

  if (!runId) {
    return (
      <Missing href="#/verde/agro/categorie" label="Alege categoria">
        Nu ai pornit încă o analiză. Alege o categorie și trimite dosarul, sau pornește un dosar demo.
      </Missing>
    );
  }

  const rows = agentRows(events, AGENTS_SME);
  const feed = farmerFeed(events).slice(-14);
  const farmerNotes = [sme.run?.agents.technicalAssessment?.farmerMessageRo, sme.run?.agents.fundingRecommendation?.farmerExplanationRo].filter(Boolean);

  return (
    <>
      <header className="intro">
        <h1 className="page-title">Analizăm dosarul</h1>
        <p className="small muted">Trei verificări, una după alta. Cifrele le calculează banca, după formule fixe, nu consultantul.</p>
      </header>

      <ul className="card rows" aria-live="polite">
        {rows.map((row) => (
          <li key={row.id} className="row">
            <span className={`state state--${{ PENDING: "waiting", RUNNING: "running", COMPLETED: "done", DEGRADED: "done", FAILED: "warn" }[row.status]}`} aria-hidden="true">
              {row.status === "COMPLETED" || row.status === "DEGRADED" ? <Icon name="check" /> : row.status === "FAILED" ? "!" : null}
            </span>
            <div className="row-main">
              <span className="row-name">{row.name}</span>
              <span className="row-note">{row.status === "DEGRADED" && row.note ? row.note : row.desc}</span>
            </div>
            <span className={row.status === "COMPLETED" || row.status === "DEGRADED" ? "status is-on" : row.status === "FAILED" ? "status status--warn" : "status"}>
              {STATUS_NOTE[row.status]}
            </span>
          </li>
        ))}
      </ul>

      {status.state === "connecting" && !events.length ? <Loading label="Mă conectez la analiză…" /> : null}
      {status.state === "reconnecting" ? <p className="small muted">Conexiunea s-a întrerupt, o refac…</p> : null}
      <ErrorCard error={status.state === "error" ? status.error : null} />

      {failed ? (
        <ErrorCard error={{ message: failed.data.messageRo ?? failed.message, code: "ANALYSIS_FAILED" }}>
          <a className="btn btn--outline btn--small" href="#/verde/agro/categorie">
            Încearcă un dosar demo
          </a>
        </ErrorCard>
      ) : null}

      <Section title="Ce se întâmplă acum">
        <ol className="card rows feed">
          {feed.map((line) => (
            <li key={line.key} className={line.tone ? `is-${line.tone}` : undefined}>
              <p>{line.text}</p>
            </li>
          ))}
          {!feed.length ? (
            <li>
              <p className="muted">Încă nu a început.</p>
            </li>
          ) : null}
        </ol>
      </Section>

      {farmerNotes.length ? (
        <Section title="Ce am aflat">
          <ul className="card rows feed">
            {farmerNotes.map((note) => (
              <li key={note} className="is-ok">
                <p>{note}</p>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <NoteCard icon="shield">Consultantul nu promite aprobarea: aprobarea finală o dă banca. Nu trimitem nimic la bancă până nu confirmi tu.</NoteCard>

      <Actions>
        <NextButton href="#/verde/agro/oferte" disabled={!completed}>
          {completed ? "Vezi ofertele" : "Se analizează…"}
        </NextButton>
      </Actions>
    </>
  );
}
