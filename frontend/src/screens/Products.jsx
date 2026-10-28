// The app's Produse tab, shown only as the place where the optional Coach is offered.

import { Btn, BtnRow, Card, Row, RowName, Rows, Small, Status } from "../components/base.jsx";
import { Icon } from "../components/icons.jsx";
import { GoalHead, Group, IconTile } from "../components/ui.jsx";
import { entry, products } from "../data/activation.js";
import { color, space } from "../theme.js";

// The yellow card that opens an optional feature from Produse (the Coach, the green credit).
export function EntryCard({ icon, entry: card, start, startLabel, example }) {
  return (
    <Card yellow style={{ gap: space.sm, paddingTop: space.lg }}>
      <GoalHead icon={icon} tone="ink" title={card.title} sub={card.subtitle} aside={<Status tone="ink">{card.badge}</Status>} />
      <Small>{card.text}</Small>
      <BtnRow>
        <Btn href={start} variant="ink" small>
          {startLabel}
        </Btn>
        <Btn href={example} variant="text" small onYellow>
          Vezi un exemplu
        </Btn>
      </BtnRow>
    </Card>
  );
}

// The client's existing products: icon, name, chevron (placeholders).
export function ProductRows({ items }) {
  return (
    <Rows>
      {items.map((product) => (
        <Row key={product.name}>
          <IconTile icon={product.icon} tone="sand" />
          <RowName style={{ flex: 1 }}>{product.name}</RowName>
          <Icon name="chevron" size={20} color={color.ink3} />
        </Row>
      ))}
    </Rows>
  );
}

export default function Products() {
  return (
    <>
      <EntryCard icon="compass" entry={entry} start="#/activare" startLabel="Activează" example="#/rezumat" />

      <Group label="Produsele tale">
        <ProductRows items={products} />
      </Group>
    </>
  );
}
