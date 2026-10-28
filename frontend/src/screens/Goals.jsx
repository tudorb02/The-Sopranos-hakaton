import { StyleSheet, View } from "react-native";

import { Btn, Card, CardTitle, RowValue, Rows, Small, Stack, T, TextLink } from "../components/base.jsx";
import { PlanChart } from "../components/charts.jsx";
import { ServiceCard } from "../components/services.jsx";
import { Amount, Aside, GoalHead, HeroCard, HeroLabel, HeroSub, Meter, Section, Src, ValueRow } from "../components/ui.jsx";
import { lei } from "../lib/format.js";
import { usePersona } from "../persona.js";
import { color, radius, space } from "../theme.js";

export default function Goals() {
  const { goal, nextGoals, pots, reserve, services } = usePersona();
  const serviceById = (id) => services.items.find((item) => item.id === id);
  const suggestion = goal.suggestion ? serviceById(goal.suggestion) : null;
  return (
    <>
      <HeroCard>
        <GoalHead icon={goal.icon} title={goal.name} sub={goal.note} aside={<Src kind="agreed" />} style={{ marginBottom: space.md }} />
        <HeroLabel>Economisit până acum</HeroLabel>
        <View style={s.amountLine}>
          <Amount value={goal.saved} size="lg" />
          <T style={{ color: color.ink3 }}> din {lei(goal.amount)}</T>
        </View>
        <Meter value={goal.saved} max={goal.amount} style={{ marginVertical: space.xs }} />
        <HeroSub>
          {goal.due.label} <T style={{ fontWeight: 600, color: color.ink }}>{goal.due.date}</T> · {goal.due.note}
        </HeroSub>
      </HeroCard>

      <Section title="Planul lunar">
        <Card>
          <Stack>
            <PlanChart plan={goal.plan} total={goal.amount} />
            <Small muted>{goal.reason}</Small>
          </Stack>
        </Card>
      </Section>

      <Section title="Din ce economisești" aside={<Src kind="est" label={goal.fundingLabel} />}>
        <Rows>
          {goal.funding.map((item) => (
            <ValueRow key={item.name} name={item.name} value={`aprox. ${lei(item.lei)}`} />
          ))}
        </Rows>
      </Section>

      {nextGoals.length ? (
        <Section title="Următorul obiectiv">
          {nextGoals.map((item) => (
            <Card key={item.name} style={{ gap: space.md }}>
              <GoalHead icon={item.icon} tone="sand" title={item.name} sub={item.when} small aside={<RowValue>{lei(item.amount)}</RowValue>} />
              <Small>{item.text}</Small>
              <TextLink href={item.href}>{item.action}</TextLink>
            </Card>
          ))}
        </Section>
      ) : null}

      <Section title="Unde păstrezi banii">
        <ServiceCard service={serviceById(goal.storage)} />
      </Section>

      {suggestion ? (
        <Section title="Sugestie din serviciile băncii" aside={<Aside>cel mult una pe săptămână</Aside>}>
          <ServiceCard service={suggestion} />
        </Section>
      ) : null}

      {pots.length ? (
        <Section title="Bani puși deoparte">
          <Rows>
            {pots.map((pot) => (
              <ValueRow key={pot.name} icon={pot.icon} name={pot.name} note={pot.note} value={lei(pot.lei)} />
            ))}
          </Rows>
        </Section>
      ) : null}

      {reserve ? (
        <View style={s.empty}>
          <CardTitle>{reserve.title}</CardTitle>
          <Small muted>{reserve.text}</Small>
          <Btn href={reserve.href} variant="outline">
            {reserve.action}
          </Btn>
        </View>
      ) : null}
    </>
  );
}

const s = StyleSheet.create({
  amountLine: { flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", gap: space["2xs"] },
  empty: {
    alignItems: "flex-start",
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: color.ink3,
  },
});
