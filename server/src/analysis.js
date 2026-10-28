// Deterministic analysis of the transactions the coach is allowed to read.
// Every insight payload holds amounts in bani and ISO dates; copy.js turns them into text.
import { addDays, daysBetween } from "./dates.js";
import { cycles } from "./history.js";

const MONTHS = ["IANUARIE", "FEBRUARIE", "MARTIE", "APRILIE", "MAI", "IUNIE", "IULIE", "AUGUST", "SEPTEMBRIE", "OCTOMBRIE", "NOIEMBRIE", "DECEMBRIE"];
export const pattern = (raw) =>
  MONTHS.reduce((text, month) => text.replaceAll(month, ""), raw.toLocaleUpperCase("ro-RO"))
    .replace(/\d+/g, "#")
    .replace(/\s+/g, " ")
    .trim();
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};
const sum = (values) => values.reduce((total, value) => total + value, 0);
const expense = (row) => row.amount_minor < 0 && !["saving", "pot"].includes(row.kind) && !row.excluded;

// End-of-day balance of the current account, from the ledger opening and every booked row.
export function dailyBalance(rows, opening, from, to) {
  const byDate = new Map();
  for (const row of rows) byDate.set(row.local_date, (byDate.get(row.local_date) ?? 0) + row.amount_minor);
  let balance = opening;
  for (const [date, amount] of [...byDate].sort()) if (date < from) balance += amount;
  const result = new Map();
  for (let date = from; date <= to; date = addDays(date, 1)) {
    balance += byDate.get(date) ?? 0;
    result.set(date, balance);
  }
  return result;
}

export function completeCycles(rows, incomeDay, asOf) {
  if (!rows.length) return [];
  const first = rows[0].local_date;
  return cycles(first, asOf, incomeDay).filter((cycle) => cycle.start >= first && cycle.end < asOf);
}

// Monthly payments: same description pattern, one per cycle, in at least two cycles, stable amount.
export function recurringGroups(rows, periods) {
  const groups = new Map();
  for (const row of rows) {
    const key = pattern(row.description_raw);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const result = [];
  for (const [key, items] of groups) {
    const perCycle = periods.map((cycle) => items.filter((row) => row.local_date >= cycle.start && row.local_date <= cycle.end));
    const single = perCycle.filter((list) => list.length === 1).map((list) => list[0]);
    if (single.length < 2 || perCycle.some((list) => list.length > 1)) continue;
    const amounts = single.map((row) => Math.abs(row.amount_minor));
    const middle = median(amounts);
    if (amounts.some((amount) => Math.abs(amount - middle) > middle * 0.15)) continue;
    result.push({ pattern: key, merchant: items[0].merchant, category: items[0].category, amount_minor: middle, cycles: single.length, income: items[0].amount_minor > 0, rows: single });
  }
  return result;
}

const monthOf = (date) => date.slice(0, 7);

export function analyse(view, facts, asOf) {
  const rows = view.rows.filter((row) => row.local_date <= asOf);
  const current = rows.filter((row) => row.account_key === "current");
  const periods = completeCycles(current, facts.income_day, asOf);
  const config = facts.config;
  const insights = [];
  const add = (type, payload) => insights.push({ type, payload });
  if (!rows.length || !periods.length)
    return { steps: { income: null, recurring: null, categories: { total: rows.length, done: rows.length }, habits: { observations: 0 } }, insights };

  const recurring = recurringGroups(current, periods);
  const main = recurring
    .filter((group) => group.income && group.pattern.startsWith(facts.income_pattern))
    .sort((a, b) => b.amount_minor - a.amount_minor)[0];
  const months = new Set(current.map((row) => monthOf(row.local_date)));
  const incomeStep = main
    ? {
        day: facts.income_day,
        total: months.size,
        hit: new Set(
          current
            .filter((row) => pattern(row.description_raw) === main.pattern && Math.abs(Number(row.local_date.slice(8)) - facts.income_day) <= 1)
            .map((row) => monthOf(row.local_date)),
        ).size,
      }
    : null;
  const outgoing = recurring.filter((group) => !group.income);
  const recurringStep = { count: outgoing.length, subscriptions: outgoing.filter((group) => group.category === "abonamente").length };
  const categoriesStep = { total: rows.length, done: rows.filter((row) => row.category !== "nesortat").length };

  const balances = dailyBalance(view.ledger, view.opening_minor, periods[0].start, asOf);
  const shortage = config.shortage;
  if (shortage) {
    const last = periods.slice(-shortage.months);
    const hit = last.filter((cycle) => {
      const anchor = addDays(cycle.end, -7);
      const from = `${anchor.slice(0, 8)}${String(shortage.from_day).padStart(2, "0")}`;
      let low = Infinity;
      for (let date = from; date <= cycle.end; date = addDays(date, 1)) low = Math.min(low, balances.get(date) ?? Infinity);
      return low < shortage.threshold_minor;
    }).length;
    if (hit * 2 > last.length) add("end_of_month_shortage", { threshold_minor: shortage.threshold_minor, from_day: shortage.from_day, hit, total: last.length });
  }

  if (config.ran_out) {
    const irregular = new Set(current.filter((row) => row.merchant === config.ran_out.irregular_merchant).map((row) => monthOf(row.local_date)));
    const months = [];
    for (const cycle of periods) {
      if (irregular.has(monthOf(cycle.start))) continue;
      let day = null;
      for (let date = cycle.start; date <= cycle.end; date = addDays(date, 1))
        if ((balances.get(date) ?? Infinity) < config.ran_out.threshold_minor) { day = date; break; }
      if (day) months.push({ month: monthOf(cycle.start), days: daysBetween(day, cycle.end) });
    }
    if (months.length)
      add("ran_out", { months: months.map((item) => item.month), days: months.map((item) => item.days), avg_days: Math.round(sum(months.map((item) => item.days)) / months.length) });
  }

  // The most expensive frequent habit in the last months (≥ 3 payments a week at one merchant).
  const recent = periods.slice(-config.habit_cycles);
  const recentRows = current.filter((row) => row.local_date >= recent[0].start && row.local_date <= recent.at(-1).end && expense(row));
  const weeks = daysBetween(recent[0].start, recent.at(-1).end) / 7;
  const byMerchant = new Map();
  for (const row of recentRows.filter((item) => item.kind === "variable")) {
    if (!byMerchant.has(row.merchant)) byMerchant.set(row.merchant, []);
    byMerchant.get(row.merchant).push(row);
  }
  const habit = [...byMerchant.values()]
    .filter((items) => items.length / weeks >= 3)
    .sort((a, b) => sum(b.map((row) => -row.amount_minor)) - sum(a.map((row) => -row.amount_minor)))[0];
  if (habit) {
    const perWeek = habit.length / weeks;
    const times = habit.map((row) => row.occurred_at.slice(11, 16)).sort();
    add("recurring_expense", {
      merchant: habit[0].merchant,
      avg_minor: Math.round(-sum(habit.map((row) => row.amount_minor)) / habit.length),
      per_week_min: Math.floor(perWeek),
      per_week_max: Math.ceil(perWeek),
      monthly_minor: Math.round(-sum(habit.map((row) => row.amount_minor)) / recent.length),
      from_time: times[0],
      to_time: times.at(-1),
    });
  }

  if (config.front_days) {
    const spent = current.filter((row) => expense(row) && row.local_date >= periods[0].start && row.local_date <= periods.at(-1).end);
    const early = spent.filter((row) => {
      const cycle = periods.find((item) => row.local_date >= item.start && row.local_date <= item.end);
      return daysBetween(cycle.start, row.local_date) < config.front_days;
    });
    add("front_loading", { days: config.front_days, share: Math.round((sum(early.map((row) => row.amount_minor)) / sum(spent.map((row) => row.amount_minor))) * 100) });
  }

  for (const sub of facts.subscriptions.filter((item) => item.monitored)) {
    const signals = sub.signals.filter((date) => date <= asOf).sort();
    const last = signals.at(-1) ?? null;
    const month = monthOf(asOf);
    add("subscription_usage", {
      name: sub.name,
      amount_minor: sub.amount_minor,
      app_label: sub.app_label,
      unused: !last || daysBetween(last.slice(0, 10), asOf) > 30,
      last_signal: last?.slice(0, 10) ?? null,
      month,
      opens_in_month: signals.filter((date) => date.startsWith(month)).length,
    });
  }

  const nextMonths = [monthOf(addDays(`${monthOf(asOf)}-01`, 32)), monthOf(addDays(`${monthOf(asOf)}-01`, 63))];
  for (const month of nextMonths) {
    const birthdays = facts.events.filter((event) => event.type === "birthday" && event.starts_on.startsWith(month)).length;
    if (birthdays >= 3) {
      add("upcoming_spike", { month, birthdays });
      break;
    }
  }
  const deadline = facts.events.filter((event) => event.type === "deadline" && event.starts_on > asOf).sort((a, b) => a.starts_on.localeCompare(b.starts_on))[0];
  if (deadline) add("deadline", { title: deadline.title, phrase: deadline.phrase, date: deadline.starts_on });

  if (facts.needs_minor) add("needs_cover", { needs_minor: facts.needs_minor, income_minor: main?.amount_minor ?? 0 });

  if (config.ran_out?.irregular_merchant) {
    const grant = current.filter((row) => row.merchant === config.ran_out.irregular_merchant && row.amount_minor > 0);
    if (grant.length)
      add("irregular_income", { months: grant.map((row) => monthOf(row.local_date)), day: median(grant.map((row) => Number(row.local_date.slice(8)))) });
  }
  if (config.side_income) {
    const counts = periods
      .map((cycle) => current.filter((row) => row.amount_minor > 0 && pattern(row.description_raw) === config.side_income && row.local_date >= cycle.start && row.local_date <= cycle.end).length)
      .filter(Boolean);
    if (counts.length) add("side_income", { min_count: Math.min(...counts), max_count: Math.max(...counts) });
  }

  return {
    steps: {
      income: incomeStep,
      recurring: recurringStep,
      categories: categoriesStep,
      habits: { observations: insights.filter((item) => !["irregular_income", "side_income", "front_loading"].includes(item.type)).length },
    },
    insights,
    recurring: recurring.map((group) => group.pattern),
  };
}
