// Deterministic bank-ledger generator for the fictional demo personas.
// The seed stores the pattern (amounts in bani, days, merchants); this expands it into
// individual transactions, so every count, average and balance shown later is computed.
import { addDays, daysBetween, weekday } from "./dates.js";

const LEDGER_DAY_LIMIT = 400;

function random(seedText) {
  let seed = [...seedText].reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619), 2166136261);
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const monthKey = (date) => date.slice(0, 7);
const monthIndex = (date) => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;
const fromMonthIndex = (index, day) =>
  `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
const daysInMonth = (date) => new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0)).getUTCDate();
const clampDay = (index, day) => fromMonthIndex(index, Math.min(day, daysInMonth(fromMonthIndex(index, 1))));

// Budget cycles start on the income day; a short month starts on its last day.
export function cycleStart(date, cycleDay) {
  const index = monthIndex(date);
  const start = clampDay(index, cycleDay);
  return date >= start ? start : clampDay(index - 1, cycleDay);
}
export const nextCycleStart = (start, cycleDay) => clampDay(monthIndex(start) + 1, cycleDay);
export function cycles(from, until, cycleDay) {
  const result = [];
  for (let start = cycleStart(from, cycleDay); start <= until; start = nextCycleStart(start, cycleDay))
    result.push({ start, end: addDays(nextCycleStart(start, cycleDay), -1) });
  return result;
}

export const localInstant = (date, time) => {
  // Europe/Bucharest: EEST from the last Sunday of March to the last Sunday of October.
  const lastSunday = (month) => {
    const end = clampDay(Number(date.slice(0, 4)) * 12 + month - 1, 31);
    return addDays(end, -weekday(end));
  };
  const summer = date >= lastSunday(3) && date < lastSunday(10);
  return `${date}T${time}:00${summer ? "+03:00" : "+02:00"}`;
};
const minutes = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const clock = (value) => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
const monthName = (date) =>
  new Intl.DateTimeFormat("ro-RO", { month: "long", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
const raw = (template, date) => template.replaceAll("{MONTH}", monthName(date).toLocaleUpperCase("ro-RO"));

function split(total, count, jitter, next) {
  // Whole lei per payment; the last one absorbs rounding so the total is exact.
  if (count <= 0 || total <= 0) return [];
  const base = Math.floor(total / count / 100) * 100;
  const parts = Array.from({ length: count - 1 }, () =>
    Math.max(100, Math.round((base * (1 + (next() * 2 - 1) * jitter)) / 100) * 100),
  );
  const last = total - parts.reduce((sum, value) => sum + value, 0);
  if (last < 100) return split(total, count - 1, jitter, next);
  return [...parts, last];
}

function pickDays(candidates, count, front, next, frontDays = 10) {
  const early = candidates.filter((day) => day.offset < frontDays);
  const late = candidates.filter((day) => day.offset >= frontDays);
  const choose = (pool, wanted) => {
    const available = [...pool];
    const chosen = [];
    while (chosen.length < wanted && pool.length) {
      if (!available.length) available.push(...pool);
      chosen.push(available.splice(Math.floor(next() * available.length), 1)[0]);
    }
    return chosen;
  };
  const wantedEarly = Math.min(count, Math.round(count * front));
  return [...choose(early.length ? early : late, wantedEarly), ...choose(late.length ? late : early, count - wantedEarly)]
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function generateLedger(slug, spec) {
  const next = random(slug);
  const rows = [];
  const range = cycles(spec.start, spec.end, spec.cycle_day).filter((cycle) => cycle.start >= spec.start);
  if (daysBetween(spec.start, spec.end) > LEDGER_DAY_LIMIT) throw new Error("Ledger range is too long");
  let balance = spec.opening_minor;
  for (const cycle of range) {
    const key = monthKey(cycle.start);
    const options = spec.cycles?.[key] ?? {};
    const end = cycle.end <= spec.end ? cycle.end : spec.end;
    const lastSpendDay = options.run_out_day ? addDays(cycle.start, options.run_out_day - 1) : end;
    const cycleRows = [];
    for (const item of spec.recurring) {
      if (item.from && cycle.start < item.from) continue;
      if (item.until && cycle.start > item.until) continue;
      if (item.months && !item.months.includes(key)) continue;
      const date = addDays(cycle.start, item.day);
      if (date > end) continue;
      const amount = item.amounts?.[key] ?? item.amount_minor;
      if (!amount) continue;
      cycleRows.push({ item, date, time: item.time, amount_minor: amount });
    }
    const variable = spec.variable.map((item) => ({
      item,
      total: options.amounts?.[item.key] ?? item.monthly_minor,
    }));
    if (options.end_minor !== undefined) {
      const balancing = variable.find((entry) => entry.item.key === spec.balance_key);
      const known =
        cycleRows.reduce((sum, row) => sum + row.amount_minor, 0) -
        variable.filter((entry) => entry !== balancing).reduce((sum, entry) => sum + entry.total, 0);
      balancing.total = balance + known - options.end_minor;
      if (balancing.total < 0) throw new Error(`Cycle ${key} cannot reach its balance target`);
    }
    for (const { item, total } of variable) {
      const candidates = [];
      for (let date = cycle.start; date <= lastSpendDay && date <= end; date = addDays(date, 1))
        if ((!item.weekdays || ![0, 6].includes(weekday(date))) && !(spec.quiet_first_day && date === cycle.start))
          candidates.push({ date, offset: daysBetween(cycle.start, date) });
      const count = item.amount_each ? Math.round(total / item.amount_each) : item.count;
      let days = pickDays(candidates, count, item.front ?? 0.5, next, item.front_days);
      if (options.run_out_day && item.key === spec.balance_key && days.length)
        days = [...days.slice(0, -1), candidates.at(-1)];
      const amounts = item.amount_each
        ? days.map(() => item.amount_each)
        : split(total, days.length, item.jitter ?? 0.35, next);
      days = days.slice(0, amounts.length);
      days.forEach((day, index) => {
        const merchant = item.merchants[Math.floor(next() * item.merchants.length)];
        const [from, to] = item.times.map(minutes);
        cycleRows.push({
          item: { ...item, ...merchant },
          date: day.date,
          time: clock(from + Math.floor(next() * Math.max(1, to - from))),
          amount_minor: -amounts[index],
        });
      });
    }
    cycleRows.sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
    for (const row of cycleRows) {
      balance += row.amount_minor;
      if (balance < 0) throw new Error(`Generated ledger for ${slug} goes negative on ${row.date}`);
      rows.push({
        external_id: `${slug}-${row.date}-${rows.length}`,
        local_date: row.date,
        occurred_at: localInstant(row.date, row.time),
        amount_minor: row.amount_minor,
        category: row.item.category,
        merchant: row.item.merchant,
        name: row.item.name ?? row.item.merchant,
        description_raw: raw(row.item.raw, row.date),
      });
    }
  }
  return { rows, closing_minor: balance };
}
