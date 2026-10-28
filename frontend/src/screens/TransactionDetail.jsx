// Details of one payment: rename it, move it to another category, add a note, tags, a rule or the receipt.
// Every field shows example values only; nothing is saved.

import { StyleSheet, View } from "react-native";

import { Btn, BtnRow, Card, CardTitle, Small, Status, T } from "../components/base.jsx";
import { CategoryPicker, CategoryTile, TxAmount } from "../components/tracking.jsx";
import { ChoiceChips, Field, Group, GroupHint, NoteCard, Switch, Switches } from "../components/ui.jsx";
import { usePersona } from "../persona.js";
import { color, space, text } from "../theme.js";

export default function TransactionDetail({ id }) {
  const { categoryNotes, client, days, pickerCategories, tagSuggestions } = usePersona();
  const day = days.find((item) => item.items.some((payment) => payment.id === id));
  const tx = day ? { ...day.items.find((payment) => payment.id === id), day } : null;
  if (!tx) return <Small muted>Plata nu există în datele demo.</Small>;

  const tags = [...new Set([...(tx.tags ?? []), ...tagSuggestions])].map((tag) => ({ label: `#${tag}`, selected: Boolean(tx.tags?.includes(tag)) }));
  const note = categoryNotes[tx.category];
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
        <Field field={{ label: "Denumire", value: tx.name, placeholder: "Ce ai cumpărat?" }} />
        <GroupHint>Denumirea se schimbă doar în coach. Extrasul rămâne neschimbat.</GroupHint>
      </Group>

      <Group label="Categorie">
        <CategoryPicker ids={pickerCategories} selected={tx.category} suggested={tx.suggestion} />
      </Group>

      {note ? <NoteCard icon={tx.category === "nesortat" ? "help" : "compass"}>{note}</NoteCard> : null}

      <Group label="Notă și etichete">
        <Field field={{ label: "Notă", type: "textarea", value: tx.note ?? "", placeholder: "De exemplu: cadou pentru Ana" }} />
        <ChoiceChips label="Etichete" options={[...tags, { label: "+ Etichetă nouă" }]} />
      </Group>

      <Group label="Reguli">
        <Switches>
          <Switch
            label={`Aplică pentru toate plățile către ${tx.merchant}`}
            hint={tx.history ?? "Plățile viitoare primesc același nume și aceeași categorie"}
            defaultChecked={Boolean(tx.rule)}
          />
          <Switch label="Exclude din cheltuieli" hint="De exemplu, dacă cineva îți returnează banii" defaultChecked={tx.category === "economii"} />
        </Switches>
      </Group>

      <BtnRow>
        <Btn variant="outline" small icon="split">
          Împarte plata
        </Btn>
        <Btn variant="outline" small icon="receipt">
          Atașează bonul fiscal
        </Btn>
      </BtnRow>
    </>
  );
}

const s = StyleSheet.create({
  hero: { alignItems: "center", gap: space["2xs"], paddingVertical: space.lg },
  heroMeta: { flexDirection: "row", alignItems: "center", gap: space.xs, marginTop: space.xs },
  raw: { fontSize: text.sm, color: color.ink2, letterSpacing: 0.28 },
});
