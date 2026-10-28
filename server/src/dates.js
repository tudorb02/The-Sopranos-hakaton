const DAY = 86400000;
export function demoToday(value = process.env.DEMO_TODAY ?? "2026-11-12") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) throw new Error("DEMO_TODAY must be a valid ISO date");
  return value;
}
export const daysBetween = (start, end) => Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY);
export const addDays = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
export const weekday = (date) => new Date(`${date}T00:00:00Z`).getUTCDay();
export const monday = (date) => addDays(date, -(weekday(date) + 6) % 7);
export const label = (date, options) => new Intl.DateTimeFormat("ro-RO", { timeZone: "UTC", ...options }).format(new Date(`${date}T00:00:00Z`));
export const capitalize = (text) => text[0].toLocaleUpperCase("ro-RO") + text.slice(1);
export const longDate = (date) => label(date, { day: "numeric", month: "long" });
export function dayLabels(date, today) {
  const recent = date === today || date === addDays(today, -1);
  return { label: date === today ? "Azi" : date === addDays(today, -1) ? "Ieri" : capitalize(label(date, { weekday: "long" })),
    date: label(date, { ...(recent ? { weekday: "long" } : {}), day: "numeric", month: "short" }) };
}
