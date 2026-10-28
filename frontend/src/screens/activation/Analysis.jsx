import { Icon } from "../../components/icons.jsx";
import { Meter, NoteCard } from "../../components/ui.jsx";
import { usePersona } from "../../persona.js";

export function Analysis() {
  const { analysis } = usePersona();
  return (
    <>
      <header className="intro">
        <h1 className="page-title">{analysis.title}</h1>
        <p className="small muted">{analysis.lead}</p>
      </header>

      <ul className="card rows">
        {analysis.items.map((item) => (
          <li key={item.label} className="row">
            <span className={`state state--${item.state}`} aria-hidden="true">
              {item.state === "done" ? <Icon name="check" /> : null}
            </span>
            <div className="row-main">
              <span className="row-name">{item.label}</span>
              <span className="row-note">{item.note}</span>
            </div>
            {item.state === "running" ? <Meter value={item.progress} max={100} /> : null}
          </li>
        ))}
      </ul>

      <NoteCard icon="bell">{analysis.note}</NoteCard>
    </>
  );
}
