// Layout and small parts of the officer zone (README §8): a wide page of numbered panels, every figure with its source.

import { MODE_OFFICER } from "../lib/labels.js";
import { RoleSwitch } from "./live.jsx";

export function OfficerFrame({ title, subtitle, children }) {
  return (
    <div className="officer">
      <header className="officer-head">
        <div>
          <p className="eyebrow">Raiffeisen · zona ofițerului (prototip, date fictive)</p>
          <h1 className="officer-title">{title}</h1>
          {subtitle ? <p className="small muted">{subtitle}</p> : null}
        </div>
        <div className="officer-nav">
          <RoleSwitch role="officer" />
          <a className="link" href="#/firma">
            Înapoi la aplicația firmei
          </a>
        </div>
      </header>
      <main className="officer-main">{children}</main>
    </div>
  );
}

export function Panel({ n, title, aside, children, wide }) {
  return (
    <section className={`card panel${wide ? " panel--wide" : ""}`} aria-label={`${n}. ${title}`}>
      <div className="panel-head">
        <h2 className="panel-title">
          <span className="panel-n">{n}</span>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

const TONES = { ok: "badge-tag is-ok", warn: "badge-tag is-warn", bad: "badge-tag is-bad", info: "badge-tag" };

export function Tag({ tone = "info", children, title }) {
  return (
    <span className={TONES[tone]} title={title}>
      {children}
    </span>
  );
}

// LIVE / CACHE / GOLDEN / MOCK: where the data or the agent output came from.
export function SourceTag({ mode }) {
  if (!mode) return null;
  const tone = mode === "LIVE" ? "ok" : mode === "MOCK" ? "info" : "warn";
  return <Tag tone={tone}>{MODE_OFFICER[mode] ?? mode}</Tag>;
}

// A figure with its formula and source, the way the officer verifies it.
export function CalcLine({ calc }) {
  if (!calc) return null;
  return (
    <div className="calc-line">
      <span className="calc-label">{calc.labelRo}</span>
      <b className="num calc-value">{calc.display}</b>
      {calc.formula ? <span className="calc-formula small muted">= {calc.formula}</span> : null}
      {calc.sourceRo ? <span className="calc-source small muted">sursa: {calc.sourceRo}</span> : null}
    </div>
  );
}

export function KeyValues({ rows }) {
  return (
    <dl className="kv">
      {rows
        .filter(Boolean)
        .map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
    </dl>
  );
}
