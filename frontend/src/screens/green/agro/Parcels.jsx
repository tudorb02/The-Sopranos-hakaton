// The "where" step of agriculture: the APIA parcels on a map and in a list (design/pj-greenstruct.md §4).

import { Intro, RowMain, RowName, RowNote, RowValue, Rows, Small } from "../../../components/base.jsx";
import { From } from "../../../components/green.jsx";
import { ParcelMap } from "../../../components/parcels.jsx";
import { CheckRow, Fact, FactList, Group } from "../../../components/ui.jsx";
import { ha } from "../../../lib/format.js";

export function Parcels({ location }) {
  return (
    <>
      <Intro title={location.title}>
        <Small muted>{location.lead}</Small>
      </Intro>

      <ParcelMap location={location} />

      <Group label="Parcelele tale">
        <Rows>
          {location.parcels.map((parcel) => (
            <CheckRow key={parcel.id} defaultChecked={parcel.selected}>
              <RowMain>
                <RowName>
                  {parcel.id} · {parcel.name}
                </RowName>
                <RowNote>{parcel.crop}</RowNote>
              </RowMain>
              <RowValue>{ha(parcel.ha)}</RowValue>
            </CheckRow>
          ))}
        </Rows>
      </Group>

      <Group label="Ce am văzut pe hartă">
        <FactList>
          {location.layers.map((layer) => (
            <Fact key={layer.label} label={layer.label} value={layer.value} src={<From source={layer.src} />} />
          ))}
        </FactList>
      </Group>
    </>
  );
}
