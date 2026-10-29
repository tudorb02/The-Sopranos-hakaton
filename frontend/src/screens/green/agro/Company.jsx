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

const fromSource = (source) => <Src kind="obs" label={`from ${source}`} />;

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
        <h1 className="page-title">Your company</h1>
        <p className="small muted">We take the data from the public registries and, with your consent, from APIA and your accounts. You only confirm it.</p>
      </header>

      <form
        className="card cui-form"
        onSubmit={(e) => {
          e.preventDefault();
          lookup(input);
        }}
      >
        <div className="field">
          <label htmlFor={inputId}>Tax identification code (CUI)</label>
          <div className="input">
            <input id={inputId} inputMode="numeric" autoComplete="off" placeholder="for example 45871203" value={input} onChange={(e) => setInput(e.target.value)} />
          </div>
        </div>
        <button type="submit" className="btn btn--small" disabled={!input.trim() || farm.loading}>
          Find the company
        </button>
      </form>

      <Group label="Demo farms (fictional data)">
        <div className="chips" role="group" aria-label="Demo farms">
          {DEMO_FARMS.map((demo) => (
            <button key={demo.cui} type="button" className="chip" aria-pressed={flow.cui === demo.cui ? "true" : "false"} onClick={() => lookup(demo.cui)}>
              {demo.name}
            </button>
          ))}
        </div>
      </Group>

      {farm.loading && flow.cui ? <Loading label="Looking up the company in the registries…" /> : null}
      <ErrorCard error={farm.error} onRetry={farm.reload} />

      {profile ? (
        <>
          <section className="card" aria-label="Company">
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

          <Group label="Your consents">
            <div className="card switches">
              <div className="switch-row">
                <p className="consent-fixed">
                  <span>Public data (ANAF)</span>
                  <span className="small muted">The company data and balance sheet, from the public registries.</span>
                </p>
                <span className="status">Public</span>
              </div>
              <ConsentSwitch
                label="APIA: parcels and crops"
                hint="Required: your parcels come from APIA."
                checked={consents.apia}
                onChange={(apia) => patchFlow({ consents: { ...consents, apia } })}
              />
              <ConsentSwitch
                label="Open Banking: the company income"
                hint="We use it to match the instalments to the months when you get paid."
                checked={consents.openBanking}
                onChange={(openBanking) => patchFlow({ consents: { ...consents, openBanking } })}
              />
            </div>
            <p className="small muted group-hint">Without Open Banking, you can answer the question about your income months yourself.</p>
          </Group>

          <PrivacyPromise legal={greenLegal} href="#/verde/informare" />

          <Group label="What we found">
            <ul className="card facts">
              <li>
                <span className="fact-label">Activity</span>
                <span className="fact-value">{profile.company.caenLabelRo}</span>
                {fromSource("ANAF")}
              </li>
              <li>
                <span className="fact-label">Employees</span>
                <span className="fact-value num">{profile.company.employees}</span>
                {fromSource("ANAF")}
              </li>
              {profile.company.turnoverEur != null ? (
                <li>
                  <span className="fact-label">Turnover ({profile.company.financialYear})</span>
                  <span className="fact-value num">{eur(profile.company.turnoverEur)}</span>
                  {fromSource("ANAF")}
                </li>
              ) : null}
              <li>
                <span className="fact-label">Farm area</span>
                <span className="fact-value num">
                  {ha(profile.farm.totalHa)}, {profile.parcels.features.length} parcels
                </span>
                {fromSource("APIA")}
              </li>
              {profile.cashflow.peakMonths.length ? (
                <li>
                  <span className="fact-label">Months with high income</span>
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
          Confirm the data
        </NextButton>
        {profile && !consents.apia ? <p className="small muted">Tick the APIA consent to continue.</p> : null}
      </Actions>
    </>
  );
}
