import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { Btn, Card, Intro, Row, RowMain, RowName, RowNote, RowValue, Rows, Small, Stack, Status, T, TextLink } from "../components/base.jsx";
import { ServiceCard } from "../components/services.jsx";
import { Chips, Disclaimer, Facts, Field, Group, Meter, Src, Switch, Switches, ValueRow } from "../components/ui.jsx";
import { lei } from "../lib/format.js";
import { usePersona, usePersonaApi } from "../persona.js";
import { useRouter } from "../router.jsx";
import { color, space, text } from "../theme.js";

const Correct = ({ onPress }) => (
  <Btn variant="text" small style={s.groupBtn} onPress={onPress}>
    Corectează
  </Btn>
);

export default function Profile() {
  const { profile, services, legal } = usePersona();
  const api = usePersonaApi(), { navigate } = useRouter();
  const [editing, setEditing] = useState(null), [draft, setDraft] = useState([]), [deactivating, setDeactivating] = useState(false);
  const edit = (section) => { setEditing(section); setDraft(profile[section].map((item) => ({ id: item.id, label: item.label, value: item.value }))); };
  const editor = (section) => editing === section ? <View style={{ gap: space.sm }}>{draft.map((item, index) => <Field key={item.id} field={{ label: item.label, value: item.value }} onChange={(value) => setDraft((old) => old.map((row, i) => i === index ? { ...row, value } : row))} />)}
    <Btn disabled={api.busy} onPress={async () => { if (await api.mutate(`/profile/${section}`, { items: draft })) setEditing(null); }}>Salvează</Btn>
    <Btn variant="text" onPress={() => setEditing(null)}>Anulează</Btn></View> : <Facts items={profile[section]} />;
  const onService = (service, action) => api.mutate(`/services/${service.id}`, { action });
  return (
    <>
      <Intro title="Ce știu despre tine">
        <Small muted>
          Corectează sau șterge orice rând. Aceste date nu sunt folosite pentru evaluarea creditelor sau în scop de marketing.{" "}
          <TextLink href="#/informare">Cine îți vede datele</TextLink>
        </Small>
        <View style={s.legend}>
          <Src kind="obs" label="observat în tranzacții" />
          <Src kind="said" label="spus de tine" />
          <Src kind="agreed" label="stabilit împreună" />
          <Src kind="est" label="estimat" />
        </View>
      </Intro>

      <Group
        label="Extrasele tale"
        action={
          <Btn href="#/extrase" variant="text" small style={s.groupBtn}>
            Gestionează
          </Btn>
        }
      >
        <Rows>
          {profile.statements.map((source) => (
            <ValueRow key={source.name} icon={source.icon} name={source.name} note={source.note} value={<Status tone="on">{source.status}</Status>} />
          ))}
        </Rows>
      </Group>

      <Group label="Despre tine" action={<Correct onPress={() => edit("about")} />}>
        {editor("about")}
      </Group>

      <Group label="Banii tăi" action={<Correct onPress={() => edit("money")} />}>
        {editor("money")}
      </Group>

      <Group label="Unde se duc banii · media pe lună">
        <Rows>
          {profile.spending.map((item) => (
            <View key={item.name} style={s.barRow}>
              <View style={s.barTop}>
                <RowMain>
                  <RowName>{item.name}</RowName>
                  {item.note ? <RowNote>{item.note}</RowNote> : null}
                </RowMain>
                <RowValue>{lei(item.lei)}</RowValue>
              </View>
              <Meter percent={api.metrics.profile[item.name]} />
            </View>
          ))}
        </Rows>
      </Group>

      <Group label="Ce am observat">
        <Facts items={profile.observed} />
      </Group>

      <Group label="Abonamente">
        <Rows>
          {profile.subscriptions.map((sub) => (
            <Row key={sub.name}>
              <RowMain>
                <RowName>{sub.name}</RowName>
                {sub.note ? <RowNote>{sub.note}</RowNote> : null}
                {sub.status ? (
                  <T style={s.status}>
                    {sub.status} <Src kind="agreed" />
                  </T>
                ) : null}
              </RowMain>
              <RowValue>
                {lei(sub.lei)}
                <T style={s.of}> / lună</T>
              </RowValue>
            </Row>
          ))}
        </Rows>
      </Group>

      <Group label="Cum comunicăm" action={<Correct onPress={() => edit("talk")} />}>
        {editor("talk")}
      </Group>

      <Group label="Confidențialitate">
        <Switches>
          {legal.screenPrivacy.map((item) => (
            <Switch key={item.id} label={item.label} hint={item.hint} checked={item.on} disabled={api.busy} onChange={(value) => api.mutate("/preferences", { privacy: { [item.id]: value } })} />
          ))}
        </Switches>
      </Group>

      <Group label="Permisiuni">
        <Switches>
          {profile.permissions.map((item) => (
            <Switch key={item.id} label={item.label} hint={item.hint} checked={item.on} disabled={api.busy} onChange={(value) => api.mutate("/preferences", { permissions: { [item.id]: value } })} />
          ))}
        </Switches>
      </Group>

      <Group label="Servicii care te-ar ajuta">
        <Switches>
          <Switch label="Sugestii din serviciile băncii" hint={services.hint} checked={services.on} disabled={api.busy} onChange={(value) => api.mutate("/preferences", { services_on: value })} />
        </Switches>
        <View style={{ gap: space.sm }}>
          {services.items.map((service) => (
            <ServiceCard key={service.id} service={service} compact onAction={onService} busy={api.busy} />
          ))}
        </View>
      </Group>

      <Group label="Ce nu știu încă">
        <Card>
          <Stack>
            <Chips items={profile.unknown} onSelect={async (topic) => { if (await api.mutate("/chat/messages", { text: `Aș vrea să vorbim despre: ${topic}.` }, "POST")) navigate("#/chat"); }} />
            <Small muted>Te întreb doar dacă vrei. Alege un subiect și vorbim.</Small>
          </Stack>
        </Card>
      </Group>

      <Disclaimer legal={legal} link />

      <View style={s.deactivate}>
        <Btn variant="danger" onPress={() => setDeactivating(true)} disabled={api.busy}>Dezactivează coach-ul</Btn>
        <Small muted style={{ textAlign: "center" }}>
          Extrasele importate și răspunsurile tale se șterg. Contul și cardurile nu sunt afectate.
        </Small>
        {deactivating ? <><Small>Confirmi ștergerea datelor din coach?</Small><Btn variant="danger" disabled={api.busy} onPress={() => api.mutate("/coach", undefined, "DELETE")}>Da, șterge datele coach-ului</Btn><Btn variant="text" onPress={() => setDeactivating(false)}>Anulează</Btn></> : null}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  legend: { flexDirection: "row", flexWrap: "wrap", columnGap: space.md, rowGap: space["2xs"] },
  groupBtn: { minHeight: 32, marginVertical: -6 },
  barRow: { gap: space.xs, paddingVertical: space.sm, paddingHorizontal: space.md },
  barTop: { flexDirection: "row", alignItems: "center", gap: space.sm },
  status: { fontSize: text.sm, color: color.ink2 },
  of: { fontWeight: 400, color: color.ink3 },
  deactivate: { alignItems: "center", gap: space["2xs"] },
});
