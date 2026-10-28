import { useEffect, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { Btn, BtnRow, Eyebrow, RowName, T } from "../components/base.jsx";
import { Icon } from "../components/icons.jsx";
import { ServiceCard } from "../components/services.jsx";
import { DisclaimerStrip } from "../components/ui.jsx";
import { usePersona, usePersonaApi } from "../persona.js";
import { caps, color, fontFamily, radius, shadowCard, space, text } from "../theme.js";

function Proposal({ item }) {
  const api = usePersonaApi();
  return (
    <View style={s.proposal}>
      <Eyebrow>Propunere</Eyebrow>
      <RowName>{item.title}</RowName>
      <View style={{ gap: 2 }}>
        {item.lines.map((line) => (
          <T key={line} style={s.proposalLine}>
            {line}
          </T>
        ))}
      </View>
      {item.done ? (
        <T style={s.done}>✓ {item.done}</T>
      ) : (
        <BtnRow>
          {item.actions.map((action, i) => (
            <Btn key={action} small variant={i === 0 ? "yellow" : "text"} disabled={api.busy} onPress={() => api.mutate(`/chat/${item.position}/decision`, { action }, "POST")}>
              {action}
            </Btn>
          ))}
        </BtnRow>
      )}
    </View>
  );
}

function Message({ item, services }) {
  const api = usePersonaApi();
  if (item.type === "divider") return <T style={s.divider}>{item.text}</T>;
  if (item.type === "me") {
    return (
      <View style={[s.msg, s.me]}>
        <T style={{ color: color.onInk }}>{item.text}</T>
      </View>
    );
  }
  if (item.type === "proposal") return <Proposal item={item} />;
  if (item.type === "service") {
    return (
      <View style={s.service}>
        <ServiceCard service={services.items.find((service) => service.id === item.id)} compact busy={api.busy} onAction={(service, action) => api.mutate(`/services/${service.id}`, { action })} />
      </View>
    );
  }
  return (
    <View style={[s.msg, s.coach, shadowCard]}>
      <T style={s.coachText}>{item.text}</T>
      {item.steps ? (
        <View style={s.steps}>
          {item.steps.map((step, i) => (
            <View key={step} style={s.step}>
              <T style={s.coachText}>{i + 1}.</T>
              <T style={[s.coachText, { flex: 1 }]}>{step}</T>
            </View>
          ))}
        </View>
      ) : null}
      {item.after ? <T style={[s.coachText, { marginTop: space.xs }]}>{item.after}</T> : null}
    </View>
  );
}

export default function Chat() {
  const { chat, chatStatus, services, legal } = usePersona();
  const api = usePersonaApi();
  const unread = chatStatus.unread;
  useEffect(() => { if (unread) api.mutate("/chat/read", {}, "POST"); }, [api, unread]);
  const waiting = chat.at(-1)?.type === "me" && !chatStatus.coachReplies;
  return (
    <>
      <DisclaimerStrip legal={legal} card />
      <View style={s.thread} accessibilityLabel="Mesaje">
        {chat.map((item, i) => (
          <Message key={i} item={item} services={services} />
        ))}
        {waiting ? <T style={s.notice} accessibilityLiveRegion="polite">Mesajul e salvat. În acest demo coach-ul nu răspunde încă la mesaje noi.</T> : null}
        {!chat.length ? <T style={s.notice}>Nu ai încă mesaje. Scrie-i coach-ului ce te preocupă.</T> : null}
      </View>
    </>
  );
}

// The message box at the bottom of the chat; messages are saved, the demo coach does not reply.
export function Composer() {
  const [message, setMessage] = useState("");
  const api = usePersonaApi();
  const send = async () => { if (message.trim() && !api.busy && await api.mutate("/chat/messages", { text: message }, "POST")) setMessage(""); };
  return (
    <>
      <TextInput accessibilityLabel="Mesajul tău" placeholder="Scrie un mesaj…" placeholderTextColor={color.ink3} autoComplete="off" style={s.input} value={message} onChangeText={setMessage} onSubmitEditing={send} editable={!api.busy} />
      <Pressable accessibilityRole="button" accessibilityLabel="Trimite" disabled={api.busy || !message.trim()} onPress={send} style={({ pressed }) => [s.send, pressed && { backgroundColor: color.yellowHover }]}>
        <Icon name="send" size={20} />
      </Pressable>
    </>
  );
}

const s = StyleSheet.create({
  thread: { gap: space.sm },
  notice: { alignSelf: "center", maxWidth: "86%", fontSize: text.sm, textAlign: "center", color: color.ink3 },
  divider: { marginTop: space.sm, fontSize: text.cap, fontWeight: 600, textAlign: "center", color: color.ink3, ...caps(text.cap, 0.08) },
  msg: { maxWidth: "86%", paddingVertical: space.sm, paddingHorizontal: space.md, borderRadius: 18 },
  coach: { alignSelf: "flex-start", backgroundColor: color.surface, borderBottomLeftRadius: 4 },
  coachText: { lineHeight: 1.45 },
  me: { alignSelf: "flex-end", backgroundColor: color.ink, borderBottomRightRadius: 4 },
  steps: { gap: space["2xs"], marginTop: space.xs },
  step: { flexDirection: "row", gap: space.xs, paddingLeft: space["2xs"] },
  proposal: {
    alignSelf: "flex-start",
    width: "86%",
    gap: space.xs,
    padding: space.md,
    backgroundColor: color.surface,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: color.ink,
  },
  proposalLine: { fontSize: text.sm, color: color.ink2 },
  done: { fontSize: text.sm, fontWeight: 600, color: color.teal },
  service: { alignSelf: "flex-start", width: "92%" },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: color.sand,
    fontFamily: fontFamily[400],
    fontSize: text.md,
    color: color.ink,
    outlineStyle: "none",
  },
  send: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: color.yellow },
});
