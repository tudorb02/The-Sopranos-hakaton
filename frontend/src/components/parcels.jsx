// The agricultural variant of the "where" step: the APIA parcels drawn as SVG, so the demo works offline.

import { ha } from "../lib/format.js";

export function ParcelMap({ location }) {
  const total = location.parcels.reduce((sum, parcel) => sum + parcel.ha, 0);
  const chosen = location.parcels.filter((parcel) => parcel.selected);
  const chosenHa = chosen.reduce((sum, parcel) => sum + parcel.ha, 0);
  const label = location.parcels.map((parcel) => `${parcel.id} ${parcel.name}, ${ha(parcel.ha)}${parcel.selected ? ", aleasă" : ""}`).join("; ");
  return (
    <figure className="card parcel-map">
      <svg viewBox="0 0 320 170" role="img" aria-label={`Harta parcelelor: ${label}.`}>
        <path className="canal" d={location.canal} />
        {location.parcels.map((parcel) => (
          <g key={parcel.id} className={parcel.selected ? "parcel is-selected" : "parcel"}>
            <polygon points={parcel.points} />
            <text x={parcel.label[0]} y={parcel.label[1]} textAnchor="middle">
              {parcel.id}
            </text>
            <text className="parcel-ha" x={parcel.label[0]} y={parcel.label[1] + 12} textAnchor="middle">
              {ha(parcel.ha)}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="small muted">
        {ha(chosenHa)} alese din {ha(total)} · sus, canalul de irigații
      </figcaption>
    </figure>
  );
}
