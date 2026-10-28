import { Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { usePersona } from "../persona.js";
import { useRiseStyle } from "../motion.js";
import { useRouter } from "../router.jsx";
import { caps, color, radius, space, text } from "../theme.js";
import { Btn, Link, Small, T } from "./base.jsx";
import { Icon } from "./icons.jsx";
import { DisclaimerStrip } from "./ui.jsx";

const COACH_PAGES = [
  { id: "rezumat", label: "Rezumat" },
  { id: "cheltuieli", label: "Cheltuieli" },
  { id: "bugete", label: "Bugete" },
  { id: "obiective", label: "Obiective" },
  { id: "idei", label: "Idei" },
  { id: "profil", label: "Profil" },
];

// Tabs of the existing app. The Coach is an optional feature inside Produse; the other tabs are placeholders.
const APP_TABS = [
  { id: "acasa", label: "Acasă", icon: "home" },
  { id: "plati", label: "Plăți", icon: "transfer" },
  { id: "carduri", label: "Carduri", icon: "card" },
  { id: "produse", label: "Produse", icon: "grid" },
];

// The phone screen. In a wide browser window it sits in a phone-sized frame.
function Stage({ children }) {
  const { width, height } = useWindowDimensions();
  const framed = Platform.OS === "web" && width >= 640;
  return (
    <View style={[s.stage, framed && s.stageFramed]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[s.app, framed && [s.appFramed, { height: Math.min(880, height - 48) }]]}
      >
        {children}
      </KeyboardAvoidingView>
    </View>
  );
}

// The scrolling middle of a screen; it starts at the top for every route and rises into place.
// gap: the space between the page's blocks (tighter in a flow).
function Main({ style, gap = space.lg, children }) {
  const { route } = useRouter();
  return (
    <ScrollView key={route} style={s.scroll} contentContainerStyle={[s.main, style]} keyboardShouldPersistTaps="handled">
      <Rise gap={gap}>{children}</Rise>
    </ScrollView>
  );
}

function Rise({ gap, children }) {
  const rise = useRiseStyle();
  return <Animated.View style={[{ gap }, rise]}>{children}</Animated.View>;
}

// The top bar, under the phone's status bar.
function Header({ style, children }) {
  const insets = useSafeAreaInsets();
  return <View style={[s.header, { paddingTop: space.md + insets.top }, style]}>{children}</View>;
}

// The bottom bar, above the phone's home indicator.
function Bottom({ style, children }) {
  const insets = useSafeAreaInsets();
  return <View style={[style, { paddingBottom: (StyleSheet.flatten(style)?.paddingBottom ?? 0) + insets.bottom }]}>{children}</View>;
}

function TabBar({ productsHref }) {
  return (
    <View style={s.tabbar} accessibilityRole="tablist" accessibilityLabel="Aplicație">
      {APP_TABS.map((tab) => {
        const current = tab.id === "produse";
        const content = (
          <>
            <View style={[s.tabIcon, current && s.tabIconOn]}>
              <Icon name={tab.icon} color={current ? color.ink : color.ink3} strokeWidth={current ? 2 : 1.6} />
            </View>
            <T style={[s.tabLabel, current && s.tabLabelOn]}>{tab.label}</T>
          </>
        );
        return current ? (
          <Link key={tab.id} href={productsHref} style={s.tab} accessibilityRole="tab" accessibilityState={{ selected: true }}>
            {content}
          </Link>
        ) : (
          <View key={tab.id} style={s.tab} accessibilityLabel={`${tab.label}: secțiune existentă în aplicație`}>
            {content}
          </View>
        );
      })}
    </View>
  );
}

// The simulated sign-in: no header or tab bar.
export function BareFrame({ children }) {
  const insets = useSafeAreaInsets();
  return (
    <Stage>
      <Main style={{ paddingTop: space.lg + space.md + insets.top, paddingBottom: space.xl + insets.bottom }}>{children}</Main>
    </Stage>
  );
}

// The Produse tab of the app: the personal one offers the Coach, the business one shows what is coming.
export function ProductsFrame({ title = "Produse", subtitle, productsHref = "#/produse", children }) {
  return (
    <Stage>
      <Header style={s.appHeader}>
        <View style={s.flex}>
          <T style={s.appTitle} accessibilityRole="header">
            {title}
          </T>
          {subtitle ? <Small muted>{subtitle}</Small> : null}
        </View>
        <View style={s.headerActions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Mesaje, 1 necitit" style={s.iconBtn}>
            <Icon name="mail" color={color.teal} />
            <View style={s.badge} aria-hidden>
              <T style={s.badgeText}>1</T>
            </View>
          </Pressable>
          <Link href="#/login" accessibilityLabel="Ieși din cont" style={s.iconBtn} pressedStyle={{ backgroundColor: color.tealWash }}>
            <Icon name="logout" color={color.teal} />
          </Link>
        </View>
      </Header>
      <Main>{children}</Main>
      <Bottom style={s.bottom}>
        <TabBar productsHref={productsHref} />
      </Bottom>
    </Stage>
  );
}

// A page of the Coach, opened from Produse: back link, the coach's own pages, the notice, the app's tab bar.
// `pages` lists the ids this client sees (Idei only for a client without a stable income).
export function SectionFrame({ current, client, pages, children }) {
  const { legal } = usePersona();
  return (
    <Stage>
      <Header style={s.coachHeader}>
        <Link href="#/produse" accessibilityLabel="Înapoi la Produse" style={s.round40} pressedStyle={{ backgroundColor: color.sand }}>
          <Icon name="back" />
        </Link>
        <View style={s.coachTitle}>
          <View style={s.coachIcon}>
            <Icon name="compass" size={20} />
          </View>
          <T style={s.coachTitleText}>Coach financiar</T>
        </View>
        <Link href="#/profil" accessibilityLabel="Profilul tău" style={[s.round40, s.avatar]}>
          <T style={s.avatarText}>{client.initial}</T>
        </Link>
      </Header>

      <View style={s.subnav}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.subnavList} accessibilityLabel="Coach">
          {COACH_PAGES.filter((page) => pages.includes(page.id)).map((page) => {
            const on = page.id === current;
            return (
              <Link key={page.id} href={`#/${page.id}`} accessibilityState={{ selected: on }} style={[s.pill, on && s.pillOn]} pressedStyle={on ? null : { backgroundColor: color.sand2 }}>
                <T style={[s.pillText, on && { color: color.ink }]}>{page.label}</T>
              </Link>
            );
          })}
        </ScrollView>
      </View>

      <Main>{children}</Main>
      <Bottom style={s.bottom}>
        <DisclaimerStrip legal={legal} />
        <TabBar productsHref="#/produse" />
      </Bottom>
    </Stage>
  );
}

// Segmented progress under the flow header, like the steps of a payment in the app.
function Progress({ steps, current, note }) {
  const done = current > steps.length;
  const label = done ? "Gata" : `Pasul ${current} din ${steps.length} · ${steps[current - 1]}`;
  return (
    <View style={s.progress}>
      <View style={s.progressBar} aria-hidden>
        {steps.map((step, i) => (
          <View key={step} style={[s.progressStep, i + 1 <= current && s.progressStepOn]} />
        ))}
      </View>
      <T style={s.progressLabel}>
        {label}
        {note ? ` · ${note}` : null}
      </T>
    </View>
  );
}

// Primary and secondary actions pinned to the bottom of a flow.
export function FlowActions({ next, nextLabel, skip, skipLabel, onNext, disabled = false }) {
  return (
    <>
      {next ? (
        <Btn href={next} onPress={onNext} disabled={disabled} block>
          {nextLabel}
        </Btn>
      ) : null}
      {skip ? (
        <Btn href={skip} variant="text" block disabled={disabled}>
          {skipLabel}
        </Btn>
      ) : null}
    </>
  );
}

// A full-screen flow (activation, chat, statements, notice): centred title, "Înapoi" and "Închide",
// like the app's payment flow. bare: the footer has its own layout (the chat's message box).
export function FlowFrame({ title, closeHref, backHref, progress, footer, bare = false, children }) {
  const { navigate } = useRouter();
  return (
    <Stage>
      <Header style={s.flowHeader}>
        <View style={s.flowSide}>
          {backHref ? (
            <T accessibilityRole="link" onPress={() => navigate(backHref)} style={s.headerLink}>
              Înapoi
            </T>
          ) : null}
        </View>
        <T style={s.flowTitle} accessibilityRole="header" numberOfLines={1}>
          {title}
        </T>
        <View style={[s.flowSide, { alignItems: "flex-end" }]}>
          <T accessibilityRole="link" onPress={() => navigate(closeHref)} style={s.headerLink}>
            Închide
          </T>
        </View>
      </Header>
      {progress ? <Progress {...progress} /> : null}
      <Main gap={space.md}>{children}</Main>
      {footer ? <Bottom style={bare ? s.composerBar : s.flowFooter}>{footer}</Bottom> : null}
    </Stage>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  stage: { flex: 1, backgroundColor: color.sand, alignItems: "center" },
  stageFramed: { backgroundColor: color.backdrop, justifyContent: "center", paddingVertical: space.lg, paddingHorizontal: space.md },
  app: { flex: 1, width: "100%", maxWidth: 430, backgroundColor: color.sand },
  appFramed: {
    flex: 0,
    overflow: "hidden",
    borderRadius: radius.frame,
    boxShadow: `0 0 0 1px ${color.line}, 0 24px 60px rgba(43, 45, 51, 0.12)`,
  },
  scroll: { flex: 1 },
  main: { padding: space.md, paddingBottom: space.xl },
  header: { backgroundColor: color.surface, paddingHorizontal: space.md, paddingBottom: space.sm },
  appHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  appTitle: { fontSize: text.xl, fontWeight: 700, lineHeight: 1.15, letterSpacing: -0.56 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 2 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20 },
  badge: {
    position: "absolute",
    top: 4,
    right: 3,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    backgroundColor: color.badge,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: color.surface, fontSize: 10, fontWeight: 700, lineHeight: 16 },
  coachHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  round40: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20 },
  avatar: { backgroundColor: color.yellow },
  avatarText: { fontWeight: 700 },
  coachTitle: { flexDirection: "row", alignItems: "center", gap: space.xs },
  coachIcon: { width: 26, height: 26, borderRadius: 13, backgroundColor: color.yellow, alignItems: "center", justifyContent: "center" },
  coachTitleText: { fontWeight: 700 },
  subnav: { backgroundColor: color.surface, paddingBottom: space.sm, borderBottomWidth: 1, borderBottomColor: color.line },
  subnavList: { gap: space.xs, paddingHorizontal: space.md },
  pill: { minHeight: 36, justifyContent: "center", paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: color.sand },
  pillOn: { backgroundColor: color.yellow },
  pillText: { fontSize: text.sm, fontWeight: 600, color: color.ink2 },
  bottom: { backgroundColor: color.surface },
  tabbar: { flexDirection: "row", backgroundColor: color.surface, borderTopWidth: 1, borderTopColor: color.line },
  tab: { flex: 1, minHeight: 60, alignItems: "center", justifyContent: "center", gap: 2 },
  tabIcon: { width: 56, height: 30, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  tabIconOn: { backgroundColor: color.yellow },
  tabLabel: { fontSize: text.tab, fontWeight: 500, color: color.ink3, lineHeight: 14 },
  tabLabelOn: { color: color.ink, fontWeight: 700 },
  flowHeader: { flexDirection: "row", alignItems: "center", paddingBottom: space.md, borderBottomWidth: 1, borderBottomColor: color.line },
  flowSide: { width: 72 },
  flowTitle: { flex: 1, fontWeight: 600, textAlign: "center" },
  headerLink: { color: color.teal, fontSize: text.sm, fontWeight: 600 },
  progress: { gap: space.xs, paddingVertical: space.sm, paddingHorizontal: space.md, backgroundColor: color.surface, borderBottomWidth: 1, borderBottomColor: color.line },
  progressBar: { flexDirection: "row", gap: 4 },
  progressStep: { flex: 1, height: 5, borderRadius: radius.pill, backgroundColor: color.line },
  progressStepOn: { backgroundColor: color.yellow, borderWidth: 1, borderColor: color.yellowDeep },
  progressLabel: { fontSize: text.cap, fontWeight: 600, color: color.ink3, ...caps() },
  flowFooter: {
    gap: space["2xs"],
    paddingTop: space.sm,
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
    backgroundColor: color.surface,
    borderTopWidth: 1,
    borderTopColor: color.line,
  },
  composerBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingTop: space.sm,
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
    backgroundColor: color.surface,
    borderTopWidth: 1,
    borderTopColor: color.line,
  },
});
