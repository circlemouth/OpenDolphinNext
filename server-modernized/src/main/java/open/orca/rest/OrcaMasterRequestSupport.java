package open.orca.rest;

import jakarta.ws.rs.core.MultivaluedMap;
import java.util.List;
import java.util.Locale;

final class OrcaMasterRequestSupport {

    private OrcaMasterRequestSupport() {
    }

    static String firstNonBlank(String... candidates) {
        if (candidates == null) {
            return null;
        }
        for (String candidate : candidates) {
            if (candidate != null && !candidate.isBlank()) {
                return candidate;
            }
        }
        return null;
    }

    static String getFirstValue(MultivaluedMap<String, String> params, String... keys) {
        if (params == null) {
            return null;
        }
        for (String key : keys) {
            List<String> values = params.get(key);
            if (values == null || values.isEmpty()) {
                continue;
            }
            String value = values.get(0);
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    static String normalizeEffectiveDate(String value) {
        if (value == null || value.isBlank()) {
            return value;
        }
        String digitsOnly = value.replaceAll("[^0-9]", "");
        return digitsOnly.length() == 8 ? digitsOnly : value;
    }

    static String normalizeDrugSearchMethod(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "prefix", "partial" -> normalized;
            default -> null;
        };
    }

    static boolean shouldIncludeTotalCount(MultivaluedMap<String, String> params) {
        String raw = getFirstValue(params, "includeTotalCount");
        if (raw == null || raw.isBlank()) {
            return false;
        }
        String normalized = raw.trim().toLowerCase(Locale.ROOT);
        return "1".equals(normalized) || "true".equals(normalized) || "yes".equals(normalized);
    }

    static Double parseNullableDouble(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Double.parseDouble(value.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    static String normalizeTensuVersion(String version) {
        if (version == null || version.isBlank()) {
            return null;
        }
        if (version.matches("^\\d{6}$")) {
            return version;
        }
        String digits = version.replaceAll("\\D", "");
        if (digits.length() >= 6) {
            return digits.substring(0, 6);
        }
        return version;
    }

    static String resolveTensuVersion(OrcaMasterFixtureSupport.FixtureEtensuEntry entry) {
        return firstNonBlank(entry.tensuVersion, entry.version, entry.snapshotVersion);
    }
}
