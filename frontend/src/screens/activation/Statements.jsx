// Statement sources for the coach: import from the current account, or attach earlier statements.
// Used in the activation flow and from Profil → Extrasele tale.

import { Icon } from "../../components/icons.jsx";
import { Field, Group, IconTile, Meter, NoteCard } from "../../components/ui.jsx";
import { statements } from "../../data/activation.js";

export function Statements() {
  return (
    <>
      <header className="intro">
        <h1 className="page-title">Extrasele tale de cont</h1>
        <p className="small muted">{statements.lead}</p>
      </header>

      <Group label="Din contul curent">
        <div className="card stack">
          <div className="row row--flush">
            <IconTile icon="card" tone="yellow" />
            <div className="row-main">
              <span className="row-name">{statements.account.name}</span>
              <span className="row-note num">{statements.account.iban}</span>
            </div>
            <span className="status is-on">Selectat</span>
          </div>
          <Field field={{ label: "Perioada", type: "select", value: statements.periods[0], options: statements.periods }} />
          <button type="button" className="btn btn--block">
            Importă extrasele
          </button>
          <div className="row row--flush done-row">
            <span className="state state--done" aria-hidden="true">
              <Icon name="check" />
            </span>
            <div className="row-main">
              <span className="row-name">{statements.imported.title}</span>
              <span className="row-note">{statements.imported.meta}</span>
            </div>
          </div>
        </div>
      </Group>

      <Group label="Atașează extrase anterioare">
        <p className="small muted group-hint">{statements.attachHint}</p>
        <label className="dropzone">
          <IconTile icon="upload" tone="yellow" />
          <span className="row-name">Alege fișierele</span>
          <span className="small muted">{statements.formats}</span>
          <input type="file" className="sr-only" accept=".pdf,.xls,.xlsx,.csv" multiple />
        </label>
        <ul className="card rows">
          {statements.files.map((file) => (
            <li key={file.name} className="row">
              <IconTile icon="file" tone="sand" />
              <div className="row-main">
                <span className="row-name file-name">{file.name}</span>
                <span className="row-note">{file.meta}</span>
              </div>
              <span className={file.state === "done" ? "status is-on" : "status"}>{file.state === "done" ? "Procesat" : "Se procesează"}</span>
              {file.state === "reading" ? <Meter value={file.progress} max={100} /> : null}
            </li>
          ))}
        </ul>
      </Group>

      <Group label="Cum exporți un extras de la altă bancă">
        <ol className="card steps">
          {statements.howTo.map((step, i) => (
            <li key={step}>
              <span className="step-num">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </Group>

      <NoteCard icon="lock">{statements.privacy}</NoteCard>
    </>
  );
}
