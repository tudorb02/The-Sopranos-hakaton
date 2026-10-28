// Dimensionless UI progress is computed here; no monetary totals are cached.
const ratio = (part, whole) => (whole > 0 ? Math.max(0, Math.min(100, (part / whole) * 100)) : 0);
export function metrics(data) {
  const largest = Math.max(1, ...data.profile.spending.map((item) => item.lei));
  return {
    categories: Object.fromEntries(
      data.spending.parts.map((part) => [
        part.id,
        data.spending.total > 0 ? Math.round((part.lei / data.spending.total) * 100) : 0,
      ]),
    ),
    budgets: Object.fromEntries(
      data.budgets.map((budget) => [
        budget.id,
        ratio(
          budget.kind === "count" ? budget.used : (budget.spent ?? 0),
          budget.kind === "count" ? budget.max : (budget.limit ?? 0),
        ),
      ]),
    ),
    goal: ratio(data.goal.saved, data.goal.amount),
    profile: Object.fromEntries(data.profile.spending.map((item) => [item.name, ratio(item.lei, largest)])),
  };
}
