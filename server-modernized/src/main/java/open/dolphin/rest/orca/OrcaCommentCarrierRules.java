package open.dolphin.rest.orca;

import java.util.regex.Pattern;

final class OrcaCommentCarrierRules {

    private static final Pattern ORDER_BUNDLE_COMMENT_CODE_PATTERN = Pattern.compile("^(?:008[1-6]|8[1-6]|098|099|98|99).*");
    private static final Pattern BACTERIA_842_PATTERN = Pattern.compile("^842\\d{6}$");
    private static final Pattern BACTERIA_830_PATTERN = Pattern.compile("^830\\d{6}$");
    private static final Pattern STRUCTURED_830_PATTERN = Pattern.compile("^830\\d{6}$");
    private static final Pattern STRUCTURED_842_PATTERN = Pattern.compile("^842\\d{6}$");
    private static final Pattern STRUCTURED_8501_PATTERN = Pattern.compile("^8501\\d{5}$");
    private static final Pattern STRUCTURED_8511_PATTERN = Pattern.compile("^8511\\d{5}$");
    private static final Pattern STRUCTURED_8521_PATTERN = Pattern.compile("^8521\\d{5}$");
    private static final Pattern STRUCTURED_831_PATTERN = Pattern.compile("^831\\d{6}$");
    private static final Pattern UNKNOWN_STRUCTURED_PATTERN = Pattern.compile("^8(?:30|31|42|50|51|52)\\d+$");
    private static final Pattern NUMBER_PATTERN = Pattern.compile("^[+-]?\\d+(?:\\.\\d+)?$");
    private static final Pattern INTEGER_PATTERN = Pattern.compile("^\\d+$");
    private static final Pattern NINE_DIGIT_PATTERN = Pattern.compile("^\\d{9}$");
    private static final Pattern DATE_PATTERN = Pattern.compile("^(\\d{3,4})-(\\d{1,2})-(\\d{1,2})$");
    private static final Pattern MONTH_DAY_PATTERN = Pattern.compile("^(\\d{1,2})-(\\d{1,2})$");

    private OrcaCommentCarrierRules() {
    }

    static boolean isOrderBundleCommentCode(String code) {
        return ORDER_BUNDLE_COMMENT_CODE_PATTERN.matcher(OrcaMedicalClassCatalog.trimToNull(code) == null ? "" : OrcaMedicalClassCatalog.trimToNull(code)).matches();
    }

    static boolean isBacteria842CommentCode(String code) {
        return BACTERIA_842_PATTERN.matcher(OrcaMedicalClassCatalog.trimToNull(code) == null ? "" : OrcaMedicalClassCatalog.trimToNull(code)).matches();
    }

    static boolean isBacteria830CommentCode(String code) {
        return BACTERIA_830_PATTERN.matcher(OrcaMedicalClassCatalog.trimToNull(code) == null ? "" : OrcaMedicalClassCatalog.trimToNull(code)).matches();
    }

    static boolean isStrictBacteriaStructuredCommentCode(String code) {
        return isBacteria830CommentCode(code) || isBacteria842CommentCode(code);
    }

    static String resolvePrescriptionStructuredCommentFamily(String code) {
        String normalized = OrcaMedicalClassCatalog.trimToNull(code);
        if (normalized == null) {
            return null;
        }
        if (STRUCTURED_830_PATTERN.matcher(normalized).matches()) {
            return "830";
        }
        if (STRUCTURED_842_PATTERN.matcher(normalized).matches()) {
            return "842";
        }
        if (STRUCTURED_8501_PATTERN.matcher(normalized).matches()) {
            return "8501";
        }
        if (STRUCTURED_8511_PATTERN.matcher(normalized).matches()) {
            return "8511";
        }
        if (STRUCTURED_8521_PATTERN.matcher(normalized).matches()) {
            return "8521";
        }
        if (STRUCTURED_831_PATTERN.matcher(normalized).matches()) {
            return "831";
        }
        if (UNKNOWN_STRUCTURED_PATTERN.matcher(normalized).matches()) {
            return "unknown";
        }
        return null;
    }

    static boolean requiresStructuredPrescriptionClaimCommentNote(String code) {
        String family = resolvePrescriptionStructuredCommentFamily(code);
        return family != null && !"unknown".equals(family);
    }

    static boolean isUnknownStructuredPrescriptionClaimCommentFamily(String code) {
        return "unknown".equals(resolvePrescriptionStructuredCommentFamily(code));
    }

    static String normalizeStructuredPrescriptionClaimCommentNote(String code, String note) {
        String family = resolvePrescriptionStructuredCommentFamily(code);
        String normalizedNote = OrcaMedicalClassCatalog.trimToNull(note);
        if (family == null || "unknown".equals(family)) {
            return normalizedNote;
        }
        if (normalizedNote == null) {
            return null;
        }
        if ("830".equals(family)) {
            String collapsed = normalizedNote.replaceAll("\\s+", " ");
            return collapsed.length() <= 50 ? collapsed : null;
        }
        if ("842".equals(family)) {
            return NUMBER_PATTERN.matcher(normalizedNote).matches() ? normalizedNote : null;
        }
        if ("8501".equals(family)) {
            return normalizeDateValue(normalizedNote);
        }
        if ("8511".equals(family)) {
            return normalizeMonthDayValue(normalizedNote);
        }
        if ("8521".equals(family)) {
            return INTEGER_PATTERN.matcher(normalizedNote).matches() ? normalizedNote : null;
        }
        if ("831".equals(family)) {
            return NINE_DIGIT_PATTERN.matcher(normalizedNote).matches() ? normalizedNote : null;
        }
        return null;
    }

    static String validateStructuredPrescriptionClaimCommentNote(String code, String note) {
        String family = resolvePrescriptionStructuredCommentFamily(code);
        if (family == null || "unknown".equals(family)) {
            return null;
        }
        if (normalizeStructuredPrescriptionClaimCommentNote(code, note) != null) {
            return null;
        }
        return switch (family) {
            case "830" -> "structured claim comment note must be 50 characters or less";
            case "842" -> "structured claim comment note must be numeric";
            case "8501" -> "structured claim comment note must be YYY-MM-DD or YYYY-MM-DD";
            case "8511" -> "structured claim comment note must be MM-DD";
            case "8521" -> "structured claim comment note must be an integer";
            case "831" -> "structured claim comment note must be 9 digits";
            default -> "structured claim comment note format is invalid";
        };
    }

    static boolean isSelectionCommentParameterAllowed() {
        return false;
    }

    private static String normalizeDateValue(String value) {
        String normalized = value.replace('/', '-').replace('.', '-');
        java.util.regex.Matcher matcher = DATE_PATTERN.matcher(normalized);
        if (!matcher.matches()) {
            return null;
        }
        int month = Integer.parseInt(matcher.group(2));
        int day = Integer.parseInt(matcher.group(3));
        if (month < 1 || month > 12 || day < 1 || day > 31) {
            return null;
        }
        return matcher.group(1) + "-" + pad2(month) + "-" + pad2(day);
    }

    private static String normalizeMonthDayValue(String value) {
        String normalized = value.replace('/', '-').replace('.', '-');
        java.util.regex.Matcher matcher = MONTH_DAY_PATTERN.matcher(normalized);
        if (!matcher.matches()) {
            return null;
        }
        int month = Integer.parseInt(matcher.group(1));
        int day = Integer.parseInt(matcher.group(2));
        if (month < 1 || month > 12 || day < 1 || day > 31) {
            return null;
        }
        return pad2(month) + "-" + pad2(day);
    }

    private static String pad2(int value) {
        return value < 10 ? "0" + value : Integer.toString(value);
    }
}
