package open.dolphin.rest.orca;

import java.util.Locale;
import open.dolphin.infomodel.IInfoModel;

final class OrcaOrderBundleRowRoleSupport {

    static final String ROW_ROLE_MAIN = "main";
    static final String ROW_ROLE_AUXILIARY = "auxiliary";
    static final String ROW_ROLE_COMMENT = "comment";
    static final String ROW_ROLE_BODY_PART = "bodyPart";

    private OrcaOrderBundleRowRoleSupport() {
    }

    static String normalizeRowRole(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return switch (value.trim().toLowerCase(Locale.ROOT)) {
            case ROW_ROLE_MAIN -> ROW_ROLE_MAIN;
            case ROW_ROLE_AUXILIARY, "material" -> ROW_ROLE_AUXILIARY;
            case ROW_ROLE_COMMENT -> ROW_ROLE_COMMENT;
            case "bodypart", "body_part", ROW_ROLE_BODY_PART -> ROW_ROLE_BODY_PART;
            default -> null;
        };
    }

    static boolean isBodyPartCode(String code) {
        String normalized = OrcaOrderBundleRequestSupport.trimToNull(code);
        return normalized != null && normalized.startsWith("002");
    }

    static boolean isCommentCode(String code) {
        return OrcaCommentCarrierRules.isKnownCommentCode(code);
    }

    static boolean isNineDigitCode(String code) {
        String normalized = OrcaOrderBundleRequestSupport.trimToNull(code);
        return normalized != null && normalized.matches("^\\d{9}$");
    }

    static boolean isUsageCode(String code) {
        String normalized = OrcaOrderBundleRequestSupport.trimToNull(code);
        return normalized != null && normalized.matches("^\\d+$");
    }

    static boolean isSendableMedicalModV2Code(String code) {
        return isBodyPartCode(code) || isCommentCode(code) || isNineDigitCode(code);
    }

    static boolean isOtherOrderCode(String code) {
        return OrcaOrderBundleRequestSupport.isValidOtherOrderCode(code);
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
        if (isCommentCode(normalizedCode)) {
            return ROW_ROLE_COMMENT;
        }
        if (shouldTreatAsLegacyAuxiliary(entity, normalizedCode)) {
            return ROW_ROLE_AUXILIARY;
        }
        return ROW_ROLE_MAIN;
    }

    static boolean isCodeCompatibleWithRole(String entity, String rowRole, String code) {
        String normalizedRole = normalizeRowRole(rowRole);
        String normalizedCode = OrcaOrderBundleRequestSupport.trimToNull(code);
        if (normalizedRole == null || normalizedCode == null) {
            return false;
        }
        return switch (normalizedRole) {
            case ROW_ROLE_BODY_PART -> OrcaOrderBundleRequestSupport.supportsBodyPartField(entity) && isBodyPartCode(normalizedCode);
            case ROW_ROLE_COMMENT -> isCommentCode(normalizedCode);
            case ROW_ROLE_AUXILIARY -> isSendableAuxiliaryCode(entity, normalizedCode);
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
                case ROW_ROLE_MAIN, ROW_ROLE_AUXILIARY -> isNineDigitCode(normalizedCode);
                default -> false;
            };
        }
        return isCodeCompatibleWithRole(entity, normalizedRole, normalizedCode);
    }

    static boolean isSendableAuxiliaryCode(String entity, String code) {
        String normalizedEntity = OrcaOrderBundleRequestSupport.normalizeEntityStorage(entity);
        if (normalizedEntity == null) {
            return false;
        }
        return switch (normalizedEntity) {
            case "treatmentOrder",
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
                    "testOrder",
                    open.dolphin.infomodel.IInfoModel.ENTITY_RADIOLOGY_ORDER,
                    open.dolphin.infomodel.IInfoModel.ENTITY_BASE_CHARGE_ORDER,
                    open.dolphin.infomodel.IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER -> isNineDigitCode(code);
            case open.dolphin.infomodel.IInfoModel.ENTITY_MED_ORDER,
                    open.dolphin.infomodel.IInfoModel.ENTITY_INJECTION_ORDER -> !isBodyPartCode(code) && !isCommentCode(code);
            case open.dolphin.infomodel.IInfoModel.ENTITY_PHYSIOLOGY_ORDER,
                    open.dolphin.infomodel.IInfoModel.ENTITY_BACTERIA_ORDER,
                    open.dolphin.infomodel.IInfoModel.ENTITY_OTHER_ORDER -> !isBodyPartCode(code) && !isCommentCode(code);
            default -> !isBodyPartCode(code) && !isCommentCode(code);
        };
    }

    private static boolean shouldTreatAsLegacyAuxiliary(String entity, String code) {
        return false;
    }
}
