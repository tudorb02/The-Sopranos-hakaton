// Interaction rules belong to the UI; answers and their defaults come from the API.
const MULTIPLE = new Set(["probleme", "obiective", "bani-in-afara", "venituri", "necesare", "idei"]);

export function toggleQuestionChoice(question, selected, label) {
  if (MULTIPLE.has(question.id)) return selected.includes(label) ? selected.filter((item) => item !== label) : [...selected, label];
  return selected.includes(label) ? [] : [label];
}
