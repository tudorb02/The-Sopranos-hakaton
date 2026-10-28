import { PlanChart } from "../components/charts.jsx";
import { Amount, IconTile, Meter, Section, Src, ValueRow } from "../components/ui.jsx";
import { goal, pots } from "../data/demo.js";
import { lei } from "../lib/format.js";

export default function Goals() {
  return (
    <>
      <section className="card hero-card" aria-labelledby="goal-title">
        <div className="goal-head">
          <IconTile icon="target" tone="yellow" />
          <div>
            <h1 id="goal-title" className="card-title">
              {goal.name}
            </h1>
            <p className="small muted">Din economii, fără rate</p>
          </div>
          <Src kind="agreed" />
        </div>
        <p className="hero-label">Strâns până acum</p>
        <p className="amount-line">
          <Amount value={0} size="lg" />
          <span className="muted"> din {lei(goal.amount)}</span>
        </p>
        <Meter value={0} max={goal.amount} />
        <p className="hero-sub">
          Gata pe <b>{goal.readyOn}</b> · prima depunere pe {goal.firstDeposit}
        </p>
      </section>

      <Section title="Planul pe luni">
        <div className="card stack">
          <PlanChart plan={goal.plan} total={goal.amount} />
          <p className="small muted">{goal.reason}</p>
        </div>
      </Section>

      <Section title="Din ce strângi" aside={<Src kind="est" label="estimat, ian.–mar." />}>
        <ul className="card rows">
          {goal.funding.map((item) => (
            <ValueRow key={item.name} name={item.name} value={`~${lei(item.lei)}`} />
          ))}
        </ul>
      </Section>

      <Section title="Unde stau banii">
        <div className="card stack">
          <div className="service-head">
            <p className="row-name">Cont de economii Super Acces Plus</p>
            <Src kind="agreed" />
          </div>
          <p className="small">
            FixPay mută 700 lei pe 5 ianuarie și pe 5 februarie, apoi 600 lei pe 5 martie. Poți retrage oricând.
          </p>
          <dl className="terms">
            <div>
              <dt>Cost FixPay</dt>
              <dd>0 lei în pachetul ZERO Simplu</dd>
            </div>
            <div>
              <dt>Dobândă</dt>
              <dd>2,00% pe an, variabilă, minus impozitul de 10%</dd>
            </div>
          </dl>
          <details className="why">
            <summary>De ce îți propun asta</summary>
            <p>Pe 28 octombrie ai spus că vrei să pui bani deoparte la început de lună. Fără FixPay, poți muta banii și tu, pe 5.</p>
          </details>
          <p className="small muted">Surse: raiffeisen.ro, tarife (01.09.2026) și cont de economii (30.06.2026)</p>
        </div>
      </Section>

      <Section title="Bani puși deoparte">
        <ul className="card rows">
          {pots.map((pot) => (
            <ValueRow key={pot.name} icon={pot.icon} name={pot.name} note={pot.note} value={lei(pot.lei)} />
          ))}
        </ul>
      </Section>

      <section className="card empty" aria-labelledby="reserve-title">
        <h2 id="reserve-title" className="card-title">
          Rezervă pentru neprevăzute
        </h2>
        <p className="small muted">Nu am vorbit încă despre asta. O rezervă te ajută când apare o cheltuială pe care n-ai planificat-o.</p>
        <a className="btn btn--outline" href="#/chat">
          Hai să vorbim
        </a>
      </section>
    </>
  );
}
