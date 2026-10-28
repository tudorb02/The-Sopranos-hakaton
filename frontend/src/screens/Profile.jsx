import { StyleSheet, View } from "react-native";

import { Btn, Card, Intro, Row, RowMain, RowName, RowNote, RowValue, Rows, Small, Stack, Status, T, TextLink } from "../components/base.jsx";
import { ServiceCard } from "../components/services.jsx";
import { Chips, Disclaimer, Facts, Group, Meter, Src, Switch, Switches, ValueRow } from "../components/ui.jsx";
import { legal } from "../data/legal.js";
import { lei } from "../lib/format.js";
import { usePersona } from "../persona.js";
import { color, space, text } from "../theme.js";

const Correct = () => (
  <Btn variant="text" small style={s.groupBtn}>
    Corectează
  </Btn>
);

export default function Profile() {
  const { profile, services } = usePersona();
  const top = Math.max(...profile.spending.map((item) => item.lei));
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

      <Group label="Despre tine" action={<Correct />}>
        <Facts items={profile.about} />
      </Group>

      <Group label="Banii tăi" action={<Correct />}>
        <Facts items={profile.money} />
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
              <Meter value={item.lei} max={top} />
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

      <Group label="Cum comunicăm" action={<Correct />}>
        <Facts items={profile.talk} />
      </Group>

      <Group label="Confidențialitate">
        <Switches>
          {legal.screenPrivacy.map((item) => (
            <Switch key={item.id} label={item.label} hint={item.hint} defaultChecked={item.on} />
          ))}
        </Switches>
      </Group>

      <Group label="Permisiuni">
        <Switches>
          {profile.permissions.map((item) => (
            <Switch key={item.id} label={item.label} hint={item.hint} defaultChecked={item.on} />
          ))}
        </Switches>
      </Group>

      <Group label="Servicii care te-ar ajuta">
        <Switches>
          <Switch label="Sugestii din serviciile băncii" hint={services.hint} defaultChecked={services.on} />
        </Switches>
        <View style={{ gap: space.sm }}>
          {services.items.map((service) => (
            <ServiceCard key={service.id} service={service} compact />
          ))}
        </View>
      </Group>

      <Group label="Ce nu știu încă">
        <Card>
          <Stack>
            <Chips items={profile.unknown} />
            <Small muted>Te întreb doar dacă vrei. Alege un subiect și vorbim.</Small>
          </Stack>
        </Card>
      </Group>

      <Disclaimer legal={legal} link />

      <View style={s.deactivate}>
        <Btn variant="danger">Dezactivează coach-ul</Btn>
        <Small muted style={{ textAlign: "center" }}>
          Extrasele importate și răspunsurile tale se șterg. Contul și cardurile nu sunt afectate.
        </Small>
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
