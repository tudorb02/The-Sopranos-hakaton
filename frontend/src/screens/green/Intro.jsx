// The welcome screen of the green-credit flow: static copy of the area's pack (data/green/agro/modules.js).

import { Icon } from "../../components/icons.jsx";
import { Disclaimer, IconTile, Section, Ticks } from "../../components/ui.jsx";
import { greenLegal } from "../../data/green/legal.js";

export function Intro({ pack }) {
  const { intro } = pack;
  return (
    <>
      <section className="card card--yellow hero-card welcome" aria-labelledby="green-intro-title">
        <IconTile icon="leaf" tone="ink" />
        <p className="eyebrow">{pack.sectorName}</p>
        <h1 id="green-intro-title" className="page-title">
          {intro.title}
        </h1>
        <p className="lead-text">{intro.lead}</p>
        <p className="pill-note">
          <Icon name="clock" />
          {intro.duration}
        </p>
      </section>

      <Section title="Cum decurge">
        <ol className="card steps">
          {intro.steps.map((step, i) => (
            <li key={step}>
              <span className="step-num">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Ce face aplicația">
        <Ticks yes={intro.does} no={intro.doesNot} />
      </Section>

      <Section title="Ce să ai la îndemână">
        <Ticks yes={intro.bring} />
      </Section>

      <Disclaimer legal={greenLegal} link href="#/verde/informare" />
    </>
  );
}
