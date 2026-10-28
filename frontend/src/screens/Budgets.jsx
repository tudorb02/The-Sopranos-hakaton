import { Btn, Eyebrow, Rows, Small, TextLink } from "../components/base.jsx";
import { Allocation, Legend } from "../components/charts.jsx";
import { Amount, Aside, BudgetRow, Chips, Disclosure, HeroCard, HeroLabel, HeroSub, InfoCard, Section, Split, Src, ValueRow } from "../components/ui.jsx";
import { lei } from "../lib/format.js";
import { usePersona } from "../persona.js";
import { space } from "../theme.js";

export default function Budgets() {
  const { allocation, budgetGroups, budgets, cycle, question, unbudgeted } = usePersona();
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

      <InfoCard
        icon="help"
        title="O întrebare scurtă"
        text={`Ce reprezintă plata de ${lei(question.amount)} către ${question.merchant} din ${question.date}?`}
      >
        <Chips items={question.options} />
        <TextLink href={`#/cheltuieli/${question.txId}`}>Deschide plata</TextLink>
      </InfoCard>

      <Disclosure summary="Sănătate și donații">Le vezi doar tu. Coach-ul nu le comentează și nu propune bugete aici.</Disclosure>

      <Btn block>Adaugă un buget</Btn>
    </>
  );
}
