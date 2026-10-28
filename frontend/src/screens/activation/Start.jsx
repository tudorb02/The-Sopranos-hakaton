import { StyleSheet, View } from "react-native";

import { Btn, Card, Intro as PageIntro, PageTitle, Row, RowMain, RowNote, Rows, Small, T } from "../../components/base.jsx";
import { Icon } from "../../components/icons.jsx";
import { Disclaimer, IconTile, InfoCard, PrivacyPromise, Section, Src, Ticks } from "../../components/ui.jsx";
import { legal } from "../../data/legal.js";
import { usePersona } from "../../persona.js";
import { color, radius, space, text } from "../../theme.js";

// The yellow welcome of a flow: icon, title, lead, how long it takes.
export function Welcome({ icon, eyebrow, title, lead, duration }) {
  return (
    <Card yellow style={s.welcome}>
      <IconTile icon={icon} tone="ink" />
      {eyebrow ? <T style={s.eyebrow}>{eyebrow}</T> : null}
      <PageTitle>{title}</PageTitle>
      <T style={{ color: color.ink2 }}>{lead}</T>
      <View style={s.pill}>
        <Icon name="clock" size={18} />
        <T style={s.pillText}>{duration}</T>
      </View>
    </Card>
  );
}

export function Intro() {
  const { intro } = usePersona();
  return (
    <>
      <Welcome icon="compass" title={intro.title} lead={intro.lead} duration={intro.duration} />

      <Section title="Ce fac">
        <Ticks yes={intro.does} />
      </Section>

      <PrivacyPromise legal={legal} />

      <Disclaimer legal={legal} />
    </>
  );
}

export function Done() {
  const { findings } = usePersona();
  const { firstStep } = findings;
  return (
    <>
      <PageIntro title="Ce am găsit">
        <Small muted>{findings.lead}</Small>
      </PageIntro>

      <Rows>
        {findings.items.map((item) => (
          <Row key={item.text}>
            <RowMain>
              <T>{item.text}</T>
              {item.note ? <RowNote>{item.note}</RowNote> : null}
            </RowMain>
            <Src kind={item.src} label={item.label} />
          </Row>
        ))}
      </Rows>

      <InfoCard icon={firstStep.icon} title={firstStep.title} text={firstStep.text}>
        <Btn href={firstStep.href} small>
          {firstStep.action}
        </Btn>
      </InfoCard>
    </>
  );
}

const s = StyleSheet.create({
  welcome: { gap: space.sm, paddingTop: space.lg, alignItems: "flex-start" },
  eyebrow: { fontSize: text.cap, fontWeight: 600, color: color.ink2, textTransform: "uppercase", letterSpacing: 0.72 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingLeft: 8,
    paddingRight: 12,
    borderRadius: radius.pill,
    backgroundColor: color.surface,
  },
  pillText: { fontSize: text.sm, fontWeight: 600 },
});
