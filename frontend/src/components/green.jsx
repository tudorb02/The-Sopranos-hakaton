// Pieces of the green-credit flow for businesses, shared by every area (design/pj-greenstruct.md §9).

import { Icon } from "./icons.jsx";
import { IconTile } from "./ui.jsx";

// An area of the platform: available (opens its flow) or coming soon (greyed, no action).
export function SectorCard({ sector }) {
  const available = sector.status === "available";
  const body = (
    <>
      <IconTile icon={sector.icon} tone={available ? "yellow" : "sand"} />
      <span className="row-main">
        <span className="row-name">{sector.name}</span>
        <span className="row-note">{sector.text}</span>
      </span>
      {available ? <Icon name="chevron" className="chevron" /> : <span className="status">Coming soon</span>}
    </>
  );
  return available ? (
    <a className="card row sector" href={sector.href}>
      {body}
    </a>
  ) : (
    <div className="card row sector is-soon">{body}</div>
  );
}
