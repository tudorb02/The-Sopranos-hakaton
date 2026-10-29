import { legal } from "../data/legal.js";
import { Icon } from "./icons.jsx";
import { DisclaimerStrip } from "./ui.jsx";

const COACH_PAGES = [
  { id: "rezumat", label: "Summary" },
  { id: "cheltuieli", label: "Spending" },
  { id: "bugete", label: "Budgets" },
  { id: "obiective", label: "Goals" },
  { id: "idei", label: "Ideas" },
  { id: "profil", label: "Profile" },
];

// Tabs of the existing app. The Coach is an optional feature inside Produse; the other tabs are placeholders.
const APP_TABS = [
  { id: "acasa", label: "Home", icon: "home" },
  { id: "plati", label: "Payments", icon: "transfer" },
  { id: "carduri", label: "Cards", icon: "card" },
  { id: "produse", label: "Products", icon: "grid" },
];

// The phone-width column; on desktop it sits in a frame.
function Stage({ children }) {
  return (
    <div className="stage">
      <div className="app">{children}</div>
    </div>
  );
}

function TabBar({ productsHref }) {
  return (
    <nav className="tabbar" aria-label="App">
      <ul>
        {APP_TABS.map((tab) => (
          <li key={tab.id}>
            {tab.id === "produse" ? (
              <a href={productsHref} aria-current="page">
                <span className="tab-icon">
                  <Icon name={tab.icon} />
                </span>
                <span>{tab.label}</span>
              </a>
            ) : (
              <span className="tab-inert" title="Existing section of the app">
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

// The simulated sign-in: no header or tab bar.
export function BareFrame({ children }) {
  return (
    <Stage>
      <main className="bare-main">{children}</main>
    </Stage>
  );
}

// The Produse tab of the app: the personal one offers the Coach, the business one shows what is coming.
export function ProductsFrame({ title = "Products", subtitle, productsHref = "#/produse", children }) {
  return (
    <Stage>
      <header className="app-header">
        <div>
          <h1 className="app-title">{title}</h1>
          {subtitle ? <p className="small muted">{subtitle}</p> : null}
        </div>
        <div className="header-actions">
          <button type="button" className="icon-btn" aria-label="Messages, 1 unread">
            <Icon name="mail" />
            <span className="badge" aria-hidden="true">
              1
            </span>
          </button>
          <a className="icon-btn" href="#/login" aria-label="Sign out" title="Sign out">
            <Icon name="logout" />
          </a>
        </div>
      </header>
      <main>{children}</main>
      <TabBar productsHref={productsHref} />
    </Stage>
  );
}

// A page of the Coach, opened from Produse: back link, the coach's own pages, the notice, the app's tab bar.
// `pages` lists the ids this client sees (Idei only for a client without a stable income).
export function SectionFrame({ current, client, pages, children }) {
  return (
    <Stage>
      <header className="app-header coach-header">
        <a className="back-link" href="#/produse" aria-label="Back to Products">
          <Icon name="back" />
        </a>
        <p className="coach-title">
          <Icon name="compass" />
          Financial coach
        </p>
        <a className="avatar" href="#/profil" aria-label="Your profile">
          {client.initial}
        </a>
      </header>

      <nav className="subnav" aria-label="Coach">
        <ul>
          {COACH_PAGES.filter((page) => pages.includes(page.id)).map((page) => (
            <li key={page.id}>
              <a href={`#/${page.id}`} aria-current={page.id === current ? "page" : undefined}>
                {page.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <main key={current}>{children}</main>
      <div className="app-bottom">
        <DisclaimerStrip legal={legal} />
        <TabBar productsHref="#/produse" />
      </div>
    </Stage>
  );
}

// Segmented progress under the flow header, like the steps of a payment in the app.
function Progress({ steps, current, note }) {
  const done = current > steps.length;
  const label = done ? "Done" : `Step ${current} of ${steps.length} · ${steps[current - 1]}`;
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

// A full-screen flow (activation, chat, statements, notice): centred title, "Back" and "Close",
// like the app's payment flow. When the screen has its own h1, pass titleAs="p".
export function FlowFrame({ title, titleAs: TitleTag = "h1", closeHref, backHref, progress, footer, children }) {
  return (
    <Stage>
      <header className="flow-header">
        {backHref ? (
          <a className="link" href={backHref}>
            Back
          </a>
        ) : (
          <span aria-hidden="true" />
        )}
        <TitleTag className="flow-title">{title}</TitleTag>
        <a className="link" href={closeHref}>
          Close
        </a>
      </header>
      {progress ? <Progress {...progress} /> : null}
      <main className="flow-main">{children}</main>
      {footer ? <div className="flow-footer">{footer}</div> : null}
    </Stage>
  );
}
