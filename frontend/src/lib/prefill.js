// Prefilled answers of the questionnaire, from what the farm data already says (APIA parcels and crops, Open Banking
// cashflow). A question declares where it could come from (`prefillFrom`); we fill it only when the data allows.

function latestCrops(farm) {
  const crops = farm?.farm?.crops ?? [];
  if (!crops.length) return [];
  const year = Math.max(...crops.map((c) => c.year));
  return [...new Set(crops.filter((c) => c.year === year).map((c) => c.crop))];
}

// -> { value, source } or null
export function prefillAnswer(question, farm) {
  if (!farm) return null;
  if (question.prefillFrom === "OPEN_BANKING" && question.type === "MONTHS" && farm.cashflow?.peakMonths?.length) {
    return { value: [...farm.cashflow.peakMonths], source: "Open Banking" };
  }
  if (question.prefillFrom === "APIA") {
    if (question.type === "TEXT") {
      const crops = latestCrops(farm);
      return crops.length ? { value: crops.join(", "), source: "APIA" } : null;
    }
    const current = farm.farm?.currentIrrigation;
    if (question.type === "SINGLE_CHOICE" && question.questionId === "irrigation_current" && current && question.options?.some((o) => o.value === current)) {
      return { value: current, source: "APIA" };
    }
  }
  return null;
}

// The prefilled answers of a whole questionnaire: { answers: {id: value}, sources: {id: "APIA"} }.
export function prefillAll(questions, farm) {
  const answers = {};
  const sources = {};
  for (const q of questions) {
    const p = prefillAnswer(q, farm);
    if (p) {
      answers[q.questionId] = p.value;
      sources[q.questionId] = p.source;
    }
  }
  return { answers, sources };
}

export const isAnswered = (value) => value !== undefined && value !== null && value !== "" && !(Array.isArray(value) && value.length === 0);

// The answers as the API wants them: numbers as numbers, empty optional answers left out.
export function serializeAnswers(questions, answers) {
  const out = {};
  for (const q of questions) {
    const v = answers[q.questionId];
    if (!isAnswered(v)) continue;
    out[q.questionId] = q.type === "NUMBER" ? Number(v) : v;
  }
  return out;
}

// Required questions that still have no valid answer.
export function missingRequired(questions, answers) {
  return questions.filter((q) => {
    if (!q.required) return false;
    const v = answers[q.questionId];
    if (q.type === "NUMBER") return !isAnswered(v) || Number.isNaN(Number(v));
    if (q.type === "BOOLEAN") return typeof v !== "boolean";
    return !isAnswered(v);
  });
}
