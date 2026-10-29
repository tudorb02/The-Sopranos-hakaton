import { ServiceCard } from "../components/services.jsx";
import { Disclaimer, Facts, Group, Meter, Src, Switch, ValueRow } from "../components/ui.jsx";
import { legal } from "../data/legal.js";
import { lei } from "../lib/format.js";
import { usePersona } from "../persona.js";

const CORRECT = (
  <button type="button" className="btn btn--text btn--small">
    Correct
  </button>
);

export default function Profile() {
  const { profile, services } = usePersona();
  const top = Math.max(...profile.spending.map((item) => item.lei));
  return (
    <>
      <header className="intro">
        <h1 className="page-title">What I know about you</h1>
        <p className="small muted">
          Correct or delete any line. This data is not used for credit assessment or for marketing.{" "}
          <a className="link" href="#/informare">
            Who sees your data
          </a>
        </p>
        <p className="src-legend">
          <Src kind="obs" label="observed in transactions" />
          <Src kind="said" label="said by you" />
          <Src kind="agreed" label="agreed together" />
          <Src kind="est" label="estimated" />
        </p>
      </header>

      <Group
        label="Your statements"
        action={
          <a className="btn btn--text btn--small" href="#/extrase">
            Manage
          </a>
        }
      >
        <ul className="card rows">
          {profile.statements.map((source) => (
            <ValueRow key={source.name} icon={source.icon} name={source.name} note={source.note} value={<span className="status is-on">{source.status}</span>} />
          ))}
        </ul>
      </Group>

      <Group label="About you" action={CORRECT}>
        <Facts items={profile.about} />
      </Group>

      <Group label="Your money" action={CORRECT}>
        <Facts items={profile.money} />
      </Group>

      <Group label="Where the money goes · monthly average">
        <ul className="card rows">
          {profile.spending.map((item) => (
            <li key={item.name} className="row row--bar">
              <div className="row-main">
                <span className="row-name">{item.name}</span>
                {item.note ? <span className="row-note">{item.note}</span> : null}
              </div>
              <span className="row-value">{lei(item.lei)}</span>
              <Meter value={item.lei} max={top} />
            </li>
          ))}
        </ul>
      </Group>

      <Group label="What I noticed">
        <Facts items={profile.observed} />
      </Group>

      <Group label="Subscriptions">
        <ul className="card rows">
          {profile.subscriptions.map((sub) => (
            <li key={sub.name} className="row">
              <div className="row-main">
                <span className="row-name">{sub.name}</span>
                {sub.note ? <span className="row-note">{sub.note}</span> : null}
                {sub.status ? (
                  <span className="row-status">
                    {sub.status} <Src kind="agreed" />
                  </span>
                ) : null}
              </div>
              <span className="row-value">
                {lei(sub.lei)}
                <span className="of"> / month</span>
              </span>
            </li>
          ))}
        </ul>
      </Group>

      <Group label="How we talk" action={CORRECT}>
        <Facts items={profile.talk} />
      </Group>

      <Group label="Privacy">
        <div className="card switches">
          {legal.screenPrivacy.map((item) => (
            <Switch key={item.id} label={item.label} hint={item.hint} defaultChecked={item.on} />
          ))}
        </div>
      </Group>

      <Group label="Permissions">
        <div className="card switches">
          {profile.permissions.map((item) => (
            <Switch key={item.id} label={item.label} hint={item.hint} defaultChecked={item.on} />
          ))}
        </div>
      </Group>

      <Group label="Services that could help you">
        <div className="card switches">
          <Switch label="Suggestions from the bank's services" hint={services.hint} defaultChecked={services.on} />
        </div>
        <div className="service-list">
          {services.items.map((service) => (
            <ServiceCard key={service.id} service={service} compact />
          ))}
        </div>
      </Group>

      <Group label="What I don't know yet">
        <div className="card stack">
          <div className="chips">
            {profile.unknown.map((topic) => (
              <button key={topic} type="button" className="chip">
                {topic}
              </button>
            ))}
          </div>
          <p className="small muted">I only ask if you want me to. Pick a topic and we'll talk.</p>
        </div>
      </Group>

      <Disclaimer legal={legal} link />

      <div className="deactivate">
        <button type="button" className="btn btn--text btn--danger">
          Turn off the coach
        </button>
        <p className="small muted">Your imported statements and answers are deleted. Your account and cards are not affected.</p>
      </div>
    </>
  );
}
