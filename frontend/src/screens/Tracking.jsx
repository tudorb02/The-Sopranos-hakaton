// Spending tracker: what was spent this cycle by category, what needs a look, and every payment by day.

import { Icon } from "../components/icons.jsx";
import { CategoryLegend, ShareBar, TxRow } from "../components/tracking.jsx";
import { Amount, ChoiceChips, IconTile, Src } from "../components/ui.jsx";
import { days, filters, review, spending } from "../data/tracking.js";
import { lei } from "../lib/format.js";

export default function Tracking() {
  return (
    <>
      <section className="card hero-card" aria-labelledby="tracking-title">
        <p className="eyebrow">Cheltuieli · {spending.period}</p>
        <h1 id="tracking-title" className="hero-label">
          Ai cheltuit din banii de cheltuit
        </h1>
        <Amount value={spending.total} size="xl" />
        <p className="hero-sub">
          {spending.compare} <Src kind="est" />
        </p>
        <div className="split">
          <ShareBar parts={spending.parts} total={spending.total} />
          <CategoryLegend parts={spending.parts} total={spending.total} />
          <p className="small muted">Plus {lei(spending.fixed)} cheltuieli fixe: chiria și abonamentele.</p>
        </div>
      </section>

      <a className="card review" href={`#/cheltuieli/${review.id}`}>
        <IconTile icon="help" tone="yellow" />
        <span className="row-main">
          <span className="row-name">{review.title}</span>
          <span className="row-note">{review.text}</span>
        </span>
        <Icon name="chevron" className="chevron" />
      </a>

      <div className="search-row">
        <label className="search">
          <Icon name="search" />
          <span className="sr-only">Caută în plăți</span>
          <input type="search" placeholder="Caută comerciant, sumă sau etichetă" />
        </label>
        <ChoiceChips label="Filtre" options={filters} />
      </div>

      {days.map((day) => (
        <section key={day.date} className="section" aria-label={`${day.label}, ${day.date}`}>
          <div className="day-head">
            <span>
              <b>{day.label}</b> · {day.date}
            </span>
            <span className="num">−{lei(day.total)}</span>
          </div>
          <ul className="card rows tx-list">
            {day.items.map((tx) => (
              <TxRow key={tx.id} tx={tx} />
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
