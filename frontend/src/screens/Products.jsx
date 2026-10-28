// The app's Produse tab, shown only as the place where the optional Coach is offered.

import { Btn, BtnRow, Card, Row, RowName, Rows, Small, Status } from "../components/base.jsx";
import { Icon } from "../components/icons.jsx";
import { GoalHead, Group, IconTile } from "../components/ui.jsx";
import { usePersona, usePersonaApi } from "../persona.js";
import { useRouter } from "../router.jsx";
import { color, space } from "../theme.js";

// The yellow card that opens an optional feature from Produse (the Coach, the green credit).
export function EntryCard({ icon, entry: card, start, startLabel, example, onStart }) {
  return (
    <Card yellow style={{ gap: space.sm, paddingTop: space.lg }}>
      <GoalHead icon={icon} tone="ink" title={card.title} sub={card.subtitle} aside={<Status tone="ink">{card.badge}</Status>} />
      <Small>{card.text}</Small>
      <BtnRow>
        <Btn href={start} onPress={onStart} variant="ink" small>
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
  const { entry, products } = usePersona();
  const api = usePersonaApi();
  const { navigate } = useRouter();
  const start = async () => {
    if (api.enabled || await api.mutate("/coach", {}, "POST")) navigate("#/activare");
  };
  return (
    <>
      {!api.enabled ? <Small>Coach-ul este dezactivat. Reactivarea încarcă din nou datele fictive ale demo-ului.</Small> : null}
      <EntryCard icon="compass" entry={entry} start="#/activare" startLabel="Activează" example="#/rezumat" onStart={start} />

      <Group label="Produsele tale">
        <ProductRows items={products} />
      </Group>
    </>
  );
}
