// The agricultural variant of the "where" step: the APIA parcels drawn as SVG, so the demo works offline.

import { StyleSheet, View } from "react-native";
import Svg, { G, Path, Polygon, Text as SvgText } from "react-native-svg";

import { ha } from "../lib/format.js";
import { color, fontFamily, space } from "../theme.js";
import { Card, Small } from "./base.jsx";

export function ParcelMap({ location }) {
  const total = location.parcels.reduce((sum, parcel) => sum + parcel.ha, 0);
  const chosen = location.parcels.filter((parcel) => parcel.selected);
  const chosenHa = chosen.reduce((sum, parcel) => sum + parcel.ha, 0);
  const label = location.parcels.map((parcel) => `${parcel.id} ${parcel.name}, ${ha(parcel.ha)}${parcel.selected ? ", aleasă" : ""}`).join("; ");
  return (
    <Card style={s.map}>
      <View accessibilityRole="image" accessibilityLabel={`Harta parcelelor: ${label}.`} style={s.svg}>
        <Svg width="100%" height="100%" viewBox="0 0 320 170">
          <Path d={location.canal} fill="none" stroke={color.teal} strokeWidth={4} strokeLinecap="round" opacity={0.5} />
          {location.parcels.map((parcel) => (
            <G key={parcel.id}>
              <Polygon
                points={parcel.points}
                fill={parcel.selected ? color.yellow : color.sand}
                stroke={parcel.selected ? color.ink : color.ink3}
                strokeWidth={parcel.selected ? 1.5 : 1}
              />
              <SvgText x={parcel.label[0]} y={parcel.label[1]} textAnchor="middle" fill={color.ink} fontSize={10} fontFamily={fontFamily[700]}>
                {parcel.id}
              </SvgText>
              <SvgText x={parcel.label[0]} y={parcel.label[1] + 12} textAnchor="middle" fill={color.ink2} fontSize={10} fontFamily={fontFamily[500]}>
                {ha(parcel.ha)}
              </SvgText>
            </G>
          ))}
        </Svg>
      </View>
      <Small muted>
        {ha(chosenHa)} alese din {ha(total)} · sus, canalul de irigații
      </Small>
    </Card>
  );
}

const s = StyleSheet.create({
  map: { gap: space.xs },
  svg: { width: "100%", aspectRatio: 320 / 170 },
});
