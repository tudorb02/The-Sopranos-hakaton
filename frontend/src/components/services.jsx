// A Raiffeisen service as the coach shows it (rules in design/coach-services.md): only for a need the client
// stated or confirmed. The card says what the service is, exactly how it helps this client, what it costs,
// the way without it, and links to the bank's own page. Nothing is set up from here.

import { StyleSheet, View } from "react-native";

import { caps, color, radius, space, text } from "../theme.js";
import { B, Btn, BtnRow, Card, Eyebrow, Link, RowName, Small, Status, T } from "./base.jsx";
import { Icon } from "./icons.jsx";
import { Disclosure, IconTile } from "./ui.jsx";

// state: "active", "proposed", "later" or "howto" (a feature the client already has).
const STATUS_TONE = { active: "on", proposed: "outline", later: undefined, howto: undefined };

// A link to raiffeisen.ro, opened in the browser.
export function ExternalLink({ link }) {
  return (
    <Link href={link.href} style={s.ext} accessibilityLabel={`${link.label} (se deschide în browser)`}>
      <T style={s.extText}>{link.label}</T>
      <Icon name="external" size={16} color={color.teal} />
    </Link>
  );
}

function Details({ service }) {
  return (
    <>
      <View style={s.terms}>
        {service.terms.map((term) => (
          <View key={term.label} style={s.term}>
            <T style={[s.termText, s.termLabel]}>{term.label}</T>
            <T style={[s.termText, s.flex]}>{term.value}</T>
          </View>
        ))}
      </View>
      {service.without ? <Small muted>{service.without}</Small> : null}
    </>
  );
}

// compact: the costs and the reason fold under "Costuri și detalii" (Profil, chat).
export function ServiceCard({ service, compact = false, onAction, busy = false }) {
  const whyLabel = service.whyLabel ?? "De ce îți propun asta";
  return (
    <Card style={s.service} accessibilityLabel={service.name}>
      <View style={s.top}>
        <IconTile icon={service.icon} tone={service.state === "active" ? "yellow" : "sand"} />
        <View style={s.name}>
          <Eyebrow>{service.kind}</Eyebrow>
          <RowName>{service.name}</RowName>
        </View>
        <Status tone={STATUS_TONE[service.state]} style={{ alignSelf: "flex-start" }}>
          {service.status}
        </Status>
      </View>

      <Small>{service.description}</Small>

      <View style={s.helps}>
        <T style={s.helpsLabel}>Cum te ajută</T>
        <Small>{service.helps}</Small>
      </View>

      {compact ? (
        <Disclosure variant="why" summary="Costuri și detalii">
          <View style={s.more}>
            <T style={s.smallInk2}>
              <B>{whyLabel}:</B> {service.why}
            </T>
            <Details service={service} />
          </View>
        </Disclosure>
      ) : (
        <>
          <Details service={service} />
          <Disclosure variant="why" summary={whyLabel}>
            {service.why}
          </Disclosure>
        </>
      )}

      <View style={s.foot}>
        <ExternalLink link={service.link} />
        <Small muted>Sursa: {service.source}</Small>
      </View>

      {service.actions ? (
        <BtnRow>
          {service.actions.map((action, i) => (
            <Btn key={action} small variant={i === 0 ? "yellow" : "text"} onPress={onAction ? () => onAction(service, action) : undefined} disabled={busy}>
              {action}
            </Btn>
          ))}
        </BtnRow>
      ) : null}
      {service.decision ? <Small accessibilityLiveRegion="polite">Alegerea ta: {service.decision}</Small> : null}
    </Card>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  ext: { flexDirection: "row", alignItems: "center", gap: space["2xs"], alignSelf: "flex-start" },
  extText: { color: color.teal, fontSize: text.sm, fontWeight: 600, textDecorationLine: "underline", flexShrink: 1 },
  terms: { gap: space.xs },
  term: { flexDirection: "row", gap: space.sm },
  termText: { fontSize: text.sm },
  termLabel: { width: 112, color: color.ink3 },
  service: { gap: space.sm },
  top: { flexDirection: "row", alignItems: "center", gap: space.sm },
  name: { flex: 1, minWidth: 0, gap: 2 },
  helps: { gap: space["2xs"], paddingVertical: space.sm, paddingHorizontal: space.md, borderRadius: radius.tile, backgroundColor: color.yellowSoft },
  helpsLabel: { fontSize: text.cap, fontWeight: 700, ...caps() },
  more: { gap: space.sm },
  smallInk2: { fontSize: text.sm, color: color.ink2 },
  foot: { gap: 2, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: color.line },
});
