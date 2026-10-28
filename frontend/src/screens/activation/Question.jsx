import { ChoiceChips, Field, IconTile } from "../../components/ui.jsx";
import { usePersona } from "../../persona.js";

export function Question({ index }) {
  const { questions } = usePersona();
  const question = questions[index];
  return (
    <>
      <div className="coach-q">
        <IconTile icon="compass" tone="yellow" />
        <h1 className="msg msg--coach question-title">{question.title}</h1>
      </div>
      {question.hint ? <p className="small muted">{question.hint}</p> : null}
      <ChoiceChips label={question.title} options={question.options} />
      {question.fields ? (
        <div className="fields">
          {question.fields.map((field) => (
            <Field key={field.label} field={field} />
          ))}
        </div>
      ) : null}
    </>
  );
}
