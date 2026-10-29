// #/ofiter/dosar/<runId>: the officer's view of one dossier, the panels of README §8 (RunView view=full).

import { useEffect, useState } from "react";

import { ErrorCard, Loading } from "../../components/live.jsx";
import { OfficerFrame, Tag } from "../../components/officer.jsx";
import { useRun, useRunEvents } from "../../lib/hooks.js";
import { STATE_RO } from "../../lib/labels.js";
import { rememberRun } from "../../lib/session.js";
import { ActionsPanel } from "./panels/Actions.jsx";
import { CompanyPanel } from "./panels/Company.jsx";
import { CreditPanel } from "./panels/Credit.jsx";
import { PortfolioPanel } from "./panels/Portfolio.jsx";
import { ReportPanel } from "./panels/Report.jsx";
import { StepsPanel } from "./panels/Steps.jsx";
import { TechnicalPanel } from "./panels/Technical.jsx";

export function OfficerDossier({ runId }) {
  const { run, error, loading, reload, replace } = useRun(runId, "full", { pollMs: 4000 });
  const { events, status } = useRunEvents(runId);
  const [portfolioKey, setPortfolioKey] = useState(0);

  useEffect(() => {
    if (run) rememberRun(runId);
  }, [run?.runId]);

  const subtitle = run ? `${run.farm.company.name} · ${run.moduleId} · ${run.runId}` : runId;
  return (
    <OfficerFrame page="dossier" title="Green credit dossier" subtitle={subtitle}>
      {loading && !run ? <Loading label="Loading the dossier…" /> : null}
      <ErrorCard error={error} onRetry={reload}>
        <a className="btn btn--outline btn--small" href="#/ofiter">
          Choose another dossier
        </a>
      </ErrorCard>
      {run ? (
        <div className="panels">
          <div className="state-bar">
            <Tag tone={run.state === "ESUAT" ? "bad" : "info"}>{STATE_RO[run.state] ?? run.state}</Tag>
            <Tag>{run.mode}</Tag>
            {run.submission ? <Tag tone="ok">SME chose: {run.submission.variant === "VERDE" ? "green credit" : "classic credit"}</Tag> : <Tag tone="warn">The SME has not sent the application</Tag>}
          </div>
          <CompanyPanel run={run} />
          <StepsPanel run={run} events={events} status={status} />
          <TechnicalPanel run={run} />
          <CreditPanel run={run} />
          <ReportPanel run={run} />
          <ActionsPanel run={run} onRun={replace} onChanged={() => setPortfolioKey((k) => k + 1)} />
          <PortfolioPanel reloadKey={portfolioKey} />
        </div>
      ) : null}
    </OfficerFrame>
  );
}
