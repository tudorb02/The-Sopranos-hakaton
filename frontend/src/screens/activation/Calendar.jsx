import { View } from "react-native";

import { Btn, Card, Intro, Row, RowMain, RowName, RowNote, Small, Status, T } from "../../components/base.jsx";
import { Agenda, ChoiceChips, Group, IconTile, NoteCard, Section, Src, Ticks } from "../../components/ui.jsx";
import { usePersona } from "../../persona.js";
import { color, space, text } from "../../theme.js";
import { CoachQuestion } from "./Question.jsx";

export function Calendar() {
  const { calendar } = usePersona();
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
              <Btn href={option.href} variant={option.href ? "yellow" : "outline"} small>
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
  return (
    <>
      <Intro title="Calendarul e conectat" />

      <Card style={{ padding: 0 }}>
        <Row>
          <IconTile icon="calendar" tone="yellow" />
          <RowMain>
            <RowName>Google Calendar</RowName>
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
        {gift.groups.map((group) => (
          <View key={group.label} style={{ gap: space["2xs"] }}>
            <T style={{ fontSize: text.sm, fontWeight: 600, color: color.ink2 }}>{group.label}</T>
            <ChoiceChips label={group.label} options={group.options.map((label) => ({ label, selected: label === group.selected }))} />
          </View>
        ))}
        <Small>
          {gift.result} <Src kind="est" />
        </Small>
      </View>
    </>
  );
}
