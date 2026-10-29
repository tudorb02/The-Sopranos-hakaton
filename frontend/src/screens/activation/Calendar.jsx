import { Agenda, ChoiceChips, Group, IconTile, NoteCard, Section, Src, Ticks } from "../../components/ui.jsx";
import { usePersona } from "../../persona.js";

export function Calendar() {
  const { calendar } = usePersona();
  return (
    <>
      <header className="intro">
        <p className="eyebrow">Optional</p>
        <h1 className="page-title">What's coming up in your calendar</h1>
        <p className="small muted">Birthdays and big events go into the budget. I'll tell you early when a busy month is coming.</p>
      </header>

      <ul className="options">
        {calendar.options.map((option, i) => (
          <li key={option.id} className="card row">
            <IconTile icon={option.icon} tone={i === 0 ? "yellow" : "sand"} />
            <div className="row-main">
              <span className="row-name">{option.title}</span>
              <span className="row-note">{option.note}</span>
            </div>
            {option.href ? (
              <a className="btn btn--small" href={option.href}>
                {option.action}
              </a>
            ) : (
              <button type="button" className="btn btn--outline btn--small">
                {option.action}
              </button>
            )}
          </li>
        ))}
      </ul>

      <Group label="What I read and what I don't">
        <Ticks yes={calendar.reads} no={calendar.doesNotRead} />
      </Group>

      <NoteCard icon="lock">Read-only access. You can disconnect any time from Profile → Permissions.</NoteCard>
    </>
  );
}

export function CalendarConnected() {
  const { calendar } = usePersona();
  const { gift } = calendar;
  return (
    <>
      <header className="intro">
        <h1 className="page-title">Calendar connected</h1>
      </header>

      <div className="card row">
        <IconTile icon="calendar" tone="yellow" />
        <div className="row-main">
          <span className="row-name">Google Calendar</span>
          <span className="row-note">Read-only · birthdays and marked events</span>
        </div>
        <span className="status is-on">Connected</span>
      </div>

      <Section title="What I found in the coming months">
        <div className="card">
          <Agenda items={calendar.found} />
        </div>
      </Section>

      <section className="section" aria-labelledby="gift-question">
        <div className="coach-q">
          <IconTile icon="compass" tone="yellow" />
          <h2 id="gift-question" className="msg msg--coach question-title">
            {gift.question}
          </h2>
        </div>
        {gift.groups.map((group) => (
          <div key={group.label} className="field">
            <p className="field-label">{group.label}</p>
            <ChoiceChips label={group.label} options={group.options.map((label) => ({ label, selected: label === group.selected }))} />
          </div>
        ))}
        <p className="small">
          {gift.result} <Src kind="est" />
        </p>
      </section>
    </>
  );
}
