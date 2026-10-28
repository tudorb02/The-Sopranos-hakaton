import { ServiceCard } from "../components/services.jsx";
import { Disclaimer, Facts, Group, Meter, Src, Switch, ValueRow } from "../components/ui.jsx";
import { legal } from "../data/legal.js";
import { lei } from "../lib/format.js";
import { usePersona } from "../persona.js";

const CORRECT = (
  <button type="button" className="btn btn--text btn--small">
    Corectează
  </button>
);

export default function Profile() {
  const { profile, services } = usePersona();
  const top = Math.max(...profile.spending.map((item) => item.lei));
  return (
    <>
      <header className="intro">
        <h1 className="page-title">Ce știu despre tine</h1>
        <p className="small muted">
          Corectează sau șterge orice rând. Aceste date nu sunt folosite pentru evaluarea creditelor sau în scop de marketing.{" "}
          <a className="link" href="#/informare">
            Cine îți vede datele
          </a>
        </p>
        <p className="src-legend">
          <Src kind="obs" label="observat în tranzacții" />
          <Src kind="said" label="spus de tine" />
          <Src kind="agreed" label="stabilit împreună" />
          <Src kind="est" label="estimat" />
        </p>
      </header>

      <Group
        label="Extrasele tale"
        action={
          <a className="btn btn--text btn--small" href="#/extrase">
            Gestionează
          </a>
        }
      >
        <ul className="card rows">
          {profile.statements.map((source) => (
            <ValueRow key={source.name} icon={source.icon} name={source.name} note={source.note} value={<span className="status is-on">{source.status}</span>} />
          ))}
        </ul>
      </Group>

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

      <Group label="Cum comunicăm" action={CORRECT}>
        <Facts items={profile.talk} />
      </Group>

      <Group label="Confidențialitate">
        <div className="card switches">
          {legal.screenPrivacy.map((item) => (
            <Switch key={item.id} label={item.label} hint={item.hint} defaultChecked={item.on} />
          ))}
        </div>
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
          <Switch label="Sugestii din serviciile băncii" hint={services.hint} defaultChecked={services.on} />
        </div>
        <div className="service-list">
          {services.items.map((service) => (
            <ServiceCard key={service.id} service={service} compact />
          ))}
        </div>
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

      <Disclaimer legal={legal} link />

      <div className="deactivate">
        <button type="button" className="btn btn--text btn--danger">
          Dezactivează coach-ul
        </button>
        <p className="small muted">Extrasele importate și răspunsurile tale se șterg. Contul și cardurile nu sunt afectate.</p>
      </div>
    </>
  );
}
