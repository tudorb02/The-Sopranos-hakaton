import { WeekStrip } from "../components/charts.jsx";
import { Agenda, Amount, BudgetRow, InfoCard, QuickActions, Section, Src } from "../components/ui.jsx";
import { agenda, budgets, cycle, insight, lastMessage, today, week } from "../data/demo.js";
import { lei } from "../lib/format.js";

const SHORTCUTS = [
  { href: "#/bugete", icon: "pie", label: "Bugete" },
  { href: "#/obiective", icon: "target", label: "Obiective" },
  { href: "#/chat", icon: "chat", label: "Întreabă" },
];

export default function Summary() {
  return (
    <>
      <section className="card hero-card" aria-labelledby="summary-title">
        <p className="eyebrow">{today.label}</p>
        <h1 id="summary-title" className="hero-label">
          Până la salariu mai ai
        </h1>
        <Amount value={cycle.left} size="xl" />
        <p className="hero-sub">
          Cam {cycle.perDay} lei pe zi · {cycle.daysLeftLabel}, până pe {cycle.endsOn} <Src kind="est" />
        </p>
        <QuickActions items={SHORTCUTS} />
      </section>

      <InfoCard icon={lastMessage.icon} meta={lastMessage.meta} title={lastMessage.title} text={lastMessage.text} />

      <Section title="Săptămâna asta" aside={<span className="small muted num">{lei(week.spent)} în {week.daysSoFar} zile</span>}>
        <div className="card">
          <WeekStrip week={week} />
        </div>
      </Section>

      <Section title="Bugete" aside={<a className="link" href="#/bugete">Vezi toate</a>}>
        <ul className="card rows">
          {budgets
            .filter((budget) => budget.onHome)
            .map((budget) => (
              <BudgetRow key={budget.id} budget={budget} />
            ))}
        </ul>
      </Section>

      <Section title="Ce am observat">
        <div className="card insight">
          <p className="insight-figure num">{insight.figure}</p>
          <p>
            {insight.text} <Src kind="obs" />
          </p>
        </div>
      </Section>

      <Section title="Ce urmează">
        <div className="card">
          <Agenda items={agenda} />
        </div>
      </Section>
    </>
  );
}
