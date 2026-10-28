import { Disclaimer, Group, NoteCard, ValueRow } from "../components/ui.jsx";
import { legal } from "../data/legal.js";

export default function Legal() {
  return (
    <>
      <Disclaimer legal={legal} />

      <Group label="Ce date folosește coach-ul">
        <ul className="card rows">
          {legal.data.map((item) => (
            <ValueRow key={item.name} name={item.name} note={item.note} />
          ))}
        </ul>
      </Group>

      <Group label="Cum îți ștergi datele">
        <div className="card">
          <p className="small">{legal.erase}</p>
        </div>
      </Group>

      <NoteCard icon="chat">{legal.contact}</NoteCard>
    </>
  );
}
