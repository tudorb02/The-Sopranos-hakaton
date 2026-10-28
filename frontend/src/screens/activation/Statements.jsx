// Statement sources for the coach: import from the current account, or attach earlier statements.
// Used in the activation flow and from Profil → Extrasele tale.

import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Btn, Card, Intro, Row, RowMain, RowName, RowNote, Rows, Small, Stack, Status, T } from "../../components/base.jsx";
import { Field, Group, GroupHint, IconTile, Meter, NoteCard, RowWithBelow, StateDot } from "../../components/ui.jsx";
import { usePersona, usePersonaApi } from "../../persona.js";
import { documentPayload, pickDocument } from "../../lib/files";
import { color, radius, space, text } from "../../theme.js";

const flush = { paddingVertical: 0, paddingHorizontal: 0 };

// Numbered steps in a card, one per row.
export function Steps({ items }) {
  return (
    <Rows>
      {items.map((step, i) => (
        <Row key={step}>
          <View style={s.num}>
            <T style={s.numText}>{i + 1}</T>
          </View>
          <T style={{ flex: 1 }}>{step}</T>
        </Row>
      ))}
    </Rows>
  );
}

export function Statements() {
  const { statements } = usePersona();
  const api = usePersonaApi();
  const [period, setPeriod] = useState(statements.periods[0]);
  const upload = async () => {
    try { const file = await pickDocument(); if (file) await api.mutate("/statements", await documentPayload(file), "POST"); }
    catch (error) { api.reportError(error); }
  };
  return (
    <>
      <Intro title="Extrasele tale de cont">
        <Small muted>{statements.lead}</Small>
      </Intro>

      <Group label="Din contul curent">
        <Card>
          <Stack>
            <Row style={flush}>
              <IconTile icon="card" tone="yellow" />
              <RowMain>
                <RowName>{statements.account.name}</RowName>
                <RowNote style={{ fontVariant: ["tabular-nums"] }}>{statements.account.iban}</RowNote>
              </RowMain>
              <Status tone="on">Selectat</Status>
            </Row>
            <Field disabled={api.busy} field={{ label: "Perioada", type: "select", value: period, options: statements.periods }} onChange={setPeriod} />
            <Btn block disabled={api.busy} onPress={() => api.mutate("/imports", { period }, "POST")}>Importă extrasele</Btn>
            <Row style={flush}>
              <StateDot state="done" />
              <RowMain>
                <RowName>{statements.imported.title}</RowName>
                <RowNote>{statements.imported.meta}</RowNote>
              </RowMain>
            </Row>
          </Stack>
        </Card>
      </Group>

      <Group label="Atașează extrase anterioare">
        <GroupHint>{statements.attachHint}</GroupHint>
        <Pressable accessibilityRole="button" accessibilityHint="PDF, XLS sau CSV" disabled={api.busy} onPress={upload} style={({ pressed }) => [s.dropzone, pressed && { backgroundColor: color.yellowSoft }]}>
          <IconTile icon="upload" tone="yellow" />
          <RowName>Alege fișierele</RowName>
          <Small muted>{statements.formats}</Small>
        </Pressable>
        {statements.files.length ? (
          <Rows>
            {statements.files.map((file) => (
              <RowWithBelow key={file.name} indent={40} below={file.state === "reading" ? <Meter value={file.progress} max={100} /> : null}>
                <IconTile icon="file" tone="sand" />
                <RowMain>
                  <RowName style={s.fileName}>{file.name}</RowName>
                  <RowNote>{file.meta}</RowNote>
                </RowMain>
                <Status tone={file.state === "done" ? "on" : undefined}>{file.state === "done" ? "Procesat" : "Se procesează"}</Status>
              </RowWithBelow>
            ))}
          </Rows>
        ) : null}
      </Group>

      <Group label="Cum exporți un extras de la altă bancă">
        <Steps items={statements.howTo} />
      </Group>

      <NoteCard icon="lock">{statements.privacy}</NoteCard>
    </>
  );
}

const s = StyleSheet.create({
  dropzone: {
    alignItems: "center",
    gap: space.xs,
    paddingVertical: space.xl,
    paddingHorizontal: space.md,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: color.ink3,
    borderRadius: radius.card,
    backgroundColor: color.surface,
  },
  fileName: { wordBreak: "break-all" },
  num: { width: 26, height: 26, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: color.yellow },
  numText: { fontSize: text.cap, fontWeight: 700, lineHeight: 16 },
});
