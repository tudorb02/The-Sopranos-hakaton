// Panel 7: the bank's green portfolio (GET /api/portfolio): loans by category, sums per fund, total impact.

import { ErrorCard, Loading } from "../../../components/live.jsx";
import { Panel, Tag } from "../../../components/officer.jsx";
import { getPortfolio } from "../../../lib/api.js";
import { dec, eur } from "../../../lib/format.js";
import { useAsync } from "../../../lib/hooks.js";
import { TIER_OFFICER } from "../../../lib/labels.js";

const MODULE_NAMES = { irigatii: "Irrigation", energie: "Farm energy", utilaje: "Machinery and precision", zootehnie: "Livestock and biogas", post_recolta: "Post-harvest", ecologic: "Organic" };

const IMPACT = [
  ["co2AvoidedT", "CO₂ avoided", "t"],
  ["energyMwh", "Renewable / saved energy", "MWh"],
  ["waterM3", "Water saved", "m³"],
  ["fuelL", "Diesel saved", "l"],
  ["nitrogenKg", "Nitrogen saved", "kg"],
  ["certifiedAreaHa", "Certified area", "ha"],
];

export function PortfolioPanel({ reloadKey }) {
  const { data, error, loading, reload } = useAsync((signal) => getPortfolio({ signal }), reloadKey ?? 0);
  return (
    <Panel
      n={7}
      title="Green portfolio"
      wide
      aside={
        <span className="panel-aside">
          {data?.parametersDemo ? <Tag tone="warn">demo parameters</Tag> : null}
          <button type="button" className="btn btn--text btn--small" onClick={reload}>
            Reload
          </button>
        </span>
      }
    >
      {loading && !data ? <Loading /> : null}
      <ErrorCard error={error} onRetry={reload} />
      {data ? (
        data.loanCount === 0 ? (
          <p className="small muted">No green credit approved yet. Approve a dossier and then “Simulate 12 months”.</p>
        ) : (
          <div className="grid-3">
            <div>
              <h3 className="sub-title">Green credits</h3>
              <p className="big num">
                {data.loanCount} · {eur(data.totalAmountEur)}
              </p>
              <table className="table">
                <tbody>
                  {data.byModule.map((m) => (
                    <tr key={m.moduleId}>
                      <td>{MODULE_NAMES[m.moduleId] ?? m.moduleId}</td>
                      <td className="num">{m.count}</td>
                      <td className="num">{eur(m.amountEur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="small muted">
                Tiers: {data.byTier.map((t) => `${TIER_OFFICER[t.tier] ?? t.tier} ${t.count}`).join(" · ")}
              </p>
            </div>
            <div>
              <h3 className="sub-title">By fund</h3>
              <table className="table">
                <tbody>
                  {data.byFund.map((f) => (
                    <tr key={f.fundCode}>
                      <td>
                        <b>{f.fundCode}</b> {f.nameRo}
                      </td>
                      <td className="num">{f.count}</td>
                      <td className="num">{eur(f.amountEur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="small muted">
                Monitored: {data.monitoring.monitoredCount}, impact confirmed: {data.monitoring.confirmedCount}
              </p>
            </div>
            <div>
              <h3 className="sub-title">Total impact (estimated)</h3>
              <table className="table">
                <tbody>
                  {IMPACT.filter(([key]) => data.impact[key] > 0).map(([key, label, unit]) => (
                    <tr key={key}>
                      <td>{label}</td>
                      <td className="num">
                        {dec(data.impact[key])} {unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : null}
    </Panel>
  );
}
