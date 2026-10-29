// Layout and small parts of the officer zone (README §8): a wide page of numbered panels, every figure with its source.

import { createContext, useContext, useEffect, useState } from "react";

import { MODE_OFFICER } from "../lib/labels.js";
import { Icon } from "./icons.jsx";
import { RoleSwitch } from "./live.jsx";

// Which panels are folded, per page ("home:1", "dossier:4"), kept for the browser session.
const PANELS_KEY = "greenstruct.officer.panels";
const PanelsContext = createContext(null);

function storedPanels() {
  try {
    return JSON.parse(window.sessionStorage.getItem(PANELS_KEY)) ?? {};
  } catch {
    return {};
  }
}

function usePanels(page) {
  const [collapsed, setCollapsed] = useState(storedPanels);
  const [keys, setKeys] = useState([]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(PANELS_KEY, JSON.stringify(collapsed));
    } catch {
      // storage full or blocked: the panels still fold, only for this page view
    }
  }, [collapsed]);

  const keyOf = (n) => `${page}:${n}`;
  const register = (n) => {
    setKeys((list) => (list.includes(keyOf(n)) ? list : [...list, keyOf(n)]));
    return () => setKeys((list) => list.filter((k) => k !== keyOf(n)));
  };
  const isCollapsed = (n) => Boolean(collapsed[keyOf(n)]);
  const toggle = (n) => setCollapsed((c) => ({ ...c, [keyOf(n)]: !c[keyOf(n)] }));
  const anyOpen = keys.some((k) => !collapsed[k]);
  const setAll = (value) => setCollapsed((c) => ({ ...c, ...Object.fromEntries(keys.map((k) => [k, value])) }));
  return { register, isCollapsed, toggle, anyOpen, setAll, count: keys.length };
}

export function OfficerFrame({ title, subtitle, page = "page", children }) {
  const panels = usePanels(page);
  return (
    <PanelsContext.Provider value={panels}>
      <OfficerLayout title={title} subtitle={subtitle} panels={panels}>
        {children}
      </OfficerLayout>
    </PanelsContext.Provider>
  );
}

function OfficerLayout({ title, subtitle, panels, children }) {
  return (
    <div className="officer">
      <header className="officer-head">
        <div>
          <p className="eyebrow">Raiffeisen · officer zone (prototype, fictional data)</p>
          <h1 className="officer-title">{title}</h1>
          {subtitle ? <p className="small muted">{subtitle}</p> : null}
        </div>
        <div className="officer-nav">
          <RoleSwitch role="officer" />
          <a className="link" href="#/firma">
            Back to the company app
          </a>
          {panels.count ? (
            <button type="button" className="btn btn--outline btn--small" onClick={() => panels.setAll(panels.anyOpen)}>
              {panels.anyOpen ? "Collapse all" : "Expand all"}
            </button>
          ) : null}
        </div>
      </header>
      <main className="officer-main">{children}</main>
    </div>
  );
}

// A numbered panel; inside an OfficerFrame its title folds and unfolds it. `aside` stays outside the toggle, so its
// tags show while folded and its buttons do not fold the panel.
export function Panel({ n, title, aside, children, wide }) {
  const panels = useContext(PanelsContext);
  useEffect(() => panels?.register(n), [n]);
  const closed = panels?.isCollapsed(n) ?? false;
  const bodyId = `panel-body-${n}`;
  const heading = (
    <>
      <span className="panel-n">{n}</span>
      {title}
    </>
  );
  return (
    <section className={`card panel${wide ? " panel--wide" : ""}${closed ? " is-collapsed" : ""}`} aria-label={`${n}. ${title}`}>
      <div className="panel-head">
        <h2 className="panel-title">
          {panels ? (
            <button type="button" className="panel-toggle" aria-expanded={!closed} aria-controls={bodyId} onClick={() => panels.toggle(n)}>
              {heading}
              <Icon name="chevron" className="panel-chevron" />
            </button>
          ) : (
            heading
          )}
        </h2>
        {aside}
      </div>
      <div id={bodyId} className="panel-body" hidden={closed}>
        {children}
      </div>
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
      {calc.sourceRo ? <span className="calc-source small muted">source: {calc.sourceRo}</span> : null}
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
