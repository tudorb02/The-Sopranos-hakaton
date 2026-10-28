// Small helpers shared by the steps of the SME flow.

import { createDemoRun } from "../../../lib/api.js";
import { DEMO_FARMS } from "../../../lib/labels.js";
import { rememberRun, resetFlow } from "../../../lib/session.js";

// Starts a recorded demo dossier of a category and remembers it; resolves with the run id.
export async function startDemo(moduleId) {
  const created = await createDemoRun(moduleId);
  const farm = DEMO_FARMS.find((f) => f.moduleId === moduleId);
  resetFlow({ moduleId, cui: farm?.cui ?? "", consents: { apia: true, openBanking: true } });
  rememberRun(created.runId);
  return created.runId;
}

// The step needs something from an earlier one: say what and link to it.
export function Missing({ children, href, label }) {
  return (
    <div className="card note-card">
      <p className="small">{children}</p>
      <a className="btn btn--outline btn--small" href={href}>
        {label}
      </a>
    </div>
  );
}
