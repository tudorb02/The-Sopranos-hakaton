const integer = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 1 });

// 1241 -> "1.241"
export const num = (x) => integer.format(x);

// 1241 -> "1.241 lei"
export const lei = (x) => `${integer.format(x)} lei`;

// 85000 -> "85.000 EUR"
export const eur = (x) => `${integer.format(x)} EUR`;

// 8.5 -> "8,5 ha"
export const ha = (x) => `${decimal.format(x)} ha`;

// Share of a whole as a CSS percentage, clamped to 0–100%.
export const pct = (value, whole) => `${Math.max(0, Math.min(100, (value / whole) * 100))}%`;
