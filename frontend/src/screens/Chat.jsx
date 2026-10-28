import { Icon } from "../components/icons.jsx";
import { chat } from "../data/demo.js";

function Proposal({ item }) {
  return (
    <div className="proposal">
      <p className="eyebrow">Propunere</p>
      <p className="row-name">{item.title}</p>
      <ul className="proposal-lines">
        {item.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {item.done ? (
        <p className="proposal-done">✓ {item.done}</p>
      ) : (
        <div className="btn-row">
          {item.actions.map((action, i) => (
            <button key={action} type="button" className={i === 0 ? "btn btn--small" : "btn btn--text btn--small"}>
              {action}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Message({ item }) {
  if (item.type === "divider") return <p className="day-divider">{item.text}</p>;
  if (item.type === "me") return <p className="msg msg--me">{item.text}</p>;
  if (item.type === "proposal") return <Proposal item={item} />;
  return (
    <div className="msg msg--coach">
      <p>{item.text}</p>
      {item.steps ? (
        <ol>
          {item.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      ) : null}
      {item.after ? <p className="msg-after">{item.after}</p> : null}
    </div>
  );
}

export default function Chat() {
  return (
    <>
      <p className="flow-intro">Îți răspund din datele tale. Nu fac nicio operațiune fără acordul tău.</p>
      <div className="thread" role="log" aria-label="Mesaje">
        {chat.map((item, i) => (
          <Message key={i} item={item} />
        ))}
      </div>
      <div className="composer">
        <label htmlFor="composer-input" className="sr-only">
          Mesajul tău
        </label>
        <input id="composer-input" type="text" placeholder="Scrie un mesaj…" autoComplete="off" />
        <button type="button" className="send" aria-label="Trimite">
          <Icon name="send" />
        </button>
      </div>
    </>
  );
}
