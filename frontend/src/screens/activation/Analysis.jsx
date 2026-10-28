import { Intro, RowMain, RowName, RowNote, Rows, Small } from "../../components/base.jsx";
import { Meter, NoteCard, RowWithBelow, StateDot } from "../../components/ui.jsx";
import { usePersona } from "../../persona.js";

// A step of an analysis: its state, what it does, and a meter while it runs.
export function PhaseRow({ phase }) {
  return (
    <RowWithBelow indent={28} below={phase.state === "running" ? <Meter value={phase.progress} max={100} /> : null}>
      <StateDot state={phase.state} />
      <RowMain>
        <RowName>{phase.label}</RowName>
        <RowNote>{phase.note}</RowNote>
      </RowMain>
    </RowWithBelow>
  );
}

export function Analysis() {
  const { analysis } = usePersona();
  return (
    <>
      <Intro title={analysis.title}>
        <Small muted>{analysis.lead}</Small>
      </Intro>

      <Rows>
        {analysis.items.map((item) => (
          <PhaseRow key={item.label} phase={item} />
        ))}
      </Rows>

      <NoteCard icon="bell">{analysis.note}</NoteCard>
    </>
  );
}
