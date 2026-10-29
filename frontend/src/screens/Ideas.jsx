// Development ideas for a client without a stable income (design/coach-students.md §6): more income,
// free money education from the bank, opportunities. Each idea starts from a goal or interest the client stated.

import { ExternalLink } from "../components/services.jsx";
import { IconTile, NoteCard, Section, Src } from "../components/ui.jsx";
import { usePersona } from "../persona.js";

export default function Ideas() {
  const { ideas } = usePersona();
  const { featured } = ideas;
  return (
    <>
      <header className="intro">
        <h1 className="page-title">{ideas.title}</h1>
        <p className="small muted">{ideas.lead}</p>
      </header>

      <section className="card card--yellow idea-featured" aria-labelledby="idea-title">
        <div className="goal-head">
          <IconTile icon={featured.icon} tone="ink" />
          <div>
            <p className="eyebrow">{featured.eyebrow}</p>
            <h2 id="idea-title" className="card-title">
              {featured.title}
            </h2>
          </div>
        </div>
        <p className="small">
          {featured.text} <Src kind="est" />
        </p>
        <ul className="idea-effects">
          {featured.effects.map((effect) => (
            <li key={effect}>{effect}</li>
          ))}
        </ul>
        <details className="why">
          <summary>Why I suggest this</summary>
          <p>{featured.why}</p>
        </details>
        <div className="btn-row">
          {featured.actions.map((action, i) => (
            <button key={action} type="button" className={i === 0 ? "btn btn--ink btn--small" : "btn btn--text btn--small btn--on-yellow"}>
              {action}
            </button>
          ))}
        </div>
      </section>

      {ideas.groups.map((group) => (
        <Section key={group.title} title={group.title} aside={group.note ? <span className="small muted">{group.note}</span> : null}>
          <ul className="card rows">
            {group.items.map((item) => (
              <li key={item.title} className="row idea-row">
                <IconTile icon={item.icon} tone="sand" />
                <div className="row-main">
                  <span className="row-name">{item.title}</span>
                  <span className="row-note">{item.text}</span>
                  {item.link ? <ExternalLink link={item.link} /> : null}
                  {item.status ? <span className="status">{item.status}</span> : null}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ))}

      <NoteCard icon="shield">{ideas.rules}</NoteCard>
    </>
  );
}
