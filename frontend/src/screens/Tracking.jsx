// Spending tracker: what was spent this budget period by category, what needs a look, and every payment by day.

import { useEffect, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import { Eyebrow, Link, RowMain, RowName, RowNote, Rows, Small, T } from "../components/base.jsx";
import { Icon } from "../components/icons.jsx";
import { CategoryLegend, ShareBar, TxRow } from "../components/tracking.jsx";
import { Amount, ChoiceChips, HeroCard, HeroLabel, HeroSub, IconTile, Split, Src } from "../components/ui.jsx";
import { lei } from "../lib/format.js";
import { usePersona, usePersonaApi } from "../persona.js";
import { personaPath, request } from "../lib/api.js";
import { ApiState } from "../components/ApiState.jsx";
import { color, fontFamily, radius, space, text } from "../theme.js";

export default function Tracking() {
  const persona = usePersona(), api = usePersonaApi();
  const [remote, setRemote] = useState(null), [query, setQuery] = useState(""), [filter, setFilter] = useState("all");
  const [attempt, retry] = useState(0);
  const searching = Boolean(query) || filter !== "all";
  const key = `${api.id}:${query}:${filter}:${attempt}`;
  useEffect(() => {
    if (!searching) return;
    const controller = new AbortController();
    const timer = setTimeout(() => request(personaPath(api.id, `/tracking?q=${encodeURIComponent(query)}&filter=${filter}`), { signal: controller.signal }).then((data) => { if (!controller.signal.aborted) setRemote({ key, data }); }).catch((error) => { if (!controller.signal.aborted) setRemote({ key, error }); }), 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [api.id, persona, query, filter, key, searching]);
  const pending = searching && remote?.key !== key;
  const error = searching && remote?.key === key ? remote.error : null;
  const packet = searching ? remote?.key === key && remote.data ? remote.data : { ...persona, days: [] } : persona;
  const { days, filters, review, spending } = packet;
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

      {review ? <Link href={`#/cheltuieli/${review.id}`} style={s.review} pressedStyle={{ backgroundColor: color.yellow }}>
        <IconTile icon="help" tone="yellow" />
        <RowMain>
          <RowName>{review.title}</RowName>
          <RowNote>{review.text}</RowNote>
        </RowMain>
        <Icon name="chevron" size={20} color={color.ink3} />
      </Link> : null}

      <View style={s.searchRow}>
        <View style={s.search}>
          <Icon name="search" color={color.ink3} />
          <TextInput
            accessibilityLabel="Caută în plăți"
            placeholder="Caută comerciant, sumă sau etichetă"
            placeholderTextColor={color.ink3}
            returnKeyType="search"
            value={query}
            onChangeText={setQuery}
            style={s.searchInput}
          />
        </View>
        <ChoiceChips label="Filtre" options={filters.map((option) => ({ ...option, selected: option.id === filter }))} onChange={(option) => setFilter(option.id)} scroll />
      </View>
      {pending ? <Small accessibilityLiveRegion="polite">Caut plățile…</Small> : null}
      {error ? <ApiState error={error} retry={() => retry((value) => value + 1)} /> : null}
      {!pending && !error && !days.length ? <Small muted>Nicio plată nu corespunde filtrelor alese.</Small> : null}

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
