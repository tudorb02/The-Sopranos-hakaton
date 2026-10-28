// Development ideas for a client without a stable income (design/coach-students.md §6): more income,
// free money education from the bank, opportunities. Each idea starts from a goal or interest the client stated.

import { StyleSheet, View } from "react-native";

import { Btn, BtnRow, Card, Intro, Row, RowMain, RowName, RowNote, Rows, Small, Status, T } from "../components/base.jsx";
import { ExternalLink } from "../components/services.jsx";
import { Aside, Disclosure, GoalHead, IconTile, NoteCard, Section, Src } from "../components/ui.jsx";
import { usePersona, usePersonaApi } from "../persona.js";
import { space, text } from "../theme.js";

export default function Ideas() {
  const { ideas } = usePersona();
  const api = usePersonaApi();
  const { featured } = ideas;
  return (
    <>
      <Intro title={ideas.title}>
        <Small muted>{ideas.lead}</Small>
      </Intro>

      <Card yellow style={{ gap: space.sm }}>
        <GoalHead icon={featured.icon} tone="ink" eyebrow={featured.eyebrow} title={featured.title} />
        <Small>
          {featured.text} <Src kind="est" />
        </Small>
        <View style={s.effects}>
          {featured.effects.map((effect) => (
            <View key={effect} style={s.effect}>
              <T style={s.effectText}>•</T>
              <T style={[s.effectText, { flex: 1 }]}>{effect}</T>
            </View>
          ))}
        </View>
        <Disclosure variant="why" summary="De ce îți propun asta">
          {featured.why}
        </Disclosure>
        <BtnRow>
          {featured.actions.map((action, i) => (
            <Btn key={action} small variant={i === 0 ? "ink" : "text"} onYellow={i > 0} disabled={api.busy} onPress={() => api.mutate("/ideas/decision", { decision: i === 0 ? "accepted" : "dismissed" }, "POST")}>
              {action}
            </Btn>
          ))}
        </BtnRow>
        {featured.decision ? <Small accessibilityLiveRegion="polite">{featured.decision === "accepted" ? "Ideea este adăugată în plan." : "Ai ales să nu urmezi această idee."}</Small> : null}
      </Card>

      {ideas.groups.map((group) => (
        <Section key={group.title} title={group.title} aside={group.note ? <Aside>{group.note}</Aside> : null}>
          <Rows>
            {group.items.map((item) => (
              <Row key={item.title} style={{ alignItems: "flex-start" }}>
                <IconTile icon={item.icon} tone="sand" />
                <RowMain>
                  <RowName>{item.title}</RowName>
                  <RowNote>{item.text}</RowNote>
                  {item.link ? (
                    <View style={{ marginTop: space["2xs"] }}>
                      <ExternalLink link={item.link} />
                    </View>
                  ) : null}
                  {item.status ? <Status style={{ marginTop: space["2xs"] }}>{item.status}</Status> : null}
                </RowMain>
              </Row>
            ))}
          </Rows>
        </Section>
      ))}

      <NoteCard icon="shield">{ideas.rules}</NoteCard>
    </>
  );
}

const s = StyleSheet.create({
  effects: { gap: space["2xs"], paddingLeft: space["2xs"] },
  effect: { flexDirection: "row", gap: space.xs },
  effectText: { fontSize: text.sm, fontWeight: 600 },
});
