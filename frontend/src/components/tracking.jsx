// Pieces of the spending tracker: category icons, the share bar, transaction rows, the category picker.

import { categories } from "../data/tracking.js";
import { lei, num } from "../lib/format.js";
import { Icon } from "./icons.jsx";

export function CategoryTile({ id, size }) {
  const category = categories[id];
  return (
    <span className={`cat-tile ${category.tone}${size === "lg" ? " cat-tile--lg" : ""}`} aria-hidden="true">
      <Icon name={category.icon} />
    </span>
  );
}

// Signed amount in the app's style: "−30" large, ",00 lei" small.
export function TxAmount({ value, size = "md" }) {
  const sign = value < 0 ? "−" : "+";
  return (
    <span className={`amount amount--${size}${value > 0 ? " is-income" : ""}`}>
      <span className="amount-int">
        {sign}
        {num(Math.abs(value))}
      </span>
      <span className="amount-dec">,00 lei</span>
    </span>
  );
}

// Variable spending by category: one segment per category, 2px gaps, colour fixed per category.
export function ShareBar({ parts, total }) {
  return (
    <div className="share" role="img" aria-label={parts.map((part) => `${categories[part.id].label} ${lei(part.lei)}`).join(", ")}>
      {parts.map((part) => (
        <span
          key={part.id}
          className={categories[part.id].tone}
          style={{ flexGrow: part.lei }}
          title={`${categories[part.id].label}: ${lei(part.lei)} (${Math.round((part.lei / total) * 100)}%)`}
        />
      ))}
    </div>
  );
}

export function CategoryLegend({ parts, total }) {
  return (
    <ul className="cat-legend">
      {parts.map((part) => (
        <li key={part.id}>
          <i className={`cat-dot ${categories[part.id].tone}`} aria-hidden="true" />
          <span>{categories[part.id].label}</span>
          <span className="num">{lei(part.lei)}</span>
          <span className="num muted">{Math.round((part.lei / total) * 100)}%</span>
        </li>
      ))}
    </ul>
  );
}

// One payment in the list; the whole row opens its details.
export function TxRow({ tx }) {
  const category = categories[tx.category];
  const title = tx.name || tx.merchant;
  const meta = [tx.name && tx.name !== tx.merchant ? tx.merchant : null, category.label, tx.time].filter(Boolean).join(" · ");
  return (
    <li>
      <a className="tx" href={`#/cheltuieli/${tx.id}`}>
        <CategoryTile id={tx.category} />
        <span className="tx-main">
          <span className="tx-name">{title}</span>
          <span className="tx-meta">{meta}</span>
          {tx.needsReview || tx.renamed || tx.recurring || tx.status === "În așteptare" ? (
            <span className="tx-flags">
              {tx.needsReview ? <span className="flag flag--review">De verificat</span> : null}
              {tx.status === "În așteptare" ? <span className="flag">În așteptare</span> : null}
              {tx.recurring ? (
                <span className="flag">
                  <Icon name="repeat" />
                  Recurentă
                </span>
              ) : null}
              {tx.renamed && !tx.recurring ? (
                <span className="flag">
                  <Icon name="pencil" />
                  Redenumită
                </span>
              ) : null}
            </span>
          ) : null}
        </span>
        <TxAmount value={tx.lei} size="sm" />
      </a>
    </li>
  );
}

// Categories as tiles; `selected` is chosen, `suggested` is the coach's proposal for an unsorted payment.
export function CategoryPicker({ ids, selected, suggested }) {
  return (
    <div className="cat-picker" role="group" aria-label="Categorie">
      {ids.map((id) => (
        <button key={id} type="button" className="cat-option" aria-pressed={id === selected ? "true" : "false"}>
          <CategoryTile id={id} />
          <span>{categories[id].label}</span>
          {id === suggested ? <span className="flag flag--review">Sugestie</span> : null}
        </button>
      ))}
      <button type="button" className="cat-option cat-option--new">
        <span className="cat-tile cat-fixed" aria-hidden="true">
          <Icon name="tag" />
        </span>
        <span>Categorie nouă</span>
      </button>
    </div>
  );
}
