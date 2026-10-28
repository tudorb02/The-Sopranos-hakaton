// Panel 1: the company dossier (ANAF, APIA, Open Banking), the parcel map with the risks and the data source badges.

import { GeoMap } from "../../../components/live.jsx";
import { KeyValues, Panel, SourceTag, Tag } from "../../../components/officer.jsx";
import { eur, ha } from "../../../lib/format.js";
import { DOC_TYPE_RO, MONTHS_RO, RISK_RO, SOURCE_RO } from "../../../lib/labels.js";

const riskTone = (level) => (level === "HIGH" ? "bad" : level === "MEDIUM" ? "warn" : "ok");

export function CompanyPanel({ run }) {
  const { company, farm, parcels, cashflow, dataSources } = run.farm;
  const selected = new Set(run.parcelIds);
  const lastYear = Math.max(...farm.crops.map((c) => c.year));
  return (
    <Panel
      n={1}
      title="Dosarul firmei"
      wide
      aside={
        <span className="panel-aside">
          {dataSources.map((s) => (
            <span key={s.source} className="source-chip">
              {SOURCE_RO[s.source] ?? s.source} <SourceTag mode={s.mode} />
            </span>
          ))}
        </span>
      }
    >
      <div className="grid-2">
        <div>
          <h3 className="sub-title">ANAF / ONRC</h3>
          <KeyValues
            rows={[
              ["Firma", `${company.name} (CUI ${company.cui})`],
              ["Activitate", `CAEN ${company.caen} · ${company.caenLabelRo}`],
              ["Sediu", `${company.locality ? `${company.locality}, ` : ""}${company.county}`],
              ["Angajați", company.employees],
              ["Cifră de afaceri", company.turnoverEur != null ? `${eur(company.turnoverEur)} (${company.financialYear})` : "fără bilanț"],
              ["Active totale", company.totalAssetsEur != null ? eur(company.totalAssetsEur) : "fără bilanț"],
              ["Statut IMM", <Tag key="sme" tone={company.smeStatus === "SME" ? "ok" : company.smeStatus === "NOT_SME" ? "bad" : "warn"}>{company.smeStatus}</Tag>],
              company.manager ? ["Administrator", `${company.manager.age} ani, instalat din ${company.manager.installedAt}`] : null,
            ]}
          />
          <h3 className="sub-title">APIA</h3>
          <KeyValues
            rows={[
              ["Suprafață", `${ha(farm.totalHa)} în ${parcels.features.length} parcele (${run.parcelIds.length} alese pentru investiție)`],
              ["Culturi " + lastYear, farm.crops.filter((c) => c.year === lastYear).map((c) => `${c.crop} ${ha(c.ha)}`).join(", ")],
              ["Irigare actuală", farm.currentIrrigation ?? "—"],
              farm.apiaSubsidiesEur != null ? ["Subvenții APIA", eur(farm.apiaSubsidiesEur)] : null,
              farm.livestock.length ? ["Animale", farm.livestock.map((l) => `${l.species} ${l.heads}`).join(", ")] : null,
            ]}
          />
          <h3 className="sub-title">Open Banking</h3>
          <KeyValues
            rows={[
              ["Cashflow net anual", eur(cashflow.annualNetEur)],
              ["Luni cu încasări mari", cashflow.peakMonths.map((m) => MONTHS_RO[m]).join(", ")],
            ]}
          />
          <h3 className="sub-title">Documente încărcate</h3>
          <ul className="plain-list small">
            {run.documents.map((d) => (
              <li key={d.documentId}>
                {DOC_TYPE_RO[d.docType] ?? d.docType} · <span className="muted">{d.fileName}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <GeoMap
            collection={parcels}
            selected={selected}
            risk
            height={230}
            caption="Parcelele alese sunt galbene; conturul punctat = zonă Natura 2000. Harta e desenată local, fără internet."
          />
          <table className="table table--tight">
            <thead>
              <tr>
                <th>Parcelă</th>
                <th>Cultură</th>
                <th className="num">ha</th>
                <th>Secetă</th>
                <th>Stres hidric</th>
                <th>Grindină</th>
                <th>Natura 2000</th>
                <th>Nitrați</th>
              </tr>
            </thead>
            <tbody>
              {parcels.features.map((f) => {
                const p = f.properties;
                return (
                  <tr key={f.id} className={selected.has(f.id) ? "is-picked" : undefined}>
                    <td>{p.parcelId}</td>
                    <td>{p.crop}</td>
                    <td className="num">{p.areaHa}</td>
                    <td>
                      <Tag tone={riskTone(p.droughtRisk)}>{RISK_RO[p.droughtRisk]}</Tag>
                    </td>
                    <td>
                      <Tag tone={riskTone(p.waterStress)}>{RISK_RO[p.waterStress]}</Tag>
                    </td>
                    <td>
                      <Tag tone={riskTone(p.hailRisk)}>{RISK_RO[p.hailRisk]}</Tag>
                    </td>
                    <td>{p.natura2000 ? <Tag tone="bad">da</Tag> : "nu"}</td>
                    <td>{p.nitrateVulnerable ? <Tag tone="warn">da</Tag> : "nu"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Panel>
  );
}
