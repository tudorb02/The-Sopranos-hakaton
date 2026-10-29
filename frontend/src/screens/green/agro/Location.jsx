// Step 3: where. The parcels of the farm (APIA, GeoJSON) on an SVG map that works offline, with the risk flags.

import { Actions, ErrorCard, GeoMap, Loading, NextButton } from "../../../components/live.jsx";
import { Group, NoteCard } from "../../../components/ui.jsx";
import { ha } from "../../../lib/format.js";
import { useFarm } from "../../../lib/hooks.js";
import { RISK_RO } from "../../../lib/labels.js";
import { patchFlow, useFlow } from "../../../lib/session.js";
import { Missing } from "./shared.jsx";

// The flags of a parcel as short plain phrases.
export function parcelFlags(p) {
  const flags = [];
  if (p.droughtRisk !== "LOW") flags.push({ text: `${RISK_RO[p.droughtRisk]} drought risk`, warn: p.droughtRisk === "HIGH" });
  if (p.waterStress !== "LOW") flags.push({ text: `${RISK_RO[p.waterStress]} water stress`, warn: p.waterStress === "HIGH" });
  if (p.hailRisk === "HIGH") flags.push({ text: "high hail risk", warn: true });
  if (p.floodRisk === "HIGH") flags.push({ text: "high flood risk", warn: true });
  if (p.natura2000) flags.push({ text: "Natura 2000 area", warn: true });
  if (p.nitrateVulnerable) flags.push({ text: "nitrate vulnerable zone", warn: true });
  return flags;
}

export function Location() {
  const flow = useFlow();
  const farm = useFarm(flow.cui);

  if (!flow.cui) {
    return <Missing href="#/verde/agro/firma" label="Choose the company">Choose the company first.</Missing>;
  }
  const features = farm.data?.parcels.features ?? [];
  // by default every parcel is chosen
  const selected = new Set(flow.parcelIds ?? features.map((f) => f.id));
  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    patchFlow({ parcelIds: [...next] });
  };

  const natura = features.filter((f) => f.properties.natura2000).length;
  const nitrate = features.filter((f) => f.properties.nitrateVulnerable).length;
  const drought = features.filter((f) => f.properties.droughtRisk === "HIGH").length;

  return (
    <>
      <header className="intro">
        <h1 className="page-title">Where will the investment be?</h1>
        <p className="small muted">Tick the APIA parcels where the investment will be. Tap a parcel on the map or in the list.</p>
      </header>

      {farm.loading ? <Loading label="Loading the parcels…" /> : null}
      <ErrorCard error={farm.error} onRetry={farm.reload} />

      {farm.data ? (
        <>
          <GeoMap
            collection={farm.data.parcels}
            selected={selected}
            onToggle={toggle}
            caption={`${selected.size} of ${features.length} parcels selected · the map also works offline`}
          />

          <Group label="Your parcels">
            <ul className="card rows">
              {features.map((f) => {
                const flags = parcelFlags(f.properties);
                return (
                  <li key={f.id}>
                    <label className="row parcel-row">
                      <input type="checkbox" className="check" checked={selected.has(f.id)} onChange={() => toggle(f.id)} />
                      <span className="row-main">
                        <span className="row-name">
                          {f.properties.parcelId} · {f.properties.crop}
                        </span>
                        <span className="flag-list">
                          {flags.length ? (
                            flags.map((flag) => (
                              <span key={flag.text} className={flag.warn ? "status status--warn" : "status"}>
                                {flag.text}
                              </span>
                            ))
                          ) : (
                            <span className="status is-on">no issues seen on the map</span>
                          )}
                        </span>
                      </span>
                      <span className="row-value num">{ha(f.properties.areaHa)}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </Group>

          <NoteCard icon="leaf">
            On the map we checked drought, water stress, hail, floods, Natura 2000 areas and nitrate vulnerable zones.{" "}
            {drought ? `${drought} parcels have a high drought risk. ` : ""}
            {natura ? `${natura} are in Natura 2000 areas, where an environmental opinion may be needed. ` : ""}
            {nitrate ? `${nitrate} are in nitrate vulnerable zones. ` : ""}
            {!drought && !natura && !nitrate ? "We found no major issues." : ""}
          </NoteCard>
        </>
      ) : null}

      <Actions>
        <NextButton href="#/verde/agro/documente" disabled={!farm.data || selected.size === 0}>
          Continue
        </NextButton>
      </Actions>
    </>
  );
}
