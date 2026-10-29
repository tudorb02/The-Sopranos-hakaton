// Produse for a business account: the green credit for investments, agriculture first
// (design/pj-greenstruct.md §4), the company's requests and its existing products.

import { Icon } from "../components/icons.jsx";
import { Group, IconTile, NoteCard } from "../components/ui.jsx";
import { business } from "../data/accounts.js";
import { greenEntry } from "../data/green/sectors.js";
import { useRun } from "../lib/hooks.js";
import { MODULE_ICONS, STATE_RO } from "../lib/labels.js";
import { currentRunId } from "../lib/session.js";

// The request of this session, if any, with its state from the API.
function CurrentRequest() {
  const runId = currentRunId();
  const { run } = useRun(runId, "sme");
  if (!runId) {
    return (
      <ul className="card rows">
        <li className="row">
          <span className="row-name muted">You have no applications yet.</span>
        </li>
      </ul>
    );
  }
  return (
    <ul className="card rows">
      <li>
        <a className="row row--link" href="#/verde/agro/dosar">
          <IconTile icon={MODULE_ICONS[run?.moduleId] ?? "leaf"} tone="sand" />
          <span className="row-main">
            <span className="row-name">{run ? `${run.farm.company.name}` : "Your application"}</span>
            <span className="row-note">Agriculture · {runId}</span>
          </span>
          <span className="status is-on">{run ? STATE_RO[run.state] : "…"}</span>
        </a>
      </li>
    </ul>
  );
}

export default function Business() {
  return (
    <>
      <section className="card card--yellow coach-entry" aria-labelledby="green-entry-title">
        <div className="goal-head">
          <IconTile icon="leaf" tone="ink" />
          <div>
            <h2 id="green-entry-title" className="card-title">
              {greenEntry.title}
            </h2>
            <p className="small">{greenEntry.subtitle}</p>
          </div>
          <span className="status status--ink">{greenEntry.badge}</span>
        </div>
        <p className="small">{greenEntry.text}</p>
        <div className="btn-row">
          <a className="btn btn--ink btn--small" href="#/verde">
            Start
          </a>
          <a className="btn btn--text btn--small btn--on-yellow" href="#/ofiter">
            Officer zone (demo)
          </a>
        </div>
      </section>

      <Group label="Your applications">
        <CurrentRequest />
      </Group>

      <Group label="Company products">
        <ul className="card rows">
          {business.products.map((product) => (
            <li key={product.name} className="row">
              <IconTile icon={product.icon} tone="sand" />
              <span className="row-name">{product.name}</span>
              <Icon name="chevron" className="chevron" />
            </li>
          ))}
        </ul>
      </Group>

      <NoteCard icon="compass">{business.note}</NoteCard>
    </>
  );
}
