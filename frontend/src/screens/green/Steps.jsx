// The steps of the green-credit flow, the same for every area (design/pj-greenstruct.md §4), in the order of the
// GreenStruct README §7. Each screen gets the area's pack (data/green/packs.js): its configuration and its dossier.

import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Btn, Card, CardTitle, Eyebrow, Intro as PageIntro, Row, RowMain, RowName, RowNote, Rows, Small, Stack, Status, T } from "../../components/base.jsx";
import { DocumentRow, From, ModuleGrid, OfferCompare, PaymentsChart, StatusSteps } from "../../components/green.jsx";
import { ServiceCard } from "../../components/services.jsx";
import {
  Amount,
  Aside,
  Check,
  ChoiceChips,
  Disclaimer,
  Fact,
  FactList,
  Facts,
  Field,
  FixedRow,
  Group,
  GroupHint,
  HeroAlert,
  HeroCard,
  HeroLabel,
  HeroSub,
  IconTile,
  Meter,
  NoteCard,
  PrivacyPromise,
  Section,
  Src,
  StateDot,
  Switch,
  Switches,
  Ticks,
  ValueRow,
} from "../../components/ui.jsx";
import { greenLegal } from "../../data/green/legal.js";
import { eur } from "../../lib/format.js";
import { color, space, text } from "../../theme.js";
import { PhaseRow } from "../activation/Analysis.jsx";
import { Welcome } from "../activation/Start.jsx";
import { Steps } from "../activation/Statements.jsx";
import { TotalRow } from "../Summary.jsx";
import { Parcels } from "./agro/Parcels.jsx";

const chosenModule = (pack) => pack.modules.find((module) => module.id === pack.selectedModule);

// The "where" step: each area brings its own variant.
const LOCATION_VARIANTS = { parcels: Parcels };

const Correct = () => (
  <Btn variant="text" small style={{ minHeight: 32, marginVertical: -6 }}>
    Corectează
  </Btn>
);

const Calculated = () => <Src kind="est" label="calculat de bancă" />;

export function Intro({ pack }) {
  const { intro } = pack;
  return (
    <>
      <Welcome icon="leaf" eyebrow={pack.sectorName} title={intro.title} lead={intro.lead} duration={intro.duration} />

      <Section title="Cum decurge">
        <Steps items={intro.steps} />
      </Section>

      <Section title="Ce face consultantul">
        <Ticks yes={intro.does} no={intro.doesNot} />
      </Section>

      <Section title="Ce să ai la îndemână">
        <Ticks yes={intro.bring} />
      </Section>

      <Disclaimer legal={greenLegal} link href="#/verde/informare" />
    </>
  );
}

export function Company({ pack }) {
  const { company, consents } = pack;
  return (
    <>
      <PageIntro title="Firma ta">
        <Small muted>Luăm datele din registrele publice și, cu acordul tău, de la APIA și din conturi. Tu doar confirmi.</Small>
      </PageIntro>

      <Card accessibilityLabel="Firma">
        <Row style={{ paddingVertical: 0, paddingHorizontal: 0 }}>
          <IconTile icon="bank" tone="yellow" />
          <RowMain>
            <RowName>{company.name}</RowName>
            <RowNote>{company.account}</RowNote>
          </RowMain>
        </Row>
      </Card>

      <Group label="Acordurile tale">
        <Switches>
          {consents.map((item) =>
            item.fixed ? (
              <FixedRow key={item.id} label={item.label} hint={item.hint} aside={<Status>Public</Status>} />
            ) : (
              <Switch key={item.id} label={item.label} hint={item.hint} defaultChecked={item.on} />
            ),
          )}
        </Switches>
        <GroupHint>Fără Open Banking, poți atașa extrasele de cont ale firmei.</GroupHint>
      </Group>

      <PrivacyPromise legal={greenLegal} href="#/verde/informare" />

      <Group label="Ce am găsit" action={<Correct />}>
        <FactList>
          {company.facts.map((fact) => (
            <Fact key={fact.label} label={fact.label} value={fact.value} src={<From source={fact.src} />} />
          ))}
        </FactList>
      </Group>
    </>
  );
}

export function Category({ pack }) {
  return (
    <>
      <PageIntro title="Ce vrei să faci?">
        <Small muted>Alege categoria investiției. Pentru fiecare verificăm alt criteriu verde.</Small>
      </PageIntro>

      <ModuleGrid modules={pack.modules} selected={pack.selectedModule} />

      <NoteCard icon="leaf">{chosenModule(pack).criterion}</NoteCard>
    </>
  );
}

export function Location({ pack }) {
  const Variant = LOCATION_VARIANTS[pack.location.variant];
  return <Variant location={pack.location} />;
}

export function Documents({ pack }) {
  const module = chosenModule(pack);
  return (
    <>
      <PageIntro title="Documente">
        <Small muted>
          Doar cele esențiale pentru categoria ta. Ce lipsește poți trimite și după: devine o condiție înainte de tragere, nu un motiv de respingere.
        </Small>
      </PageIntro>

      <Btn variant="outline" small icon="upload">
        Încarcă dosarul demo
      </Btn>

      <Group label="Pentru orice investiție">
        <Rows>
          {pack.generalDocuments.map((doc) => (
            <DocumentRow key={doc.id} doc={doc} state={pack.documents[doc.id]} />
          ))}
        </Rows>
      </Group>

      <Group label={`Pentru ${module.name.toLowerCase()}`}>
        <Rows>
          {module.documents.map((doc) => (
            <DocumentRow key={doc.id} doc={doc} state={pack.documents[doc.id]} />
          ))}
        </Rows>
      </Group>

      <NoteCard icon="lock">Documentele sunt criptate, nu devin publice și sunt folosite doar pentru acest dosar. Agenții citesc din ele doar datele tehnice.</NoteCard>
    </>
  );
}

function Question({ question, answer = {} }) {
  const source = answer.src ? <From source={answer.src} /> : null;
  if (question.type === "text" || question.type === "textarea") {
    return (
      <View style={s.question}>
        <Field
          field={{ label: question.label, type: question.type === "textarea" ? "textarea" : undefined, value: answer.value, suffix: question.suffix, numeric: question.numeric }}
          style={{ alignSelf: "stretch" }}
        />
        {source}
      </View>
    );
  }
  const selected = answer.selected ?? [];
  return (
    <View style={s.question}>
      <T style={s.questionLabel}>{question.label}</T>
      <ChoiceChips label={question.label} options={question.options.map((option) => ({ label: option, selected: selected.includes(option) }))} />
      {source}
    </View>
  );
}

export function Questions({ pack }) {
  const module = chosenModule(pack);
  const groups = [
    { label: `Pentru ${module.name.toLowerCase()}`, items: module.questions },
    { label: "Pentru orice investiție", items: pack.commonQuestions },
  ];
  return (
    <>
      <PageIntro title="Câteva întrebări">
        <Small muted>Doar ce ne trebuie pentru calcul. Le-am completat din APIA unde am putut.</Small>
      </PageIntro>

      {groups.map((group) => (
        <Group key={group.label} label={group.label}>
          <Card style={{ gap: space.lg }}>
            {group.items.map((question) => (
              <Question key={question.id} question={question} answer={pack.answers[question.id]} />
            ))}
          </Card>
        </Group>
      ))}
    </>
  );
}

const FEED_TONES = { warn: { color: color.warn, fontWeight: 600 }, ok: { fontWeight: 700 } };

export function Analysis({ pack }) {
  const { analysis } = pack;
  return (
    <>
      <PageIntro title={analysis.title}>
        <Small muted>{analysis.lead}</Small>
      </PageIntro>

      <Rows>
        {analysis.phases.map((phase) => (
          <PhaseRow key={phase.label} phase={phase} />
        ))}
      </Rows>

      <Section title="Ce am aflat">
        <Rows>
          {analysis.messages.map((message) => (
            <View key={message.text} style={s.feedItem}>
              <Eyebrow>{message.phase}</Eyebrow>
              <T style={[{ fontSize: text.sm }, FEED_TONES[message.tone]]}>{message.text}</T>
            </View>
          ))}
        </Rows>
      </Section>

      <NoteCard icon="shield">{analysis.note}</NoteCard>
    </>
  );
}

export function Offers({ pack }) {
  const { offer } = pack;
  return (
    <>
      <HeroCard yellow>
        <Eyebrow style={{ marginBottom: space.xs }}>{offer.eyebrow}</Eyebrow>
        <HeroLabel>{offer.headline.label}</HeroLabel>
        <Amount value={offer.headline.eur} size="xl" currency="EUR" />
        <HeroSub>
          <Calculated />
        </HeroSub>
        <HeroAlert icon="leaf">
          <T style={{ fontWeight: 700 }}>{offer.level.name}</T> · {offer.recommended}
        </HeroAlert>
      </HeroCard>

      <Section title="Creditul clasic și creditul verde" aside={<Calculated />}>
        <OfferCompare columns={offer.columns} rows={offer.rows} />
        <Small muted>{offer.difference}</Small>
      </Section>

      <Section title={offer.rate.title}>
        <Rows>
          {offer.rate.parts.map((part) => (
            <ValueRow key={part.label} name={part.label} value={part.pp} />
          ))}
          <TotalRow label={offer.rate.total.label} value={offer.rate.total.pp} />
        </Rows>
        <Small muted>{offer.rate.note}</Small>
      </Section>

      <Section title="Ratele, într-un an">
        <Card>
          <PaymentsChart payments={offer.payments} />
        </Card>
      </Section>

      <Section title="Garanția din creditul verde">
        <ServiceCard service={offer.guarantee} />
      </Section>

      <NoteCard icon="shield">{offer.notice}</NoteCard>
    </>
  );
}

export function Changes({ pack }) {
  const { changes, offer } = pack;
  return (
    <>
      <PageIntro title={changes.title}>
        <Small muted>{changes.lead}</Small>
      </PageIntro>

      <Rows>
        <ValueRow icon="file" name={changes.from.name} note={`Cerut · ${changes.from.note}`} value={eur(changes.from.eur)} />
        <ValueRow icon="drop" name={changes.to.name} note={`Propus · ${changes.to.note}`} value={eur(changes.to.eur)} />
      </Rows>

      <Facts items={changes.facts} />

      <NoteCard icon="leaf">
        <T style={{ fontWeight: 700 }}>{offer.level.name}.</T> {offer.level.text}
      </NoteCard>

      <Section title="Alte schimbări posibile" aside={<Aside>din catalog</Aside>}>
        <Rows>
          {changes.more.map((item) => (
            <Row key={item}>
              <RowName style={{ flex: 1 }}>{item}</RowName>
            </Row>
          ))}
        </Rows>
      </Section>
    </>
  );
}

// The variants of the credit as radio cards; a tap moves the choice, nothing is stored.
function Variants({ variants }) {
  const [chosen, setChosen] = useState(variants.find((variant) => variant.selected)?.id);
  return (
    <View style={{ gap: space.sm }} accessibilityRole="radiogroup" accessibilityLabel="Varianta de credit">
      {variants.map((variant) => {
        const on = variant.id === chosen;
        return (
          <Pressable key={variant.id} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setChosen(variant.id)}>
            <Card style={[s.variant, on && s.variantOn]}>
              <Check checked={on} radio />
              <RowMain>
                <RowName>{variant.name}</RowName>
                <RowNote>{variant.note}</RowNote>
              </RowMain>
              {variant.badge ? <Status tone="on">{variant.badge}</Status> : null}
            </Card>
          </Pressable>
        );
      })}
    </View>
  );
}

// The consultant checks the request before it goes to the bank, which only gives the final approval: the variant,
// how ready the dossier is, what to improve, the clauses (those already in the green offer, and those the client
// adds to the request) and what the client commits to.
export function Request({ pack }) {
  const { advice } = pack;
  const { readiness } = advice;
  return (
    <>
      <PageIntro title={advice.title}>
        <Small muted>{advice.lead}</Small>
      </PageIntro>

      <Group label="Ce variantă trimiți">
        <Variants variants={advice.variants} />
      </Group>

      <Section
        title={readiness.title}
        aside={
          <T style={{ fontSize: text.sm, fontVariant: ["tabular-nums"] }}>
            <T style={{ fontWeight: 600 }}>{readiness.met}</T> din {readiness.total}
          </T>
        }
      >
        <Card>
          <Stack>
            <Meter value={readiness.met} max={readiness.total} />
            <Small muted>{readiness.summary}</Small>
          </Stack>
        </Card>
        <Rows>
          {readiness.items.map((item) => (
            <Row key={item.label}>
              <StateDot state={item.state === "done" ? "done" : "warn"} />
              <RowMain>
                <RowName>{item.label}</RowName>
                <RowNote>{item.note}</RowNote>
              </RowMain>
            </Row>
          ))}
        </Rows>
      </Section>

      <Section title="Ce mai poți îmbunătăți">
        <Rows>
          {advice.actions.map((action) => (
            <Row key={action.title}>
              <IconTile icon={action.icon} tone="sand" />
              <RowMain>
                <RowName>{action.title}</RowName>
                <RowNote>{action.text}</RowNote>
              </RowMain>
              {action.button ? (
                <Btn variant="outline" small>
                  {action.button}
                </Btn>
              ) : null}
            </Row>
          ))}
        </Rows>
      </Section>

      <Section title="Clauzele din oferta verde">
        <Rows>
          {advice.clauses
            .filter((clause) => clause.status === "offer")
            .map((clause) => (
              <Row key={clause.title}>
                <RowMain>
                  <RowName>{clause.title}</RowName>
                  <RowNote>{clause.text}</RowNote>
                  <Status tone="on" style={{ marginTop: space["2xs"] }}>
                    În oferta verde
                  </Status>
                </RowMain>
              </Row>
            ))}
        </Rows>
      </Section>

      <Section title="Clauzele pe care le ceri">
        <Switches>
          {advice.clauses
            .filter((clause) => clause.status !== "offer")
            .map((clause) => (
              <Switch key={clause.title} label={clause.status === "proposal" ? `${clause.title} (propunere)` : clause.title} hint={clause.text} defaultChecked />
            ))}
        </Switches>
        <Small muted>Le adaugi acum în cerere. Banca le confirmă la aprobarea finală.</Small>
      </Section>

      <Section title="Ce te obligi să faci, cu creditul verde">
        <Obligations items={advice.obligations} />
      </Section>

      <NoteCard icon="shield">{advice.note}</NoteCard>
    </>
  );
}

function Obligations({ items }) {
  return (
    <Rows>
      {items.map((item) => (
        <ValueRow key={item.what} name={item.what} note={item.note} value={<Status>{item.when}</Status>} />
      ))}
    </Rows>
  );
}

export function Dossier({ pack }) {
  const { advice, dossier } = pack;
  return (
    <>
      <HeroCard>
        <Eyebrow style={{ marginBottom: space.xs }}>{dossier.eyebrow}</Eyebrow>
        <CardTitle>{dossier.title}</CardTitle>
        <HeroSub>{dossier.text}</HeroSub>
      </HeroCard>

      <StatusSteps steps={dossier.steps} />

      <Group label="Impactul estimat, măsurat la 12 luni">
        <Facts items={dossier.impact} />
      </Group>

      <Group label="După aprobare, ce trimiți și când">
        <Obligations items={advice.obligations} />
      </Group>

      <View style={s.withdraw}>
        <Btn variant="danger">Retrage cererea</Btn>
        <Small muted style={{ textAlign: "center" }}>
          Documentele încărcate și răspunsurile tale se șterg. Contul firmei nu este afectat.
        </Small>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  question: { alignItems: "flex-start", gap: space.xs },
  questionLabel: { fontSize: text.sm, fontWeight: 600 },
  feedItem: { gap: 2, paddingVertical: space.sm, paddingHorizontal: space.md },
  variant: { flexDirection: "row", alignItems: "center", gap: space.sm, borderWidth: 2, borderColor: "transparent" },
  variantOn: { backgroundColor: color.yellowSoft, borderColor: color.ink },
  withdraw: { alignItems: "center", gap: space["2xs"] },
});
