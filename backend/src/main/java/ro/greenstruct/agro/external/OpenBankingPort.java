package ro.greenstruct.agro.external;

import java.util.Optional;

import ro.greenstruct.agro.external.model.CashflowInfo;

/** Account history aggregated into a monthly cash-flow profile, available with the farmer's consent. */
public interface OpenBankingPort {

    Optional<CashflowInfo> cashflow(String cui);
}
