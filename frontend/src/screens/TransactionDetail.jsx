// Details of one payment: rename it, move it to another category, add a note, tags, a rule or the receipt.
// Every field shows example values only; nothing is saved.

import { Icon } from "../components/icons.jsx";
import { CategoryPicker, CategoryTile, TxAmount } from "../components/tracking.jsx";
import { ChoiceChips, Field, Group, NoteCard, Switch } from "../components/ui.jsx";
import { usePersona } from "../persona.js";

export default function TransactionDetail({ id }) {
  const { categoryNotes, client, days, pickerCategories, tagSuggestions } = usePersona();
  const day = days.find((item) => item.items.some((payment) => payment.id === id));
  const tx = day ? { ...day.items.find((payment) => payment.id === id), day } : null;
  if (!tx) return <p className="small muted">Plata nu există în datele demo.</p>;

  const tags = [...new Set([...(tx.tags ?? []), ...tagSuggestions])].map((tag) => ({ label: `#${tag}`, selected: Boolean(tx.tags?.includes(tag)) }));
  const note = categoryNotes[tx.category];
  return (
    <>
      <section className="card tx-hero" aria-labelledby="tx-title">
        <CategoryTile id={tx.category} size="lg" />
        <TxAmount value={tx.lei} size="xl" />
        <h1 id="tx-title" className="card-title">
          {tx.name || tx.merchant}
        </h1>
        <p className="small muted">
          {tx.day.label}, {tx.day.date} · {tx.time}
        </p>
        <p className="tx-hero-meta">
          <span className={tx.status === "În așteptare" ? "status" : "status is-on"}>{tx.status}</span>
          <span className="small muted">{client.card}</span>
        </p>
      </section>

      <Group label="Pe extras">
        <div className="card raw-line">{tx.raw}</div>
      </Group>

      <Group label="Cum vrei să apară">
        <Field field={{ label: "Denumire", value: tx.name, placeholder: "Ce ai cumpărat?" }} />
        <p className="small muted group-hint">Denumirea se schimbă doar în coach. Extrasul rămâne neschimbat.</p>
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
        <div className="card switches">
          <Switch
            label={`Aplică pentru toate plățile către ${tx.merchant}`}
            hint={tx.history ?? "Plățile viitoare primesc același nume și aceeași categorie"}
            defaultChecked={Boolean(tx.rule)}
          />
          <Switch label="Exclude din cheltuieli" hint="De exemplu, dacă cineva îți returnează banii" defaultChecked={tx.category === "economii"} />
        </div>
      </Group>

      <div className="btn-row tx-actions">
        <button type="button" className="btn btn--outline btn--small">
          <Icon name="split" />
          Împarte plata
        </button>
        <button type="button" className="btn btn--outline btn--small">
          <Icon name="receipt" />
          Atașează bonul fiscal
        </button>
      </div>
    </>
  );
}
