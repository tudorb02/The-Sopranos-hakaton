// Romanian presentation of computed facts. Seed copy may contain {{placeholders}};
// every number or date shown to the user is filled in here from a computed value.
import { addDays, label } from "./dates.js";
import { lei, ro } from "./money.js";

export function formatLei(amountMinor) {
  const value = lei(amountMinor);
  const [whole, fraction] = Math.abs(value).toFixed(2).split(".");
  return `${value < 0 ? "-" : ""}${ro(whole)}${fraction === "00" ? "" : `,${fraction}`}`;
}
// Rounded for estimates ("circa 30 lei"): to whole lei, or to `step` lei.
export const roundedLei = (amountMinor, step = 1) =>
  ro(Math.round(Math.abs(amountMinor) / (100 * step)) * step);

export const dayMonth = (date) => label(date, { day: "numeric", month: "long" });
export const dayMonthShort = (date) => label(date, { day: "numeric", month: "short" });
export const monthLong = (date) => label(date, { month: "long" });
export const monthShort = (date) => label(date, { month: "short" });
export const monthYear = (date) => label(date, { month: "long", year: "numeric" });
export const monthYearShort = (date) => `${monthShort(date)} ${date.slice(0, 4)}`;
export const dayMonthYear = (date) => label(date, { day: "numeric", month: "long", year: "numeric" });

export function dateRange(start, end) {
  if (start.slice(0, 7) === end.slice(0, 7)) return `${Number(start.slice(8))} – ${dayMonthShort(end)}`;
  return `${dayMonthShort(start)} – ${dayMonthShort(end)}`;
}
export const monthRange = (from, to) =>
  from.slice(0, 7) === to.slice(0, 7) ? monthYearShort(from) : `${monthYearShort(from)} – ${monthYearShort(to)}`;

// "1 plată", "5 plăți", "24 de plăți": Romanian requires "de" from 20 upwards.
export function count(n, one, many) {
  if (n === 1) return `1 ${one}`;
  const rest = n % 100;
  return `${ro(n)} ${n > 0 && (rest === 0 || rest >= 20) ? "de " : ""}${many}`;
}

export function list(items) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} și ${items.at(-1)}`;
}

const ORDINALS = ["Prima", "A doua", "A treia", "A patra", "A cincea", "A șasea", "A șaptea", "A opta", "A noua", "A zecea"];
export const ordinal = (n) => ORDINALS[n - 1] ?? `A ${n}-a`;

// Consecutive months collapse into a span: "martie–iunie și octombrie".
export function monthSpans(months, last = null) {
  const index = (month) => Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7));
  const sorted = [...new Set(months)].sort();
  const spans = [];
  for (const month of sorted) {
    const last = spans.at(-1);
    if (last && index(month) === index(last.at(-1)) + 1) last.push(month);
    else spans.push([month]);
  }
  const parts = spans.map((span) =>
      span.length >= 3
        ? `${monthLong(`${span[0]}-01`)}–${monthLong(`${span.at(-1)}-01`)}`
        : span.map((month) => monthLong(`${month}-01`)).join(", "),
  );
  return last && parts.length > 1 ? `${parts.slice(0, -1).join(", ")}${last}${parts.at(-1)}` : list(parts);
}

export function relativeDay(date, today) {
  if (date === today) return "Azi";
  if (date === addDays(today, -1)) return "Ieri";
  return dayMonthShort(date);
}

// Strict mode throws on a missing value; soft mode turns that sentence into null, so a
// persona without the underlying fact (e.g. no analysis yet) simply does not show it.
export function interpolate(value, vars, { soft = false } = {}, path = "") {
  if (typeof value === "string") {
    let missing = null;
    const text = value.replace(/\{\{([^{}]+)\}\}/g, (_, key) => {
      if (vars[key] === undefined || vars[key] === null) {
        missing = key;
        return "";
      }
      return String(vars[key]);
    });
    if (missing === null) return text;
    if (soft) return null;
    throw new Error(`Missing copy value ${missing} in ${path}`);
  }
  if (Array.isArray(value)) return value.map((item, index) => interpolate(item, vars, { soft }, `${path}[${index}]`));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, interpolate(item, vars, { soft }, `${path}.${key}`)]),
    );
  return value;
}

export function monthsBack(date, months) {
  const index = Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1 - months;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}-01`;
}
