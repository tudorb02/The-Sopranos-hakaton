// Simulated sign-in for the demo: pick a personal or the business account. Nothing is typed or checked.

import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { Btn, Card, Link, PageTitle, Row, RowMain, RowName, RowNote, T } from "../components/base.jsx";
import { IconTile, NoteCard } from "../components/ui.jsx";
import { accounts, login } from "../data/accounts.js";
import { ApiState } from "../components/ApiState.jsx";
import { request } from "../lib/api.js";
import { color, radius, shadowCard, space, text } from "../theme.js";

const TYPES = [
  { id: "pf", label: "Persoană fizică", href: "#/login" },
  { id: "pj", label: "Persoană juridică", href: "#/login/pj" },
];

export default function Login({ type }) {
  const [remote, setRemote] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, retry] = useState(0);
  useEffect(() => {
    if (type !== "pf") return;
    const controller = new AbortController();
    request("/accounts", { signal: controller.signal }).then((data) => { if (!controller.signal.aborted) { setRemote(data); setError(null); } }).catch((error) => { if (!controller.signal.aborted) setError(error); });
    return () => controller.abort();
  }, [type, attempt]);
  const content = type === "pf" ? remote?.login ?? login : login;
  const choices = type === "pf" ? remote?.accounts ?? [] : accounts.pj;
  return (
    <>
      <Card yellow style={s.welcome}>
        <IconTile icon="lock" tone="ink" />
        <PageTitle>{content.title}</PageTitle>
        <T style={{ color: color.ink2 }}>{content.lead}</T>
      </Card>

      <View style={[s.segmented, shadowCard]} accessibilityLabel="Tipul contului">
        {TYPES.map((item) => {
          const on = item.id === type;
          return (
            <Link key={item.id} href={item.href} accessibilityState={{ selected: on }} style={[s.segment, on && s.segmentOn]}>
              <T style={[s.segmentText, on && { color: color.ink }]}>{item.label}</T>
            </Link>
          );
        })}
      </View>

      {type === "pf" && !remote ? <ApiState loading={!error} error={error} retry={() => { setError(null); retry((value) => value + 1); }} /> : null}
      {choices.map((account) => (
        <Card key={account.id} style={s.account} accessibilityLabel={`Cont demo: ${account.name}`}>
          <Row style={s.flush}>
            <IconTile tone="yellow" round>
              <T style={s.initial}>{account.initial}</T>
            </IconTile>
            <RowMain>
              <RowName>{account.name}</RowName>
              <RowNote>
                {account.profile} · {account.detail}
              </RowNote>
            </RowMain>
          </Row>
          <Btn href={account.href} block>
            Intră în cont
          </Btn>
        </Card>
      ))}

      <NoteCard icon="lock">{content.note}</NoteCard>
    </>
  );
}

const s = StyleSheet.create({
  welcome: { gap: space.sm, paddingTop: space.lg, alignItems: "flex-start" },
  segmented: { flexDirection: "row", gap: 4, padding: 4, borderRadius: radius.pill, backgroundColor: color.surface },
  segment: { flex: 1, minHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  segmentOn: { backgroundColor: color.yellow },
  segmentText: { fontSize: text.sm, fontWeight: 600, color: color.ink2 },
  account: { gap: space.md },
  flush: { padding: 0, paddingVertical: 0, paddingHorizontal: 0 },
  initial: { fontSize: text.lg, fontWeight: 700 },
});
