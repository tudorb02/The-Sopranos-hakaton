// The "where" step of agriculture: the APIA parcels on a map and in a list (design/pj-greenstruct.md §4).

import { From } from "../../../components/green.jsx";
import { ParcelMap } from "../../../components/parcels.jsx";
import { Group } from "../../../components/ui.jsx";
import { ha } from "../../../lib/format.js";

export function Parcels({ location }) {
  return (
    <>
      <header className="intro">
        <h1 className="page-title">{location.title}</h1>
        <p className="small muted">{location.lead}</p>
      </header>

      <ParcelMap location={location} />

      <Group label="Parcelele tale">
        <ul className="card rows">
          {location.parcels.map((parcel) => (
            <li key={parcel.id}>
              <label className="row parcel-row">
                <input type="checkbox" className="check" defaultChecked={parcel.selected} />
                <span className="row-main">
                  <span className="row-name">
                    {parcel.id} · {parcel.name}
                  </span>
                  <span className="row-note">{parcel.crop}</span>
                </span>
                <span className="row-value">{ha(parcel.ha)}</span>
              </label>
            </li>
          ))}
        </ul>
      </Group>

      <Group label="Ce am văzut pe hartă">
        <ul className="card facts">
          {location.layers.map((layer) => (
            <li key={layer.label}>
              <span className="fact-label">{layer.label}</span>
              <span className="fact-value">{layer.value}</span>
              <From source={layer.src} />
            </li>
          ))}
        </ul>
      </Group>
    </>
  );
}
