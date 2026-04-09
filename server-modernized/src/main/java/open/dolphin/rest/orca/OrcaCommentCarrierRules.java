package open.dolphin.rest.orca;

import java.util.regex.Pattern;

final class OrcaCommentCarrierRules {

    private static final Pattern ORDER_BUNDLE_COMMENT_CODE_PATTERN = Pattern.compile("^(?:008[1-6]|8[1-6]|098|099|98|99).*");
    private static final Pattern BACTERIA_842_PATTERN = Pattern.compile("^842\\d{6}$");
    private static final Pattern BACTERIA_830_PATTERN = Pattern.compile("^830\\d{6}$");
    private static final Pattern STRUCTURED_831_PATTERN = Pattern.compile("^831\\d{6}$");
    private static final Pattern STRUCTURED_85_PATTERN = Pattern.compile("^85(?:01|11|21)\\d{5}$");
    private static final Pattern UNKNOWN_STRUCTURED_PATTERN = Pattern.compile("^(?:83|85)\\d+$");

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
        if (STRUCTURED_831_PATTERN.matcher(normalized).matches()) {
            return "831";
        }
        if (STRUCTURED_85_PATTERN.matcher(normalized).matches()) {
            return "85";
        }
        if (UNKNOWN_STRUCTURED_PATTERN.matcher(normalized).matches()) {
            return "unknown";
        }
        return null;
    }

    static boolean requiresStructuredPrescriptionClaimCommentNote(String code) {
        String family = resolvePrescriptionStructuredCommentFamily(code);
        return "85".equals(family) || "831".equals(family);
    }

    static boolean isUnknownStructuredPrescriptionClaimCommentFamily(String code) {
        return "unknown".equals(resolvePrescriptionStructuredCommentFamily(code));
    }
}
