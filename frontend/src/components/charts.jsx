import { Animated, StyleSheet, View } from "react-native";
import Svg, { Line } from "react-native-svg";

import { lei, num, pct } from "../lib/format.js";
import { useGrowStyle } from "../motion.js";
import { allocationTones, caps, color, radius, space, text } from "../theme.js";
import { Small, T } from "./base.jsx";

// A dashed horizontal line at `p` (a percentage) of the plot's height.
export function GuideLine({ p }) {
  return (
    <View style={[s.guide, { bottom: p }]} pointerEvents="none">
      <Svg width="100%" height={2}>
        <Line x1="0" y1="1" x2="100%" y2="1" stroke={color.ink3} strokeWidth={1.5} strokeDasharray="4 4" />
      </Svg>
    </View>
  );
}

// A bar that grows up from the bottom of its track.
export function Bar({ p, style }) {
  const grow = useGrowStyle("up");
  return <Animated.View style={[{ width: "100%", height: p }, style, grow]} />;
}

// Spending per day this week, against the daily target (dashed line).
export function WeekStrip({ week }) {
  const spentDays = week.days.filter((day) => day.lei !== undefined);
  const summary = spentDays.map((day) => `${day.name} ${lei(day.lei)}`).join(", ");
  return (
    <View style={s.week}>
      <View style={s.weekPlot} accessibilityRole="image" accessibilityLabel={`${summary}. Limita recomandată: ${lei(week.guidePerDay)} pe zi.`}>
        {week.days.map((day) => (
          <View key={day.d} style={[s.day, day.lei === undefined && s.dayFuture]}>
            {day.lei !== undefined ? <Bar p={pct(day.lei, week.scaleMax)} style={day.today ? s.dayToday : s.dayFill} /> : null}
          </View>
        ))}
        <GuideLine p={pct(week.guidePerDay, week.scaleMax)} />
      </View>
      <View style={s.weekLabels} aria-hidden>
        {week.days.map((day) => (
          <View key={day.d} style={s.weekLabel}>
            <T style={[s.weekDay, day.today && s.weekToday]}>{day.d}</T>
            <T style={s.weekLei}>{day.lei ?? "·"}</T>
          </View>
        ))}
      </View>
      <Small muted>Linia punctată: limita recomandată de {lei(week.guidePerDay)} pe zi</Small>
    </View>
  );
}

// How the salary is split: fixed costs, money set aside, money to spend.
export function Allocation({ parts, total }) {
  const label = parts.map((part) => `${part.label} ${lei(part.lei)}`).join(", ");
  return (
    <View style={s.alloc} accessibilityRole="image" accessibilityLabel={`Din ${lei(total)}: ${label}.`}>
      {parts.map((part, i) => (
        <View
          key={part.id}
          style={[s.allocPart, { flexGrow: part.lei, backgroundColor: allocationTones[part.tone] }, i === 0 && s.first, i === parts.length - 1 && s.last]}
        />
      ))}
    </View>
  );
}

export function Legend({ parts }) {
  return (
    <View style={s.legend}>
      {parts.map((part) => (
        <View key={part.id} style={s.legendItem}>
          <View style={s.legendName}>
            <View style={[s.swatch, { backgroundColor: allocationTones[part.tone] }]} />
            <T style={s.legendText}>{part.label}</T>
          </View>
          <T style={[s.legendText, s.num]}>{lei(part.lei)}</T>
        </View>
      ))}
    </View>
  );
}

// Savings plan per month; each bar shows the running total towards the goal.
export function PlanChart({ plan, total }) {
  const label = plan.map((month) => `${month.month} ${month.add ? `+${lei(month.add)}` : "0 lei"}`).join(", ");
  return (
    <View style={s.plan} accessibilityRole="image" accessibilityLabel={`Plan pe luni: ${label}. Total ${lei(total)}.`}>
      {plan.map((month) => (
        <View key={month.month} style={s.planCol} aria-hidden>
          <View style={s.planBar}>
            <Bar p={pct(month.total, total)} style={s.planFill} />
          </View>
          <T style={s.planAmount}>{month.add ? `+${num(month.add)}` : "0"}</T>
          <T style={s.planMonth}>{month.month}</T>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  num: { fontVariant: ["tabular-nums"] },
  guide: { position: "absolute", left: 0, right: 0, height: 2, marginBottom: -1 },
  week: { gap: space.xs },
  weekPlot: { height: 96, flexDirection: "row", gap: space.xs },
  day: { flex: 1, justifyContent: "flex-end", overflow: "hidden", borderRadius: 6, backgroundColor: color.sand },
  dayFuture: { backgroundColor: "transparent", borderWidth: 1, borderColor: color.line },
  dayFill: { backgroundColor: color.ink },
  dayToday: { backgroundColor: color.yellow, borderWidth: 1.5, borderColor: color.ink, borderBottomWidth: 0, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  weekLabels: { flexDirection: "row", gap: space.xs },
  weekLabel: { flex: 1, alignItems: "center" },
  weekDay: { fontSize: text.cap, fontWeight: 600, color: color.ink2, lineHeight: 16 },
  weekToday: { color: color.ink, textDecorationLine: "underline" },
  weekLei: { fontSize: text.cap, color: color.ink3, lineHeight: 16, fontVariant: ["tabular-nums"] },
  alloc: { flexDirection: "row", gap: 3, height: 12 },
  allocPart: { flexBasis: 0, borderRadius: 3 },
  first: { borderTopLeftRadius: radius.pill, borderBottomLeftRadius: radius.pill },
  last: { borderTopRightRadius: radius.pill, borderBottomRightRadius: radius.pill },
  legend: { gap: space["2xs"] },
  legendItem: { flexDirection: "row", justifyContent: "space-between", gap: space.sm },
  legendName: { flexDirection: "row", alignItems: "center", flexShrink: 1 },
  legendText: { fontSize: text.sm },
  swatch: { width: 10, height: 10, marginRight: space.xs, borderRadius: 2 },
  plan: { flexDirection: "row", gap: space.xs },
  planCol: { flex: 1, alignItems: "center", gap: space["2xs"] },
  planBar: { width: "100%", height: 112, justifyContent: "flex-end", overflow: "hidden", borderRadius: 6, backgroundColor: color.sand },
  planFill: { backgroundColor: color.yellow, borderWidth: 1, borderColor: color.yellowDeep, borderBottomWidth: 0 },
  planAmount: { fontSize: text.sm, fontWeight: 600, fontVariant: ["tabular-nums"] },
  planMonth: { fontSize: text.cap, color: color.ink3, ...caps() },
});
