import { Icon } from "../../components/icons.jsx";
import { Disclaimer, IconTile, InfoCard, PrivacyPromise, Section, Src, Ticks } from "../../components/ui.jsx";
import { legal } from "../../data/legal.js";
import { usePersona } from "../../persona.js";

export function Intro() {
  const { intro } = usePersona();
  return (
    <>
      <section className="card card--yellow hero-card welcome" aria-labelledby="intro-title">
        <IconTile icon="compass" tone="ink" />
        <h1 id="intro-title" className="page-title">
          {intro.title}
        </h1>
        <p className="lead-text">{intro.lead}</p>
        <p className="pill-note">
          <Icon name="clock" />
          {intro.duration}
        </p>
      </section>

      <Section title="Ce fac">
        <Ticks yes={intro.does} />
      </Section>

      <PrivacyPromise legal={legal} />

      <Disclaimer legal={legal} />
    </>
  );
}

export function Done() {
  const { findings } = usePersona();
  const { firstStep } = findings;
  return (
    <>
      <header className="intro">
        <h1 className="page-title">Ce am găsit</h1>
        <p className="small muted">{findings.lead}</p>
      </header>

      <ul className="card rows">
        {findings.items.map((item) => (
          <li key={item.text} className="row">
            <div className="row-main">
              <span>{item.text}</span>
              {item.note ? <span className="row-note">{item.note}</span> : null}
            </div>
            <span className="row-value">
              <Src kind={item.src} label={item.label} />
            </span>
          </li>
        ))}
      </ul>

      <InfoCard icon={firstStep.icon} title={firstStep.title} text={firstStep.text}>
        <a className="btn btn--small" href={firstStep.href}>
          {firstStep.action}
        </a>
      </InfoCard>
    </>
  );
}
