// Pieces shared by the screens that talk to the backend: loading and error states, the footer actions of a step,
// the SME / officer switch, the parcel map (Leaflet on satellite tiles) and the repayment chart (SVG).

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { MAP_TILES, MARKER_MAX_ZOOM, PARCELS_ATTRIBUTION, ROMANIA_BOUNDS } from "../lib/geo.js";
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

const RISK_VAR = { LOW: "--sand", MEDIUM: "--yellow-soft", HIGH: "--yellow" };

function cssColor(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

// The parcels of a farm (GeoJSON from GET /api/farms) on a satellite map. `selected` is a Set of parcel ids; `onToggle`
// makes the polygons clickable. `risk` fills them by drought risk; Natura 2000 parcels get a dashed outline.
export function GeoMap({ collection, selected, onToggle, risk = false, height = 240, caption }) {
  const box = useRef(null);
  const view = useRef(null);
  const props = useRef({});
  props.current = { selected, onToggle, risk };

  const style = (feature) => {
    const { selected: chosen, risk: byRisk } = props.current;
    const on = !chosen || chosen.has(feature.id);
    const yellow = cssColor("--yellow", "#fee600");
    return {
      color: on ? yellow : "#ffffff",
      weight: on ? 3 : 2,
      opacity: 1,
      dashArray: feature.properties.natura2000 ? "6 5" : null,
      fillColor: byRisk ? cssColor(RISK_VAR[feature.properties.droughtRisk], yellow) : yellow,
      fillOpacity: byRisk ? 0.55 : on ? 0.3 : 0.05,
    };
  };

  // fitBounds on a hidden map picks a wrong zoom, so the fit waits until the map has a size
  const fitWhenShown = (fit) => {
    if (!view.current) return;
    if (box.current?.clientHeight) fit();
    else view.current.pending = fit;
  };
  const fitParcels = () =>
    fitWhenShown(() => {
      const { map, layer } = view.current;
      if (layer?.getLayers().length) map.fitBounds(layer.getBounds(), { padding: [20, 20], maxZoom: 16 });
    });
  const fitRomania = () => fitWhenShown(() => view.current.map.fitBounds(ROMANIA_BOUNDS));

  useEffect(() => {
    // start over Romania, so the map has a view even while hidden; the parcels refit it right after
    const map = L.map(box.current, { scrollWheelZoom: false, zoomSnap: 0.5 }).setView(L.latLngBounds(ROMANIA_BOUNDS).getCenter(), 6);
    MAP_TILES.forEach((t) => L.tileLayer(t.url, { attribution: t.attribution, maxZoom: 19, maxNativeZoom: 18 }).addTo(map));
    map.attributionControl.addAttribution(PARCELS_ATTRIBUTION);
    // the page scrolls with the wheel until the map is clicked or focused
    map.on("focus", () => map.scrollWheelZoom.enable());
    map.on("blur", () => map.scrollWheelZoom.disable());
    view.current = { map, layer: null, marker: null, pending: null };
    // a map inside a folded panel has no size: redraw it, and do the pending fit, once it shows
    const resize = new ResizeObserver(() => {
      if (!box.current?.clientHeight || !view.current) return;
      map.invalidateSize();
      const fit = view.current.pending;
      view.current.pending = null;
      fit?.();
    });
    resize.observe(box.current);
    return () => {
      resize.disconnect();
      map.remove();
      view.current = null;
    };
  }, []);

  useEffect(() => {
    const current = view.current;
    if (!current) return undefined;
    const { map } = current;
    const layer = L.geoJSON(collection, {
      style,
      onEachFeature: (feature, path) => {
        const p = feature.properties;
        path.bindTooltip(`${p.parcelId} · ${p.crop} · ${p.areaHa} ha`, { sticky: true, className: "map-tip" });
        path.on("click", () => props.current.onToggle?.(feature.id));
      },
    }).addTo(map);
    const marker = layer.getLayers().length
      ? L.circleMarker(layer.getBounds().getCenter(), { radius: 8, weight: 3, color: "#ffffff", fillColor: cssColor("--yellow", "#fee600"), fillOpacity: 1 })
      : null;
    const showMarker = () => {
      if (!marker) return;
      if (map.getZoom() <= MARKER_MAX_ZOOM) marker.addTo(map);
      else marker.remove();
    };
    map.on("zoomend", showMarker);
    Object.assign(current, { layer, marker });
    if (layer.getLayers().length) fitParcels();
    else fitRomania();
    showMarker();
    return () => {
      map.off("zoomend", showMarker);
      layer.remove();
      marker?.remove();
    };
  }, [collection]);

  useEffect(() => {
    view.current?.layer?.setStyle(style);
  }, [selected, risk]);

  const label = collection.features
    .map((f) => {
      const p = f.properties;
      return `${p.parcelId} ${p.crop}, ${p.areaHa} ha${selected?.has(f.id) ? ", selected" : ""}, drought risk ${RISK_RO[p.droughtRisk]}`;
    })
    .join("; ");
  return (
    <figure className="card parcel-map">
      <div className="map-frame">
        <div ref={box} className={`map-box${onToggle ? " is-click" : ""}`} style={{ height }} role="region" aria-label={`Parcel map: ${label}.`} />
        <div className="map-tools">
          <button type="button" className="map-tool" onClick={fitParcels}>
            My parcels
          </button>
          <button type="button" className="map-tool" onClick={fitRomania}>
            Romania
          </button>
        </div>
      </div>
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
