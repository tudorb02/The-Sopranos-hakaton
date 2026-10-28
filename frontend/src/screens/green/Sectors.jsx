// The area picker of the green credit: agriculture opens its flow, the other areas are coming soon
// (design/pj-greenstruct.md §4).

import { View } from "react-native";

import { Intro, Small } from "../../components/base.jsx";
import { SectorCard } from "../../components/green.jsx";
import { sectors, sectorsIntro } from "../../data/green/sectors.js";
import { space } from "../../theme.js";

export function Sectors() {
  return (
    <>
      <Intro title={sectorsIntro.title}>
        <Small muted>{sectorsIntro.lead}</Small>
      </Intro>

      <View style={{ gap: space.sm }}>
        {sectors.map((sector) => (
          <SectorCard key={sector.id} sector={sector} />
        ))}
      </View>

      <Small muted>{sectorsIntro.more}</Small>
    </>
  );
}
