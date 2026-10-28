// Step 2: what the farmer wants to do. The six categories come from GET /api/modules; each card also has a demo dossier.

import { useState } from "react";

import { Actions, ErrorCard, Loading, NextButton } from "../../../components/live.jsx";
import { IconTile, NoteCard } from "../../../components/ui.jsx";
import { useModules } from "../../../lib/hooks.js";
import { CRITERION_COPY, MODULE_ICONS, MODULE_ORDER } from "../../../lib/labels.js";
import { patchFlow, useFlow } from "../../../lib/session.js";
import { startDemo } from "./shared.jsx";

export const sortModules = (modules) => [...modules].sort((a, b) => MODULE_ORDER.indexOf(a.moduleId) - MODULE_ORDER.indexOf(b.moduleId));

// What makes this category green, in plain words (the number is the threshold of the category's config).
export function criterionText(module) {
  const copy = CRITERION_COPY[module.indicator];
  return copy ? copy.replace("{v}", String(module.threshold.value ?? "").replace(".", ",")) : "";
}

export function Category() {
  const flow = useFlow();
  const modules = useModules();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const choose = (moduleId) => {
    if (moduleId !== flow.moduleId) patchFlow({ moduleId, answers: {} });
  };

  const demo = async (moduleId) => {
    setBusy(moduleId);
    setError(null);
    try {
      await startDemo(moduleId);
      window.location.hash = "/verde/agro/analiza";
    } catch (e) {
      setError(e);
      setBusy(null);
    }
  };

  const list = modules.data ? sortModules(modules.data) : [];
  const chosen = list.find((m) => m.moduleId === flow.moduleId);

  return (
    <>
      <header className="intro">
        <h1 className="page-title">Ce vrei să faci?</h1>
        <p className="small muted">Alege categoria investiției. Pentru fiecare verificăm alt criteriu verde. Cu „Dosar demo” vezi direct un exemplu complet.</p>
      </header>

      {modules.loading ? <Loading label="Încarc categoriile…" /> : null}
      <ErrorCard error={modules.error} onRetry={modules.reload} />
      <ErrorCard error={error} />

      <div className="module-grid" role="group" aria-label="Categoria investiției">
        {list.map((module) => (
          <div key={module.moduleId} className="module-wrap">
            <button type="button" className="module-card" aria-pressed={module.moduleId === flow.moduleId ? "true" : "false"} onClick={() => choose(module.moduleId)}>
              <IconTile icon={MODULE_ICONS[module.moduleId] ?? "leaf"} tone={module.moduleId === flow.moduleId ? "yellow" : "sand"} />
              <span className="row-name">{module.nameRo}</span>
              <span className="row-note">{module.examplesRo.join(", ")}</span>
            </button>
            <button type="button" className="btn btn--outline btn--small btn--block" disabled={busy !== null} onClick={() => demo(module.moduleId)}>
              {busy === module.moduleId ? "Se pornește…" : "Dosar demo"}
            </button>
          </div>
        ))}
      </div>

      {chosen ? <NoteCard icon="leaf">{criterionText(chosen)}</NoteCard> : null}

      <Actions>
        <NextButton href="#/verde/agro/unde" disabled={!chosen}>
          Continuă
        </NextButton>
      </Actions>
    </>
  );
}
