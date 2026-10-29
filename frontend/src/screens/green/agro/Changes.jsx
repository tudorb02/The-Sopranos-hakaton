// Step 8: what to change so the investment becomes green: the upgrade, what it costs, the indicator before and after
// and the payback, all from the technical assessment (figures resolved from calcs).

import { Actions, ErrorCard, Loading, NextButton } from "../../../components/live.jsx";
import { Group, IconTile, NoteCard, ValueRow } from "../../../components/ui.jsx";
import { calcOf, disp } from "../../../lib/calc.js";
import { useRun } from "../../../lib/hooks.js";
import { TIER_SME } from "../../../lib/labels.js";
import { useFlow } from "../../../lib/session.js";
import { Missing } from "./shared.jsx";

// The impacts worth a line to a farmer (the rest are intermediate figures).
export const FARMER_IMPACTS = ["WATER_SAVED_M3", "ENERGY_SAVED_KWH", "FUEL_SAVED_L", "NITROGEN_SAVED_KG", "RENEWABLE_KWH", "GRID_ENERGY_REPLACED_KWH", "CO2_AVOIDED_T", "CERTIFIED_AREA_HA"];

export function Changes() {
  const { runId } = useFlow();
  const { run, loading, error, reload } = useRun(runId, "sme");

  if (!runId) {
    return (
      <Missing href="#/verde/agro/documente" label="Upload the offer">
        You do not have an analysis yet.
      </Missing>
    );
  }
  const tech = run?.agents.technicalAssessment;
  const funding = run?.agents.fundingRecommendation;
  const initial = tech?.configurations.find((c) => c.configId === tech.initialConfigId);
  const recommended = tech?.configurations.find((c) => c.configId === tech.recommendedConfigId);
  const upgraded = Boolean(tech) && recommended && recommended.configId !== initial?.configId;
  const impacts = recommended?.impacts.filter((i) => FARMER_IMPACTS.includes(i.metric)) ?? [];
  const tier = funding ? TIER_SME[funding.greenTier.tier] : null;

  return (
    <>
      <header className="intro">
        <h1 className="page-title">What to change</h1>
        <p className="small muted">What we propose for your investment so it becomes green, how much extra it costs and how quickly it pays back.</p>
      </header>

      {loading ? <Loading label="Loading the proposal…" /> : null}
      <ErrorCard error={error} onRetry={reload} />
      {run && !tech ? (
        <Missing href="#/verde/agro/analiza" label="Back to the analysis">
          The analysis has not finished yet.
        </Missing>
      ) : null}

      {tech && initial ? (
        <>
          <ul className="card rows">
            <ValueRow icon="file" name="What you asked for" note={initial.components.map((c) => c.nameRo).join(" · ")} value={<span className="num">{disp(run, initial.totalCostCalcId)}</span>} />
            {upgraded ? (
              <ValueRow icon="leaf" name="What we propose" note={recommended.components.map((c) => c.nameRo).join(" · ")} value={<span className="num">{disp(run, recommended.totalCostCalcId)}</span>} />
            ) : null}
          </ul>

          <Group label="The green indicator">
            <ul className="card facts">
              <li>
                <span className="fact-label">Requested investment</span>
                <span className="fact-value num">{disp(run, initial.indicatorCalcId)}</span>
                <span className={initial.thresholdResult === "PASS" ? "status is-on" : "status status--warn"}>{initial.thresholdResult === "PASS" ? "above the threshold" : "below the threshold"}</span>
              </li>
              {upgraded ? (
                <li>
                  <span className="fact-label">With the proposed changes</span>
                  <span className="fact-value num">{disp(run, recommended.indicatorCalcId)}</span>
                  <span className={recommended.thresholdResult === "PASS" ? "status is-on" : "status status--warn"}>
                    {recommended.thresholdResult === "PASS" ? "above the threshold" : "below the threshold"}
                  </span>
                </li>
              ) : null}
              <li>
                <span className="fact-label">Threshold for the green credit</span>
                <span className="fact-value num">{disp(run, tech.threshold.thresholdCalcId)}</span>
              </li>
            </ul>
          </Group>

          {upgraded ? (
            <Group label="What is added">
              <ul className="card rows">
                {recommended.components
                  .filter((c) => c.source === "CATALOG_UPGRADE")
                  .map((c) => (
                    <li key={c.componentId} className="row">
                      <IconTile icon="leaf" tone="sand" />
                      <div className="row-main">
                        <span className="row-name">{c.nameRo}</span>
                        <span className="row-note">added, estimated price from the catalogue</span>
                      </div>
                      <span className="row-value num">{disp(run, c.costCalcId)}</span>
                    </li>
                  ))}
                <li className="row row--total">
                  <span className="row-name">Extra cost compared with your offer</span>
                  <span className="row-value num">{disp(run, recommended.upgradeCostCalcId)}</span>
                </li>
              </ul>
              {funding ? (
                <ul className="card facts">
                  <li>
                    <span className="fact-label">Paid back from savings in</span>
                    <span className="fact-value num">{disp(run, funding.comparison.upgradePaybackCalcId)}</span>
                  </li>
                </ul>
              ) : null}
            </Group>
          ) : (
            <NoteCard icon="check">The requested investment already reaches the green threshold, so you do not need to change anything.</NoteCard>
          )}

          {impacts.length ? (
            <Group label="What you gain per year">
              <ul className="card facts">
                {impacts.map((impact) => (
                  <li key={impact.calcId}>
                    <span className="fact-label">{calcOf(run, impact.calcId)?.labelRo}</span>
                    <span className="fact-value num">{disp(run, impact.calcId)}</span>
                  </li>
                ))}
              </ul>
            </Group>
          ) : null}

          {tier ? (
            <NoteCard icon="leaf">
              <b>{tier.name}.</b> {tier.text}
            </NoteCard>
          ) : null}
          <p className="small muted">{tech.farmerMessageRo}</p>
          {upgraded ? (
            <NoteCard icon="clock">The price of the changes is estimated. Before signing, the bank asks the supplier for an updated offer, and the credit amount is adjusted to it.</NoteCard>
          ) : null}
        </>
      ) : null}

      <Actions>
        <NextButton href="#/verde/agro/cerere" disabled={!tech}>
          Prepare the application
        </NextButton>
      </Actions>
    </>
  );
}
