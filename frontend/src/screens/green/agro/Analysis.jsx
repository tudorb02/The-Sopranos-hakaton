// The wait between the questions and the offers: no progress detail, just a short loader that moves on by itself.

import { useEffect } from "react";

import { ErrorCard, Loading } from "../../../components/live.jsx";
import { useRunEvents } from "../../../lib/hooks.js";
import { useFlow } from "../../../lib/session.js";
import { Missing } from "./shared.jsx";

export function Analysis() {
  const { runId } = useFlow();
  const { events, status } = useRunEvents(runId);

  const completed = events.some((e) => e.type === "run.completed");
  const failed = events.find((e) => e.type === "run.failed");

  useEffect(() => {
    if (completed) window.location.hash = "/verde/agro/oferte";
  }, [completed]);

  if (!runId) {
    return (
      <Missing href="#/verde/agro/documente" label="Încarcă oferta">
        Nu ai pornit încă un dosar. Încarcă oferta, sau pornește un dosar demo.
      </Missing>
    );
  }

  return (
    <>
      <header className="intro">
        <h1 className="page-title">Pregătim ofertele</h1>
        <p className="small muted">Durează câteva momente. Cifrele le calculează banca, după formule fixe.</p>
      </header>

      {!failed && status.state !== "error" ? <Loading label="Pregătim ofertele…" /> : null}
      <ErrorCard error={status.state === "error" ? status.error : null} />
      {failed ? (
        <ErrorCard error={{ message: failed.data.messageRo ?? failed.message, code: "ANALYSIS_FAILED" }}>
          <a className="btn btn--outline btn--small" href="#/verde/agro/documente">
            Încearcă un dosar demo
          </a>
        </ErrorCard>
      ) : null}
    </>
  );
}
