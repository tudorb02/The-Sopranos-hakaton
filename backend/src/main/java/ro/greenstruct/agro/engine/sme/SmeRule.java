package ro.greenstruct.agro.engine.sme;

import java.math.BigDecimal;

import static ro.greenstruct.agro.engine.Decimals.requirePositive;

/**
 * The SME definition of Recommendation 2003/361/EC (Law 346/2004), from config/funds.json (smeDefinition):
 * fewer than employeesBelow employees and (turnover ≤ maxTurnoverEur or total assets ≤ maxTotalAssetsEur).
 * Partner and linked enterprises are not checked: ANAF does not publish them.
 */
public record SmeRule(int employeesBelow, BigDecimal maxTurnoverEur, BigDecimal maxTotalAssetsEur) {

    public SmeRule {
        if (employeesBelow <= 0) {
            throw new IllegalArgumentException("employeesBelow must be > 0, was " + employeesBelow);
        }
        requirePositive(maxTurnoverEur, "maxTurnoverEur");
        requirePositive(maxTotalAssetsEur, "maxTotalAssetsEur");
    }

    /**
     * turnoverEur and totalAssetsEur are null when the balance sheet does not give them. One financial limit met is
     * enough; the company is NOT_SME only when the head count is too high or both limits are known and exceeded.
     */
    public SmeStatus classify(int employees, BigDecimal turnoverEur, BigDecimal totalAssetsEur) {
        if (employees >= employeesBelow) {
            return SmeStatus.NOT_SME;
        }
        boolean turnoverWithin = turnoverEur != null && turnoverEur.compareTo(maxTurnoverEur) <= 0;
        boolean assetsWithin = totalAssetsEur != null && totalAssetsEur.compareTo(maxTotalAssetsEur) <= 0;
        if (turnoverWithin || assetsWithin) {
            return SmeStatus.SME;
        }
        return turnoverEur != null && totalAssetsEur != null ? SmeStatus.NOT_SME : SmeStatus.UNKNOWN;
    }
}
