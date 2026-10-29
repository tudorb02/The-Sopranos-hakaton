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
  if (!tx) return <p className="small muted">This payment is not in the demo data.</p>;

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
          <span className={tx.status === "Pending" ? "status" : "status is-on"}>{tx.status}</span>
          <span className="small muted">{client.card}</span>
        </p>
      </section>

      <Group label="On the statement">
        <div className="card raw-line">{tx.raw}</div>
      </Group>

      <Group label="How you want it to appear">
        <Field field={{ label: "Name", value: tx.name, placeholder: "What did you buy?" }} />
        <p className="small muted group-hint">The name changes only in the coach. The statement stays the same.</p>
      </Group>

      <Group label="Category">
        <CategoryPicker ids={pickerCategories} selected={tx.category} suggested={tx.suggestion} />
      </Group>

      {note ? <NoteCard icon={tx.category === "nesortat" ? "help" : "compass"}>{note}</NoteCard> : null}

      <Group label="Note and tags">
        <Field field={{ label: "Note", type: "textarea", value: tx.note ?? "", placeholder: "For example: gift for Ana" }} />
        <ChoiceChips label="Tags" options={[...tags, { label: "+ New tag" }]} />
      </Group>

      <Group label="Rules">
        <div className="card switches">
          <Switch
            label={`Apply to all payments to ${tx.merchant}`}
            hint={tx.history ?? "Future payments get the same name and category"}
            defaultChecked={Boolean(tx.rule)}
          />
          <Switch label="Exclude from spending" hint="For example, if someone pays you back" defaultChecked={tx.category === "economii"} />
        </div>
      </Group>

      <div className="btn-row tx-actions">
        <button type="button" className="btn btn--outline btn--small">
          <Icon name="split" />
          Split payment
        </button>
        <button type="button" className="btn btn--outline btn--small">
          <Icon name="receipt" />
          Attach receipt
        </button>
      </div>
    </>
  );
}
