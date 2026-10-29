// A Raiffeisen service as the coach shows it (rules in design/coach-services.md): only for a need the client
// stated or confirmed. The card says what the service is, exactly how it helps this client, what it costs,
// the way without it, and links to the bank's own page. Nothing is set up from here.

import { useId } from "react";

import { Icon } from "./icons.jsx";
import { IconTile } from "./ui.jsx";

// state: "active", "proposed", "later" or "howto" (a feature the client already has).
const STATUS_CLASS = { active: "status is-on", proposed: "status status--outline", later: "status", howto: "status" };

// A link to raiffeisen.ro, opened in a new tab.
export function ExternalLink({ link }) {
  return (
    <a className="ext-link" href={link.href} target="_blank" rel="noopener noreferrer">
      <span>{link.label}</span>
      <Icon name="external" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

function Details({ service }) {
  return (
    <>
      <dl className="terms">
        {service.terms.map((term) => (
          <div key={term.label}>
            <dt>{term.label}</dt>
            <dd>{term.value}</dd>
          </div>
        ))}
      </dl>
      {service.without ? <p className="small muted">{service.without}</p> : null}
    </>
  );
}

// compact: the costs and the reason fold under "Costs and details" (Profile, chat).
export function ServiceCard({ service, compact = false }) {
  const id = useId();
  return (
    <article className={compact ? "card service service--compact" : "card service"} aria-labelledby={id}>
      <div className="service-top">
        <IconTile icon={service.icon} tone={service.state === "active" ? "yellow" : "sand"} />
        <div className="service-name">
          <p className="eyebrow">{service.kind}</p>
          <p id={id} className="row-name">
            {service.name}
          </p>
        </div>
        <span className={STATUS_CLASS[service.state]}>{service.status}</span>
      </div>

      <p className="small">{service.description}</p>

      <div className="service-helps">
        <p className="service-helps-label">How it helps you</p>
        <p>{service.helps}</p>
      </div>

      {compact ? (
        <details className="why">
          <summary>Costs and details</summary>
          <div className="service-more">
            <p>
              <b>{service.whyLabel ?? "Why I suggest this"}:</b> {service.why}
            </p>
            <Details service={service} />
          </div>
        </details>
      ) : (
        <>
          <Details service={service} />
          <details className="why">
            <summary>{service.whyLabel ?? "Why I suggest this"}</summary>
            <p>{service.why}</p>
          </details>
        </>
      )}

      <div className="service-foot">
        <ExternalLink link={service.link} />
        <p className="small muted">Source: {service.source}</p>
      </div>

      {service.actions ? (
        <div className="btn-row">
          {service.actions.map((action, i) => (
            <button key={action} type="button" className={i === 0 ? "btn btn--small" : "btn btn--text btn--small"}>
              {action}
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}
