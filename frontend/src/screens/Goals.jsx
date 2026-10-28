import { PlanChart } from "../components/charts.jsx";
import { ServiceCard } from "../components/services.jsx";
import { Amount, IconTile, Meter, Section, Src, ValueRow } from "../components/ui.jsx";
import { lei } from "../lib/format.js";
import { usePersona } from "../persona.js";

export default function Goals() {
  const { goal, nextGoals, pots, reserve, services } = usePersona();
  const serviceById = (id) => services.items.find((item) => item.id === id);
  const suggestion = goal.suggestion ? serviceById(goal.suggestion) : null;
  return (
    <>
      <section className="card hero-card" aria-labelledby="goal-title">
        <div className="goal-head">
          <IconTile icon={goal.icon} tone="yellow" />
          <div>
            <h1 id="goal-title" className="card-title">
              {goal.name}
            </h1>
            <p className="small muted">{goal.note}</p>
          </div>
          <Src kind="agreed" />
        </div>
        <p className="hero-label">Economisit până acum</p>
        <p className="amount-line">
          <Amount value={goal.saved} size="lg" />
          <span className="muted"> din {lei(goal.amount)}</span>
        </p>
        <Meter value={goal.saved} max={goal.amount} />
        <p className="hero-sub">
          {goal.due.label} <b>{goal.due.date}</b> · {goal.due.note}
        </p>
      </section>

      <Section title="Planul lunar">
        <div className="card stack">
          <PlanChart plan={goal.plan} total={goal.amount} />
          <p className="small muted">{goal.reason}</p>
        </div>
      </Section>

      <Section title="Din ce economisești" aside={<Src kind="est" label={goal.fundingLabel} />}>
        <ul className="card rows">
          {goal.funding.map((item) => (
            <ValueRow key={item.name} name={item.name} value={`aprox. ${lei(item.lei)}`} />
          ))}
        </ul>
      </Section>

      {nextGoals.length ? (
        <Section title="Următorul obiectiv">
          {nextGoals.map((item) => (
            <div key={item.name} className="card stack">
              <div className="goal-head goal-head--flush">
                <IconTile icon={item.icon} tone="sand" />
                <div>
                  <p className="row-name">{item.name}</p>
                  <p className="small muted">{item.when}</p>
                </div>
                <span className="row-value">{lei(item.amount)}</span>
              </div>
              <p className="small">{item.text}</p>
              <a className="link" href={item.href}>
                {item.action}
              </a>
            </div>
          ))}
        </Section>
      ) : null}

      <Section title="Unde păstrezi banii">
        <ServiceCard service={serviceById(goal.storage)} />
      </Section>

      {suggestion ? (
        <Section title="Sugestie din serviciile băncii" aside={<span className="small muted">cel mult una pe săptămână</span>}>
          <ServiceCard service={suggestion} />
        </Section>
      ) : null}

      {pots.length ? (
        <Section title="Bani puși deoparte">
          <ul className="card rows">
            {pots.map((pot) => (
              <ValueRow key={pot.name} icon={pot.icon} name={pot.name} note={pot.note} value={lei(pot.lei)} />
            ))}
          </ul>
        </Section>
      ) : null}

      {reserve ? (
        <section className="card empty" aria-labelledby="reserve-title">
          <h2 id="reserve-title" className="card-title">
            {reserve.title}
          </h2>
          <p className="small muted">{reserve.text}</p>
          <a className="btn btn--outline" href={reserve.href}>
            {reserve.action}
          </a>
        </section>
      ) : null}
    </>
  );
}
