// Simulated sign-in for the demo: pick a personal or the business account. Nothing is typed or checked.

import { IconTile, NoteCard } from "../components/ui.jsx";
import { accounts, login } from "../data/accounts.js";

export default function Login({ type }) {
  return (
    <>
      <section className="card card--yellow hero-card welcome" aria-labelledby="login-title">
        <IconTile icon="lock" tone="ink" />
        <h1 id="login-title" className="page-title">
          {login.title}
        </h1>
        <p className="lead-text">{login.lead}</p>
      </section>

      <nav className="segmented" aria-label="Tipul contului">
        <a href="#/login" aria-current={type === "pf" ? "page" : undefined}>
          Persoană fizică
        </a>
        <a href="#/login/pj" aria-current={type === "pj" ? "page" : undefined}>
          Persoană juridică
        </a>
      </nav>

      {accounts[type].map((account) => (
        <section key={account.id} className="card account-card" aria-label={`Cont demo: ${account.name}`}>
          <div className="row row--flush">
            <span className="tile tile--yellow avatar-tile" aria-hidden="true">
              {account.initial}
            </span>
            <div className="row-main">
              <span className="row-name">{account.name}</span>
              <span className="row-note">
                {account.profile} · {account.detail}
              </span>
            </div>
          </div>
          <a className="btn btn--block" href={account.href}>
            Intră în cont
          </a>
        </section>
      ))}

      <NoteCard icon="lock">{login.note}</NoteCard>
    </>
  );
}
