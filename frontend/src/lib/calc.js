// Figures of a dossier. Every number shown to a user is resolved from RunView.calcs by calcId: the API already formatted
// it (`display`), so nothing here computes or reformats money, percentages or ratios.

export const calcOf = (run, calcId) => (calcId && run?.calcs ? run.calcs[calcId] : undefined) ?? null;

// The ready-to-show text of a figure ("85.000 EUR", "15,0%"); a dash when the figure is missing.
export const disp = (run, calcId) => calcOf(run, calcId)?.display ?? "—";

// The raw value, only for decisions such as "is the advantage positive", never for display.
export const valueOf = (run, calcId) => calcOf(run, calcId)?.value ?? null;

// The funding option of a variant: CLASIC = the STANDARD option, VERDE = the recommended green one.
export function optionFor(funding, variant) {
  const options = funding?.options ?? [];
  if (variant === "CLASIC") return options.find((o) => o.kind === "STANDARD") ?? null;
  const green = options.filter((o) => o.greenEligible);
  return green.find((o) => o.optionId === funding?.recommendedOptionId) ?? green[0] ?? null;
}

// The loan item of an option (the guarantee item is a separate entry of the funding stack).
export const loanOf = (option) => option?.fundingStack?.find((item) => item.type === "STANDARD_LOAN" || item.type === "GREEN_LOAN") ?? null;

// All figures that came with the events of a dossier (agent.tool_result.data.calcs), by calcId.
export function calcsFromEvents(events) {
  const out = {};
  for (const e of events) {
    if (e.type === "agent.tool_result") for (const c of e.data.calcs ?? []) out[c.calcId] = c;
  }
  return out;
}
