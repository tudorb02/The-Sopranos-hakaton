import { Disclaimer, Group, IconTile, NoteCard, Ticks, ValueRow } from "../components/ui.jsx";
import { legal as coachLegal } from "../data/legal.js";

// Icon, title and text, for who sees the data, how it is protected and what to do if something happens.
function InfoRows({ items }) {
  return (
    <ul className="card rows">
      {items.map((item) => (
        <li key={item.title} className="row">
          <IconTile icon={item.icon} tone="sand" />
          <div className="row-main">
            <span className="row-name">{item.title}</span>
            <span className="row-note">{item.text}</span>
          </div>
        </li>
      ))}
    </ul>
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
        <ul className="card rows">
          {legal.data.map((item) => (
            <ValueRow key={item.name} name={item.name} note={item.note} />
          ))}
        </ul>
      </Group>

      <Group label={legal.log.title}>
        <ul className="card rows">
          {legal.log.items.map((item) => (
            <ValueRow key={item.when} name={item.who} note={item.what} value={<span className="small muted">{item.when}</span>} />
          ))}
        </ul>
        {legal.log.note ? <p className="small muted group-hint">{legal.log.note}</p> : null}
      </Group>

      <Group label={legal.incident.title}>
        <InfoRows items={legal.incident.items} />
      </Group>

      <Group label="How to delete your data">
        <div className="card">
          <p className="small">{legal.erase}</p>
        </div>
      </Group>

      <NoteCard icon="chat">{legal.contact}</NoteCard>
    </>
  );
}
