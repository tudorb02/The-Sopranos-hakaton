import { lei, num, pct } from "../lib/format.js";

// Spending per day this week, against the daily target (dashed line).
export function WeekStrip({ week }) {
  const spentDays = week.days.filter((day) => day.lei !== undefined);
  const summary = spentDays.map((day) => `${day.name} ${lei(day.lei)}`).join(", ");
  return (
    <figure className="week">
      <div className="week-plot" role="img" aria-label={`${summary}. Limita recomandată: ${lei(week.guidePerDay)} pe zi.`}>
        <span className="week-guide" style={{ "--p": pct(week.guidePerDay, week.scaleMax) }} />
        {week.days.map((day) => {
          const classes = ["day", day.today ? "is-today" : "", day.lei === undefined ? "is-future" : ""].filter(Boolean).join(" ");
          return (
            <span key={day.d} className={classes}>
              {day.lei !== undefined ? <span className="day-fill" style={{ "--p": pct(day.lei, week.scaleMax) }} /> : null}
            </span>
          );
        })}
      </div>
      <ol className="week-labels" aria-hidden="true">
        {week.days.map((day) => (
          <li key={day.d} className={day.today ? "is-today" : undefined}>
            <b>{day.d}</b>
            <span className="num">{day.lei ?? "·"}</span>
          </li>
        ))}
      </ol>
      <figcaption className="small muted">Linia punctată: limita recomandată de {lei(week.guidePerDay)} pe zi</figcaption>
    </figure>
  );
}

// How the salary is split: fixed costs, money set aside, money to spend.
export function Allocation({ parts, total }) {
  const label = parts.map((part) => `${part.label} ${lei(part.lei)}`).join(", ");
  return (
    <div className="alloc" role="img" aria-label={`Din ${lei(total)}: ${label}.`}>
      {parts.map((part) => (
        <span key={part.id} className={`is-${part.tone}`} style={{ flex: `${part.lei} 1 0` }} />
      ))}
    </div>
  );
}

export function Legend({ parts }) {
  return (
    <ul className="legend">
      {parts.map((part) => (
        <li key={part.id}>
          <span>
            <i className={`swatch is-${part.tone}`} />
            {part.label}
          </span>
          <span className="num">{lei(part.lei)}</span>
        </li>
      ))}
    </ul>
  );
}

// Savings plan per month; each bar shows the running total towards the goal.
export function PlanChart({ plan, total }) {
  const label = plan.map((month) => `${month.month} ${month.add ? `+${lei(month.add)}` : "0 lei"}`).join(", ");
  return (
    <figure className="plan" role="img" aria-label={`Plan pe luni: ${label}. Total ${lei(total)}.`}>
      {plan.map((month) => (
        <div key={month.month} className="plan-col" aria-hidden="true">
          <div className="plan-bar">
            <span style={{ "--p": pct(month.total, total) }} />
          </div>
          <b className="plan-amount">{month.add ? `+${num(month.add)}` : "0"}</b>
          <span className="plan-month">{month.month}</span>
        </div>
      ))}
    </figure>
  );
}
