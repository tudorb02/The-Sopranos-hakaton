import { Facts, Group, Meter, Src, Switch } from "../components/ui.jsx";
import { profile } from "../data/demo.js";
import { lei } from "../lib/format.js";

const CORRECT = (
  <button type="button" className="btn btn--text btn--small">
    Corectează
  </button>
);

export default function Profile() {
  const top = Math.max(...profile.spending.map((item) => item.lei));
  return (
    <>
      <header className="intro">
        <h1 className="page-title">Ce știu despre tine</h1>
        <p className="small muted">Corectează sau șterge orice rând. Datele astea nu se folosesc pentru credit sau reclame.</p>
        <p className="src-legend">
          <Src kind="obs" label="observat în tranzacții" />
          <Src kind="said" label="spus de tine" />
          <Src kind="agreed" label="stabilit împreună" />
          <Src kind="est" label="estimat" />
        </p>
      </header>

      <Group label="Despre tine" action={CORRECT}>
        <Facts items={profile.about} />
      </Group>

      <Group label="Banii tăi" action={CORRECT}>
        <Facts items={profile.money} />
      </Group>

      <Group label="Unde se duc banii · media pe lună">
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

      <Group label="Ce am observat">
        <Facts items={profile.observed} />
      </Group>

      <Group label="Abonamente">
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
                <span className="of"> / lună</span>
              </span>
            </li>
          ))}
        </ul>
      </Group>

      <Group label="Cum vorbim" action={CORRECT}>
        <Facts items={profile.talk} />
      </Group>

      <Group label="Permisiuni">
        <div className="card switches">
          {profile.permissions.map((item) => (
            <Switch key={item.id} label={item.label} hint={item.hint} defaultChecked={item.on} />
          ))}
        </div>
      </Group>

      <Group label="Servicii care te-ar ajuta">
        <div className="card switches">
          <Switch label="Sugestii din serviciile băncii" hint={profile.services.hint} defaultChecked={profile.services.on} />
        </div>
        <ul className="card rows">
          {profile.services.items.map((service) => (
            <li key={service.name} className="row">
              <div className="row-main">
                <span className="row-name">{service.name}</span>
                <span className="row-note">{service.text}</span>
                <span className={service.active ? "status is-on" : "status"}>{service.status}</span>
              </div>
            </li>
          ))}
        </ul>
      </Group>

      <Group label="Ce nu știu încă">
        <div className="card stack">
          <div className="chips">
            {profile.unknown.map((topic) => (
              <button key={topic} type="button" className="chip">
                {topic}
              </button>
            ))}
          </div>
          <p className="small muted">Te întreb doar dacă vrei. Alege un subiect și vorbim.</p>
        </div>
      </Group>

      <button type="button" className="btn btn--text btn--danger">
        Șterge tot ce știe coach-ul
      </button>
    </>
  );
}
