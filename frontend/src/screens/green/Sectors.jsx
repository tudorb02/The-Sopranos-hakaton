// The area picker of the green credit: agriculture opens its flow, the other areas are coming soon
// (design/pj-greenstruct.md §4).

import { SectorCard } from "../../components/green.jsx";
import { sectors, sectorsIntro } from "../../data/green/sectors.js";

export function Sectors() {
  return (
    <>
      <header className="intro">
        <h1 className="page-title">{sectorsIntro.title}</h1>
        <p className="small muted">{sectorsIntro.lead}</p>
      </header>

      <div className="sector-list">
        {sectors.map((sector) => (
          <SectorCard key={sector.id} sector={sector} />
        ))}
      </div>

      <p className="small muted">{sectorsIntro.more}</p>
    </>
  );
}
