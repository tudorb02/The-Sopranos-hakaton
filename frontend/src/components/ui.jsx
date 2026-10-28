import { useId } from "react";

import { lei, num, pct } from "../lib/format.js";
import { Icon } from "./icons.jsx";

const SOURCE_LABELS = { obs: "observat", said: "spus", agreed: "stabilit", est: "estimat" };

// Where a line comes from: observed in transactions, said by the client, agreed together, or estimated.
export function Src({ kind, label }) {
  return <span className={`src src-${kind}`}>{label ?? SOURCE_LABELS[kind]}</span>;
}

// Section title outside the card, as in the app's "Produse favorite · Vezi toate".
export function Section({ title, aside, children }) {
  const id = useId();
  return (
    <section className="section" aria-labelledby={id}>
      <div className="section-head">
        <h2 id={id} className="section-title">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

// Amount in the app's style: the integer large, ",00 lei" small.
export function Amount({ value, size = "lg" }) {
  return (
    <span className={`amount amount--${size}`}>
      <span className="amount-int">{num(value)}</span>
      <span className="amount-dec">,00 lei</span>
    </span>
  );
}

export function IconTile({ icon, tone }) {
  return (
    <span className={tone ? `tile tile--${tone}` : "tile"}>
      <Icon name={icon} />
    </span>
  );
}

// Square shortcuts under a card's main figure; the first one is the main action.
// On a yellow card the main tile is ink instead of yellow.
export function QuickActions({ items, primaryTone = "yellow" }) {
  return (
    <ul className="quick">
      {items.map((item, i) => (
        <li key={item.label}>
          <a href={item.href}>
            <IconTile icon={item.icon} tone={i === 0 ? primaryTone : undefined} />
            <span>{item.label}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

// A message or a question from the coach: icon, bold title, text, optional extra content.
export function InfoCard({ icon, title, meta, text, children }) {
  return (
    <section className="card info" aria-label={title}>
      <IconTile icon={icon} tone="yellow" />
      <div className="info-body">
        {meta ? <p className="info-meta">{meta}</p> : null}
        <p className="info-title">{title}</p>
        {text ? <p className="info-text">{text}</p> : null}
      </div>
      {children ? <div className="info-extra">{children}</div> : null}
    </section>
  );
}

export function Meter({ value, max, tone }) {
  return (
    <div className={tone ? `meter is-${tone}` : "meter"} aria-hidden="true">
      <span style={{ "--p": pct(value, max) }} />
    </div>
  );
}

export function Dots({ used, max }) {
  return (
    <span className="dots" role="img" aria-label={`${used} din ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <i key={i} className={i < used ? undefined : "is-empty"} />
      ))}
    </span>
  );
}

// kind: "count", "amount", "pause" or "protected" (see data/demo.js).
export function BudgetRow({ budget }) {
  const { name, hint, icon, kind, note, warn } = budget;
  return (
    <li className="row row--budget">
      <IconTile icon={icon} tone="sand" />
      <span className="row-name">{name}</span>
      <span className="row-note">
        {hint ? <span className="row-hint">{hint} · </span> : null}
        <span className={warn ? "is-warn" : undefined}>{note}</span>
      </span>
      {kind === "count" ? <Dots used={budget.used} max={budget.max} /> : null}
      {kind === "amount" ? (
        <span className="row-value">
          {num(budget.spent)}
          <span className="of"> / {lei(budget.limit)}</span>
        </span>
      ) : null}
      {kind === "protected" ? <span className="row-value">{lei(budget.spent)}</span> : null}
      {kind === "pause" ? <span className="row-value">0 lei</span> : null}
      {kind === "amount" ? <Meter value={budget.spent} max={budget.limit} tone={warn ? "warn" : undefined} /> : null}
    </li>
  );
}

// A simple list row: icon, name with an optional note, value on the right.
export function ValueRow({ icon, name, note, value }) {
  return (
    <li className="row">
      {icon ? <IconTile icon={icon} tone="sand" /> : null}
      <div className="row-main">
        <span className="row-name">{name}</span>
        {note ? <span className="row-note">{note}</span> : null}
      </div>
      <span className="row-value">{value}</span>
    </li>
  );
}

// Uppercase label above a card, like the app's form groups ("CONT SURSĂ").
export function Group({ label, action, children }) {
  const id = useId();
  return (
    <section className="group" aria-labelledby={id}>
      <div className="group-head">
        <h2 id={id} className="group-label">
          {label}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Facts({ items }) {
  return (
    <ul className="card facts">
      {items.map((item) => (
        <li key={item.label ?? item.text}>
          {item.label ? <span className="fact-label">{item.label}</span> : null}
          <span className="fact-value">
            {item.value ?? item.text}
            {item.quote ? <span className="quote"> „{item.quote}”</span> : null}
          </span>
          {item.src ? <Src kind={item.src} /> : null}
        </li>
      ))}
    </ul>
  );
}

export function Agenda({ items }) {
  return (
    <ol className="agenda">
      {items.map((item) => (
        <li key={`${item.day}-${item.month}`}>
          <p className="date">
            <b>{item.day}</b>
            <span>{item.month}</span>
          </p>
          <div>
            <p className="agenda-title">{item.title}</p>
            <p className="small muted">{item.note}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

// Answer chips; `selected` options are shown as chosen (aria-pressed), nothing is stored.
export function ChoiceChips({ label, options }) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.label} type="button" className="chip" aria-pressed={option.selected ? "true" : "false"}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

// What a permission gives the coach (check) and what it never does (lock).
export function Ticks({ yes = [], no = [] }) {
  return (
    <ul className="card ticks">
      {yes.map((text) => (
        <li key={text}>
          <Icon name="check" />
          <span>{text}</span>
        </li>
      ))}
      {no.map((text) => (
        <li key={text} className="is-no">
          <Icon name="lock" />
          <span>{text}</span>
        </li>
      ))}
    </ul>
  );
}

// The official notice on advice and data (see data/legal.js), as a full card.
export function Disclaimer({ legal, link = false }) {
  const id = useId();
  return (
    <section className="card disclaimer" aria-labelledby={id}>
      <div className="disclaimer-head">
        <IconTile icon="shield" tone="ink" />
        <div>
          <p className="eyebrow">{legal.eyebrow}</p>
          <h2 id={id} className="card-title">
            {legal.title}
          </h2>
        </div>
      </div>
      <ul className="disclaimer-list">
        {legal.items.map((item) => (
          <li key={item.text}>
            <Icon name={item.icon} />
            <span>{item.text}</span>
          </li>
        ))}
      </ul>
      {link ? (
        <a className="link" href="#/informare">
          Citește informarea completă
        </a>
      ) : null}
    </section>
  );
}

// The same notice in one line, kept in view on every coach page.
export function DisclaimerStrip({ legal, className }) {
  return (
    <p className={className ? `disclaimer-strip ${className}` : "disclaimer-strip"}>
      <Icon name="lock" />
      <span>{legal.strip}</span>
      <a className="link" href="#/informare">
        Detalii
      </a>
    </p>
  );
}

export function NoteCard({ icon, children }) {
  return (
    <div className="card note-card">
      <Icon name={icon} />
      <p className="small">{children}</p>
    </div>
  );
}

// type: "text" (default), "textarea", "select" or "time"; values are examples only.
export function Field({ field }) {
  const id = useId();
  let control;
  if (field.type === "textarea") {
    control = <textarea id={id} rows={3} defaultValue={field.value} placeholder={field.placeholder} />;
  } else if (field.type === "select") {
    control = (
      <select id={id} defaultValue={field.value}>
        {field.options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    );
  } else {
    control = (
      <input
        id={id}
        type={field.type ?? "text"}
        defaultValue={field.value}
        placeholder={field.placeholder}
        inputMode={field.numeric ? "numeric" : undefined}
      />
    );
  }
  return (
    <div className="field">
      <label htmlFor={id}>{field.label}</label>
      <div className={`input${field.type === "textarea" ? " input--area" : ""}${field.type === "select" ? " input--select" : ""}`}>
        {control}
        {field.suffix ? <span className="suffix">{field.suffix}</span> : null}
      </div>
    </div>
  );
}

export function Switch({ label, hint, defaultChecked }) {
  const id = useId();
  return (
    <div className="switch-row">
      <label htmlFor={id}>
        <span>{label}</span>
        {hint ? <span className="small muted">{hint}</span> : null}
      </label>
      <input id={id} className="switch" type="checkbox" role="switch" defaultChecked={defaultChecked} />
    </div>
  );
}
