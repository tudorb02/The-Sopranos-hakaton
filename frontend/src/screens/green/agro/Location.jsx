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
  if (p.droughtRisk !== "LOW") flags.push({ text: `risc de secetă ${RISK_RO[p.droughtRisk]}`, warn: p.droughtRisk === "HIGH" });
  if (p.waterStress !== "LOW") flags.push({ text: `lipsă de apă ${RISK_RO[p.waterStress]}`, warn: p.waterStress === "HIGH" });
  if (p.hailRisk === "HIGH") flags.push({ text: "risc de grindină mare", warn: true });
  if (p.floodRisk === "HIGH") flags.push({ text: "risc de inundație mare", warn: true });
  if (p.natura2000) flags.push({ text: "zonă Natura 2000", warn: true });
  if (p.nitrateVulnerable) flags.push({ text: "zonă vulnerabilă la nitrați", warn: true });
  return flags;
}

export function Location() {
  const flow = useFlow();
  const farm = useFarm(flow.cui);

  if (!flow.cui) {
    return <Missing href="#/verde/agro/firma" label="Alege firma">Mai întâi alege firma.</Missing>;
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
        <h1 className="page-title">Unde va fi investiția?</h1>
        <p className="small muted">Bifează parcelele din APIA unde va fi investiția. Atinge o parcelă pe hartă sau în listă.</p>
      </header>

      {farm.loading ? <Loading label="Încarc parcelele…" /> : null}
      <ErrorCard error={farm.error} onRetry={farm.reload} />

      {farm.data ? (
        <>
          <GeoMap
            collection={farm.data.parcels}
            selected={selected}
            onToggle={toggle}
            caption={`${selected.size} din ${features.length} parcele alese · harta merge și fără internet`}
          />

          <Group label="Parcelele tale">
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
                            <span className="status is-on">fără probleme văzute pe hartă</span>
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
            Pe hartă am verificat secetă, lipsa de apă, grindină, inundații, zonele Natura 2000 și cele vulnerabile la nitrați.{" "}
            {drought ? `${drought} parcele au risc mare de secetă. ` : ""}
            {natura ? `${natura} sunt în zone Natura 2000, unde poate fi nevoie de un aviz de mediu. ` : ""}
            {nitrate ? `${nitrate} sunt în zone vulnerabile la nitrați. ` : ""}
            {!drought && !natura && !nitrate ? "Nu am găsit probleme majore." : ""}
          </NoteCard>
        </>
      ) : null}

      <Actions>
        <NextButton href="#/verde/agro/documente" disabled={!farm.data || selected.size === 0}>
          Continuă
        </NextButton>
      </Actions>
    </>
  );
}
