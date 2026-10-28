// Pieces of the spending tracker: category icons, the share bar, transaction rows, the category picker.

import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { categories } from "../data/tracking.js";
import { lei } from "../lib/format.js";
import { categoryTones, color, radius, space, text } from "../theme.js";
import { Link, T } from "./base.jsx";
import { Icon } from "./icons.jsx";
import { Amount } from "./ui.jsx";

export function CategoryTile({ id, size }) {
  const tone = categoryTones[categories[id].tone];
  const lg = size === "lg";
  return (
    <View style={[s.tile, { backgroundColor: tone.bg }, lg && s.tileLg]} aria-hidden>
      <Icon name={categories[id].icon} size={lg ? 28 : 21} color={tone.fg} />
    </View>
  );
}

// Signed amount in the app's style: "−30" large, ",00 lei" small.
export function TxAmount({ value, size = "md" }) {
  return <Amount value={Math.abs(value)} size={size} prefix={value < 0 ? "−" : "+"} income={value > 0} />;
}

const percent = (part, total) => Math.round((part.lei / total) * 100);

// Variable spending by category: one segment per category, 2px gaps, colour fixed per category.
export function ShareBar({ parts }) {
  return (
    <View style={s.share} accessibilityRole="image" accessibilityLabel={parts.map((part) => `${categories[part.id].label} ${lei(part.lei)}`).join(", ")}>
      {parts.map((part, i) => (
        <View
          key={part.id}
          style={[
            s.sharePart,
            { flexGrow: part.lei, backgroundColor: categoryTones[categories[part.id].tone].dot },
            i === 0 && s.first,
            i === parts.length - 1 && s.last,
          ]}
        />
      ))}
    </View>
  );
}

export function CategoryLegend({ parts, total }) {
  return (
    <View style={s.legend}>
      {parts.map((part) => (
        <View key={part.id} style={s.legendItem}>
          <View style={[s.dot, { backgroundColor: categoryTones[categories[part.id].tone].dot }]} aria-hidden />
          <T style={[s.legendText, s.flex]}>{categories[part.id].label}</T>
          <T style={[s.legendText, s.num]}>{lei(part.lei)}</T>
          <T style={[s.legendText, s.num, s.percent]}>{percent(part, total)}%</T>
        </View>
      ))}
    </View>
  );
}

function Flag({ icon, review, children }) {
  return (
    <View style={[s.flag, review && s.flagReview]}>
      {icon ? <Icon name={icon} size={12} strokeWidth={2} color={color.ink2} /> : null}
      <T style={[s.flagText, review && { color: color.ink }]}>{children}</T>
    </View>
  );
}

// One payment in the list; the whole row opens its details.
export function TxRow({ tx }) {
  const category = categories[tx.category];
  const title = tx.name || tx.merchant;
  const meta = [tx.name && tx.name !== tx.merchant ? tx.merchant : null, category.label, tx.time].filter(Boolean).join(" · ");
  const pending = tx.status === "În așteptare";
  return (
    <Link href={`#/cheltuieli/${tx.id}`} style={s.tx} pressedStyle={{ backgroundColor: color.rowPressed }}>
      <CategoryTile id={tx.category} />
      <View style={s.txMain}>
        <T style={s.txName} numberOfLines={1}>
          {title}
        </T>
        <T style={s.txMeta} numberOfLines={1}>
          {meta}
        </T>
        {tx.needsReview || tx.renamed || tx.recurring || pending ? (
          <View style={s.flags}>
            {tx.needsReview ? <Flag review>De verificat</Flag> : null}
            {pending ? <Flag>În așteptare</Flag> : null}
            {tx.recurring ? <Flag icon="repeat">Recurentă</Flag> : null}
            {tx.renamed && !tx.recurring ? <Flag icon="pencil">Redenumită</Flag> : null}
          </View>
        ) : null}
      </View>
      <TxAmount value={tx.lei} size="sm" />
    </Link>
  );
}

// Categories as tiles; `selected` is chosen, `suggested` is the coach's proposal for an unsorted payment.
// A tap moves the choice; nothing is saved.
export function CategoryPicker({ ids, selected, suggested }) {
  const [chosen, setChosen] = useState(selected);
  return (
    <View style={s.picker} accessibilityLabel="Categorie">
      {ids.map((id) => (
        <Pressable
          key={id}
          accessibilityRole="button"
          accessibilityState={{ selected: id === chosen }}
          onPress={() => setChosen(id)}
          style={[s.option, id === chosen && s.optionOn]}
        >
          <CategoryTile id={id} />
          <T style={s.optionText}>{categories[id].label}</T>
          {id === suggested ? (
            <View style={s.optionFlag}>
              <Flag review>Sugestie</Flag>
            </View>
          ) : null}
        </Pressable>
      ))}
      <Pressable accessibilityRole="button" style={s.option}>
        <View style={[s.tile, { backgroundColor: color.sand }]} aria-hidden>
          <Icon name="tag" size={21} />
        </View>
        <T style={[s.optionText, { color: color.teal }]}>Categorie nouă</T>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  num: { fontVariant: ["tabular-nums"] },
  tile: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20 },
  tileLg: { width: 56, height: 56, borderRadius: 28, marginBottom: space.xs },
  share: { flexDirection: "row", gap: 2, height: 12 },
  sharePart: { flexBasis: 0, minWidth: 4, borderRadius: 2 },
  first: { borderTopLeftRadius: 4, borderBottomLeftRadius: 4 },
  last: { borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  legend: { gap: 6 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: space.xs },
  legendText: { fontSize: text.sm },
  percent: { width: 44, textAlign: "right", color: color.ink3 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  tx: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.sm, paddingHorizontal: space.md },
  txMain: { flex: 1, minWidth: 0, gap: 1 },
  txName: { fontWeight: 600 },
  txMeta: { fontSize: text.sm, color: color.ink3 },
  flags: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 3 },
  flag: { flexDirection: "row", alignItems: "center", gap: 3, paddingVertical: 1, paddingHorizontal: 8, borderRadius: radius.pill, backgroundColor: color.sand },
  flagReview: { backgroundColor: color.yellow },
  flagText: { fontSize: 11, fontWeight: 600, color: color.ink2, lineHeight: 18 },
  picker: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  option: {
    width: "31%",
    flexGrow: 1,
    maxWidth: "33%",
    alignItems: "center",
    gap: 6,
    paddingVertical: space.sm,
    paddingHorizontal: space["2xs"],
    borderRadius: 14,
    backgroundColor: color.surface,
    borderWidth: 1.5,
    borderColor: color.line,
  },
  optionOn: { backgroundColor: color.yellowSoft, borderWidth: 2.5, borderColor: color.ink },
  optionText: { fontSize: text.sm, fontWeight: 600, textAlign: "center" },
  optionFlag: { position: "absolute", top: 6, right: 6 },
});
