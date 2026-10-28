package ro.greenstruct.agro.tools;

/** Units of a calc, as enumerated in contracts/schemas/event.json (calcResult.unit), with their Romanian display. */
public enum Unit {
    EUR(0, " EUR"),
    EUR_PER_MONTH(2, " EUR/lună"),
    EUR_PER_YEAR(0, " EUR/an"),
    EUR_PER_L(2, " EUR/l"),
    EUR_PER_M3(2, " EUR/m³"),
    EUR_PER_KWH(2, " EUR/kWh"),
    EUR_PER_HA(0, " EUR/ha"),
    PCT(2, "%"),
    PP(2, " pp"),
    RATIO(2, ""),
    M3(0, " m³"),
    M3_PER_YEAR(0, " m³/an"),
    M3_PER_HA(0, " m³/ha"),
    KWH(0, " kWh"),
    KWH_PER_YEAR(0, " kWh/an"),
    KWH_PER_M3(2, " kWh/m³"),
    KWH_PER_KWP(0, " kWh/kWp"),
    L(0, " l"),
    L_PER_YEAR(0, " l/an"),
    L_PER_HA(0, " l/ha"),
    KG_N_PER_YEAR(0, " kg N/an"),
    KG_N_PER_HA(0, " kg N/ha"),
    T_CO2(1, " t CO₂"),
    T_CO2_PER_YEAR(1, " t CO₂/an"),
    KG_CO2_PER_L(2, " kg CO₂/l"),
    KG_CO2_PER_KWH(2, " kg CO₂/kWh"),
    HA(0, " ha"),
    HP(0, " CP"),
    HP_PER_HA(2, " CP/ha"),
    KW(0, " kW"),
    KWP(0, " kWp"),
    MONTHS(1, " luni"),
    YEARS(0, " ani"),
    COUNT(0, ""),
    POINTS(0, " puncte");

    private final int displayDecimals;
    private final String suffix;

    Unit(int displayDecimals, String suffix) {
        this.displayDecimals = displayDecimals;
        this.suffix = suffix;
    }

    public int displayDecimals() {
        return displayDecimals;
    }

    public String suffix() {
        return suffix;
    }
}
