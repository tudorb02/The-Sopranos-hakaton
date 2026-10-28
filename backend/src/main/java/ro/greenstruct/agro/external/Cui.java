package ro.greenstruct.agro.external;

import java.util.Locale;

public final class Cui {

    private Cui() {
    }

    /** "ro 90000101", "RO90000101" and "90000101" all normalise to "90000101". */
    public static String normalize(String cui) {
        if (cui == null) {
            return "";
        }
        String compact = cui.replaceAll("\\s", "").toUpperCase(Locale.ROOT);
        return compact.startsWith("RO") ? compact.substring(2) : compact;
    }
}
