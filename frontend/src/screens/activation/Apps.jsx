import { Intro, Small } from "../../components/base.jsx";
import { Group, Switch, Switches, Ticks } from "../../components/ui.jsx";
import { lei } from "../../lib/format.js";
import { usePersona } from "../../persona.js";

export function Apps() {
  const { apps } = usePersona();
  return (
    <>
      <Intro eyebrow="Opțional" title="Folosești ce plătești?">
        <Small muted>{apps.found} Dacă vrei, verific dacă deschizi aplicațiile lor, ca să-ți spun când plătești ceva ce nu folosești.</Small>
      </Intro>

      <Group label="Alege ce urmăresc">
        <Switches>
          {apps.items.map((app) => (
            <Switch key={app.name} label={`${app.name} · ${lei(app.lei)} pe lună`} hint={app.note} defaultChecked={app.on} />
          ))}
        </Switches>
      </Group>

      <Group label="Ce aflu și ce nu">
        <Ticks yes={apps.learns} no={apps.doesNotLearn} />
      </Group>

      <Small muted>{apps.platform}</Small>
    </>
  );
}
