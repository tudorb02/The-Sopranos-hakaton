// The building blocks every screen uses, in place of the web version's HTML elements and CSS classes:
// text in the app's font, links, cards, list rows, buttons, statuses.

import { Children, createContext, useContext } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useRouter } from "../router.jsx";
import { caps, color, fontFamily, radius, shadowCard, space, text } from "../theme.js";
import { Icon } from "./icons.jsx";

const InText = createContext(false);

// True inside a yellow card: quiet text turns ink-2 instead of grey, white tiles lose their outline.
export const OnYellow = createContext(false);

// Text in Hanken Grotesk. fontWeight picks the font file; a lineHeight under 4 is a ratio of the font size,
// as in CSS. Nested text inherits from the text around it, so it only sets what it is given.
export function T({ style, children, ...props }) {
  const nested = useContext(InText);
  const flat = StyleSheet.flatten(style) ?? {};
  const { fontWeight, ...rest } = flat;
  const own = {};
  if (!nested) {
    own.color = color.ink;
    own.fontSize = text.md;
    own.fontFamily = fontFamily[400];
  }
  if (fontWeight) own.fontFamily = fontFamily[fontWeight] ?? fontFamily[400];
  const fontSize = rest.fontSize ?? (nested ? undefined : text.md);
  if (rest.lineHeight && rest.lineHeight < 4 && fontSize) rest.lineHeight = Math.round(rest.lineHeight * fontSize);
  else if (!nested && !rest.lineHeight) rest.lineHeight = Math.round(fontSize * 1.5);
  return (
    <InText.Provider value>
      <Text style={[own, rest]} {...props}>
        {children}
      </Text>
    </InText.Provider>
  );
}

export const B = ({ children }) => <T style={{ fontWeight: 600 }}>{children}</T>;

// Something that opens a route ("#/bugete") or a page outside the app (https://…).
export function Link({ href, onPress, style, pressedStyle, children, ...props }) {
  const { navigate } = useRouter();
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress ?? (href ? () => navigate(href) : undefined)}
      style={({ pressed }) => [style, pressed && (pressedStyle ?? styles.pressed)]}
      {...props}
    >
      {children}
    </Pressable>
  );
}

// A teal text link; it can also sit inside a paragraph.
export function TextLink({ href, style, children }) {
  const { navigate } = useRouter();
  return (
    <T accessibilityRole="link" onPress={() => navigate(href)} style={[styles.link, style]}>
      {children}
    </T>
  );
}

// yellow: the main card of a page, in brand yellow; flat: without the shadow (tinted or outlined cards).
export function Card({ yellow, flat, style, children, ...props }) {
  const card = (
    <View style={[styles.card, !(yellow || flat) && shadowCard, yellow && styles.cardYellow, style]} {...props}>
      {children}
    </View>
  );
  return yellow ? <OnYellow.Provider value>{card}</OnYellow.Provider> : card;
}

// A card of rows with a line between them, like the web version's <ul class="card rows">.
export function Rows({ style, children }) {
  const items = Children.toArray(children).filter(Boolean);
  return (
    <Card style={[styles.rows, style]}>
      {items.map((child, i) => (
        <View key={child.key ?? i} style={i > 0 ? styles.divider : null}>
          {child}
        </View>
      ))}
    </Card>
  );
}

// Lines between the children, without a card around them (switch lists, facts).
export function Divided({ children }) {
  const items = Children.toArray(children).filter(Boolean);
  return items.map((child, i) => (
    <View key={child.key ?? i} style={i > 0 ? styles.divider : null}>
      {child}
    </View>
  ));
}

// A list row: icon or state on the left, the main text, a value on the right.
export function Row({ style, children }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function RowMain({ children, style }) {
  return <View style={[styles.rowMain, style]}>{children}</View>;
}

export const RowName = ({ style, ...props }) => <T style={[styles.rowName, style]} {...props} />;
export const RowNote = ({ style, ...props }) => <T style={[styles.rowNote, style]} {...props} />;
export const RowValue = ({ style, ...props }) => <T style={[styles.rowValue, style]} {...props} />;
export function Small({ children, muted, style }) {
  const onYellow = useContext(OnYellow);
  return <T style={[styles.small, onYellow ? styles.quietOnYellow : muted && styles.muted, style]}>{children}</T>;
}

export function Eyebrow({ children, style }) {
  const onYellow = useContext(OnYellow);
  return <T style={[styles.eyebrow, onYellow && styles.quietOnYellow, style]}>{children}</T>;
}
export const CardTitle = ({ style, ...props }) => <T style={[styles.cardTitle, style]} accessibilityRole="header" {...props} />;
export const PageTitle = ({ style, ...props }) => <T style={[styles.pageTitle, style]} accessibilityRole="header" {...props} />;

// The title and lead at the top of a page.
export function Intro({ eyebrow, title, children }) {
  return (
    <View style={styles.intro}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <PageTitle>{title}</PageTitle>
      {children}
    </View>
  );
}

// tone: "on" (yellow), "ink", "outline", "warn"; without a tone, sand.
export function Status({ tone, children, style }) {
  return (
    <View style={[styles.status, tone && statusTones[tone].box, style]}>
      <T style={[styles.statusText, tone && statusTones[tone].text]}>{children}</T>
    </View>
  );
}

const BTN_TEXT = { ink: color.yellow, text: color.teal, danger: color.danger };

// A pill button. variant: "yellow" (default), "ink", "outline", "text", "danger"; small and block change the size.
// onYellow keeps a text button in ink on a yellow card.
export function Btn({ href, onPress, variant = "yellow", small, block, onYellow, icon, style, children }) {
  const { navigate } = useRouter();
  const textColor = onYellow ? color.ink : (BTN_TEXT[variant] ?? color.ink);
  return (
    <Pressable
      accessibilityRole={href ? "link" : "button"}
      onPress={onPress ?? (href ? () => navigate(href) : undefined)}
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        block && styles.btnBlock,
        btnVariants[variant],
        pressed && (btnPressed[onYellow ? "onYellow" : variant] ?? styles.pressed),
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={18} color={textColor} /> : null}
      <T style={[styles.btnText, small && styles.btnTextSmall, { color: textColor }]}>{children}</T>
    </Pressable>
  );
}

export function BtnRow({ children, style }) {
  return <View style={[styles.btnRow, style]}>{children}</View>;
}

// Spacing between the blocks of a card or a page.
export function Stack({ gap = space.md, style, children }) {
  return <View style={[{ gap }, style]}>{children}</View>;
}

export const styles = StyleSheet.create({
  pressed: { opacity: 0.75 },
  link: { color: color.teal, fontSize: text.sm, fontWeight: 600 },
  card: {
    padding: space.md,
    backgroundColor: color.surface,
    borderRadius: radius.card,
  },
  cardYellow: { backgroundColor: color.yellow },
  quietOnYellow: { color: color.ink2 },
  rows: { padding: 0, overflow: "hidden" },
  divider: { borderTopWidth: 1, borderTopColor: color.line },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  rowMain: { flex: 1, minWidth: 0, gap: 2, alignItems: "flex-start" },
  rowName: { fontWeight: 600 },
  rowNote: { fontSize: text.sm, color: color.ink3 },
  rowValue: { fontWeight: 600, textAlign: "right", fontVariant: ["tabular-nums"] },
  small: { fontSize: text.sm },
  muted: { color: color.ink3 },
  eyebrow: { fontSize: text.cap, fontWeight: 600, color: color.ink3, ...caps() },
  cardTitle: { fontSize: text.lg, fontWeight: 700, lineHeight: 1.2 },
  pageTitle: { fontSize: text.xl, fontWeight: 700, lineHeight: 1.15, letterSpacing: -0.56 },
  intro: { gap: space.xs, paddingHorizontal: space["2xs"] },
  status: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: color.sand,
  },
  statusText: { fontSize: text.cap, fontWeight: 600, color: color.ink2, lineHeight: 1.4 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    gap: space.xs,
    minHeight: 48,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: color.yellow,
  },
  btnSmall: { minHeight: 38, paddingHorizontal: space.md },
  btnBlock: { alignSelf: "stretch" },
  btnText: { fontWeight: 600, textAlign: "center" },
  btnTextSmall: { fontSize: text.sm },
  btnRow: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
});

const statusTones = {
  on: { box: { backgroundColor: color.yellowSoft }, text: { color: color.ink } },
  ink: { box: { backgroundColor: color.ink }, text: { color: color.yellow } },
  outline: { box: { backgroundColor: "transparent", borderWidth: 1, borderColor: color.ink3, paddingVertical: 2, paddingHorizontal: 9 }, text: { color: color.ink } },
  warn: { box: { backgroundColor: color.warnWash }, text: { color: color.warn } },
  soon: { box: { backgroundColor: "transparent", borderWidth: 1, borderColor: color.line, paddingVertical: 2, paddingHorizontal: 9 }, text: {} },
};

const btnVariants = {
  yellow: {},
  ink: { backgroundColor: color.ink },
  outline: { backgroundColor: color.surface, borderWidth: 1.5, borderColor: color.line },
  text: { backgroundColor: "transparent" },
  danger: { backgroundColor: "transparent", alignSelf: "center" },
};

const btnPressed = {
  yellow: { backgroundColor: color.yellowHover },
  ink: { backgroundColor: color.ink2 },
  outline: { borderColor: color.ink3 },
  text: { backgroundColor: color.tealWash },
  danger: { backgroundColor: color.dangerWash },
  onYellow: { backgroundColor: color.yellowHover },
};
