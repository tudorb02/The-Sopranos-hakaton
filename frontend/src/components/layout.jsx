import { Icon } from "./icons.jsx";

const COACH_PAGES = [
  { id: "rezumat", label: "Rezumat" },
  { id: "bugete", label: "Bugete" },
  { id: "obiective", label: "Obiective" },
  { id: "profil", label: "Profil" },
];

// Tabs of the existing app. Only Coach belongs to this prototype; the others are placeholders.
const APP_TABS = [
  { id: "acasa", label: "Acasă", icon: "home" },
  { id: "plati", label: "Plăți", icon: "transfer" },
  { id: "carduri", label: "Carduri", icon: "card" },
  { id: "coach", label: "Coach", icon: "compass", href: "#/rezumat" },
  { id: "produse", label: "Produse", icon: "grid" },
];

function Stage({ children }) {
  return (
    <div className="stage">
      <p className="stage-note">Concept de extensie pentru Smart Mobile · prototip de hackathon · date fictive · neafiliat Raiffeisen Bank</p>
      <div className="app">{children}</div>
    </div>
  );
}

// A page of the Coach tab: greeting header, the coach's own pages, the app's tab bar.
export function SectionFrame({ current, client, children }) {
  return (
    <Stage>
      <header className="app-header">
        <div className="greeting">
          <a className="avatar" href="#/profil" aria-label="Profilul tău">
            {client.initial}
          </a>
          <p>Bună, {client.firstName}</p>
        </div>
        <button type="button" className="icon-btn" aria-label="Mesaje, 1 necitit">
          <Icon name="mail" />
          <span className="badge" aria-hidden="true">
            1
          </span>
        </button>
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

      <nav className="tabbar" aria-label="Aplicație">
        <ul>
          {APP_TABS.map((tab) => (
            <li key={tab.id}>
              {tab.href ? (
                <a href={tab.href} aria-current="page">
                  <Icon name={tab.icon} />
                  <span>{tab.label}</span>
                </a>
              ) : (
                <span className="tab-inert" title="Secțiune existentă în aplicație">
                  <Icon name={tab.icon} />
                  <span>{tab.label}</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </Stage>
  );
}

// A full-screen step (the chat), with a centred title and "Închide", like the app's payment flow.
export function FlowFrame({ title, closeHref, children }) {
  return (
    <Stage>
      <header className="flow-header">
        <span aria-hidden="true" />
        <h1 className="flow-title">{title}</h1>
        <a className="link" href={closeHref}>
          Închide
        </a>
      </header>
      <main className="flow-main">{children}</main>
    </Stage>
  );
}
