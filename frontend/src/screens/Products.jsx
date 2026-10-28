// The app's Produse tab, shown only as the place where the optional Coach is offered.

import { Icon } from "../components/icons.jsx";
import { Group, IconTile } from "../components/ui.jsx";
import { entry, products } from "../data/activation.js";

export default function Products() {
  return (
    <>
      <section className="card card--yellow coach-entry" aria-labelledby="coach-entry-title">
        <div className="goal-head">
          <IconTile icon="compass" tone="ink" />
          <div>
            <h2 id="coach-entry-title" className="card-title">
              {entry.title}
            </h2>
            <p className="small">{entry.subtitle}</p>
          </div>
          <span className="status status--ink">{entry.badge}</span>
        </div>
        <p className="small">{entry.text}</p>
        <div className="btn-row">
          <a className="btn btn--ink btn--small" href="#/activare">
            Activează
          </a>
          <a className="btn btn--text btn--small btn--on-yellow" href="#/rezumat">
            Vezi un exemplu
          </a>
        </div>
      </section>

      <Group label="Produsele tale">
        <ul className="card rows">
          {products.map((product) => (
            <li key={product.name} className="row">
              <IconTile icon={product.icon} tone="sand" />
              <span className="row-name">{product.name}</span>
              <Icon name="chevron" className="chevron" />
            </li>
          ))}
        </ul>
      </Group>
    </>
  );
}
