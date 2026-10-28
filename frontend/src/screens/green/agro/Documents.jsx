// Step 4: the documents of the category (GET /api/modules requiredDocs). Upload them, or use the recorded demo dossier.

import { useRef, useState } from "react";

import { Actions, ErrorCard, Loading, NextButton } from "../../../components/live.jsx";
import { Icon } from "../../../components/icons.jsx";
import { Group, IconTile, NoteCard } from "../../../components/ui.jsx";
import { useModules } from "../../../lib/hooks.js";
import { getFiles, setFile, useFlow } from "../../../lib/session.js";
import { Missing, startDemo } from "./shared.jsx";

// The backend caps one file at 5 MB (application.yml); the contract says 20 MB.
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

function DocRow({ doc, file, onPick, onRemove }) {
  const input = useRef(null);
  const [problem, setProblem] = useState(null);
  const pick = (e) => {
    const chosen = e.target.files?.[0];
    e.target.value = "";
    if (!chosen) return;
    if (chosen.size > MAX_BYTES) {
      setProblem("Fișierul e prea mare. Încarcă unul de cel mult 5 MB.");
      return;
    }
    if (!/\.(pdf|jpe?g|png)$/i.test(chosen.name)) {
      setProblem("Acceptăm doar PDF, JPG sau PNG.");
      return;
    }
    setProblem(null);
    onPick(chosen);
  };
  return (
    <li className="row doc-row">
      <IconTile icon="file" tone="sand" />
      <div className="row-main">
        <span className="row-name">{doc.labelRo}</span>
        {file ? <span className="row-note">{file.name}</span> : null}
        <span className={file ? "status is-on" : doc.required ? "status status--warn" : "status"}>{file ? "Încărcat" : doc.required ? "Lipsește" : "Opțional"}</span>
        {problem ? (
          <span className="small field-error" role="alert">
            {problem}
          </span>
        ) : null}
      </div>
      <input ref={input} type="file" accept={ACCEPT} hidden onChange={pick} />
      {file ? (
        <button type="button" className="btn btn--text btn--small" onClick={onRemove}>
          Șterge
        </button>
      ) : (
        <button type="button" className="btn btn--outline btn--small" onClick={() => input.current?.click()}>
          Încarcă
        </button>
      )}
    </li>
  );
}

export function Documents() {
  const flow = useFlow();
  const modules = useModules();
  const [, force] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const module = modules.data?.find((m) => m.moduleId === flow.moduleId);
  const files = getFiles();
  const fileOf = (docType) => files.find((f) => f.docType === docType)?.file;

  const demo = async () => {
    setBusy(true);
    setError(null);
    try {
      await startDemo(flow.moduleId);
      window.location.hash = "/verde/agro/analiza";
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  };

  if (!flow.moduleId) {
    return <Missing href="#/verde/agro/categorie" label="Alege categoria">Mai întâi alege categoria investiției.</Missing>;
  }

  // The offer is what the price and the technical data come from: without it there is nothing to analyse.
  const offerDone = Boolean(fileOf("OFFER"));
  const missingRequired = module?.requiredDocs.filter((d) => d.required && !fileOf(d.docType)) ?? [];

  return (
    <>
      <header className="intro">
        <h1 className="page-title">Documente</h1>
        <p className="small muted">
          Doar cele esențiale pentru categoria ta. Ce lipsește poți trimite și după: devine o condiție înainte de tragere, nu un motiv de respingere.
        </p>
      </header>

      <button type="button" className="btn btn--outline btn--small btn--start" onClick={demo} disabled={busy}>
        <Icon name="upload" />
        {busy ? "Se pornește…" : "Folosește documentele demo"}
      </button>
      <p className="small muted">Pornește dosarul demo al categoriei, cu firma și documentele lui fictive, și trece direct la analiză.</p>

      {modules.loading ? <Loading label="Încarc lista de documente…" /> : null}
      <ErrorCard error={modules.error} onRetry={modules.reload} />
      <ErrorCard error={error} />

      {module ? (
        <Group label={`Pentru ${module.nameRo.toLowerCase()}`}>
          <ul className="card rows">
            {module.requiredDocs.map((doc) => (
              <DocRow
                key={doc.docType}
                doc={doc}
                file={fileOf(doc.docType)}
                onPick={(file) => {
                  setFile(doc.docType, file);
                  force((n) => n + 1);
                }}
                onRemove={() => {
                  setFile(doc.docType, null);
                  force((n) => n + 1);
                }}
              />
            ))}
          </ul>
        </Group>
      ) : null}

      {offerDone && missingRequired.length ? (
        <NoteCard icon="clock">Mai lipsesc {missingRequired.length} documente esențiale. Le poți trimite și după: banca le cere înainte de tragere.</NoteCard>
      ) : null}
      <NoteCard icon="lock">Documentele sunt criptate, nu devin publice și sunt folosite doar pentru acest dosar. Citim din ele doar datele tehnice.</NoteCard>

      <Actions>
        <NextButton href="#/verde/agro/intrebari" disabled={!offerDone}>
          Continuă
        </NextButton>
        {!offerDone ? <p className="small muted">Încarcă măcar oferta sau factura proformă ca să continui.</p> : null}
      </Actions>
    </>
  );
}
