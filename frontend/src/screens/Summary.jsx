import { StyleSheet } from "react-native";

import { Card, Eyebrow, Row, RowName, RowValue, Rows, Status, T, TextLink } from "../components/base.jsx";
import { WeekStrip } from "../components/charts.jsx";
import {
  Agenda,
  Amount,
  Aside,
  BudgetRow,
  HeroAlert,
  HeroCard,
  HeroLabel,
  HeroSub,
  InfoCard,
  Marker,
  NoteCard,
  QuickActions,
  Section,
  Src,
  ValueRow,
} from "../components/ui.jsx";
import { lei } from "../lib/format.js";
import { usePersona } from "../persona.js";
import { color, radius, space, text } from "../theme.js";

const SHORTCUTS = [
  { href: "#/cheltuieli", icon: "receipt", label: "Cheltuieli" },
  { href: "#/bugete", icon: "pie", label: "Bugete" },
  { href: "#/chat", icon: "chat", label: "Întreabă" },
];

// The last row of a list, on yellow: what is left.
export function TotalRow({ label, value }) {
  return (
    <Row style={s.total}>
      <RowName style={s.totalText}>{label}</RowName>
      <RowValue style={s.totalValue}>{value}</RowValue>
    </Row>
  );
}

// Without a stable income (Matei), the necessary expenses come right after the main figure.
function Essentials({ essentials }) {
  return (
    <Section title={essentials.title} aside={<Aside>{lei(essentials.total)}</Aside>}>
      <Rows>
        {essentials.items.map((item) => (
          <ValueRow
            key={item.name}
            icon={item.icon}
            name={item.name}
            note={item.note}
            value={item.status ? <Status tone="on">{item.status}</Status> : lei(item.lei)}
          />
        ))}
        <TotalRow label={essentials.rest.label} value={lei(essentials.rest.lei)} />
      </Rows>
      {essentials.pending ? <NoteCard icon="clock">{essentials.pending}</NoteCard> : null}
    </Section>
  );
}

export default function Summary() {
  const { agenda, budgets, cycle, essentials, insight, lastMessage, today, week } = usePersona();
  return (
    <>
      <HeroCard yellow>
        <Eyebrow style={{ marginBottom: space.xs }}>{today.label}</Eyebrow>
        <HeroLabel>Disponibil până pe {cycle.endsOn}</HeroLabel>
        <Amount value={cycle.left} size="xl" />
        <HeroSub>
          Circa {cycle.perDay} lei pe zi, pentru următoarele {cycle.daysLeftLabel}. {cycle.basis} <Src kind="est" />
        </HeroSub>
        {cycle.pace ? <HeroAlert icon="clock">{cycle.pace}</HeroAlert> : null}
        <QuickActions items={SHORTCUTS} primaryTone="ink" />
      </HeroCard>

      {essentials ? <Essentials essentials={essentials} /> : null}

      {lastMessage ? <InfoCard icon={lastMessage.icon} meta={lastMessage.meta} title={lastMessage.title} text={lastMessage.text} /> : null}

      <Section title="Săptămâna aceasta" aside={<Aside>{`${lei(week.spent)} în ${week.daysSoFar} zile`}</Aside>}>
        <Card>
          <WeekStrip week={week} />
        </Card>
      </Section>

      <Section title="Bugete" aside={<TextLink href="#/bugete">Vezi toate</TextLink>}>
        <Rows>
          {budgets
            .filter((budget) => budget.onHome)
            .map((budget) => (
              <BudgetRow key={budget.id} budget={budget} />
            ))}
        </Rows>
      </Section>

      {insight ? (
        <Section title="Ce am observat">
          <Card style={s.insight}>
            <Marker style={s.figure}>{insight.figure}</Marker>
            <T style={{ flex: 1 }}>
              {insight.text} <Src kind="obs" />
            </T>
          </Card>
        </Section>
      ) : null}

      {agenda.length ? (
        <Section title="Ce urmează">
          <Card>
            <Agenda items={agenda} />
          </Card>
        </Section>
      ) : null}
    </>
  );
}

const s = StyleSheet.create({
  total: { backgroundColor: color.yellowSoft, borderBottomLeftRadius: radius.card, borderBottomRightRadius: radius.card },
  totalText: { flex: 1, fontWeight: 700 },
  totalValue: { fontWeight: 700 },
  insight: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  figure: { fontSize: text.xl, fontWeight: 700, lineHeight: 32, letterSpacing: -0.56, fontVariant: ["tabular-nums"] },
});
