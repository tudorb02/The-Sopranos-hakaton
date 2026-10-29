// Pieces shared by the screens that talk to the backend: loading and error states, the footer actions of a step,
// the SME / officer switch and the SVG charts (parcels and repayment calendar), all drawn without any tile or library.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { projectParcels } from "../lib/geo.js";
import { MONTHS_RO, periodMonth, RISK_RO } from "../lib/labels.js";
import { currentRunId } from "../lib/session.js";
import { Icon } from "./icons.jsx";

export function Loading({ label = "Loading…" }) {
  return (
    <p className="loading" role="status">
      <span className="state state--running" aria-hidden="true" />
      {label}
    </p>
  );
}

// An API error in plain words, with the way out. `error` is an ApiError (lib/api.js).
export function ErrorCard({ error, onRetry, retryLabel = "Try again", children }) {
  if (!error) return null;
  const offline = error.code === "NETWORK" || error.code === "UNAVAILABLE";
  return (
    <div className="card error-card" role="alert">
      <Icon name="shield" />
      <div>
        <p className="row-name">{offline ? "The server is not responding" : "That did not work"}</p>
        <p className="small">{error.message}</p>
        {error.details?.length ? (
          <ul className="small error-details">
            {error.details.map((d) => (
              <li key={`${d.field}:${d.message}`}>{d.message}</li>
            ))}
          </ul>
        ) : null}
        <div className="btn-row">
          {onRetry ? (
            <button type="button" className="btn btn--outline btn--small" onClick={onRetry}>
              {retryLabel}
            </button>
          ) : null}
          {children}
        </div>
      </div>
    </div>
  );
}

// The actions of a step live in the footer of the flow frame (App.jsx renders <div id="green-actions">); the screen
// decides what they do, so it renders them here into that slot.
export function Actions({ children }) {
  const [slot, setSlot] = useState(() => document.getElementById("green-actions"));
  useEffect(() => {
    setSlot(document.getElementById("green-actions"));
  }, []);
  return slot ? createPortal(children, slot) : null;
}

// A footer button that moves to the next screen; `onClick` may be async and cancel the move by returning false.
export function NextButton({ href, onClick, disabled, busy, children, variant }) {
  const go = async () => {
    if (onClick && (await onClick()) === false) return;
    if (href) window.location.hash = href.replace(/^#/, "");
  };
  return (
    <button type="button" className={`btn btn--block${variant ? ` btn--${variant}` : ""}`} disabled={disabled || busy} onClick={go}>
      {busy ? "Sending…" : children}
    </button>
  );
}

// One person plays both roles: the switch keeps the dossier id (sessionStorage) and moves between the two zones.
export function RoleSwitch({ role }) {
  const runId = currentRunId();
  const imm = runId ? "#/verde/agro/dosar" : "#/verde/agro";
  const officer = runId ? `#/ofiter/dosar/${runId}` : "#/ofiter";
  return (
    <nav className="role-switch" aria-label="Your role in the demo">
      <a href={imm} aria-current={role === "imm" ? "page" : undefined}>
        SME
      </a>
      <a href={officer} aria-current={role === "officer" ? "page" : undefined}>
        Officer
      </a>
      {runId ? <span className="small muted num">{runId}</span> : null}
    </nav>
  );
}

const RISK_FILL = { LOW: "var(--sand)", MEDIUM: "var(--yellow-soft)", HIGH: "var(--yellow)" };

// The parcels of a farm (GeoJSON from GET /api/farms) as SVG. `selected` is a Set of parcel ids; `onToggle` makes the
// polygons clickable. `risk` colours them by drought risk and draws a dashed outline for Natura 2000.
export function GeoMap({ collection, selected, onToggle, risk = false, height = 190, caption }) {
  const parcels = projectParcels(collection, 320, height);
  const label = parcels
    .map((p) => `${p.props.parcelId} ${p.props.crop}, ${p.props.areaHa} ha${selected?.has(p.id) ? ", selected" : ""}, drought risk ${RISK_RO[p.props.droughtRisk]}`)
    .join("; ");
  return (
    <figure className="card parcel-map">
      <svg viewBox={`0 0 320 ${height}`} role="img" aria-label={`Parcel map: ${label}.`}>
        {parcels.map((p) => {
          const on = !selected || selected.has(p.id);
          const classes = ["parcel", on ? "is-selected" : "", p.props.natura2000 ? "is-natura" : "", onToggle ? "is-click" : ""].filter(Boolean).join(" ");
          return (
            <g
              key={p.id}
              className={classes}
              onClick={onToggle ? () => onToggle(p.id) : undefined}
              style={risk ? { "--risk-fill": RISK_FILL[p.props.droughtRisk] } : undefined}
            >
              <path d={p.path} />
              <text x={p.center[0]} y={p.center[1]} textAnchor="middle">
                {p.props.parcelId.split("_").slice(-1)[0]}
              </text>
              <text className="parcel-ha" x={p.center[0]} y={p.center[1] + 11} textAnchor="middle">
                {p.props.areaHa} ha
              </text>
            </g>
          );
        })}
      </svg>
      {caption ? <figcaption className="small muted">{caption}</figcaption> : null}
    </figure>
  );
}

// The repayment calendar: one bar per month of the green credit (from the schedule calc series), a dashed line at the
// classic credit's equal instalment. Bars are only scaled here; the figures in words come from the calcs' `display`.
export function RepaymentChart({ green, classic, months = 12, ariaLabel }) {
  const rows = (green ?? []).slice(0, months);
  const line = classic?.[classic.length > 1 ? 1 : 0]?.values.payment ?? 0;
  const max = Math.max(1, line, ...rows.map((r) => r.values.payment));
  const w = 320;
  const h = 120;
  const slot = w / rows.length;
  const y = (v) => h - (v / max) * h;
  return (
    <figure className="payments">
      <svg viewBox={`0 0 ${w} ${h + 18}`} role="img" aria-label={ariaLabel} className="repay-chart">
        {rows.map((r, i) => (
          <g key={r.period}>
            {r.values.payment > 0 ? (
              <rect className="repay-bar" x={i * slot + 3} y={y(r.values.payment)} width={slot - 6} height={h - y(r.values.payment)} rx="3" />
            ) : (
              <rect className="repay-bar is-zero" x={i * slot + 3} y={h - 2} width={slot - 6} height="2" />
            )}
            <text x={i * slot + slot / 2} y={h + 13} textAnchor="middle" className={r.values.payment > 0 ? "is-on" : undefined}>
              {periodMonth(r.period)}
            </text>
          </g>
        ))}
        {line > 0 ? <line className="repay-line" x1="0" x2={w} y1={y(line)} y2={y(line)} /> : null}
      </svg>
    </figure>
  );
}

export const monthsText = (months) => (months ?? []).map((m) => MONTHS_RO[m]).join(", ");
