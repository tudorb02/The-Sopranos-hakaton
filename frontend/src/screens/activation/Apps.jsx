import { Group, Switch, Ticks } from "../../components/ui.jsx";
import { apps } from "../../data/activation.js";
import { lei } from "../../lib/format.js";

export function Apps() {
  return (
    <>
      <header className="intro">
        <p className="eyebrow">Opțional</p>
        <h1 className="page-title">Folosești ce plătești?</h1>
        <p className="small muted">
          {apps.found} Dacă vrei, verific dacă deschizi aplicațiile lor, ca să-ți spun când plătești ceva ce nu folosești.
        </p>
      </header>

      <Group label="Alege ce urmăresc">
        <div className="card switches">
          {apps.items.map((app) => (
            <Switch key={app.name} label={`${app.name} · ${lei(app.lei)} pe lună`} hint={app.note} defaultChecked={app.on} />
          ))}
        </div>
      </Group>

      <Group label="Ce aflu și ce nu">
        <Ticks yes={apps.learns} no={apps.doesNotLearn} />
      </Group>

      <p className="small muted">{apps.platform}</p>
    </>
  );
}
