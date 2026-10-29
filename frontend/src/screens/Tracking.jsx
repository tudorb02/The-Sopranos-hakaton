// Spending tracker: what was spent this budget period by category, what needs a look, and every payment by day.

import { Icon } from "../components/icons.jsx";
import { CategoryLegend, ShareBar, TxRow } from "../components/tracking.jsx";
import { Amount, ChoiceChips, IconTile, Src } from "../components/ui.jsx";
import { lei } from "../lib/format.js";
import { usePersona } from "../persona.js";

export default function Tracking() {
  const { days, filters, review, spending } = usePersona();
  return (
    <>
      <section className="card hero-card" aria-labelledby="tracking-title">
        <p className="eyebrow">Spending · {spending.period}</p>
        <h1 id="tracking-title" className="hero-label">
          {spending.title}
        </h1>
        <Amount value={spending.total} size="xl" />
        <p className="hero-sub">
          {spending.compare} <Src kind="est" />
        </p>
        <div className="split">
          <ShareBar parts={spending.parts} total={spending.total} />
          <CategoryLegend parts={spending.parts} total={spending.total} />
          <p className="small muted">Plus {lei(spending.fixed)} in fixed costs: {spending.fixedNote}.</p>
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
          <span className="sr-only">Search payments</span>
          <input type="search" placeholder="Search merchant, amount or tag" />
        </label>
        <ChoiceChips label="Filters" options={filters} />
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
