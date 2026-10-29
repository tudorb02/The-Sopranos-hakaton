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
      setProblem("The file is too large. Upload one of at most 5 MB.");
      return;
    }
    if (!/\.(pdf|jpe?g|png)$/i.test(chosen.name)) {
      setProblem("We accept only PDF, JPG or PNG.");
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
        <span className={file ? "status is-on" : doc.required ? "status status--warn" : "status"}>{file ? "Uploaded" : doc.required ? "Missing" : "Optional"}</span>
        {problem ? (
          <span className="small field-error" role="alert">
            {problem}
          </span>
        ) : null}
      </div>
      <input ref={input} type="file" accept={ACCEPT} hidden onChange={pick} />
      {file ? (
        <button type="button" className="btn btn--text btn--small" onClick={onRemove}>
          Remove
        </button>
      ) : (
        <button type="button" className="btn btn--outline btn--small" onClick={() => input.current?.click()}>
          Upload
        </button>
      )}
    </li>
  );
}

export function Documents() {
  const flow = useFlow();
  // only the demo dossier of the signed-in company: the demo never switches to another company
  const ownDemo = DEMO_FARMS.find((f) => f.cui === flow.cui);
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
  const offerDoc = { docType: "OFFER", labelRo: "The offer or pro forma invoice, with the technical data sheet", required: true };

  return (
    <>
      <header className="intro">
        <h1 className="page-title">Documents</h1>
        <p className="small muted">
          Start with the offer: from it we recognise the investment you want to make. You can send anything missing later: it becomes a condition precedent to drawdown, not a reason for rejection.
        </p>
      </header>

      {modules.loading ? <Loading label="Loading the list of documents…" /> : null}
      <ErrorCard error={modules.error} onRetry={modules.reload} />
      <ErrorCard error={error} />

      <Group label={module ? `Recognised: ${module.nameRo}` : "Offer"}>
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

      {busy === "classify" ? <Loading label="Recognising the investment…" /> : null}
      {unknown ? <NoteCard icon="help">We could not recognise the investment from the offer. Upload the full offer, with the description and the technical data sheet of the equipment.</NoteCard> : null}
      {offer && module && missingRequired.length ? (
        <NoteCard icon="clock">{missingRequired.length} essential documents are still missing. You can send them later: the bank asks for them before drawdown.</NoteCard>
      ) : null}
      <NoteCard icon="lock">The documents are encrypted, do not become public and are used only for this dossier. We read only the technical data from them.</NoteCard>

      {ownDemo ? (
        <Group label="Or start a demo dossier">
          <p className="small muted">The recorded demo documents of your company (fictional data); you go straight to the offers.</p>
          <div className="demo-buttons">
            <button type="button" className="btn btn--outline btn--small" disabled={busy !== null} onClick={() => demo(ownDemo.moduleId)}>
              <Icon name="upload" />
              {busy === ownDemo.moduleId ? "Starting…" : ownDemo.name}
            </button>
          </div>
        </Group>
      ) : null}

      <Actions>
        <NextButton href="#/verde/agro/intrebari" disabled={!offer || !module}>
          Continue
        </NextButton>
        {!offer ? <p className="small muted">Upload the offer or pro forma invoice to continue.</p> : null}
      </Actions>
    </>
  );
}
