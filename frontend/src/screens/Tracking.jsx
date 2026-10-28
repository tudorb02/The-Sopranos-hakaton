// Spending tracker: what was spent this budget period by category, what needs a look, and every payment by day.

import { StyleSheet, TextInput, View } from "react-native";

import { Eyebrow, Link, RowMain, RowName, RowNote, Rows, Small, T } from "../components/base.jsx";
import { Icon } from "../components/icons.jsx";
import { CategoryLegend, ShareBar, TxRow } from "../components/tracking.jsx";
import { Amount, ChoiceChips, HeroCard, HeroLabel, HeroSub, IconTile, Split, Src } from "../components/ui.jsx";
import { lei } from "../lib/format.js";
import { usePersona } from "../persona.js";
import { color, fontFamily, radius, space, text } from "../theme.js";

export default function Tracking() {
  const { days, filters, review, spending } = usePersona();
  return (
    <>
      <HeroCard>
        <Eyebrow style={{ marginBottom: space.xs }}>Cheltuieli · {spending.period}</Eyebrow>
        <HeroLabel>{spending.title}</HeroLabel>
        <Amount value={spending.total} size="xl" />
        <HeroSub>
          {spending.compare} <Src kind="est" />
        </HeroSub>
        <Split>
          <ShareBar parts={spending.parts} total={spending.total} />
          <CategoryLegend parts={spending.parts} total={spending.total} />
          <Small muted>
            Plus {lei(spending.fixed)} cheltuieli fixe: {spending.fixedNote}.
          </Small>
        </Split>
      </HeroCard>

      <Link href={`#/cheltuieli/${review.id}`} style={s.review} pressedStyle={{ backgroundColor: color.yellow }}>
        <IconTile icon="help" tone="yellow" />
        <RowMain>
          <RowName>{review.title}</RowName>
          <RowNote>{review.text}</RowNote>
        </RowMain>
        <Icon name="chevron" size={20} color={color.ink3} />
      </Link>

      <View style={s.searchRow}>
        <View style={s.search}>
          <Icon name="search" color={color.ink3} />
          <TextInput
            accessibilityLabel="Caută în plăți"
            placeholder="Caută comerciant, sumă sau etichetă"
            placeholderTextColor={color.ink3}
            returnKeyType="search"
            style={s.searchInput}
          />
        </View>
        <ChoiceChips label="Filtre" options={filters} scroll />
      </View>

      {days.map((day) => (
        <View key={day.date} style={s.section} accessibilityLabel={`${day.label}, ${day.date}`}>
          <View style={s.dayHead}>
            <T style={s.dayText}>
              <T style={s.dayLabel}>{day.label}</T> · {day.date}
            </T>
            <T style={[s.dayText, { fontVariant: ["tabular-nums"] }]}>−{lei(day.total)}</T>
          </View>
          <Rows>
            {day.items.map((tx) => (
              <TxRow key={tx.id} tx={tx} />
            ))}
          </Rows>
        </View>
      ))}
    </>
  );
}

const s = StyleSheet.create({
  review: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.card,
    backgroundColor: color.yellowSoft,
  },
  searchRow: { gap: space.sm },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    minHeight: 46,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: color.surface,
    borderWidth: 1.5,
    borderColor: color.line,
  },
  searchInput: { flex: 1, minWidth: 0, fontFamily: fontFamily[400], fontSize: text.md, color: color.ink, paddingVertical: 10, outlineStyle: "none" },
  section: { gap: space.sm },
  dayHead: { flexDirection: "row", justifyContent: "space-between", gap: space.sm, paddingHorizontal: space["2xs"] },
  dayText: { fontSize: text.sm, color: color.ink3 },
  dayLabel: { fontWeight: 600, color: color.ink },
});
