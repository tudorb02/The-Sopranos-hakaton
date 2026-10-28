// Produse for a business account: the green credit for investments, agriculture first
// (design/pj-greenstruct.md §4), the company's requests and its existing products.

import { Icon } from "../components/icons.jsx";
import { Group, IconTile, NoteCard } from "../components/ui.jsx";
import { business } from "../data/accounts.js";
import { greenPacks } from "../data/green/packs.js";
import { greenEntry } from "../data/green/sectors.js";

export default function Business() {
  const { dossier } = greenPacks.agro;
  return (
    <>
      <section className="card card--yellow coach-entry" aria-labelledby="green-entry-title">
        <div className="goal-head">
          <IconTile icon="leaf" tone="ink" />
          <div>
            <h2 id="green-entry-title" className="card-title">
              {greenEntry.title}
            </h2>
            <p className="small">{greenEntry.subtitle}</p>
          </div>
          <span className="status status--ink">{greenEntry.badge}</span>
        </div>
        <p className="small">{greenEntry.text}</p>
        <div className="btn-row">
          <a className="btn btn--ink btn--small" href="#/verde">
            Începe
          </a>
          <a className="btn btn--text btn--small btn--on-yellow" href="#/verde/agro/oferta">
            Vezi un exemplu
          </a>
        </div>
      </section>

      <Group label="Cererile tale">
        <ul className="card rows">
          <li>
            <a className="row row--link" href={dossier.href}>
              <IconTile icon="drop" tone="sand" />
              <span className="row-main">
                <span className="row-name">{dossier.row.title}</span>
                <span className="row-note">{dossier.row.note}</span>
              </span>
              <span className="status is-on">{dossier.row.status}</span>
            </a>
          </li>
        </ul>
      </Group>

      <Group label="Produsele firmei">
        <ul className="card rows">
          {business.products.map((product) => (
            <li key={product.name} className="row">
              <IconTile icon={product.icon} tone="sand" />
              <span className="row-name">{product.name}</span>
              <Icon name="chevron" className="chevron" />
            </li>
          ))}
        </ul>
      </Group>

      <NoteCard icon="compass">{business.note}</NoteCard>
    </>
  );
}
