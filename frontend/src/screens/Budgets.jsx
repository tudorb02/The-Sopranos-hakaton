import { Allocation, Legend } from "../components/charts.jsx";
import { Amount, BudgetRow, InfoCard, Section, Src, ValueRow } from "../components/ui.jsx";
import { allocation, budgets, cycle, question, unbudgeted } from "../data/demo.js";
import { lei } from "../lib/format.js";

export default function Budgets() {
  return (
    <>
      <section className="card hero-card" aria-labelledby="budgets-title">
        <p className="eyebrow">Ciclul de salariu · {cycle.label}</p>
        <h1 id="budgets-title" className="hero-label">
          Până pe {cycle.endsOn} mai ai disponibili
        </h1>
        <Amount value={cycle.left} size="lg" />
        <p className="hero-sub">
          din {lei(cycle.spendable)} · ai folosit {lei(cycle.spent)}
        </p>
        <div className="split">
          <Allocation parts={allocation} total={cycle.salary} />
          <Legend parts={allocation} />
        </div>
      </section>

      <Section title="Pe categorii" aside={<Src kind="agreed" label="stabilite de tine" />}>
        <ul className="card rows">
          {budgets.map((budget) => (
            <BudgetRow key={budget.id} budget={budget} />
          ))}
        </ul>
      </Section>

      <Section title="Fără buget" aside={<span className="small muted num">{lei(unbudgeted.total)}</span>}>
        <ul className="card rows">
          {unbudgeted.items.map((item) => (
            <ValueRow key={item.name} icon={item.icon} name={item.name} note={item.note} value={lei(item.lei)} />
          ))}
        </ul>
      </Section>

      <InfoCard
        icon="help"
        title="O întrebare scurtă"
        text={`Plata de ${lei(question.amount)} la ${question.merchant}, din ${question.date}: ce a fost?`}
      >
        <div className="chips">
          {question.options.map((option) => (
            <button key={option} type="button" className="chip">
              {option}
            </button>
          ))}
        </div>
        <a className="link" href="#/cheltuieli/t14">
          Deschide plata
        </a>
      </InfoCard>

      <details className="card disclosure">
        <summary>Sănătate și donații</summary>
        <p>Le vezi doar tu. Coach-ul nu le comentează și nu propune bugete aici.</p>
      </details>

      <button type="button" className="btn btn--block">
        Adaugă un buget
      </button>
    </>
  );
}
