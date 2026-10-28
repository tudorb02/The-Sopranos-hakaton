import { Allocation, Legend } from "../components/charts.jsx";
import { Amount, BudgetRow, InfoCard, Section, Src, ValueRow } from "../components/ui.jsx";
import { lei } from "../lib/format.js";
import { usePersona } from "../persona.js";

export default function Budgets() {
  const { allocation, budgetGroups, budgets, cycle, question, unbudgeted } = usePersona();
  return (
    <>
      <section className="card hero-card" aria-labelledby="budgets-title">
        <p className="eyebrow">Perioada de buget · {cycle.label}</p>
        <h1 id="budgets-title" className="hero-label">
          Disponibil până pe {cycle.endsOn}
        </h1>
        <Amount value={cycle.left} size="lg" />
        <p className="hero-sub">
          din {lei(cycle.spendable)} · ai folosit {lei(cycle.spent)}
        </p>
        <div className="split">
          <Allocation parts={allocation} total={cycle.total} />
          <Legend parts={allocation} />
          <p className="small muted">{cycle.totalNote}</p>
        </div>
      </section>

      {budgetGroups.map((group) => (
        <Section
          key={group.title}
          title={group.title}
          aside={group.src ? <Src kind={group.src} label={group.note} /> : <span className="small muted num">{group.note}</span>}
        >
          <ul className="card rows">
            {budgets
              .filter((budget) => !group.id || budget.group === group.id)
              .map((budget) => (
                <BudgetRow key={budget.id} budget={budget} />
              ))}
          </ul>
        </Section>
      ))}

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
        text={`Ce reprezintă plata de ${lei(question.amount)} către ${question.merchant} din ${question.date}?`}
      >
        <div className="chips">
          {question.options.map((option) => (
            <button key={option} type="button" className="chip">
              {option}
            </button>
          ))}
        </div>
        <a className="link" href={`#/cheltuieli/${question.txId}`}>
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
