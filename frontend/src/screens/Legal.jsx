import { Card, Row, RowMain, RowName, RowNote, Rows, Small } from "../components/base.jsx";
import { Disclaimer, Group, GroupHint, IconTile, NoteCard, Ticks, ValueRow } from "../components/ui.jsx";
import { legal as coachLegal } from "../data/legal.js";

// Icon, title and text, for who sees the data, how it is protected and what to do if something happens.
function InfoRows({ items }) {
  return (
    <Rows>
      {items.map((item) => (
        <Row key={item.title}>
          <IconTile icon={item.icon} tone="sand" />
          <RowMain>
            <RowName>{item.title}</RowName>
            <RowNote>{item.text}</RowNote>
          </RowMain>
        </Row>
      ))}
    </Rows>
  );
}

// The coach's notice by default; the green credit passes its own (data/green/legal.js).
export default function Legal({ legal = coachLegal }) {
  return (
    <>
      <Disclaimer legal={legal} />

      <Group label={legal.access.title}>
        <InfoRows items={legal.access.items} />
      </Group>

      <Group label={legal.security.title}>
        <InfoRows items={legal.security.items} />
      </Group>

      <Group label={legal.privacy.title}>
        <Ticks yes={legal.privacy.items} />
      </Group>

      <Group label={legal.never.title}>
        <Ticks no={legal.never.items} />
      </Group>

      <Group label={legal.dataTitle}>
        <Rows>
          {legal.data.map((item) => (
            <ValueRow key={item.name} name={item.name} note={item.note} />
          ))}
        </Rows>
      </Group>

      <Group label={legal.log.title}>
        <Rows>
          {legal.log.items.map((item) => (
            <ValueRow key={item.when} name={item.who} note={item.what} value={<Small muted>{item.when}</Small>} />
          ))}
        </Rows>
        {legal.log.note ? <GroupHint>{legal.log.note}</GroupHint> : null}
      </Group>

      <Group label={legal.incident.title}>
        <InfoRows items={legal.incident.items} />
      </Group>

      <Group label="Cum îți ștergi datele">
        <Card>
          <Small>{legal.erase}</Small>
        </Card>
      </Group>

      <NoteCard icon="chat">{legal.contact}</NoteCard>
    </>
  );
}
