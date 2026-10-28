import { useContext, useEffect, useState } from "react";
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";

import { lei, num, pct } from "../lib/format.js";
import { useGrowStyle, useSpinStyle } from "../motion.js";
import { usePersonaApi } from "../persona.js";
import { caps, color, fontFamily, radius, space, text } from "../theme.js";
import { Card, CardTitle, Divided, Eyebrow, Link, OnYellow, Row, RowMain, RowName, RowNote, RowValue, Rows, Small, T, TextLink } from "./base.jsx";
import { Icon } from "./icons.jsx";

const SOURCE_LABELS = { obs: "observat", said: "spus", agreed: "stabilit", est: "estimat" };
const SOURCE_MARKS = { obs: "•", said: "„", agreed: "✓", est: "≈" };

// Where a line comes from: observed in transactions, said by the client, agreed together, or estimated.
// It is text, so it can follow a sentence on the same line.
export function Src({ kind, label }) {
  const onYellow = useContext(OnYellow);
  return (
    <T style={[s.src, onYellow && { color: color.ink2 }]}>
      <T style={[s.srcMark, onYellow && { color: color.ink }]}>{SOURCE_MARKS[kind]} </T>
      {label ?? SOURCE_LABELS[kind]}
    </T>
  );
}

// Section title outside the card, as in the app's "Produse favorite · Vezi toate".
export function Section({ title, aside, children }) {
  return (
    <View style={s.section}>
      <View style={s.sectionHead}>
        <T style={s.sectionTitle} accessibilityRole="header">
          {title}
        </T>
        {aside}
      </View>
      {children}
    </View>
  );
}

// A quiet note next to a section or group title.
export const Aside = ({ children }) => <Small muted>{children}</Small>;

const AMOUNT_SIZES = {
  xl: [{ fontSize: text["2xl"], lineHeight: 44 }, { fontSize: text.md }],
  lg: [{ fontSize: text.xl, lineHeight: 32 }, { fontSize: text.sm }],
  md: [{ fontSize: text.lg }, { fontSize: text.cap }],
  sm: [{ fontSize: text.md }, { fontSize: 11 }],
};

// Amount in the app's style: the integer large, ",00 lei" (or ",00 EUR") small.
// prefix: the sign of a payment; income: teal.
export function Amount({ value, size = "lg", currency = "lei", prefix = "", income = false }) {
  const [int, dec] = AMOUNT_SIZES[size];
  const tint = income ? { color: color.teal } : null;
  return (
    <T style={[s.amountInt, int, tint]} numberOfLines={1}>
      {prefix}
      {num(value)}
      <T style={[s.amountDec, dec, tint]}>,00 {currency}</T>
    </T>
  );
}

const TILE_ICON = { ink: color.yellow };

// round: the avatar of a demo account.
export function IconTile({ icon, tone, round, children }) {
  const onYellow = useContext(OnYellow);
  const box = [s.tile, tone && tiles[tone], onYellow && tone !== "ink" && tone !== "yellow" && s.tileOnYellow, round && { borderRadius: radius.pill }];
  return (
    <View style={box} aria-hidden>
      {children ?? <Icon name={icon} size={22} color={TILE_ICON[tone] ?? color.ink} />}
    </View>
  );
}

// Square shortcuts under a card's main figure; the first one is the main action.
// On a yellow card the main tile is ink instead of yellow.
export function QuickActions({ items, primaryTone = "yellow" }) {
  const onYellow = useContext(OnYellow);
  return (
    <View style={[s.quick, onYellow && { borderTopColor: color.yellowDeep }]}>
      {items.map((item, i) => (
        <Link key={item.label} href={item.href} style={s.quickItem}>
          <IconTile icon={item.icon} tone={i === 0 ? primaryTone : undefined} />
          <T style={s.quickLabel}>{item.label}</T>
        </Link>
      ))}
    </View>
  );
}

// The main card of a page: an eyebrow, a label, the big figure, a line under it.
export function HeroCard({ yellow, style, children }) {
  return (
    <Card yellow={yellow} style={[s.hero, style]}>
      {children}
    </Card>
  );
}

export function HeroLabel({ children }) {
  const onYellow = useContext(OnYellow);
  return (
    <T style={[s.heroLabel, onYellow && { color: color.ink2 }]} accessibilityRole="header">
      {children}
    </T>
  );
}

export function HeroSub({ children }) {
  const onYellow = useContext(OnYellow);
  return <T style={[s.heroSub, onYellow && { color: color.ink2 }]}>{children}</T>;
}

// A warning inside the yellow card (the student's pace, the green level).
export function HeroAlert({ icon, children }) {
  return (
    <View style={s.heroAlert}>
      <Icon name={icon} size={18} style={{ marginTop: 2 }} />
      <T style={s.heroAlertText}>{children}</T>
    </View>
  );
}

// A thin line and a block under the main figure (the share of spending, the salary split).
export function Split({ children }) {
  return <View style={s.split}>{children}</View>;
}

// The head of a goal or an offer: icon, title with a line under it, something on the right.
export function GoalHead({ icon, tone = "yellow", eyebrow, title, sub, aside, small = false, style }) {
  return (
    <View style={[s.goalHead, style]}>
      <IconTile icon={icon} tone={tone} />
      <View style={s.flex}>
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        {small ? <RowName>{title}</RowName> : <CardTitle>{title}</CardTitle>}
        {sub ? <Small muted>{sub}</Small> : null}
      </View>
      {aside}
    </View>
  );
}

// A message or a question from the coach: icon, bold title, text, optional extra content.
export function InfoCard({ icon, title, meta, text: body, children }) {
  return (
    <Card style={s.info} accessibilityLabel={title}>
      <View style={s.infoTop}>
        <IconTile icon={icon} tone="yellow" />
        <View style={s.infoBody}>
          {meta ? <T style={s.infoMeta}>{meta}</T> : null}
          <T style={s.infoTitle}>{title}</T>
          {body ? <T style={s.infoText}>{body}</T> : null}
        </View>
      </View>
      {children ? <View style={s.infoExtra}>{children}</View> : null}
    </Card>
  );
}

export function Meter({ value, max, tone, style, percent }) {
  const grow = useGrowStyle("right");
  return (
    <View style={[s.meter, style]} aria-hidden>
      <Animated.View style={[s.meterFill, { width: percent === undefined ? pct(value, max) : `${percent}%` }, tone === "warn" && s.meterWarn, grow]} />
    </View>
  );
}

export function Dots({ used, max }) {
  return (
    <View style={s.dots} accessibilityLabel={`${used} din ${max}`} accessibilityRole="image">
      {Array.from({ length: max }, (_, i) => (
        <View key={i} style={[s.dot, i >= used && s.dotEmpty]} />
      ))}
    </View>
  );
}

// kind: "count", "amount", "paid", "pause" or "protected" (see data/demo.js).
export function BudgetRow({ budget }) {
  const api = usePersonaApi();
  const { name, hint, icon, kind, note, warn } = budget;
  let value = null;
  if (kind === "count") value = <Dots used={budget.used} max={budget.max} />;
  if (kind === "amount") {
    value = (
      <RowValue>
        {num(budget.spent)}
        <T style={s.of}> / {lei(budget.limit)}</T>
      </RowValue>
    );
  }
  if (kind === "protected" || kind === "paid") value = <RowValue>{lei(budget.spent)}</RowValue>;
  if (kind === "pause") value = <RowValue>0 lei</RowValue>;
  return (
    <Row style={s.budgetRow}>
      <IconTile icon={icon} tone="sand" />
      <View style={s.budgetMain}>
        <View style={s.budgetTop}>
          <RowName style={s.flex}>{name}</RowName>
          {value}
        </View>
        <RowNote>
          {hint ? <T style={{ color: color.ink3 }}>{hint} · </T> : null}
          <T style={warn ? { color: color.warn } : null}>{note}</T>
        </RowNote>
        {kind === "amount" ? <Meter value={budget.spent} max={budget.limit} percent={api?.metrics?.budgets[budget.id]} tone={warn ? "warn" : undefined} style={{ marginTop: 6 }} /> : null}
      </View>
    </Row>
  );
}

// A list row with something under its text (a meter while a step runs); `indent` lines it up with the text.
export function RowWithBelow({ indent, below, children }) {
  return (
    <View style={s.rowBelow}>
      <View style={s.rowTop}>{children}</View>
      {below ? <View style={{ paddingLeft: indent + space.sm }}>{below}</View> : null}
    </View>
  );
}

// A simple list row: icon, name with an optional note, value on the right (text or an element).
export function ValueRow({ icon, name, note, value }) {
  return (
    <Row>
      {icon ? <IconTile icon={icon} tone="sand" /> : null}
      <RowMain>
        <RowName>{name}</RowName>
        {note ? <RowNote>{note}</RowNote> : null}
      </RowMain>
      {typeof value === "string" ? <RowValue>{value}</RowValue> : value}
    </Row>
  );
}

// Uppercase label above a card, like the app's form groups ("CONT SURSĂ").
export function Group({ label, action, children }) {
  return (
    <View style={s.group}>
      <View style={s.groupHead}>
        <T style={s.groupLabel} accessibilityRole="header">
          {label}
        </T>
        {action}
      </View>
      {children}
    </View>
  );
}

// A hint under a group's card.
export const GroupHint = ({ children }) => (
  <Small muted style={{ paddingHorizontal: space["2xs"] }}>
    {children}
  </Small>
);

// Label, value and where it comes from; `src` can be a kind ("obs") or a ready element.
export function Fact({ label, value, quote, src }) {
  return (
    <View style={s.fact}>
      <View style={s.flex}>
        {label ? <T style={s.factLabel}>{label}</T> : null}
        <T>
          {value}
          {quote ? <T style={s.quote}> „{quote}”</T> : null}
        </T>
      </View>
      {typeof src === "string" ? <Src kind={src} /> : src}
    </View>
  );
}

export function FactList({ children }) {
  return (
    <Card style={s.cardFlush}>
      <Divided>{children}</Divided>
    </Card>
  );
}

export function Facts({ items }) {
  return (
    <FactList>
      {items.map((item) => (
        <Fact key={item.label ?? item.text} label={item.label} value={item.value ?? item.text} quote={item.quote} src={item.src} />
      ))}
    </FactList>
  );
}

export function Agenda({ items }) {
  return (
    <View>
      {items.map((item, i) => (
        <View key={`${item.day}-${item.month}`} style={[s.agendaItem, i > 0 && s.agendaNext]}>
          <View style={s.date}>
            <T style={s.dateDay}>{item.day}</T>
            <T style={s.dateMonth}>{item.month}</T>
          </View>
          <View style={s.flex}>
            <T style={s.agendaTitle}>{item.title}</T>
            <Small muted>{item.note}</Small>
          </View>
        </View>
      ))}
    </View>
  );
}

// One answer chip. The web version only showed the choice; here a tap also changes it, nothing is stored.
export function Chip({ label, selected = false, onPress, toggle = true, disabled = false }) {
  const [on, setOn] = useState(selected);
  const pressed = onPress ? selected : on;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      accessibilityState={{ selected: pressed }}
      onPress={onPress ?? (toggle ? () => setOn(!on) : undefined)}
      style={({ pressed: down }) => [s.chip, pressed && s.chipOn, down && !pressed && { borderColor: color.ink3 }]}
    >
      <T style={s.chipText}>
        {pressed ? "✓  " : ""}
        {label}
      </T>
    </Pressable>
  );
}

// Answer chips; `selected` options start as chosen.
export function ChoiceChips({ label, options, scroll = false, onChange, disabled = false }) {
  const chips = options.map((option, index) => <Chip key={option.label} label={option.label} selected={Boolean(option.selected)} disabled={disabled} onPress={onChange ? () => onChange(option, index) : undefined} />);
  if (scroll) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.chips, s.chipsNoWrap]} accessibilityLabel={label}>
        {chips}
      </ScrollView>
    );
  }
  return (
    <View style={s.chips} accessibilityLabel={label}>
      {chips}
    </View>
  );
}

// Plain chips that do nothing yet (the web version's buttons without an action).
export function Chips({ items, onSelect }) {
  return (
    <View style={s.chips}>
      {items.map((item) => (
        <Chip key={item} label={item} toggle={false} onPress={onSelect ? () => onSelect(item) : undefined} />
      ))}
    </View>
  );
}

// An icon in a round badge: yellow for yes, sand for no.
export function RoundIcon({ name, tone = "yellow", size = 26 }) {
  const no = tone === "sand";
  return (
    <View style={[s.round, { width: size, height: size }, no && { backgroundColor: color.sand }]}>
      <Icon name={name} size={size - 8} color={no ? color.ink2 : color.ink} strokeWidth={no ? 1.6 : 2} />
    </View>
  );
}

// What a permission gives the coach (check) and what it never does (lock).
export function Ticks({ yes = [], no = [] }) {
  return (
    <Card style={s.ticks}>
      {yes.map((line) => (
        <View key={line} style={s.tick}>
          <RoundIcon name="check" />
          <T style={s.flex}>{line}</T>
        </View>
      ))}
      {no.map((line) => (
        <View key={line} style={s.tick}>
          <RoundIcon name="lock" tone="sand" />
          <T style={s.flex}>{line}</T>
        </View>
      ))}
    </Card>
  );
}

// The official notice on advice and data (see data/legal.js), as a full card.
export function Disclaimer({ legal, link = false, href = "#/informare" }) {
  return (
    <Card style={s.disclaimer}>
      <View style={s.disclaimerHead}>
        <IconTile icon="shield" tone="ink" />
        <View style={s.flex}>
          <T style={s.eyebrow}>{legal.eyebrow}</T>
          <T style={s.cardTitle} accessibilityRole="header">
            {legal.title}
          </T>
        </View>
      </View>
      <View style={{ gap: space.sm }}>
        {legal.items.map((item) => (
          <View key={item.text} style={s.tickTop}>
            <RoundIcon name={item.icon} />
            <T style={[s.flex, s.smallInk2]}>{item.text}</T>
          </View>
        ))}
      </View>
      {link ? <TextLink href={href}>Citește informarea completă</TextLink> : null}
    </Card>
  );
}

// The same notice in one line, kept in view on every coach page. card: rounded, without the top line.
export function DisclaimerStrip({ legal, card = false, href = "#/informare" }) {
  return (
    <View style={[s.strip, card && s.stripCard]}>
      <Icon name="lock" size={16} strokeWidth={2} />
      <T style={[s.stripText, s.flex]}>{legal.strip}</T>
      <TextLink href={href} style={{ fontSize: text.cap }}>
        Detalii
      </TextLink>
    </View>
  );
}

// The short privacy promise, shown where people share data; the full notice is one tap away.
export function PrivacyPromise({ legal, href = "#/informare" }) {
  return (
    <Card flat style={s.privacy}>
      <View style={s.privacyHead}>
        <IconTile icon="lock" tone="yellow" />
        <RowName style={s.flex}>{legal.promise.title}</RowName>
      </View>
      <View style={{ gap: space.xs }}>
        {legal.promise.items.map((line) => (
          <View key={line} style={s.privacyItem}>
            <Icon name="check" size={18} strokeWidth={2.2} style={{ marginTop: 1 }} />
            <T style={[s.flex, { fontSize: text.sm }]}>{line}</T>
          </View>
        ))}
      </View>
      <TextLink href={href}>{legal.promise.link}</TextLink>
    </Card>
  );
}

export function NoteCard({ icon, children }) {
  return (
    <Card flat style={s.note}>
      <Icon name={icon} size={22} />
      <T style={[s.flex, { fontSize: text.sm }]}>{children}</T>
    </Card>
  );
}

// A row that only shows a step's state: done (yellow check), running (spinning), waiting, or warn ("!").
export function StateDot({ state }) {
  const spin = useSpinStyle();
  if (state === "running") return <Animated.View style={[s.state, s.stateRunning, spin]} aria-hidden />;
  return (
    <View style={[s.state, stateTones[state]]} aria-hidden>
      {state === "done" ? <Icon name="check" size={18} strokeWidth={2.2} /> : null}
      {state === "warn" ? <T style={s.stateWarnText}>!</T> : null}
    </View>
  );
}

// Folded text, like the web version's <details>: "why" is a teal link, otherwise a card with + and −.
export function Disclosure({ summary, variant = "card", children }) {
  const [open, setOpen] = useState(false);
  const onYellow = useContext(OnYellow);
  const why = variant === "why";
  const toggle = (
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={why ? s.whySummary : s.disclosureSummary}>
      <T style={why ? [s.whyText, onYellow && { color: color.ink }] : s.rowName600}>
        {summary}
        {why ? (open ? " −" : " +") : null}
      </T>
      {why ? null : <T style={s.plus}>{open ? "−" : "+"}</T>}
    </Pressable>
  );
  const body = open ? <View style={{ marginTop: space.xs }}>{typeof children === "string" ? <T style={s.smallInk2}>{children}</T> : children}</View> : null;
  if (why) {
    return (
      <View>
        {toggle}
        {body}
      </View>
    );
  }
  return (
    <Card>
      {toggle}
      {body}
    </Card>
  );
}

// Yellow highlighter behind a key figure.
export function Marker({ children, style }) {
  const grow = useGrowStyle("right");
  return (
    <View style={s.marker}>
      <Animated.View style={[s.markerInk, grow]} />
      <T style={style}>{children}</T>
    </View>
  );
}

// type: "text" (default), "textarea", "select" or "time"; values are examples only.
export function Field({ field, style, onChange, disabled = false }) {
  const area = field.type === "textarea";
  return (
    <View style={[s.field, style]}>
      <T style={s.fieldLabel}>{field.label}</T>
      {field.type === "select" ? (
        <Select value={field.value} options={field.options} label={field.label} onChange={onChange} disabled={disabled} />
      ) : (
        <View style={[s.input, area && s.inputArea]}>
          <TextInput
            accessibilityLabel={field.label}
            editable={!disabled}
            {...(onChange ? { value: field.value ?? "", onChangeText: onChange } : { defaultValue: field.value })}
            placeholder={field.placeholder}
            placeholderTextColor={color.ink3}
            multiline={area}
            numberOfLines={area ? 3 : 1}
            keyboardType={field.numeric ? "numeric" : "default"}
            style={[s.inputText, area && s.inputTextArea]}
          />
          {field.suffix ? <T style={s.suffix}>{field.suffix}</T> : null}
        </View>
      )}
    </View>
  );
}

// A select without the system picker: the chosen value, and the list under it once tapped.
function Select({ value, options, label, onChange, disabled }) {
  const [local, setChosen] = useState(value ?? options[0]);
  const chosen = onChange ? value : local;
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${chosen}`} disabled={disabled} onPress={() => setOpen(!open)} style={[s.input, open && s.inputFocus]}>
        <T style={s.flex}>{chosen}</T>
        <Icon name="chevron" size={18} color={color.ink2} strokeWidth={2} style={{ transform: [{ rotate: open ? "-90deg" : "90deg" }] }} />
      </Pressable>
      {open ? (
        <Card style={s.options}>
          {options.map((option) => (
            <Pressable
              key={option}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ selected: option === chosen }}
              onPress={() => {
                setChosen(option);
                onChange?.(option);
                setOpen(false);
              }}
              style={({ pressed }) => [s.option, option === chosen && { backgroundColor: color.yellowSoft }, pressed && { backgroundColor: color.sand }]}
            >
              <T>{option}</T>
            </Pressable>
          ))}
        </Card>
      ) : null}
    </View>
  );
}

export function Switch({ label, hint, defaultChecked = false, checked, onChange, disabled = false }) {
  const [local, setOn] = useState(Boolean(defaultChecked));
  const on = checked === undefined ? local : checked;
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: on, disabled }} disabled={disabled} onPress={() => onChange ? onChange(!on) : setOn(!on)} style={s.switchRow}>
      <View style={s.switchText}>
        <T>{label}</T>
        {hint ? <Small muted>{hint}</Small> : null}
      </View>
      <Toggle on={on} />
    </Pressable>
  );
}

// The switch itself, drawn as in the web version on every platform: ink when on, the thumb slides.
function Toggle({ on }) {
  const [x] = useState(() => new Animated.Value(on ? 1 : 0));
  useEffect(() => {
    Animated.timing(x, { toValue: on ? 1 : 0, duration: 200, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: Platform.OS !== "web" }).start();
  }, [on, x]);
  return (
    <View style={[s.toggle, on && s.toggleOn]} aria-hidden>
      <Animated.View style={[s.thumb, { transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, 20] }) }] }]} />
    </View>
  );
}

// A card of switches (and other rows) with a line between them.
export function Switches({ children }) {
  return (
    <Card style={s.cardFlush}>
      <Divided>{children}</Divided>
    </Card>
  );
}

// A switch row's layout for a row that cannot be switched off (a public register).
export function FixedRow({ label, hint, aside }) {
  return (
    <View style={s.switchRow}>
      <View style={s.switchText}>
        <T>{label}</T>
        {hint ? <Small muted>{hint}</Small> : null}
      </View>
      {aside}
    </View>
  );
}

// A checkbox or a radio button with its row; the state lives here, nothing is stored.
export function Check({ checked, radio = false }) {
  return (
    <View style={[radio ? s.radio : s.check, checked && (radio ? s.radioOn : s.checkOn)]}>
      {checked ? radio ? <View style={s.radioDot} /> : <Icon name="check" size={16} strokeWidth={2.4} /> : null}
    </View>
  );
}

export function CheckRow({ defaultChecked, children }) {
  const [on, setOn] = useState(Boolean(defaultChecked));
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => setOn(!on)}>
      <Row>
        <Check checked={on} />
        {children}
      </Row>
    </Pressable>
  );
}

export { Rows };

const tiles = {
  yellow: { backgroundColor: color.yellow, borderWidth: 0 },
  sand: { width: 40, height: 40, backgroundColor: color.sand, borderWidth: 0 },
  ink: { backgroundColor: color.ink, borderWidth: 0 },
};

const stateTones = {
  done: { backgroundColor: color.yellow },
  waiting: { borderWidth: 1.5, borderColor: color.ink3 },
  warn: { borderWidth: 1.5, borderColor: color.warn },
};

const s = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  goalHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  hero: { gap: space["2xs"], paddingTop: space.lg },
  heroLabel: { fontSize: text.sm, fontWeight: 500, color: color.ink2 },
  heroSub: { fontSize: text.sm, color: color.ink3 },
  heroAlert: { flexDirection: "row", alignItems: "flex-start", gap: space.xs, marginTop: space.xs, paddingVertical: space.xs, paddingHorizontal: space.sm, borderRadius: radius.tile, backgroundColor: color.heroAlert },
  heroAlertText: { flex: 1, fontSize: text.sm, fontWeight: 600 },
  split: { gap: space.sm, marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: color.line },
  src: { fontSize: text.cap, fontFamily: fontFamily[500], color: color.ink3 },
  srcMark: { fontFamily: fontFamily[700], color: color.ink2 },
  section: { gap: space.sm },
  sectionHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: space.sm, paddingHorizontal: space["2xs"] },
  sectionTitle: { fontWeight: 600, flexShrink: 1 },
  amountInt: { fontWeight: 700, letterSpacing: -0.5, fontVariant: ["tabular-nums"] },
  amountDec: { fontWeight: 600, letterSpacing: 0 },
  tile: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.tile,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
  },
  tileOnYellow: { backgroundColor: color.surface, borderWidth: 0 },
  quick: { flexDirection: "row", gap: space.xs, marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: color.line },
  quickItem: { flex: 1, alignItems: "center", gap: space.xs, paddingVertical: space["2xs"], borderRadius: radius.tile },
  quickLabel: { fontSize: text.sm, fontWeight: 600 },
  info: { gap: space.sm },
  infoTop: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  infoBody: { flex: 1, gap: 2 },
  infoMeta: { fontSize: text.cap, color: color.ink3 },
  infoTitle: { fontWeight: 700 },
  infoText: { fontSize: text.sm, color: color.ink2 },
  infoExtra: { gap: space.sm },
  meter: { height: 6, overflow: "hidden", borderRadius: radius.pill, backgroundColor: color.sand2, alignSelf: "stretch" },
  meterFill: { height: "100%", borderRadius: radius.pill, backgroundColor: color.yellow, borderWidth: 1, borderColor: color.yellowDeep },
  meterWarn: { backgroundColor: color.warn, borderWidth: 0 },
  dots: { flexDirection: "row", gap: 4 },
  dot: { width: 14, height: 14, borderRadius: 4, backgroundColor: color.yellow, borderWidth: 1.5, borderColor: color.ink },
  dotEmpty: { backgroundColor: "transparent", borderColor: color.ink3 },
  of: { fontFamily: fontFamily[400], color: color.ink3 },
  budgetRow: { alignItems: "flex-start" },
  rowBelow: { gap: space.xs, paddingVertical: space.sm, paddingHorizontal: space.md },
  rowTop: { flexDirection: "row", alignItems: "center", gap: space.sm },
  budgetMain: { flex: 1, gap: 2, justifyContent: "center", minHeight: 40 },
  budgetTop: { flexDirection: "row", alignItems: "center", gap: space.sm },
  group: { gap: space.xs },
  groupHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm, paddingHorizontal: space["2xs"], minHeight: 20 },
  groupLabel: { fontSize: text.cap, fontWeight: 600, color: color.ink3, ...caps(), flexShrink: 1 },
  cardFlush: { padding: 0, overflow: "hidden" },
  fact: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.sm, paddingHorizontal: space.md },
  factLabel: { fontSize: text.cap, color: color.ink3 },
  quote: { color: color.ink2, fontStyle: "italic" },
  agendaItem: { flexDirection: "row", gap: space.md, paddingBottom: space.sm },
  agendaNext: { paddingTop: space.sm, borderTopWidth: 1, borderTopColor: color.line },
  date: { width: 44 },
  dateDay: { fontSize: text.lg, fontWeight: 700, lineHeight: 22 },
  dateMonth: { marginTop: 3, fontSize: text.cap, color: color.ink3, lineHeight: 14, ...caps() },
  agendaTitle: { fontWeight: 600 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  chipsNoWrap: { flexWrap: "nowrap" },
  chip: {
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: color.surface,
    borderWidth: 1.5,
    borderColor: color.line,
  },
  chipOn: { backgroundColor: color.yellow, borderColor: color.yellow },
  chipText: { fontSize: text.sm, fontWeight: 600 },
  round: { alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: color.yellow },
  ticks: { paddingVertical: space.xs, paddingHorizontal: space.md },
  tick: { flexDirection: "row", alignItems: "flex-start", gap: space.sm, paddingVertical: space.xs },
  tickTop: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  smallInk2: { fontSize: text.sm, color: color.ink2 },
  disclaimer: { gap: space.md, borderWidth: 1.5, borderColor: color.ink },
  disclaimerHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  eyebrow: { fontSize: text.cap, fontWeight: 600, color: color.ink3, ...caps() },
  cardTitle: { fontSize: text.lg, fontWeight: 700, lineHeight: 1.2 },
  strip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    backgroundColor: color.yellowSoft,
    borderTopWidth: 1,
    borderTopColor: color.yellowDeep,
  },
  stripCard: { borderTopWidth: 0, borderRadius: radius.tile },
  stripText: { fontSize: text.cap, fontWeight: 600, lineHeight: 1.4 },
  privacy: { gap: space.sm, backgroundColor: color.yellowSoft },
  privacyHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  privacyItem: { flexDirection: "row", alignItems: "flex-start", gap: space.xs },
  note: { flexDirection: "row", alignItems: "flex-start", gap: space.sm, backgroundColor: color.yellowSoft },
  state: { width: 28, height: 28, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  stateRunning: { borderWidth: 2.5, borderColor: color.line, borderTopColor: color.ink },
  stateWarnText: { fontSize: text.sm, fontWeight: 700, color: color.warn, lineHeight: 18 },
  whySummary: { alignSelf: "flex-start" },
  whyText: { color: color.teal, fontSize: text.sm, fontWeight: 600 },
  disclosureSummary: { flexDirection: "row", justifyContent: "space-between", gap: space.sm },
  rowName600: { fontWeight: 600, flex: 1 },
  plus: { color: color.teal, fontWeight: 700 },
  marker: { alignSelf: "flex-start", paddingHorizontal: 2 },
  markerInk: { position: "absolute", top: "32%", bottom: "2%", left: 0, right: 0, backgroundColor: color.yellow, borderTopLeftRadius: 3, borderTopRightRadius: 7, borderBottomRightRadius: 4, borderBottomLeftRadius: 6 },
  field: { gap: space["2xs"], minWidth: 0 },
  fieldLabel: { fontSize: text.sm, fontWeight: 600, color: color.ink2 },
  input: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    minHeight: 48,
    paddingHorizontal: space.md,
    borderRadius: 12,
    backgroundColor: color.surface,
    borderWidth: 1.5,
    borderColor: color.line,
  },
  inputFocus: { borderColor: color.ink },
  inputArea: { alignItems: "flex-start", paddingVertical: space.sm },
  inputText: { flex: 1, minWidth: 0, paddingVertical: 0, fontFamily: fontFamily[400], fontSize: text.md, color: color.ink, outlineStyle: "none" },
  inputTextArea: { minHeight: 66, textAlignVertical: "top", lineHeight: 23 },
  suffix: { color: color.ink3, fontWeight: 600 },
  options: { marginTop: space["2xs"], padding: 0, overflow: "hidden" },
  option: { paddingVertical: space.sm, paddingHorizontal: space.md },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md, paddingVertical: space.sm, paddingHorizontal: space.md },
  switchText: { flex: 1, gap: 2 },
  toggle: { width: 48, height: 28, padding: 3, borderRadius: radius.pill, backgroundColor: color.line },
  toggleOn: { backgroundColor: color.ink },
  thumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: color.surface, boxShadow: "0 1px 2px rgba(43, 45, 51, 0.25)" },
  check: { width: 22, height: 22, alignItems: "center", justifyContent: "center", borderRadius: 6, backgroundColor: color.surface, borderWidth: 1.5, borderColor: color.ink3 },
  checkOn: { backgroundColor: color.yellow, borderColor: color.ink },
  radio: { width: 22, height: 22, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: color.surface, borderWidth: 1.5, borderColor: color.ink3 },
  radioOn: { borderColor: color.ink },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: color.ink },
});
