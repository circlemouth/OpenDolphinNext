package open.dolphin.rest.orca;

import java.util.Locale;
import java.util.regex.Pattern;
import open.dolphin.infomodel.IInfoModel;

final class OrcaOrderBundleRowRoleSupport {

    static final String ROW_ROLE_MAIN = "main";
    static final String ROW_ROLE_MATERIAL = "material";
    static final String ROW_ROLE_AUXILIARY = "auxiliary";
    static final String ROW_ROLE_COMMENT = "comment";
    static final String ROW_ROLE_BODY_PART = "bodyPart";

    private static final Pattern BODY_PART_CODE_PATTERN = Pattern.compile("^002\\d+$");
    private static final Pattern NINE_DIGIT_CODE_PATTERN = Pattern.compile("^\\d{9}$");
    private static final Pattern DIGITS_ONLY_PATTERN = Pattern.compile("^\\d+$");
    private static final Pattern OTHER_ORDER_RESERVED_COMMENT_CODE_PATTERN = Pattern.compile("^(?:008[1-6]|098|099|98|99).*");

    private OrcaOrderBundleRowRoleSupport() {
    }

    static String normalizeRowRole(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return switch (value.trim().toLowerCase(Locale.ROOT)) {
            case ROW_ROLE_MAIN -> ROW_ROLE_MAIN;
            case ROW_ROLE_AUXILIARY, ROW_ROLE_MATERIAL -> ROW_ROLE_MATERIAL;
            case ROW_ROLE_COMMENT -> ROW_ROLE_COMMENT;
            case "bodypart", "body_part", ROW_ROLE_BODY_PART -> ROW_ROLE_BODY_PART;
            default -> null;
        };
    }

    static boolean isBodyPartCode(String code) {
        String normalized = OrcaOrderBundleRequestSupport.trimToNull(code);
        return normalized != null && BODY_PART_CODE_PATTERN.matcher(normalized).matches();
    }

    static boolean isCommentCode(String code) {
        String normalized = OrcaOrderBundleRequestSupport.trimToNull(code);
        return normalized != null && OrcaCommentCarrierRules.isOrderBundleCommentCode(normalized);
    }

    static boolean isNineDigitCode(String code) {
        String normalized = OrcaOrderBundleRequestSupport.trimToNull(code);
        return normalized != null && NINE_DIGIT_CODE_PATTERN.matcher(normalized).matches();
    }

    static boolean isUsageCode(String code) {
        String normalized = OrcaOrderBundleRequestSupport.trimToNull(code);
        return normalized != null && DIGITS_ONLY_PATTERN.matcher(normalized).matches();
    }

    static boolean isSendableMedicalModV2Code(String code) {
        return isBodyPartCode(code) || isCommentCode(code) || isNineDigitCode(code) || isUsageCode(code);
    }

    static boolean isOtherOrderCode(String code) {
        return OrcaOrderBundleRequestSupport.isValidOtherOrderCode(code);
    }

    static boolean isOtherOrderLocalCode(String code) {
        String normalized = OrcaOrderBundleRequestSupport.trimToNull(code);
        return normalized != null
                && !isBodyPartCode(normalized)
                && !OTHER_ORDER_RESERVED_COMMENT_CODE_PATTERN.matcher(normalized).matches();
    }

    static String resolveRowRole(String entity, String explicitRowRole, String code) {
        String normalizedRole = normalizeRowRole(explicitRowRole);
        String normalizedCode = OrcaOrderBundleRequestSupport.trimToNull(code);
        if (normalizedRole != null
                && ((entity == null || entity.isBlank())
                        ? isSendableCodeForRowRole(null, normalizedRole, normalizedCode)
                        : isCodeCompatibleWithRole(entity, normalizedRole, normalizedCode))) {
            return normalizedRole;
        }
        if (isBodyPartCode(normalizedCode)) {
            return ROW_ROLE_BODY_PART;
        }
        if (isOtherOrderEntity(entity)) {
            return ROW_ROLE_MAIN;
        }
        if (isCommentCode(normalizedCode)) {
            return ROW_ROLE_COMMENT;
        }
        if (shouldTreatAsMaterialItem(entity, normalizedCode)) {
            return ROW_ROLE_MATERIAL;
        }
        return ROW_ROLE_MAIN;
    }

    static boolean isCodeCompatibleWithRole(String entity, String rowRole, String code) {
        String normalizedRole = normalizeRowRole(rowRole);
        String normalizedCode = OrcaOrderBundleRequestSupport.trimToNull(code);
        if (normalizedRole == null || normalizedCode == null) {
            return false;
        }
        if (isOtherOrderEntity(entity)) {
            return switch (normalizedRole) {
                case ROW_ROLE_MAIN, ROW_ROLE_COMMENT -> isOtherOrderLocalCode(normalizedCode);
                default -> false;
            };
        }
        return switch (normalizedRole) {
            case ROW_ROLE_BODY_PART -> OrcaOrderBundleRequestSupport.supportsBodyPartField(entity) && isBodyPartCode(normalizedCode);
            case ROW_ROLE_COMMENT -> isCommentCode(normalizedCode);
            case ROW_ROLE_MATERIAL -> isSendableMaterialCode(entity, normalizedCode);
            case ROW_ROLE_MAIN -> isSendableMainCode(entity, normalizedCode);
            default -> false;
        };
    }

    static boolean isSendableCodeForRowRole(String entity, String rowRole, String code) {
        String normalizedRole = normalizeRowRole(rowRole);
        String normalizedCode = OrcaOrderBundleRequestSupport.trimToNull(code);
        if (normalizedRole == null || normalizedCode == null) {
            return false;
        }
        if (entity == null || entity.isBlank()) {
            return switch (normalizedRole) {
                case ROW_ROLE_BODY_PART -> isBodyPartCode(normalizedCode);
                case ROW_ROLE_COMMENT -> isCommentCode(normalizedCode);
                case ROW_ROLE_MAIN, ROW_ROLE_MATERIAL -> isNineDigitCode(normalizedCode);
                default -> false;
            };
        }
        return isCodeCompatibleWithRole(entity, normalizedRole, normalizedCode);
    }

    static boolean isSendableMaterialCode(String entity, String code) {
        String normalizedEntity = OrcaOrderBundleRequestSupport.normalizeEntityStorage(entity);
        if (normalizedEntity == null) {
            return false;
        }
        return switch (normalizedEntity) {
            case "treatmentOrder",
                    IInfoModel.ENTITY_SURGERY_ORDER,
                    IInfoModel.ENTITY_RADIOLOGY_ORDER,
                    IInfoModel.ENTITY_MED_ORDER,
                    IInfoModel.ENTITY_INJECTION_ORDER -> isNineDigitCode(code);
            default -> false;
        };
    }

    static boolean isSendableMainCode(String entity, String code) {
        String normalizedEntity = OrcaOrderBundleRequestSupport.normalizeEntityStorage(entity);
        if (normalizedEntity == null) {
            return false;
        }
        return switch (normalizedEntity) {
            case "treatmentOrder",
                    IInfoModel.ENTITY_SURGERY_ORDER,
                    IInfoModel.ENTITY_RADIOLOGY_ORDER,
                    "testOrder",
                    IInfoModel.ENTITY_PHYSIOLOGY_ORDER,
                    IInfoModel.ENTITY_BACTERIA_ORDER -> isNineDigitCode(code);
            case IInfoModel.ENTITY_OTHER_ORDER -> isOtherOrderLocalCode(code);
            case IInfoModel.ENTITY_BASE_CHARGE_ORDER, IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER -> isNineDigitCode(code);
            case IInfoModel.ENTITY_MED_ORDER, IInfoModel.ENTITY_INJECTION_ORDER -> !isBodyPartCode(code) && !isCommentCode(code);
            default -> !isBodyPartCode(code) && !isCommentCode(code);
        };
    }

    private static boolean shouldTreatAsMaterialItem(String entity, String code) {
        String normalizedCode = OrcaOrderBundleRequestSupport.trimToNull(code);
        if (normalizedCode == null || !OrcaMedicalClassCatalog.isAuxiliaryMaterialCode(normalizedCode)) {
            return false;
        }
        String normalizedEntity = OrcaOrderBundleRequestSupport.normalizeEntityResponse(entity);
        return "treatmentOrder".equals(normalizedEntity)
                || IInfoModel.ENTITY_SURGERY_ORDER.equals(normalizedEntity)
                || IInfoModel.ENTITY_INJECTION_ORDER.equals(normalizedEntity);
    }

    private static boolean isOtherOrderEntity(String entity) {
        return IInfoModel.ENTITY_OTHER_ORDER.equals(OrcaOrderBundleRequestSupport.normalizeEntityResponse(entity));
    }
}
