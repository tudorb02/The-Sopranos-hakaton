const integer = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 });

// 1241 -> "1.241"
export const num = (x) => integer.format(x);

// 1241 -> "1.241 lei"
export const lei = (x) => `${integer.format(x)} lei`;

// Share of a whole as a CSS percentage, clamped to 0–100%.
export const pct = (value, whole) => `${Math.max(0, Math.min(100, (value / whole) * 100))}%`;
