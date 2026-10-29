import { Group, Switch, Ticks } from "../../components/ui.jsx";
import { lei } from "../../lib/format.js";
import { usePersona } from "../../persona.js";

export function Apps() {
  const { apps } = usePersona();
  return (
    <>
      <header className="intro">
        <p className="eyebrow">Optional</p>
        <h1 className="page-title">Do you use what you pay for?</h1>
        <p className="small muted">
          {apps.found} If you like, I can check whether you open their apps, so I can tell you when you pay for something you don't use.
        </p>
      </header>

      <Group label="Choose what I track">
        <div className="card switches">
          {apps.items.map((app) => (
            <Switch key={app.name} label={`${app.name} · ${lei(app.lei)} a month`} hint={app.note} defaultChecked={app.on} />
          ))}
        </div>
      </Group>

      <Group label="What I learn and what I don't">
        <Ticks yes={apps.learns} no={apps.doesNotLearn} />
      </Group>

      <p className="small muted">{apps.platform}</p>
    </>
  );
}
