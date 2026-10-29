// Step 5: the questions of the category (GET /api/modules questionnaire), prefilled from APIA / Open Banking where the
// farm data allows. "Send for analysis" creates the dossier (POST /api/runs, multipart).

import { useEffect, useId, useMemo, useState } from "react";

import { Actions, ErrorCard, Loading, NextButton } from "../../../components/live.jsx";
import { Src } from "../../../components/ui.jsx";
import { createRun } from "../../../lib/api.js";
import { useFarm, useModules } from "../../../lib/hooks.js";
import { MONTH_LIST, MONTHS_RO, UNIT_RO } from "../../../lib/labels.js";
import { isAnswered, missingRequired, prefillAll, serializeAnswers } from "../../../lib/prefill.js";
import { getFiles, patchFlow, rememberRun, useFlow } from "../../../lib/session.js";
import { Missing } from "./shared.jsx";

function Chips({ label, options, selected, multi, onChange }) {
  const toggle = (value) => {
    if (!multi) return onChange(selected === value ? undefined : value);
    const set = new Set(selected ?? []);
    if (set.has(value)) set.delete(value);
    else set.add(value);
    return onChange([...set]);
  };
  const isOn = (value) => (multi ? (selected ?? []).includes(value) : selected === value);
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" className="chip" aria-pressed={isOn(o.value) ? "true" : "false"} onClick={() => toggle(o.value)}>
          {o.labelRo}
        </button>
      ))}
    </div>
  );
}

function Question({ question, value, source, onChange }) {
  const id = useId();
  const suffix = question.unit ? UNIT_RO[question.unit] : null;
  let control;
  switch (question.type) {
    case "TEXT":
      control = (
        <div className="input">
          <input id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
        </div>
      );
      break;
    case "NUMBER":
      control = (
        <div className="input">
          <input id={id} inputMode="decimal" value={value ?? ""} onChange={(e) => onChange(e.target.value.replace(",", "."))} />
          {suffix ? <span className="suffix">{suffix}</span> : null}
        </div>
      );
      break;
    case "BOOLEAN":
      control = (
        <Chips
          label={question.labelRo}
          options={[
            { value: "true", labelRo: "Yes" },
            { value: "false", labelRo: "No" },
          ]}
          selected={typeof value === "boolean" ? String(value) : undefined}
          onChange={(v) => onChange(v === undefined ? undefined : v === "true")}
        />
      );
      break;
    case "SINGLE_CHOICE":
      control = <Chips label={question.labelRo} options={question.options} selected={value} onChange={onChange} />;
      break;
    case "MULTI_CHOICE":
      control = <Chips label={question.labelRo} options={question.options} selected={value} multi onChange={onChange} />;
      break;
    case "MONTHS":
      control = (
        <Chips label={question.labelRo} options={MONTH_LIST.map((m) => ({ value: m, labelRo: MONTHS_RO[m] }))} selected={value} multi onChange={onChange} />
      );
      break;
    default:
      control = null;
  }
  const labelled = ["TEXT", "NUMBER"].includes(question.type);
  return (
    <div className="question">
      {labelled ? (
        <div className="field">
          <label htmlFor={id}>
            {question.labelRo}
            {question.required ? "" : " (optional)"}
          </label>
          {control}
        </div>
      ) : (
        <>
          <p className="question-label">
            {question.labelRo}
            {question.required ? "" : " (optional)"}
          </p>
          {control}
        </>
      )}
      {source ? <Src kind="obs" label={`filled in from ${source}`} /> : null}
    </div>
  );
}

export function Questions() {
  const flow = useFlow();
  const modules = useModules();
  const farm = useFarm(flow.cui);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sources, setSources] = useState({});

  const module = modules.data?.find((m) => m.moduleId === flow.moduleId);
  const questions = module?.questionnaire ?? [];

  // Prefill once per category and company, without overwriting what the farmer already typed.
  const prefilled = useMemo(() => (module && farm.data ? prefillAll(questions, farm.data) : null), [module, farm.data]);
  useEffect(() => {
    if (!prefilled) return;
    const fresh = Object.fromEntries(Object.entries(prefilled.answers).filter(([id]) => !isAnswered(flow.answers[id])));
    if (Object.keys(fresh).length) patchFlow({ answers: { ...flow.answers, ...fresh } });
    setSources(prefilled.sources);
  }, [prefilled]);

  if (!flow.cui) {
    return <Missing href="#/verde/agro/firma" label="Start with the company">Choose the company first.</Missing>;
  }
  if (!flow.moduleId) {
    return <Missing href="#/verde/agro/documente" label="Upload the offer">Upload the offer first, so we know what investment you are making.</Missing>;
  }

  const set = (id, value) => {
    setSources((s) => ({ ...s, [id]: undefined }));
    patchFlow({ answers: { ...flow.answers, [id]: value } });
  };
  const missing = missingRequired(questions, flow.answers);
  const parcelIds = flow.parcelIds ?? farm.data?.parcels.features.map((f) => f.id) ?? [];

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await createRun({
        cui: flow.cui,
        moduleId: flow.moduleId,
        parcelIds,
        questionnaire: serializeAnswers(questions, flow.answers),
        documents: getFiles(),
        consents: flow.consents,
      });
      rememberRun(created.runId);
      return true;
    } catch (e) {
      setError(e);
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <header className="intro">
        <h1 className="page-title">A few questions</h1>
        <p className="small muted">Only what we need for the calculation. We filled them in from APIA and your income where we could.</p>
      </header>

      {modules.loading || farm.loading ? <Loading label="Preparing the questions…" /> : null}
      <ErrorCard error={modules.error ?? farm.error} onRetry={() => (modules.error ? modules.reload() : farm.reload())} />

      {module ? (
        <div className="card questions">
          {questions.map((q) => (
            <Question key={q.questionId} question={q} value={flow.answers[q.questionId]} source={sources[q.questionId]} onChange={(v) => set(q.questionId, v)} />
          ))}
        </div>
      ) : null}

      <ErrorCard error={error} onRetry={send} retryLabel="Send again" />

      <Actions>
        <NextButton href="#/verde/agro/analiza" onClick={send} busy={busy} disabled={!module || missing.length > 0}>
          Send for analysis
        </NextButton>
        {missing.length ? <p className="small muted">{missing.length} required questions are still unanswered.</p> : null}
      </Actions>
    </>
  );
}
