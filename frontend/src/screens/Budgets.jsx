import { useState } from "react";
import { View } from "react-native";
import { Btn, Eyebrow, Rows, Small, TextLink } from "../components/base.jsx";
import { Allocation, Legend } from "../components/charts.jsx";
import { Amount, Aside, BudgetRow, Chips, Disclosure, Field, HeroCard, HeroLabel, HeroSub, InfoCard, Section, Split, Src, ValueRow } from "../components/ui.jsx";
import { lei } from "../lib/format.js";
import { usePersona, usePersonaApi } from "../persona.js";
import { amountMinor } from "../lib/api.js";
import { useRouter } from "../router.jsx";
import { space } from "../theme.js";

export default function Budgets() {
  const { allocation, budgetGroups, budgets, cycle, question, unbudgeted, categories, pickerCategories } = usePersona();
  const api = usePersonaApi(), { navigate } = useRouter();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", category: pickerCategories[0], kind: "amount", limit: "", period: "cycle" });
  const change = (key, value) => setDraft((old) => ({ ...old, [key]: value }));
  const create = async () => {
    try {
      const limit = draft.kind === "amount" ? { limit_minor: amountMinor(draft.limit) } : { count_limit: /^\d+$/.test(draft.limit) ? Number(draft.limit) : 0 };
      if (await api.mutate("/budgets", { category: draft.category, ...(draft.name.trim() ? { name: draft.name.trim() } : {}), kind: draft.kind, period: draft.period, ...limit }, "POST")) setAdding(false);
    } catch (error) { api.reportError(error); }
  };
  const classify = async (option) => {
    const category = { "Cumpărături online": "cumparaturi", "Cadou": "cadouri", "Un joc": "cumparaturi", "Un abonament": "abonamente" }[option];
    if (category) await api.mutate(`/transactions/${question.txId}`, { category });
    else navigate(`#/cheltuieli/${question.txId}`);
  };
  return (
    <>
      <HeroCard>
        <Eyebrow style={{ marginBottom: space.xs }}>Perioada de buget · {cycle.label}</Eyebrow>
        <HeroLabel>Disponibil până pe {cycle.endsOn}</HeroLabel>
        <Amount value={cycle.left} size="lg" />
        <HeroSub>
          din {lei(cycle.spendable)} · ai folosit {lei(cycle.spent)}
        </HeroSub>
        <Split>
          <Allocation parts={allocation} total={cycle.total} />
          <Legend parts={allocation} />
          <Small muted>{cycle.totalNote}</Small>
        </Split>
      </HeroCard>

      {budgetGroups.map((group) => (
        <Section key={group.title} title={group.title} aside={group.src ? <Src kind={group.src} label={group.note} /> : <Aside>{group.note}</Aside>}>
          <Rows>
            {budgets
              .filter((budget) => !group.id || budget.group === group.id)
              .map((budget) => (
                <BudgetRow key={budget.id} budget={budget} />
              ))}
          </Rows>
        </Section>
      ))}

      <Section title="Fără buget" aside={<Aside>{lei(unbudgeted.total)}</Aside>}>
        <Rows>
          {unbudgeted.items.map((item) => (
            <ValueRow key={item.name} icon={item.icon} name={item.name} note={item.note} value={lei(item.lei)} />
          ))}
        </Rows>
      </Section>

      {question ? <InfoCard
        icon="help"
        title="O întrebare scurtă"
        text={`Ce reprezintă plata de ${lei(question.amount)} către ${question.merchant} din ${question.date}?`}
      >
        <Chips items={question.options} onSelect={classify} />
        <TextLink href={`#/cheltuieli/${question.txId}`}>Deschide plata</TextLink>
      </InfoCard> : null}

      <Disclosure summary="Sănătate și donații">Le vezi doar tu. Coach-ul nu le comentează și nu propune bugete aici.</Disclosure>

      <Btn block onPress={() => setAdding(!adding)} disabled={api.busy}>Adaugă un buget</Btn>
      {adding ? <View style={{ gap: space.sm }}>
        <Field disabled={api.busy} field={{ label: "Numele bugetului", value: draft.name }} onChange={(value) => change("name", value)} />
        <Field disabled={api.busy} field={{ label: "Categorie", type: "select", value: categories[draft.category].label, options: pickerCategories.map((id) => categories[id].label) }} onChange={(value) => change("category", pickerCategories.find((id) => categories[id].label === value))} />
        <Field disabled={api.busy} field={{ label: "Tipul limitei", type: "select", value: draft.kind === "amount" ? "Sumă" : "Număr de plăți", options: ["Sumă", "Număr de plăți"] }} onChange={(value) => change("kind", value === "Sumă" ? "amount" : "count")} />
        <Field disabled={api.busy} field={{ label: "Limită", value: draft.limit, numeric: true, suffix: draft.kind === "amount" ? "lei" : "plăți" }} onChange={(value) => change("limit", value)} />
        <Field disabled={api.busy} field={{ label: "Perioada", type: "select", value: draft.period === "cycle" ? "Perioada de buget" : "Săptămână", options: ["Perioada de buget", "Săptămână"] }} onChange={(value) => change("period", value === "Săptămână" ? "week" : "cycle")} />
        <Btn onPress={create} disabled={api.busy}>Salvează bugetul</Btn>
      </View> : null}
    </>
  );
}
