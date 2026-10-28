// Step 4: the documents of the category (GET /api/modules requiredDocs). Upload them, or use the recorded demo dossier.

import { useRef, useState } from "react";
import { classifyOffer } from "../../../lib/api.js";

import { Actions, ErrorCard, Loading, NextButton } from "../../../components/live.jsx";
import { Icon } from "../../../components/icons.jsx";
import { Group, IconTile, NoteCard } from "../../../components/ui.jsx";
import { useModules } from "../../../lib/hooks.js";
import { DEMO_FARMS } from "../../../lib/labels.js";
import { getFiles, patchFlow, setFile, useFlow } from "../../../lib/session.js";
import { startDemo } from "./shared.jsx";

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
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [unknown, setUnknown] = useState(false);

  const module = modules.data?.find((m) => m.moduleId === flow.moduleId);
  const files = getFiles();
  const fileOf = (docType) => files.find((f) => f.docType === docType)?.file;
  const offer = fileOf("OFFER");

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

  // The offer says what is bought: the app finds the category and asks for the rest of its documents.
  const pickOffer = async (file) => {
    setFile("OFFER", file);
    force((n) => n + 1);
    setBusy("classify");
    setError(null);
    setUnknown(false);
    try {
      const { moduleId } = await classifyOffer(file);
      setUnknown(!moduleId);
      if (moduleId !== flow.moduleId) patchFlow({ moduleId, answers: {} });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  };

  const removeOffer = () => {
    setFile("OFFER", null);
    patchFlow({ moduleId: null, answers: {} });
    setUnknown(false);
    force((n) => n + 1);
  };

  const missingRequired = module?.requiredDocs.filter((d) => d.required && !fileOf(d.docType)) ?? [];
  const offerDoc = { docType: "OFFER", labelRo: "Oferta sau factura proformă, cu fișa tehnică", required: true };

  return (
    <>
      <header className="intro">
        <h1 className="page-title">Documente</h1>
        <p className="small muted">
          Începe cu oferta: din ea recunoaștem ce investiție vrei să faci. Ce lipsește poți trimite și după: devine o condiție înainte de tragere, nu un motiv de respingere.
        </p>
      </header>

      {modules.loading ? <Loading label="Încarc lista de documente…" /> : null}
      <ErrorCard error={modules.error} onRetry={modules.reload} />
      <ErrorCard error={error} />

      <Group label={module ? `Recunoscut: ${module.nameRo}` : "Oferta"}>
        <ul className="card rows">
          {(module ? module.requiredDocs : [offerDoc]).map((doc) => (
            <DocRow
              key={doc.docType}
              doc={doc}
              file={fileOf(doc.docType)}
              onPick={(file) => (doc.docType === "OFFER" ? pickOffer(file) : (setFile(doc.docType, file), force((n) => n + 1)))}
              onRemove={() => (doc.docType === "OFFER" ? removeOffer() : (setFile(doc.docType, null), force((n) => n + 1)))}
            />
          ))}
        </ul>
      </Group>

      {busy === "classify" ? <Loading label="Recunoaștem investiția…" /> : null}
      {unknown ? <NoteCard icon="help">Nu am putut recunoaște investiția din ofertă. Încarcă oferta completă, cu descrierea și fișa tehnică a echipamentului.</NoteCard> : null}
      {offer && module && missingRequired.length ? (
        <NoteCard icon="clock">Mai lipsesc {missingRequired.length} documente esențiale. Le poți trimite și după: banca le cere înainte de tragere.</NoteCard>
      ) : null}
      <NoteCard icon="lock">Documentele sunt criptate, nu devin publice și sunt folosite doar pentru acest dosar. Citim din ele doar datele tehnice.</NoteCard>

      <Group label="Sau pornește un dosar demo">
        <p className="small muted">Firma și documentele lui sunt fictive; treci direct la oferte.</p>
        <div className="demo-buttons">
          {DEMO_FARMS.map((farm) => (
            <button key={farm.moduleId} type="button" className="btn btn--outline btn--small" disabled={busy !== null} onClick={() => demo(farm.moduleId)}>
              <Icon name="upload" />
              {busy === farm.moduleId ? "Se pornește…" : farm.name}
            </button>
          ))}
        </div>
      </Group>

      <Actions>
        <NextButton href="#/verde/agro/intrebari" disabled={!offer || !module}>
          Continuă
        </NextButton>
        {!offer ? <p className="small muted">Încarcă oferta sau factura proformă ca să continui.</p> : null}
      </Actions>
    </>
  );
}
