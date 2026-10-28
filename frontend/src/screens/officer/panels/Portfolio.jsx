// Panel 7: the bank's green portfolio (GET /api/portfolio): loans by category, sums per fund, total impact.

import { ErrorCard, Loading } from "../../../components/live.jsx";
import { Panel, Tag } from "../../../components/officer.jsx";
import { getPortfolio } from "../../../lib/api.js";
import { dec, eur } from "../../../lib/format.js";
import { useAsync } from "../../../lib/hooks.js";
import { TIER_OFFICER } from "../../../lib/labels.js";

const MODULE_NAMES = { irigatii: "Irigații", energie: "Energie la fermă", utilaje: "Utilaje și precizie", zootehnie: "Zootehnie și biogaz", post_recolta: "Post-recoltă", ecologic: "Ecologic" };

const IMPACT = [
  ["co2AvoidedT", "CO₂ evitat", "t"],
  ["energyMwh", "Energie regenerabilă / economisită", "MWh"],
  ["waterM3", "Apă economisită", "m³"],
  ["fuelL", "Motorină economisită", "l"],
  ["nitrogenKg", "Azot economisit", "kg"],
  ["certifiedAreaHa", "Suprafață certificată", "ha"],
];

export function PortfolioPanel({ reloadKey }) {
  const { data, error, loading, reload } = useAsync((signal) => getPortfolio({ signal }), reloadKey ?? 0);
  return (
    <Panel
      n={7}
      title="Portofoliu verde"
      wide
      aside={
        <span className="panel-aside">
          {data?.parametersDemo ? <Tag tone="warn">parametri demo</Tag> : null}
          <button type="button" className="btn btn--text btn--small" onClick={reload}>
            Reîncarcă
          </button>
        </span>
      }
    >
      {loading && !data ? <Loading /> : null}
      <ErrorCard error={error} onRetry={reload} />
      {data ? (
        data.loanCount === 0 ? (
          <p className="small muted">Niciun credit verde aprobat încă. Aprobă un dosar și apoi „Simulează 12 luni”.</p>
        ) : (
          <div className="grid-3">
            <div>
              <h3 className="sub-title">Credite verzi</h3>
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
                Niveluri: {data.byTier.map((t) => `${TIER_OFFICER[t.tier] ?? t.tier} ${t.count}`).join(" · ")}
              </p>
            </div>
            <div>
              <h3 className="sub-title">Pe fonduri</h3>
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
                Monitorizate: {data.monitoring.monitoredCount}, impact confirmat: {data.monitoring.confirmedCount}
              </p>
            </div>
            <div>
              <h3 className="sub-title">Impact total (estimat)</h3>
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
