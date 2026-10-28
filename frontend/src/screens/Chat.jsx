import { Icon } from "../components/icons.jsx";
import { ServiceCard } from "../components/services.jsx";
import { DisclaimerStrip } from "../components/ui.jsx";
import { legal } from "../data/legal.js";
import { usePersona } from "../persona.js";

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

function Message({ item, services }) {
  if (item.type === "divider") return <p className="day-divider">{item.text}</p>;
  if (item.type === "me") return <p className="msg msg--me">{item.text}</p>;
  if (item.type === "proposal") return <Proposal item={item} />;
  if (item.type === "service") {
    return (
      <div className="msg-service">
        <ServiceCard service={services.items.find((service) => service.id === item.id)} compact />
      </div>
    );
  }
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
  const { chat, services } = usePersona();
  return (
    <>
      <DisclaimerStrip legal={legal} className="disclaimer-strip--card" />
      <div className="thread" role="log" aria-label="Mesaje">
        {chat.map((item, i) => (
          <Message key={i} item={item} services={services} />
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
