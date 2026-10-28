import { useEffect, useRef } from "react";
import { Btn, Intro, RowMain, RowName, RowNote, Rows, Small } from "../../components/base.jsx";
import { NoteCard, RowWithBelow, StateDot } from "../../components/ui.jsx";
import { usePersona, usePersonaApi } from "../../persona.js";

// A step of an analysis: its state and what it found.
export function PhaseRow({ phase }) {
  return (
    <RowWithBelow indent={28}>
      <StateDot state={phase.state} />
      <RowMain>
        <RowName>{phase.label}</RowName>
        <RowNote>{phase.note}</RowNote>
      </RowMain>
    </RowWithBelow>
  );
}

// The analysis runs on the server when this step opens, if there is new imported data.
export function Analysis() {
  const { analysis, statements } = usePersona();
  const api = usePersonaApi();
  const started = useRef(false);
  const canRun = Boolean(statements.imported || statements.files.some((file) => file.state === "done"));
  const due = canRun && analysis.status !== "done";
  useEffect(() => {
    if (!due || started.current) return;
    started.current = true;
    api.mutate("/analysis", {}, "POST");
  }, [api, due]);
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

      {!canRun ? <NoteCard icon="bell">Importă mai întâi extrasele, la pasul Extrase, ca să am ce analiza.</NoteCard> : null}
      {due && !api.busy ? <Btn onPress={() => api.mutate("/analysis", {}, "POST")}>Pornește analiza</Btn> : null}
      {api.busy ? <Small accessibilityLiveRegion="polite">Analizez extrasele…</Small> : null}
    </>
  );
}
