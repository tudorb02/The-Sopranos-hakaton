import { useState } from "react";
import { View } from "react-native";

import { Btn, Card, Intro, Row, RowMain, RowName, RowNote, Small, Status, T } from "../../components/base.jsx";
import { Agenda, ChoiceChips, Field, Group, IconTile, NoteCard, Section, Src, Ticks } from "../../components/ui.jsx";
import { usePersona, usePersonaApi } from "../../persona.js";
import { useRouter } from "../../router.jsx";
import { color, space, text } from "../../theme.js";
import { CoachQuestion } from "./Question.jsx";

export function Calendar() {
  const { calendar } = usePersona();
  const api = usePersonaApi(), { navigate } = useRouter();
  return (
    <>
      <Intro eyebrow="Opțional" title="Ce urmează în calendarul tău">
        <Small muted>Zilele de naștere și evenimentele mari intră în buget. Îți spun din timp când vine o lună încărcată.</Small>
      </Intro>

      <View style={{ gap: space.sm }}>
        {calendar.options.map((option, i) => (
          <Card key={option.id} style={{ padding: 0 }}>
            <Row>
              <IconTile icon={option.icon} tone={i === 0 ? "yellow" : "sand"} />
              <RowMain>
                <RowName>{option.title}</RowName>
                <RowNote>{option.note}</RowNote>
              </RowMain>
              <Btn href={option.href} variant={option.href ? "yellow" : "outline"} small disabled={api.busy} onPress={async () => { if (await api.mutate("/calendar", { connected: option.id })) navigate("#/activare/calendar/conectat"); }}>
                {option.action}
              </Btn>
            </Row>
          </Card>
        ))}
      </View>

      <Group label="Ce citesc și ce nu">
        <Ticks yes={calendar.reads} no={calendar.doesNotRead} />
      </Group>

      <NoteCard icon="lock">Acces doar pentru citire. Poți deconecta oricând din Profil → Permisiuni.</NoteCard>
    </>
  );
}

export function CalendarConnected() {
  const { calendar } = usePersona();
  const { gift } = calendar;
  const api = usePersonaApi();
  const [custom, setCustom] = useState(null);
  const [amount, setAmount] = useState("");
  const choose = (index, value) => api.mutate("/calendar", { gift_choices: gift.groups.map((group, i) => i === index ? value : group.selected) });
  return (
    <>
      <Intro title="Calendarul e conectat" />

      <Card style={{ padding: 0 }}>
        <Row>
          <IconTile icon="calendar" tone="yellow" />
          <RowMain>
            <RowName>{api.preferences?.calendar_connected === "phone" ? "Calendarul telefonului" : "Google Calendar"}</RowName>
            <RowNote>Doar citire · zilele de naștere și evenimentele marcate</RowNote>
          </RowMain>
          <Status tone="on">Conectat</Status>
        </Row>
      </Card>

      <Section title="Ce am găsit în lunile următoare">
        <Card>
          <Agenda items={calendar.found} />
        </Card>
      </Section>

      <View style={{ gap: space.sm }}>
        <CoachQuestion>{gift.question}</CoachQuestion>
        {gift.groups.map((group, index) => (
          <View key={group.label} style={{ gap: space["2xs"] }}>
            <T style={{ fontSize: text.sm, fontWeight: 600, color: color.ink2 }}>{group.label}</T>
            <ChoiceChips label={group.label} options={group.options.map((label) => ({ label, selected: label === group.selected || label === "Altă sumă" && !group.options.includes(group.selected) }))} onChange={(option) => {
              if (option.label === "Altă sumă") { setCustom(index); setAmount(""); }
              else choose(index, option.label);
            }} />
            {custom === index ? <View style={{ gap: space.sm }}><Field disabled={api.busy} field={{ label: "Altă sumă", value: amount, suffix: "lei", numeric: true }} onChange={setAmount} /><Btn small disabled={api.busy} onPress={async () => { if (await choose(index, `${amount} lei`)) setCustom(null); }}>Salvează suma</Btn></View> : null}
            {!group.options.includes(group.selected) ? <Small muted>{group.selected}</Small> : null}
          </View>
        ))}
        <Small>
          {gift.result} <Src kind="est" />
        </Small>
      </View>
    </>
  );
}
