import { Icon } from "./icons.jsx";

const COACH_PAGES = [
  { id: "rezumat", label: "Rezumat" },
  { id: "bugete", label: "Bugete" },
  { id: "obiective", label: "Obiective" },
  { id: "profil", label: "Profil" },
];

// Tabs of the existing app. The Coach is an optional feature inside Produse; the other tabs are placeholders.
const APP_TABS = [
  { id: "acasa", label: "Acasă", icon: "home" },
  { id: "plati", label: "Plăți", icon: "transfer" },
  { id: "carduri", label: "Carduri", icon: "card" },
  { id: "produse", label: "Produse", icon: "grid", href: "#/produse" },
];

function Stage({ children }) {
  return (
    <div className="stage">
      <p className="stage-note">Concept de extensie pentru Smart Mobile · prototip de hackathon · date fictive · neafiliat Raiffeisen Bank</p>
      <div className="app">{children}</div>
    </div>
  );
}

function TabBar() {
  return (
    <nav className="tabbar" aria-label="Aplicație">
      <ul>
        {APP_TABS.map((tab) => (
          <li key={tab.id}>
            {tab.href ? (
              <a href={tab.href} aria-current="page">
                <span className="tab-icon">
                  <Icon name={tab.icon} />
                </span>
                <span>{tab.label}</span>
              </a>
            ) : (
              <span className="tab-inert" title="Secțiune existentă în aplicație">
                <span className="tab-icon">
                  <Icon name={tab.icon} />
                </span>
                <span>{tab.label}</span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

// The Produse tab of the app, where the Coach is offered.
export function ProductsFrame({ children }) {
  return (
    <Stage>
      <header className="app-header">
        <h1 className="app-title">Produse</h1>
        <button type="button" className="icon-btn" aria-label="Mesaje, 1 necitit">
          <Icon name="mail" />
          <span className="badge" aria-hidden="true">
            1
          </span>
        </button>
      </header>
      <main>{children}</main>
      <TabBar />
    </Stage>
  );
}

// A page of the Coach, opened from Produse: back link, the coach's own pages, the app's tab bar.
export function SectionFrame({ current, client, children }) {
  return (
    <Stage>
      <header className="app-header coach-header">
        <a className="back-link" href="#/produse" aria-label="Înapoi la Produse">
          <Icon name="back" />
        </a>
        <p className="coach-title">
          <Icon name="compass" />
          Coach financiar
        </p>
        <a className="avatar" href="#/profil" aria-label="Profilul tău">
          {client.initial}
        </a>
      </header>

      <nav className="subnav" aria-label="Coach">
        <ul>
          {COACH_PAGES.map((page) => (
            <li key={page.id}>
              <a href={`#/${page.id}`} aria-current={page.id === current ? "page" : undefined}>
                {page.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <main key={current}>{children}</main>
      <TabBar />
    </Stage>
  );
}

// Segmented progress under the flow header, like the steps of a payment in the app.
function Progress({ steps, current, note }) {
  const done = current > steps.length;
  const label = done ? "Gata" : `Pasul ${current} din ${steps.length} · ${steps[current - 1]}`;
  return (
    <div className="progress">
      <ol aria-hidden="true">
        {steps.map((step, i) => (
          <li key={step} className={i + 1 < current ? "is-done" : i + 1 === current ? "is-current" : undefined} />
        ))}
      </ol>
      <p className="progress-label">
        {label}
        {note ? <span> · {note}</span> : null}
      </p>
    </div>
  );
}

// Primary and secondary actions pinned to the bottom of a flow.
export function FlowActions({ next, nextLabel, skip, skipLabel }) {
  return (
    <>
      {next ? (
        <a className="btn btn--block" href={next}>
          {nextLabel}
        </a>
      ) : null}
      {skip ? (
        <a className="btn btn--text btn--block" href={skip}>
          {skipLabel}
        </a>
      ) : null}
    </>
  );
}

// A full-screen flow (activation, chat, statements): centred title, "Înapoi" and "Închide",
// like the app's payment flow. When the screen has its own h1, pass titleAs="p".
export function FlowFrame({ title, titleAs: TitleTag = "h1", closeHref, backHref, progress, footer, children }) {
  return (
    <Stage>
      <header className="flow-header">
        {backHref ? (
          <a className="link" href={backHref}>
            Înapoi
          </a>
        ) : (
          <span aria-hidden="true" />
        )}
        <TitleTag className="flow-title">{title}</TitleTag>
        <a className="link" href={closeHref}>
          Închide
        </a>
      </header>
      {progress ? <Progress {...progress} /> : null}
      <main className="flow-main">{children}</main>
      {footer ? <div className="flow-footer">{footer}</div> : null}
    </Stage>
  );
}
