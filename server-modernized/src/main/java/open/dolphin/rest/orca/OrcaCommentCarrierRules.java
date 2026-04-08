package open.dolphin.rest.orca;

import java.util.Map;

final class OrcaCommentCarrierRules {
    private static final String STRUCTURED_COMMENT_CODE_PATTERN = "^(?:83|84|85)\\d+$";

    private static final Map<String, CommentCarrierRule> RULES = Map.of(
            "830", new CommentCarrierRule("Medication_Name", ValueKind.TEXT),
            "842", new CommentCarrierRule("Medication_Number", ValueKind.NUMBER),
            "8501", new CommentCarrierRule("Medication_Number", ValueKind.DATE),
            "8511", new CommentCarrierRule("Medication_Number", ValueKind.TIME),
            "8521", new CommentCarrierRule("Medication_Number", ValueKind.DURATION),
            "831", new CommentCarrierRule("Medication_Number", ValueKind.PROCEDURE_CODE_9));

    private OrcaCommentCarrierRules() {
    }

    static String normalizeCommentCode(String code) {
        String normalized = trimToNull(code);
        if (normalized == null) {
            return null;
        }
        for (String family : RULES.keySet()) {
            if (normalized.startsWith(family)) {
                return normalized;
            }
        }
        return null;
    }

    static boolean isKnownCommentCode(String code) {
        return carrierField(code) != null;
    }

    static boolean isStructuredCommentCode(String code) {
        String normalized = trimToNull(code);
        return normalized != null && normalized.matches(STRUCTURED_COMMENT_CODE_PATTERN);
    }

    static boolean hasUnknownStructuredFamily(String code) {
        return isStructuredCommentCode(code) && !isKnownCommentCode(code);
    }

    static boolean isBacteriaStructuredFamilyAllowed(String code) {
        String family = resolveCommentFamily(code);
        return "830".equals(family) || "842".equals(family);
    }

    static String carrierField(String code) {
        String normalized = trimToNull(code);
        if (normalized == null) {
            return null;
        }
        for (Map.Entry<String, CommentCarrierRule> entry : RULES.entrySet()) {
            if (normalized.startsWith(entry.getKey())) {
                return entry.getValue().carrierField();
            }
        }
        return null;
    }

    static boolean requiresTextValue(String code) {
        CommentCarrierRule rule = rule(code);
        return rule != null && rule.valueKind() == ValueKind.TEXT;
    }

    static boolean requiresNumberValue(String code) {
        CommentCarrierRule rule = rule(code);
        return rule != null && rule.valueKind() == ValueKind.NUMBER;
    }

    static boolean hasSupportedValue(String code, String inputValue) {
        CommentCarrierRule rule = rule(code);
        String normalized = trimToNull(inputValue);
        if (rule == null || normalized == null) {
            return false;
        }
        return switch (rule.valueKind()) {
            case TEXT -> true;
            case NUMBER -> normalized.matches("^[+-]?\\d+(?:\\.\\d+)?$");
            case DATE -> normalized.matches("^\\d{8}$|^\\d{4}-\\d{2}-\\d{2}$");
            case TIME -> normalized.matches("^\\d{2}:\\d{2}(?::\\d{2})?$|^\\d{4}(?:\\d{2})?$");
            case DURATION -> normalized.matches("^\\d+$");
            case PROCEDURE_CODE_9 -> normalized.matches("^\\d{9}$");
        };
    }

    static boolean isSelectionCommentParameterAllowed() {
        return false;
    }

    static boolean isSelectionCommentCarrier(String code) {
        return isKnownCommentCode(code);
    }

    static String resolveCommentFamily(String code) {
        String normalized = trimToNull(code);
        if (normalized == null) {
            return null;
        }
        for (String family : RULES.keySet()) {
            if (normalized.startsWith(family)) {
                return family;
            }
        }
        return null;
    }

    private static CommentCarrierRule rule(String code) {
        String normalized = trimToNull(code);
        if (normalized == null) {
            return null;
        }
        for (Map.Entry<String, CommentCarrierRule> entry : RULES.entrySet()) {
            if (normalized.startsWith(entry.getKey())) {
                return entry.getValue();
            }
        }
        return null;
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private record CommentCarrierRule(String carrierField, ValueKind valueKind) {
    }

    private enum ValueKind {
        TEXT,
        NUMBER,
        DATE,
        TIME,
        DURATION,
        PROCEDURE_CODE_9
    }
}
