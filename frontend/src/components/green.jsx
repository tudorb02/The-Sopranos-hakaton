// Pieces of the green-credit flow for businesses, shared by every area (design/pj-greenstruct.md §9).

import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { num, pct } from "../lib/format.js";
import { caps, color, radius, shadowCard, space, text } from "../theme.js";
import { Btn, Card, Link, Row, RowMain, RowName, RowNote, Rows, Small, Status, T } from "./base.jsx";
import { Bar, GuideLine } from "./charts.jsx";
import { Icon } from "./icons.jsx";
import { IconTile, Src, StateDot } from "./ui.jsx";

// Where a company figure comes from: "din ANAF", "din APIA"; without a source, the client fills it in.
export function From({ source }) {
  return source ? <Src kind="obs" label={`din ${source}`} /> : <Src kind="said" label="completat de tine" />;
}

// An area of the platform: available (opens its flow) or coming soon (greyed, no action).
export function SectorCard({ sector }) {
  const available = sector.status === "available";
  const body = (
    <>
      <IconTile icon={sector.icon} tone={available ? "yellow" : "sand"} />
      <RowMain>
        <RowName style={!available && s.soonText}>{sector.name}</RowName>
        <RowNote>{sector.text}</RowNote>
      </RowMain>
      {available ? <Icon name="chevron" size={20} color={color.ink3} /> : <Status tone="soon">În curând</Status>}
    </>
  );
  return available ? (
    <Link href={sector.href} style={[s.sector, shadowCard]} pressedStyle={s.sectorPressed}>
      {body}
    </Link>
  ) : (
    <View style={[s.sector, s.soon]}>{body}</View>
  );
}

// A type of investment; the chosen one is shown as pressed. A tap moves the choice, nothing is stored.
export function ModuleGrid({ modules, selected }) {
  const [chosen, setChosen] = useState(selected);
  return (
    <View style={s.modules} accessibilityLabel="Categoria investiției">
      {modules.map((module) => (
        <ModuleCard key={module.id} module={module} selected={module.id === chosen} onPress={() => setChosen(module.id)} />
      ))}
    </View>
  );
}

export function ModuleCard({ module, selected, onPress }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[s.module, shadowCard, selected && s.moduleOn]}>
      <View style={{ marginBottom: space.xs }}>
        <IconTile icon={module.icon} tone={selected ? "yellow" : "sand"} />
      </View>
      <RowName>{module.name}</RowName>
      <RowNote style={{ fontSize: text.cap }}>{module.example}</RowNote>
    </Pressable>
  );
}

const DOC_STATES = {
  done: { label: "Încărcat", tone: "on" },
  ready: { label: "Gata", tone: "on" },
  missing: { label: "Lipsește", tone: "warn" },
  optional: { label: "Opțional", tone: undefined },
};

// One document of the checklist; a missing one gets an upload button. A missing optional document
// (required: false) is not a gap: it only makes the estimate more precise.
export function DocumentRow({ doc, state }) {
  const missing = (state?.state ?? "missing") === "missing";
  const status = missing && doc.required === false ? DOC_STATES.optional : DOC_STATES[state?.state ?? "missing"];
  return (
    <Row>
      <IconTile icon="file" tone="sand" />
      <RowMain>
        <RowName>{doc.name}</RowName>
        {state?.file ? <RowNote>{state.file}</RowNote> : null}
        <Status tone={status.tone} style={{ marginTop: space["2xs"] }}>
          {status.label}
        </Status>
      </RowMain>
      {missing ? (
        <Btn variant="outline" small>
          Încarcă
        </Btn>
      ) : null}
    </Row>
  );
}

// Standard vs green, one block per term: the label, then the two values side by side.
export function OfferCompare({ columns, rows }) {
  return (
    <Card style={s.compare} accessibilityLabel={`${columns[0]} și ${columns[1]}`}>
      <View style={s.compareRow}>
        <T style={[s.compareHead, s.cell]}>{columns[0]}</T>
        <View style={[s.cell, s.green, s.compareGreenHead]}>
          <Icon name="leaf" size={14} />
          <T style={[s.compareHead, { color: color.ink }]}>{columns[1]}</T>
        </View>
      </View>
      {rows.map((row) => (
        <View key={row.label} style={s.compareBlock}>
          <T style={s.compareLabel}>{row.label}</T>
          <View style={s.compareRow}>
            <T style={[s.cell, s.cellText]}>{row.a}</T>
            <T style={[s.cell, s.cellText, s.green, { fontWeight: 600 }]}>{row.b}</T>
          </View>
        </View>
      ))}
    </Card>
  );
}

// A year of instalments: the green credit's bars fall in the income months, the dashed line is the
// standard credit's equal monthly instalment.
export function PaymentsChart({ payments }) {
  const paid = payments.months.filter((month) => month.eur);
  const summary = paid.map((month) => month.name).join(", ");
  return (
    <View style={s.payments}>
      <View
        style={s.plot}
        accessibilityRole="image"
        accessibilityLabel={`Credit verde: ${num(payments.green)} EUR în ${summary}. Credit standard: ${num(payments.standard)} EUR în fiecare lună.`}
      >
        {payments.months.map((month) => (
          <View key={month.name} style={s.bar}>
            {month.eur ? <Bar p={pct(month.eur, payments.scaleMax)} style={s.fill} /> : null}
          </View>
        ))}
        <GuideLine p={pct(payments.standard, payments.scaleMax)} />
      </View>
      <View style={s.labels} aria-hidden>
        {payments.months.map((month) => (
          <T key={month.name} style={[s.label, month.eur && s.labelOn]}>
            {month.short}
          </T>
        ))}
      </View>
      <Small muted>
        Barele: creditul verde, {num(payments.green)} EUR în lunile cu încasări. Linia punctată: creditul standard, {num(payments.standard)} EUR în fiecare
        lună.
      </Small>
    </View>
  );
}

// Where a dossier stands, as the steps of a payment in the app.
export function StatusSteps({ steps }) {
  return (
    <Rows>
      {steps.map((step) => (
        <Row key={step.label}>
          <StateDot state={step.state} />
          <RowMain>
            <RowName>{step.label}</RowName>
            <RowNote>{step.note}</RowNote>
          </RowMain>
        </Row>
      ))}
    </Rows>
  );
}

const s = StyleSheet.create({
  sector: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: "transparent",
    backgroundColor: color.surface,
  },
  sectorPressed: { borderColor: color.ink },
  soon: { backgroundColor: "transparent", borderColor: color.line },
  soonText: { color: color.ink3 },
  modules: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  module: {
    width: "47%",
    flexGrow: 1,
    alignItems: "flex-start",
    gap: 2,
    padding: space.md,
    borderRadius: radius.card,
    backgroundColor: color.surface,
  },
  moduleOn: { backgroundColor: color.yellowSoft, borderWidth: 2, borderColor: color.ink, padding: space.md - 2 },
  compare: { padding: 0, overflow: "hidden" },
  compareRow: { flexDirection: "row" },
  compareBlock: { borderTopWidth: 1, borderTopColor: color.line },
  compareHead: { fontSize: text.cap, fontWeight: 700, color: color.ink2, ...caps(text.cap, 0.04) },
  compareGreenHead: { flexDirection: "row", alignItems: "center", gap: space["2xs"] },
  compareLabel: { paddingTop: space.xs, paddingHorizontal: space.md, fontSize: text.cap, color: color.ink3 },
  cell: { flex: 1, paddingVertical: space.xs, paddingHorizontal: space.md },
  cellText: { fontSize: text.sm },
  green: { backgroundColor: color.yellowSoft },
  payments: { gap: space.xs },
  plot: { height: 96, flexDirection: "row", gap: 4 },
  bar: { flex: 1, justifyContent: "flex-end", overflow: "hidden", borderRadius: 4, backgroundColor: color.sand },
  fill: { backgroundColor: color.yellow, borderWidth: 1.5, borderColor: color.ink, borderBottomWidth: 0 },
  labels: { flexDirection: "row", gap: 4 },
  label: { flex: 1, fontSize: text.cap, textAlign: "center", color: color.ink3 },
  labelOn: { color: color.ink, fontWeight: 700 },
});
