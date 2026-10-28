// Integer minor units throughout business logic. Legacy lei numbers exist only at the JSON boundary.
export function minor(value) {
  const match = /^(-?)(\d+)(?:[.,](\d{1,2}))?$/.exec(String(value));
  if (!match) throw new RangeError("Suma trebuie să aibă maximum două zecimale.");
  const result = (BigInt(match[2]) * 100n + BigInt((match[3] ?? "").padEnd(2, "0"))) * (match[1] ? -1n : 1n);
  return safeInteger(result);
}

export function safeInteger(value) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || BigInt(number) !== BigInt(value)) throw new RangeError("Suma depășește limita acceptată.");
  return number;
}

export function lei(value) {
  const amount = BigInt(safeInteger(value));
  const sign = amount < 0n ? "-" : "";
  const absolute = amount < 0n ? -amount : amount;
  return Number(`${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`);
}

export const sum = (values) => safeInteger(values.reduce((total, value) => total + BigInt(value), 0n));
export const roundLei = (amount, divisor = 1) => Number((BigInt(amount) + BigInt(divisor) * 50n) / (BigInt(divisor) * 100n));
export const percent = (part, whole) => whole > 0 ? Number((BigInt(part) * 100n + BigInt(whole) / 2n) / BigInt(whole)) : 0;
export const ro = (value) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
