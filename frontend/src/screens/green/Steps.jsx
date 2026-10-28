// The steps of the green-credit flow, the same for every area (design/pj-greenstruct.md §4), in the order of the
// GreenStruct README §7. Each screen gets the area's pack (data/green/packs.js): its configuration and its dossier.

import { DocumentRow, From, ModuleCard, OfferCompare, PaymentsChart, StatusSteps } from "../../components/green.jsx";
import { Icon } from "../../components/icons.jsx";
import { ServiceCard } from "../../components/services.jsx";
import { Amount, ChoiceChips, Disclaimer, Facts, Field, Group, IconTile, Meter, NoteCard, PrivacyPromise, Section, Src, Switch, Ticks, ValueRow } from "../../components/ui.jsx";
import { greenLegal } from "../../data/green/legal.js";
import { eur } from "../../lib/format.js";
import { Parcels } from "./agro/Parcels.jsx";

const chosenModule = (pack) => pack.modules.find((module) => module.id === pack.selectedModule);

// The "where" step: each area brings its own variant.
const LOCATION_VARIANTS = { parcels: Parcels };

const CORRECT = (
  <button type="button" className="btn btn--text btn--small">
    Corectează
  </button>
);

const CALCULATED = <Src kind="est" label="calculat de bancă" />;

export function Intro({ pack }) {
  const { intro } = pack;
  return (
    <>
      <section className="card card--yellow hero-card welcome" aria-labelledby="green-intro-title">
        <IconTile icon="leaf" tone="ink" />
        <p className="eyebrow">{pack.sectorName}</p>
        <h1 id="green-intro-title" className="page-title">
          {intro.title}
        </h1>
        <p className="lead-text">{intro.lead}</p>
        <p className="pill-note">
          <Icon name="clock" />
          {intro.duration}
        </p>
      </section>

      <Section title="Cum decurge">
        <ol className="card steps">
          {intro.steps.map((step, i) => (
            <li key={step}>
              <span className="step-num">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Ce face consultantul">
        <Ticks yes={intro.does} no={intro.doesNot} />
      </Section>

      <Section title="Ce să ai la îndemână">
        <Ticks yes={intro.bring} />
      </Section>

      <Disclaimer legal={greenLegal} link href="#/verde/informare" />
    </>
  );
}

export function Company({ pack }) {
  const { company, consents } = pack;
  return (
    <>
      <header className="intro">
        <h1 className="page-title">Firma ta</h1>
        <p className="small muted">Luăm datele din registrele publice și, cu acordul tău, de la APIA și din conturi. Tu doar confirmi.</p>
      </header>

      <section className="card" aria-label="Firma">
        <div className="row row--flush">
          <IconTile icon="bank" tone="yellow" />
          <div className="row-main">
            <span className="row-name">{company.name}</span>
            <span className="row-note">{company.account}</span>
          </div>
        </div>
      </section>

      <Group label="Acordurile tale">
        <div className="card switches">
          {consents.map((item) =>
            item.fixed ? (
              <div key={item.id} className="switch-row">
                <p className="consent-fixed">
                  <span>{item.label}</span>
                  <span className="small muted">{item.hint}</span>
                </p>
                <span className="status">Public</span>
              </div>
            ) : (
              <Switch key={item.id} label={item.label} hint={item.hint} defaultChecked={item.on} />
            ),
          )}
        </div>
        <p className="small muted group-hint">Fără Open Banking, poți atașa extrasele de cont ale firmei.</p>
      </Group>

      <PrivacyPromise legal={greenLegal} href="#/verde/informare" />

      <Group label="Ce am găsit" action={CORRECT}>
        <ul className="card facts">
          {company.facts.map((fact) => (
            <li key={fact.label}>
              <span className="fact-label">{fact.label}</span>
              <span className="fact-value">{fact.value}</span>
              <From source={fact.src} />
            </li>
          ))}
        </ul>
      </Group>
    </>
  );
}

export function Category({ pack }) {
  return (
    <>
      <header className="intro">
        <h1 className="page-title">Ce vrei să faci?</h1>
        <p className="small muted">Alege categoria investiției. Pentru fiecare verificăm alt criteriu verde.</p>
      </header>

      <div className="module-grid" role="group" aria-label="Categoria investiției">
        {pack.modules.map((module) => (
          <ModuleCard key={module.id} module={module} selected={module.id === pack.selectedModule} />
        ))}
      </div>

      <NoteCard icon="leaf">{chosenModule(pack).criterion}</NoteCard>
    </>
  );
}

export function Location({ pack }) {
  const Variant = LOCATION_VARIANTS[pack.location.variant];
  return <Variant location={pack.location} />;
}

export function Documents({ pack }) {
  const module = chosenModule(pack);
  return (
    <>
      <header className="intro">
        <h1 className="page-title">Documente</h1>
        <p className="small muted">
          Doar cele esențiale pentru categoria ta. Ce lipsește poți trimite și după: devine o condiție înainte de tragere, nu un motiv de respingere.
        </p>
      </header>

      <button type="button" className="btn btn--outline btn--small btn--start">
        <Icon name="upload" />
        Încarcă dosarul demo
      </button>

      <Group label="Pentru orice investiție">
        <ul className="card rows">
          {pack.generalDocuments.map((doc) => (
            <DocumentRow key={doc.id} doc={doc} state={pack.documents[doc.id]} />
          ))}
        </ul>
      </Group>

      <Group label={`Pentru ${module.name.toLowerCase()}`}>
        <ul className="card rows">
          {module.documents.map((doc) => (
            <DocumentRow key={doc.id} doc={doc} state={pack.documents[doc.id]} />
          ))}
        </ul>
      </Group>

      <NoteCard icon="lock">Documentele sunt criptate, nu devin publice și sunt folosite doar pentru acest dosar. Agenții citesc din ele doar datele tehnice.</NoteCard>
    </>
  );
}

function Question({ question, answer = {} }) {
  const source = answer.src ? <From source={answer.src} /> : null;
  if (question.type === "text" || question.type === "textarea") {
    return (
      <div className="question">
        <Field field={{ label: question.label, type: question.type === "textarea" ? "textarea" : undefined, value: answer.value, suffix: question.suffix, numeric: question.numeric }} />
        {source}
      </div>
    );
  }
  const selected = answer.selected ?? [];
  return (
    <div className="question">
      <p className="question-label">{question.label}</p>
      <ChoiceChips label={question.label} options={question.options.map((option) => ({ label: option, selected: selected.includes(option) }))} />
      {source}
    </div>
  );
}

export function Questions({ pack }) {
  const module = chosenModule(pack);
  const groups = [
    { label: `Pentru ${module.name.toLowerCase()}`, items: module.questions },
    { label: "Pentru orice investiție", items: pack.commonQuestions },
  ];
  return (
    <>
      <header className="intro">
        <h1 className="page-title">Câteva întrebări</h1>
        <p className="small muted">Doar ce ne trebuie pentru calcul. Le-am completat din APIA unde am putut.</p>
      </header>

      {groups.map((group) => (
        <Group key={group.label} label={group.label}>
          <div className="card questions">
            {group.items.map((question) => (
              <Question key={question.id} question={question} answer={pack.answers[question.id]} />
            ))}
          </div>
        </Group>
      ))}
    </>
  );
}

export function Analysis({ pack }) {
  const { analysis } = pack;
  return (
    <>
      <header className="intro">
        <h1 className="page-title">{analysis.title}</h1>
        <p className="small muted">{analysis.lead}</p>
      </header>

      <ul className="card rows">
        {analysis.phases.map((phase) => (
          <li key={phase.label} className="row">
            <span className={`state state--${phase.state}`} aria-hidden="true">
              {phase.state === "done" ? <Icon name="check" /> : null}
            </span>
            <div className="row-main">
              <span className="row-name">{phase.label}</span>
              <span className="row-note">{phase.note}</span>
            </div>
            {phase.state === "running" ? <Meter value={phase.progress} max={100} /> : null}
          </li>
        ))}
      </ul>

      <Section title="Ce am aflat">
        <ol className="card rows feed">
          {analysis.messages.map((message) => (
            <li key={message.text} className={message.tone ? `is-${message.tone}` : undefined}>
              <span className="eyebrow">{message.phase}</span>
              <p>{message.text}</p>
            </li>
          ))}
        </ol>
      </Section>

      <NoteCard icon="shield">{analysis.note}</NoteCard>
    </>
  );
}

export function Offers({ pack }) {
  const { offer } = pack;
  return (
    <>
      <section className="card card--yellow hero-card" aria-labelledby="offer-title">
        <p className="eyebrow">{offer.eyebrow}</p>
        <h1 id="offer-title" className="hero-label">
          {offer.headline.label}
        </h1>
        <Amount value={offer.headline.eur} size="xl" currency="EUR" />
        <p className="hero-sub">{CALCULATED}</p>
        <p className="hero-alert">
          <Icon name="leaf" />
          <span>
            <b>{offer.level.name}</b> · {offer.recommended}
          </span>
        </p>
      </section>

      <Section title="Creditul clasic și creditul verde" aside={CALCULATED}>
        <OfferCompare columns={offer.columns} rows={offer.rows} />
        <p className="small muted">{offer.difference}</p>
      </Section>

      <Section title={offer.rate.title}>
        <ul className="card rows">
          {offer.rate.parts.map((part) => (
            <ValueRow key={part.label} name={part.label} value={<span className="num">{part.pp}</span>} />
          ))}
          <li className="row row--total">
            <span className="row-name">{offer.rate.total.label}</span>
            <span className="row-value num">{offer.rate.total.pp}</span>
          </li>
        </ul>
        <p className="small muted">{offer.rate.note}</p>
      </Section>

      <Section title="Ratele, într-un an">
        <div className="card">
          <PaymentsChart payments={offer.payments} />
        </div>
      </Section>

      <Section title="Garanția din creditul verde">
        <ServiceCard service={offer.guarantee} />
      </Section>

      <NoteCard icon="shield">{offer.notice}</NoteCard>
    </>
  );
}

export function Changes({ pack }) {
  const { changes, offer } = pack;
  return (
    <>
      <header className="intro">
        <h1 className="page-title">{changes.title}</h1>
        <p className="small muted">{changes.lead}</p>
      </header>

      <ul className="card rows">
        <ValueRow icon="file" name={changes.from.name} note={`Cerut · ${changes.from.note}`} value={eur(changes.from.eur)} />
        <ValueRow icon="drop" name={changes.to.name} note={`Propus · ${changes.to.note}`} value={eur(changes.to.eur)} />
      </ul>

      <Facts items={changes.facts} />

      <NoteCard icon="leaf">
        <b>{offer.level.name}.</b> {offer.level.text}
      </NoteCard>

      <Section title="Alte schimbări posibile" aside={<span className="small muted">din catalog</span>}>
        <ul className="card rows">
          {changes.more.map((item) => (
            <li key={item} className="row">
              <span className="row-name">{item}</span>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

// status of a clause: already in the green offer, to ask the officer for, or a new proposal (README §4, step 6).
const CLAUSE_STATUS = {
  offer: { label: "În oferta verde", className: "status is-on" },
  ask: { label: "De cerut", className: "status status--outline" },
  proposal: { label: "Propunere nouă", className: "status" },
};

// The consultant checks the request before it goes to the bank: the variant, how ready the dossier is, what to
// improve, which clauses to ask for and what the client commits to.
export function Request({ pack }) {
  const { advice } = pack;
  const { readiness } = advice;
  return (
    <>
      <header className="intro">
        <h1 className="page-title">{advice.title}</h1>
        <p className="small muted">{advice.lead}</p>
      </header>

      <Group label="Ce variantă trimiți">
        <div className="variants" role="radiogroup" aria-label="Varianta de credit">
          {advice.variants.map((variant) => (
            <label key={variant.id} className="card variant">
              <input type="radio" className="radio" name="variant" defaultChecked={variant.selected} />
              <span className="row-main">
                <span className="row-name">{variant.name}</span>
                <span className="row-note">{variant.note}</span>
              </span>
              {variant.badge ? <span className="status is-on">{variant.badge}</span> : null}
            </label>
          ))}
        </div>
      </Group>

      <Section
        title={readiness.title}
        aside={
          <span className="small num">
            <b>{readiness.met}</b> din {readiness.total}
          </span>
        }
      >
        <div className="card stack">
          <Meter value={readiness.met} max={readiness.total} />
          <p className="small muted">{readiness.summary}</p>
        </div>
        <ul className="card rows">
          {readiness.items.map((item) => (
            <li key={item.label} className="row">
              <span className={`state state--${item.state}`} aria-hidden="true">
                {item.state === "done" ? <Icon name="check" /> : "!"}
              </span>
              <div className="row-main">
                <span className="row-name">{item.label}</span>
                <span className="row-note">{item.note}</span>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Ce mai poți îmbunătăți">
        <ul className="card rows">
          {advice.actions.map((action) => (
            <li key={action.title} className="row">
              <IconTile icon={action.icon} tone="sand" />
              <div className="row-main">
                <span className="row-name">{action.title}</span>
                <span className="row-note">{action.text}</span>
              </div>
              {action.button ? (
                <button type="button" className="btn btn--outline btn--small">
                  {action.button}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Clauzele pe care ți le recomand">
        <ul className="card rows">
          {advice.clauses.map((clause) => (
            <li key={clause.title} className="row">
              <div className="row-main">
                <span className="row-name">{clause.title}</span>
                <span className="row-note">{clause.text}</span>
                <span className={CLAUSE_STATUS[clause.status].className}>{CLAUSE_STATUS[clause.status].label}</span>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Ce te obligi să faci, cu creditul verde">
        <ul className="card rows">
          {advice.obligations.map((item) => (
            <ValueRow key={item.what} name={item.what} note={item.note} value={<span className="status">{item.when}</span>} />
          ))}
        </ul>
      </Section>

      <NoteCard icon="shield">{advice.note}</NoteCard>
    </>
  );
}

export function Dossier({ pack }) {
  const { advice, dossier } = pack;
  return (
    <>
      <section className="card hero-card" aria-labelledby="dossier-title">
        <p className="eyebrow">{dossier.eyebrow}</p>
        <h1 id="dossier-title" className="card-title">
          {dossier.title}
        </h1>
        <p className="hero-sub">{dossier.text}</p>
      </section>

      <StatusSteps steps={dossier.steps} />

      <Group label="Impactul estimat, măsurat la 12 luni">
        <Facts items={dossier.impact} />
      </Group>

      <Group label="După aprobare, ce trimiți și când">
        <ul className="card rows">
          {advice.obligations.map((item) => (
            <ValueRow key={item.what} name={item.what} note={item.note} value={<span className="status">{item.when}</span>} />
          ))}
        </ul>
      </Group>

      <div className="deactivate">
        <button type="button" className="btn btn--text btn--danger">
          Retrage cererea
        </button>
        <p className="small muted">Documentele încărcate și răspunsurile tale se șterg. Contul firmei nu este afectat.</p>
      </div>
    </>
  );
}
