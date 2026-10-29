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
      title="Company dossier"
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
              ["Company", `${company.name} (CUI ${company.cui})`],
              ["Activity", `CAEN ${company.caen} · ${company.caenLabelRo}`],
              ["Registered office", `${company.locality ? `${company.locality}, ` : ""}${company.county}`],
              ["Employees", company.employees],
              ["Turnover", company.turnoverEur != null ? `${eur(company.turnoverEur)} (${company.financialYear})` : "no balance sheet"],
              ["Total assets", company.totalAssetsEur != null ? eur(company.totalAssetsEur) : "no balance sheet"],
              ["SME status", <Tag key="sme" tone={company.smeStatus === "SME" ? "ok" : company.smeStatus === "NOT_SME" ? "bad" : "warn"}>{company.smeStatus}</Tag>],
              company.manager ? ["Manager", `${company.manager.age} years old, set up since ${company.manager.installedAt}`] : null,
            ]}
          />
          <h3 className="sub-title">APIA</h3>
          <KeyValues
            rows={[
              ["Area", `${ha(farm.totalHa)} in ${parcels.features.length} parcels (${run.parcelIds.length} selected for the investment)`],
              ["Crops " + lastYear, farm.crops.filter((c) => c.year === lastYear).map((c) => `${c.crop} ${ha(c.ha)}`).join(", ")],
              ["Current irrigation", farm.currentIrrigation ?? "—"],
              farm.apiaSubsidiesEur != null ? ["APIA subsidies", eur(farm.apiaSubsidiesEur)] : null,
              farm.livestock.length ? ["Animals", farm.livestock.map((l) => `${l.species} ${l.heads}`).join(", ")] : null,
            ]}
          />
          <h3 className="sub-title">Open Banking</h3>
          <KeyValues
            rows={[
              ["Annual net cash flow", eur(cashflow.annualNetEur)],
              ["Months with high income", cashflow.peakMonths.map((m) => MONTHS_RO[m]).join(", ")],
            ]}
          />
          <h3 className="sub-title">Uploaded documents</h3>
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
            caption="Selected parcels are yellow; dotted outline = Natura 2000 area. The map is drawn locally, without internet."
          />
          <table className="table table--tight">
            <thead>
              <tr>
                <th>Parcel</th>
                <th>Crop</th>
                <th className="num">ha</th>
                <th>Drought</th>
                <th>Water stress</th>
                <th>Hail</th>
                <th>Natura 2000</th>
                <th>Nitrates</th>
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
                    <td>{p.natura2000 ? <Tag tone="bad">yes</Tag> : "no"}</td>
                    <td>{p.nitrateVulnerable ? <Tag tone="warn">yes</Tag> : "no"}</td>
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
