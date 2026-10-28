// Produse for a business account: the green credit for investments, agriculture first
// (design/pj-greenstruct.md §4), the company's requests and its existing products.

import { Link, RowMain, RowName, RowNote, Rows, Status, styles } from "../components/base.jsx";
import { Group, IconTile, NoteCard } from "../components/ui.jsx";
import { business } from "../data/accounts.js";
import { greenPacks } from "../data/green/packs.js";
import { greenEntry } from "../data/green/sectors.js";
import { color } from "../theme.js";
import { EntryCard, ProductRows } from "./Products.jsx";

export default function Business() {
  const { dossier } = greenPacks.agro;
  return (
    <>
      <EntryCard icon="leaf" entry={greenEntry} start="#/verde" startLabel="Începe" example="#/verde/agro/oferte" />

      <Group label="Cererile tale">
        <Rows>
          <Link href={dossier.href} style={styles.row} pressedStyle={{ backgroundColor: color.rowPressed }}>
            <IconTile icon="drop" tone="sand" />
            <RowMain>
              <RowName>{dossier.row.title}</RowName>
              <RowNote>{dossier.row.note}</RowNote>
            </RowMain>
            <Status tone="on">{dossier.row.status}</Status>
          </Link>
        </Rows>
      </Group>

      <Group label="Produsele firmei">
        <ProductRows items={business.products} />
      </Group>

      <NoteCard icon="compass">{business.note}</NoteCard>
    </>
  );
}
