// Pieces of the green-credit flow for businesses, shared by every area (design/pj-greenstruct.md §9).

import { num, pct } from "../lib/format.js";
import { Icon } from "./icons.jsx";
import { IconTile, Src } from "./ui.jsx";

// Where a company figure comes from: "din ANAF", "din APIA"; without a source, the client fills it in.
export function From({ source }) {
  return source ? <Src kind="obs" label={`din ${source}`} /> : <Src kind="said" label="completat de tine" />;
}

// An area of the platform: available (opens its flow) or coming soon (greyed, no action).
export function SectorCard({ sector }) {
  const available = sector.status === "available";
  const body = (
    <>
      <IconTile icon={sector.icon} tone={available ? "yellow" : "sand"} />
      <span className="row-main">
        <span className="row-name">{sector.name}</span>
        <span className="row-note">{sector.text}</span>
      </span>
      {available ? <Icon name="chevron" className="chevron" /> : <span className="status">În curând</span>}
    </>
  );
  return available ? (
    <a className="card row sector" href={sector.href}>
      {body}
    </a>
  ) : (
    <div className="card row sector is-soon">{body}</div>
  );
}

// A type of investment; the chosen one is shown as pressed.
export function ModuleCard({ module, selected }) {
  return (
    <button type="button" className="module-card" aria-pressed={selected ? "true" : "false"}>
      <IconTile icon={module.icon} tone={selected ? "yellow" : "sand"} />
      <span className="row-name">{module.name}</span>
      <span className="row-note">{module.example}</span>
    </button>
  );
}

const DOC_STATES = {
  done: { label: "Încărcat", className: "status is-on" },
  ready: { label: "Gata", className: "status is-on" },
  missing: { label: "Lipsește", className: "status status--warn" },
};

// One document of the checklist; a missing one gets an upload button.
export function DocumentRow({ doc, state }) {
  const status = DOC_STATES[state?.state ?? "missing"];
  return (
    <li className="row doc-row">
      <IconTile icon="file" tone="sand" />
      <div className="row-main">
        <span className="row-name">{doc.name}</span>
        {state?.file ? <span className="row-note">{state.file}</span> : null}
        <span className={status.className}>{status.label}</span>
      </div>
      {state?.state === "missing" ? (
        <button type="button" className="btn btn--outline btn--small">
          Încarcă
        </button>
      ) : null}
    </li>
  );
}

// Standard vs green, one block per term: the label, then the two values side by side.
export function OfferCompare({ columns, rows }) {
  return (
    <div className="card compare" role="table" aria-label={`${columns[0]} și ${columns[1]}`}>
      <div className="compare-head" role="row">
        <span className="sr-only" role="columnheader">
          Ce compari
        </span>
        <span role="columnheader">{columns[0]}</span>
        <span role="columnheader" className="is-green">
          <Icon name="leaf" />
          {columns[1]}
        </span>
      </div>
      {rows.map((row) => (
        <div key={row.label} className="compare-row" role="row">
          <span className="compare-label" role="rowheader">
            {row.label}
          </span>
          <span role="cell">{row.a}</span>
          <span role="cell" className="is-green">
            {row.b}
          </span>
        </div>
      ))}
    </div>
  );
}

// A year of instalments: the green credit's bars fall in the income months, the dashed line is the
// standard credit's equal monthly instalment.
export function PaymentsChart({ payments }) {
  const paid = payments.months.filter((month) => month.eur);
  const summary = paid.map((month) => month.name).join(", ");
  return (
    <figure className="payments">
      <div
        className="payments-plot"
        role="img"
        aria-label={`Credit verde: ${num(payments.green)} EUR în ${summary}. Credit standard: ${num(payments.standard)} EUR în fiecare lună.`}
      >
        <span className="week-guide" style={{ "--p": pct(payments.standard, payments.scaleMax) }} />
        {payments.months.map((month) => (
          <span key={month.name} className="payments-bar">
            {month.eur ? <span className="payments-fill" style={{ "--p": pct(month.eur, payments.scaleMax) }} /> : null}
          </span>
        ))}
      </div>
      <ol className="payments-labels" aria-hidden="true">
        {payments.months.map((month) => (
          <li key={month.name} className={month.eur ? "is-on" : undefined} title={month.name}>
            {month.short}
          </li>
        ))}
      </ol>
      <figcaption className="small muted">
        Barele: creditul verde, {num(payments.green)} EUR în lunile cu încasări. Linia punctată: creditul standard, {num(payments.standard)} EUR în
        fiecare lună.
      </figcaption>
    </figure>
  );
}

// Where a dossier stands, as the steps of a payment in the app.
export function StatusSteps({ steps }) {
  return (
    <ol className="card rows">
      {steps.map((step) => (
        <li key={step.label} className="row">
          <span className={`state state--${step.state}`} aria-hidden="true">
            {step.state === "done" ? <Icon name="check" /> : null}
          </span>
          <div className="row-main">
            <span className="row-name">{step.label}</span>
            <span className="row-note">{step.note}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
