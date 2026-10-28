// Step 1: the company. The CUI is looked up in the backend (GET /api/farms/{cui}); the two consents decide what we may read.

import { useId, useState } from "react";

import { Actions, ErrorCard, Loading, NextButton } from "../../../components/live.jsx";
import { Group, IconTile, NoteCard, PrivacyPromise, Src } from "../../../components/ui.jsx";
import { greenLegal } from "../../../data/green/legal.js";
import { eur, ha } from "../../../lib/format.js";
import { useFarm } from "../../../lib/hooks.js";
import { DEMO_FARMS, MONTHS_RO, SME_STATUS_RO } from "../../../lib/labels.js";
import { patchFlow, useFlow } from "../../../lib/session.js";

function ConsentSwitch({ label, hint, checked, onChange }) {
  const id = useId();
  return (
    <div className="switch-row">
      <label htmlFor={id}>
        <span>{label}</span>
        <span className="small muted">{hint}</span>
      </label>
      <input id={id} className="switch" type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </div>
  );
}

const fromSource = (source) => <Src kind="obs" label={`din ${source}`} />;

export function Company() {
  const flow = useFlow();
  const [input, setInput] = useState(flow.cui);
  const farm = useFarm(flow.cui);
  const inputId = useId();
  const profile = farm.data;

  const lookup = (cui) => {
    const clean = cui.trim().replace(/^RO/i, "");
    setInput(clean);
    // a different company starts a new request
    if (clean !== flow.cui) patchFlow({ cui: clean, moduleId: null, parcelIds: null, answers: {}, runId: null });
    else farm.reload();
  };

  const consents = flow.consents;
  const canContinue = Boolean(profile) && consents.apia;

  return (
    <>
      <header className="intro">
        <h1 className="page-title">Firma ta</h1>
        <p className="small muted">Luăm datele din registrele publice și, cu acordul tău, de la APIA și din conturi. Tu doar confirmi.</p>
      </header>

      <form
        className="card cui-form"
        onSubmit={(e) => {
          e.preventDefault();
          lookup(input);
        }}
      >
        <div className="field">
          <label htmlFor={inputId}>Codul de identificare fiscală (CUI)</label>
          <div className="input">
            <input id={inputId} inputMode="numeric" autoComplete="off" placeholder="de exemplu 45871203" value={input} onChange={(e) => setInput(e.target.value)} />
          </div>
        </div>
        <button type="submit" className="btn btn--small" disabled={!input.trim() || farm.loading}>
          Caută firma
        </button>
      </form>

      <Group label="Ferme demo (date fictive)">
        <div className="chips" role="group" aria-label="Ferme demo">
          {DEMO_FARMS.map((demo) => (
            <button key={demo.cui} type="button" className="chip" aria-pressed={flow.cui === demo.cui ? "true" : "false"} onClick={() => lookup(demo.cui)}>
              {demo.name}
            </button>
          ))}
        </div>
      </Group>

      {farm.loading && flow.cui ? <Loading label="Caut firma în registre…" /> : null}
      <ErrorCard error={farm.error} onRetry={farm.reload} />

      {profile ? (
        <>
          <section className="card" aria-label="Firma">
            <div className="row row--flush">
              <IconTile icon="bank" tone="yellow" />
              <div className="row-main">
                <span className="row-name">{profile.company.name}</span>
                <span className="row-note">
                  CUI {profile.company.cui} · {profile.company.locality ? `${profile.company.locality}, ` : ""}
                  {profile.company.county}
                </span>
              </div>
            </div>
          </section>

          <NoteCard icon={profile.company.smeStatus === "NOT_SME" ? "shield" : "check"}>{SME_STATUS_RO[profile.company.smeStatus]}</NoteCard>

          <Group label="Acordurile tale">
            <div className="card switches">
              <div className="switch-row">
                <p className="consent-fixed">
                  <span>Date publice (ANAF)</span>
                  <span className="small muted">Datele firmei și bilanțul, din registrele publice.</span>
                </p>
                <span className="status">Public</span>
              </div>
              <ConsentSwitch
                label="APIA: parcelele și culturile"
                hint="Necesar: parcelele tale vin de la APIA."
                checked={consents.apia}
                onChange={(apia) => patchFlow({ consents: { ...consents, apia } })}
              />
              <ConsentSwitch
                label="Open Banking: încasările firmei"
                hint="Din ele potrivim ratele cu lunile în care încasezi."
                checked={consents.openBanking}
                onChange={(openBanking) => patchFlow({ consents: { ...consents, openBanking } })}
              />
            </div>
            <p className="small muted group-hint">Fără Open Banking, poți răspunde tu la întrebarea despre lunile cu încasări.</p>
          </Group>

          <PrivacyPromise legal={greenLegal} href="#/verde/informare" />

          <Group label="Ce am găsit">
            <ul className="card facts">
              <li>
                <span className="fact-label">Activitate</span>
                <span className="fact-value">{profile.company.caenLabelRo}</span>
                {fromSource("ANAF")}
              </li>
              <li>
                <span className="fact-label">Angajați</span>
                <span className="fact-value num">{profile.company.employees}</span>
                {fromSource("ANAF")}
              </li>
              {profile.company.turnoverEur != null ? (
                <li>
                  <span className="fact-label">Cifra de afaceri ({profile.company.financialYear})</span>
                  <span className="fact-value num">{eur(profile.company.turnoverEur)}</span>
                  {fromSource("ANAF")}
                </li>
              ) : null}
              <li>
                <span className="fact-label">Suprafața fermei</span>
                <span className="fact-value num">
                  {ha(profile.farm.totalHa)}, {profile.parcels.features.length} parcele
                </span>
                {fromSource("APIA")}
              </li>
              {profile.cashflow.peakMonths.length ? (
                <li>
                  <span className="fact-label">Luni cu încasări mari</span>
                  <span className="fact-value">{profile.cashflow.peakMonths.map((m) => MONTHS_RO[m]).join(", ")}</span>
                  {fromSource("Open Banking")}
                </li>
              ) : null}
            </ul>
          </Group>
        </>
      ) : null}

      <Actions>
        <NextButton href="#/verde/agro/unde" disabled={!canContinue}>
          Confirm datele
        </NextButton>
        {profile && !consents.apia ? <p className="small muted">Bifează acordul APIA ca să continui.</p> : null}
      </Actions>
    </>
  );
}
