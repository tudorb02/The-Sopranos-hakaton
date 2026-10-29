import { WeekStrip } from "../components/charts.jsx";
import { Icon } from "../components/icons.jsx";
import { Agenda, Amount, BudgetRow, InfoCard, NoteCard, QuickActions, Section, Src, ValueRow } from "../components/ui.jsx";
import { lei } from "../lib/format.js";
import { usePersona } from "../persona.js";

const SHORTCUTS = [
  { href: "#/cheltuieli", icon: "receipt", label: "Spending" },
  { href: "#/bugete", icon: "pie", label: "Budgets" },
  { href: "#/chat", icon: "chat", label: "Ask" },
];

// Without a stable income (Matei), the necessary expenses come right after the main figure.
function Essentials({ essentials }) {
  return (
    <Section title={essentials.title} aside={<span className="small muted num">{lei(essentials.total)}</span>}>
      <ul className="card rows">
        {essentials.items.map((item) => (
          <ValueRow
            key={item.name}
            icon={item.icon}
            name={item.name}
            note={item.note}
            value={item.status ? <span className="status is-on">{item.status}</span> : lei(item.lei)}
          />
        ))}
        <li className="row row--total">
          <span className="row-name">{essentials.rest.label}</span>
          <span className="row-value">{lei(essentials.rest.lei)}</span>
        </li>
      </ul>
      <NoteCard icon="clock">{essentials.pending}</NoteCard>
    </Section>
  );
}

export default function Summary() {
  const { agenda, budgets, cycle, essentials, insight, lastMessage, today, week } = usePersona();
  return (
    <>
      <section className="card card--yellow hero-card" aria-labelledby="summary-title">
        <p className="eyebrow">{today.label}</p>
        <h1 id="summary-title" className="hero-label">
          Available until {cycle.endsOn}
        </h1>
        <Amount value={cycle.left} size="xl" />
        <p className="hero-sub">
          About {cycle.perDay} RON a day for the next {cycle.daysLeftLabel}. {cycle.basis} <Src kind="est" />
        </p>
        {cycle.pace ? (
          <p className="hero-alert">
            <Icon name="clock" />
            <span>{cycle.pace}</span>
          </p>
        ) : null}
        <QuickActions items={SHORTCUTS} primaryTone="ink" />
      </section>

      {essentials ? <Essentials essentials={essentials} /> : null}

      <InfoCard icon={lastMessage.icon} meta={lastMessage.meta} title={lastMessage.title} text={lastMessage.text} />

      <Section title="This week" aside={<span className="small muted num">{lei(week.spent)} in {week.daysSoFar} days</span>}>
        <div className="card">
          <WeekStrip week={week} />
        </div>
      </Section>

      <Section title="Budgets" aside={<a className="link" href="#/bugete">See all</a>}>
        <ul className="card rows">
          {budgets
            .filter((budget) => budget.onHome)
            .map((budget) => (
              <BudgetRow key={budget.id} budget={budget} />
            ))}
        </ul>
      </Section>

      <Section title="What I noticed">
        <div className="card insight">
          <p className="insight-figure num">
            <span className="marker">{insight.figure}</span>
          </p>
          <p>
            {insight.text} <Src kind="obs" />
          </p>
        </div>
      </Section>

      <Section title="Coming up">
        <div className="card">
          <Agenda items={agenda} />
        </div>
      </Section>
    </>
  );
}
