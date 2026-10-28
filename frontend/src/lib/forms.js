// Interaction rules belong to the UI; whether a question takes several answers comes from the API.
export function toggleQuestionChoice(question, selected, label) {
  if (question.multiple) return selected.includes(label) ? selected.filter((item) => item !== label) : [...selected, label];
  return selected.includes(label) ? [] : [label];
}
