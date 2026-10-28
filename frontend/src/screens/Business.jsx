// Produse for a business account: the business coach is not built yet, so it is shown as coming soon.

import { Icon } from "../components/icons.jsx";
import { Group, IconTile, NoteCard } from "../components/ui.jsx";
import { business } from "../data/accounts.js";

export default function Business() {
  const { coach } = business;
  return (
    <>
      <section className="card empty coach-entry" aria-labelledby="business-coach-title">
        <div className="goal-head">
          <IconTile icon="compass" tone="sand" />
          <div>
            <h2 id="business-coach-title" className="card-title">
              {coach.title}
            </h2>
            <p className="small muted">Pentru persoane juridice</p>
          </div>
          <span className="status">{coach.badge}</span>
        </div>
        <p className="small">{coach.text}</p>
      </section>

      <Group label="Produsele firmei">
        <ul className="card rows">
          {business.products.map((product) => (
            <li key={product.name} className="row">
              <IconTile icon={product.icon} tone="sand" />
              <span className="row-name">{product.name}</span>
              <Icon name="chevron" className="chevron" />
            </li>
          ))}
        </ul>
      </Group>

      <NoteCard icon="compass">{business.note}</NoteCard>
    </>
  );
}
