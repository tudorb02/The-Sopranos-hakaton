import { useCallback, useEffect } from "react";
import { Intro, Small } from "../../components/base.jsx";
import { Group, Switch, Switches, Ticks } from "../../components/ui.jsx";
import { lei } from "../../lib/format.js";
import { usePersona, usePersonaApi } from "../../persona.js";

export function Apps() {
  const { apps } = usePersona();
  const api = usePersonaApi();
  const save = useCallback(() => api.mutate("/preferences", { permissions: { screen: apps.items.some((app) => app.on) } }), [api, apps.items]);
  useEffect(() => api.registerSubmit(save), [api, save]);
  return (
    <>
      <Intro eyebrow="Opțional" title="Folosești ce plătești?">
        <Small muted>{apps.found} Dacă vrei, verific dacă deschizi aplicațiile lor, ca să-ți spun când plătești ceva ce nu folosești.</Small>
      </Intro>

      <Group label="Alege ce urmăresc">
        <Switches>
          {apps.items.map((app) => (
            <Switch key={app.name} label={`${app.name} · ${lei(app.lei)} pe lună`} hint={app.note} checked={app.on} disabled={api.busy} onChange={(value) => api.mutate(`/apps/${encodeURIComponent(app.name)}`, { on: value })} />
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
