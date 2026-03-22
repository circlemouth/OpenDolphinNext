package open.orca.rest;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;

final class OrcaLegacyRequestSupport {

    private OrcaLegacyRequestSupport() {
    }

    static String[] splitParamSafely(String param) {
        return param != null ? param.split(",") : new String[0];
    }

    static String pickParam(String[] params, int index) {
        if (params == null || index < 0 || index >= params.length) {
            return null;
        }
        return params[index];
    }

    static String defaultNow(String candidate) {
        if (candidate != null && !candidate.isBlank()) {
            return candidate;
        }
        return new SimpleDateFormat("yyyyMMdd").format(new Date());
    }

    static String normalizeOrcaDate(String candidate) {
        if (candidate == null) {
            return null;
        }
        String trimmed = candidate.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        if (trimmed.length() == 10 && trimmed.charAt(4) == '-' && trimmed.charAt(7) == '-') {
            return trimmed.replace("-", "");
        }
        return trimmed;
    }

    static boolean parseBooleanOrDefault(String value, boolean defaultValue) {
        if (value == null || value.isBlank()) {
            return defaultValue;
        }
        return Boolean.parseBoolean(value);
    }

    static String resolveEffectiveDate(String visitDateParam) {
        String candidate = visitDateParam != null ? visitDateParam.trim() : "";
        if (!candidate.isEmpty()) {
            String digits = candidate.replaceAll("[^0-9]", "");
            if (digits.length() >= 8) {
                return digits.substring(0, 8);
            }
        }
        SimpleDateFormat sdf = new SimpleDateFormat("yyyyMMdd");
        return sdf.format(new Date());
    }

    static String toDolphinDate(String orcaDate) {
        if (orcaDate == null || orcaDate.isEmpty()) {
            return null;
        }
        try {
            SimpleDateFormat sdf = new SimpleDateFormat("yyyyMMdd");
            Date orca = sdf.parse(orcaDate);
            sdf.applyPattern("yyyy-MM-dd");
            return sdf.format(orca);
        } catch (ParseException ex) {
            return null;
        }
    }
}
