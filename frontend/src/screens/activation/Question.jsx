import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { Small, T } from "../../components/base.jsx";
import { ChoiceChips, Field, IconTile } from "../../components/ui.jsx";
import { usePersona, usePersonaApi } from "../../persona.js";
import { toggleQuestionChoice } from "../../lib/forms.js";
import { color, shadowCard, space, text } from "../../theme.js";

// The coach asks: its icon next to a speech bubble.
export function CoachQuestion({ children }) {
  return (
    <View style={s.question}>
      <IconTile icon="compass" tone="yellow" />
      <View style={[s.bubble, shadowCard]}>
        <T style={s.title} accessibilityRole="header">
          {children}
        </T>
      </View>
    </View>
  );
}

// Text fields side by side when there is room; a select or a text area takes the whole line.
export function Fields({ fields, onChange, disabled }) {
  return (
    <View style={s.fields}>
      {fields.map((field) => (
        <Field key={field.label} field={field} disabled={disabled} onChange={onChange ? (value) => onChange(field.label, value) : undefined} style={field.type === "select" || field.type === "textarea" ? s.wide : s.narrow} />
      ))}
    </View>
  );
}

export function Question({ index }) {
  const { questions } = usePersona();
  const question = questions[index];
  const api = usePersonaApi();
  const [selected, setSelected] = useState(() => question.options.filter((option) => option.selected).map((option) => option.label));
  const [fields, setFields] = useState(() => Object.fromEntries((question.fields ?? []).map((field) => [field.label, field.value ?? ""])));
  const save = useCallback(() => api.mutate(`/answers/${question.id}`, { selected, fields }, "PUT"), [api, question.id, selected, fields]);
  useEffect(() => api.registerSubmit(save), [api, save]);
  return (
    <>
      <CoachQuestion>{question.title}</CoachQuestion>
      {question.hint ? <Small muted>{question.hint}</Small> : null}
      <ChoiceChips label={question.title} disabled={api.busy} options={question.options.map((option) => ({ ...option, selected: selected.includes(option.label) }))} onChange={(option) => setSelected((old) => toggleQuestionChoice(question, old, option.label))} />
      {question.fields ? <Fields disabled={api.busy} fields={question.fields.map((field) => ({ ...field, value: fields[field.label] }))} onChange={(label, value) => setFields((old) => ({ ...old, [label]: value }))} /> : null}
    </>
  );
}

const s = StyleSheet.create({
  question: { flexDirection: "row", alignItems: "flex-end", gap: space.sm },
  bubble: {
    flex: 1,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    backgroundColor: color.surface,
  },
  title: { fontSize: text.lg, fontWeight: 600, lineHeight: 1.35 },
  fields: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  narrow: { flexGrow: 1, flexBasis: 140 },
  wide: { width: "100%" },
});
