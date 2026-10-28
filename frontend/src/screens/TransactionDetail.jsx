// Details of one payment: rename it, move it to another category, add a note, tags, a rule or the receipt.
// Every field shows example values only; nothing is saved.

import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { Btn, BtnRow, Card, CardTitle, Small, Status, T } from "../components/base.jsx";
import { CategoryPicker, CategoryTile, TxAmount } from "../components/tracking.jsx";
import { ChoiceChips, Field, Group, GroupHint, NoteCard, Switch, Switches } from "../components/ui.jsx";
import { usePersona, usePersonaApi } from "../persona.js";
import { amountMinor } from "../lib/api.js";
import { documentPayload, pickDocument } from "../lib/files";
import { color, space, text } from "../theme.js";

export default function TransactionDetail({ id }) {
  const { categoryNotes, client, days, pickerCategories, tagSuggestions } = usePersona();
  const day = days.find((item) => item.items.some((payment) => payment.id === id));
  const tx = day ? { ...day.items.find((payment) => payment.id === id), day } : null;
  if (!tx) return <Small muted>Plata nu există în datele demo.</Small>;
  return <TransactionEditor tx={tx} client={client} categoryNotes={categoryNotes} pickerCategories={pickerCategories} tagSuggestions={tagSuggestions} />;
}

function TransactionEditor({ tx, client, categoryNotes, pickerCategories, tagSuggestions }) {
  const api = usePersonaApi();
  const { categories } = usePersona();
  const [draft, setDraft] = useState({ name: tx.name, category: tx.category, note: tx.note ?? "", tags: tx.tags ?? [], rule: Boolean(tx.rule), excluded: tx.excluded ?? tx.category === "economii" });
  const [newCategory, setNewCategory] = useState(null), [newTag, setNewTag] = useState(null), [splitting, setSplitting] = useState(false);
  const [parts, setParts] = useState([{ category: tx.category, amount: "" }, { category: pickerCategories.find((id) => id !== tx.category), amount: "" }]);
  const change = (key, value) => setDraft((old) => ({ ...old, [key]: value }));
  const save = useCallback(() => api.mutate(`/transactions/${tx.id}`, draft), [api, tx.id, draft]);
  useEffect(() => api.registerSubmit(save), [api, save]);
  const upload = async () => {
    try { const file = await pickDocument(true); if (file) await api.mutate(`/transactions/${tx.id}/receipt`, await documentPayload(file), "POST"); }
    catch (error) { api.reportError(error); }
  };
  const split = async () => {
    try { if (await api.mutate(`/transactions/${tx.id}/splits`, { parts: parts.map((part) => ({ category: part.category, amount_minor: amountMinor(part.amount) })) }, "POST")) setSplitting(false); }
    catch (error) { api.reportError(error); }
  };

  const tags = [...new Set([...draft.tags, ...tagSuggestions])].map((tag) => ({ label: `#${tag}`, selected: draft.tags.includes(tag) }));
  const note = categoryNotes[draft.category];
  return (
    <>
      <Card style={s.hero}>
        <CategoryTile id={tx.category} size="lg" />
        <TxAmount value={tx.lei} size="xl" />
        <CardTitle style={{ textAlign: "center" }}>{tx.name || tx.merchant}</CardTitle>
        <Small muted>
          {tx.day.label}, {tx.day.date} · {tx.time}
        </Small>
        <View style={s.heroMeta}>
          <Status tone={tx.status === "În așteptare" ? undefined : "on"}>{tx.status}</Status>
          <Small muted>{client.card}</Small>
        </View>
      </Card>

      <Group label="Pe extras">
        <Card>
          <T style={s.raw}>{tx.raw}</T>
        </Card>
      </Group>

      <Group label="Cum vrei să apară">
        <Field disabled={api.busy} field={{ label: "Denumire", value: draft.name, placeholder: "Ce ai cumpărat?" }} onChange={(value) => change("name", value)} />
        <GroupHint>Denumirea se schimbă doar în coach. Extrasul rămâne neschimbat.</GroupHint>
      </Group>

      <Group label="Categorie">
        <CategoryPicker disabled={api.busy} ids={pickerCategories} selected={draft.category} suggested={tx.suggestion} onChange={(value) => change("category", value)} onCreate={() => setNewCategory("")} />
        {newCategory !== null ? <View style={{ gap: space.sm }}><Field disabled={api.busy} field={{ label: "Categorie nouă", value: newCategory }} onChange={setNewCategory} /><Btn small disabled={api.busy} onPress={async () => { if (await api.mutate("/categories", { label: newCategory }, "POST")) setNewCategory(null); }}>Adaugă categoria</Btn></View> : null}
      </Group>

      {note ? <NoteCard icon={tx.category === "nesortat" ? "help" : "compass"}>{note}</NoteCard> : null}

      <Group label="Notă și etichete">
        <Field disabled={api.busy} field={{ label: "Notă", type: "textarea", value: draft.note, placeholder: "De exemplu: cadou pentru Ana" }} onChange={(value) => change("note", value)} />
        <ChoiceChips disabled={api.busy} label="Etichete" options={[...tags, { label: "+ Etichetă nouă" }]} onChange={(option) => {
          if (option.label === "+ Etichetă nouă") return setNewTag("");
          const tag = option.label.slice(1); change("tags", draft.tags.includes(tag) ? draft.tags.filter((item) => item !== tag) : [...draft.tags, tag]);
        }} />
        {newTag !== null ? <View style={{ gap: space.sm }}><Field disabled={api.busy} field={{ label: "Etichetă nouă", value: newTag }} onChange={setNewTag} /><Btn small onPress={() => { if (newTag.trim()) { change("tags", [...new Set([...draft.tags, newTag.trim()])]); setNewTag(null); } }}>Adaugă eticheta</Btn></View> : null}
      </Group>

      <Group label="Reguli">
        <Switches>
          <Switch
            label={`Aplică pentru toate plățile către ${tx.merchant}`}
            hint={tx.history ?? "Plățile viitoare primesc același nume și aceeași categorie"}
            checked={draft.rule} onChange={(value) => change("rule", value)}
          />
          <Switch label="Exclude din cheltuieli" hint="De exemplu, dacă cineva îți returnează banii" checked={draft.excluded} onChange={(value) => change("excluded", value)} />
        </Switches>
      </Group>

      <BtnRow>
        <Btn variant="outline" small icon="split" onPress={() => setSplitting(!splitting)} disabled={api.busy}>
          Împarte plata
        </Btn>
        <Btn variant="outline" small icon="receipt" onPress={upload} disabled={api.busy}>
          Atașează bonul fiscal
        </Btn>
      </BtnRow>
      {tx.receipt ? <Small>Bon atașat: {tx.receipt.name}</Small> : null}
      {tx.splits ? <Small>Plată împărțită în {tx.splits.length} categorii.</Small> : null}
      {splitting ? <Group label="Împarte suma în două categorii">{parts.map((part, index) => <View key={index} style={{ gap: space.sm }}>
        <Field disabled={api.busy} field={{ label: `Categoria ${index + 1}`, type: "select", value: categories[part.category].label, options: pickerCategories.map((id) => categories[id].label) }} onChange={(value) => setParts((old) => old.map((item, i) => i === index ? { ...item, category: pickerCategories.find((id) => categories[id].label === value) } : item))} />
        <Field disabled={api.busy} field={{ label: `Suma ${index + 1}`, value: part.amount, numeric: true, suffix: "lei" }} onChange={(value) => setParts((old) => old.map((item, i) => i === index ? { ...item, amount: value } : item))} />
      </View>)}<Btn small onPress={split} disabled={api.busy}>Salvează împărțirea</Btn></Group> : null}
    </>
  );
}

const s = StyleSheet.create({
  hero: { alignItems: "center", gap: space["2xs"], paddingVertical: space.lg },
  heroMeta: { flexDirection: "row", alignItems: "center", gap: space.xs, marginTop: space.xs },
  raw: { fontSize: text.sm, color: color.ink2, letterSpacing: 0.28 },
});
