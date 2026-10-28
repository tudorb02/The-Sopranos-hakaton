// Number formatting as ro-RO: "." between thousands, "," before decimals. Written by hand so every
// JavaScript engine (Hermes on the phone, the browser on the web) prints the same thing.

function group(digits) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function format(x, decimals) {
  const sign = x < 0 ? "-" : "";
  const [int, dec] = Math.abs(x).toFixed(decimals).split(".");
  const trimmed = dec ? dec.replace(/0+$/, "") : "";
  return `${sign}${group(int)}${trimmed ? `,${trimmed}` : ""}`;
}

// 1241 -> "1.241"
export const num = (x) => format(x, 0);

// 1241 -> "1.241 lei"
export const lei = (x) => `${num(x)} lei`;

// 85000 -> "85.000 EUR"
export const eur = (x) => `${num(x)} EUR`;

// 8.5 -> "8,5 ha"
export const ha = (x) => `${format(x, 1)} ha`;

// Share of a whole as a percentage for a width or height, clamped to 0–100%.
export const pct = (value, whole) => `${Math.max(0, Math.min(100, (value / whole) * 100))}%`;
