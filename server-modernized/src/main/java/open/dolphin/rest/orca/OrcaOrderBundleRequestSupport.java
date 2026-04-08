package open.dolphin.rest.orca;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.Date;
import java.util.Set;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.ModelUtils;

final class OrcaOrderBundleRequestSupport {
    static final String ROW_ROLE_MAIN = OrcaOrderBundleRowRoleSupport.ROW_ROLE_MAIN;
    static final String ROW_ROLE_MATERIAL = OrcaOrderBundleRowRoleSupport.ROW_ROLE_AUXILIARY;
    static final String ROW_ROLE_COMMENT = OrcaOrderBundleRowRoleSupport.ROW_ROLE_COMMENT;
    static final String ROW_ROLE_BODY_PART = OrcaOrderBundleRowRoleSupport.ROW_ROLE_BODY_PART;

    private static final Set<String> ORDER_BUNDLE_ENTITIES = Set.of(
            IInfoModel.ENTITY_MED_ORDER,
            IInfoModel.ENTITY_OTHER_ORDER,
            "treatmentOrder",
            IInfoModel.ENTITY_SURGERY_ORDER,
            IInfoModel.ENTITY_RADIOLOGY_ORDER,
            "testOrder",
            IInfoModel.ENTITY_PHYSIOLOGY_ORDER,
            IInfoModel.ENTITY_BACTERIA_ORDER,
            IInfoModel.ENTITY_INJECTION_ORDER,
            IInfoModel.ENTITY_BASE_CHARGE_ORDER,
            IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER);

    private OrcaOrderBundleRequestSupport() {
    }

    static String normalizeEntityQuery(String entity) {
        return canonicalizeEntity(entity);
    }

    static String normalizeEntityResponse(String entity) {
        return canonicalizeEntity(entity);
    }

    static String normalizeEntityStorage(String entity) {
        return canonicalizeEntity(entity);
    }

    static boolean entitiesMatch(String requestedEntity, String moduleEntity) {
        if (requestedEntity == null || requestedEntity.isBlank()) {
            return true;
        }
        if (moduleEntity == null || moduleEntity.isBlank()) {
            return false;
        }
        String requested = canonicalizeEntity(requestedEntity);
        String actual = canonicalizeEntity(moduleEntity);
        if (requested == null || actual == null) {
            return false;
        }
        return requested.equals(actual);
    }

    static String normalizeOrcaDateOrToday(String input) {
        if (input == null || input.isBlank()) {
            return LocalDate.now().toString().replace("-", "");
        }
        String digits = input.replaceAll("[^0-9]", "");
        if (digits.length() == 8) {
            return digits;
        }
        return LocalDate.now().toString().replace("-", "");
    }

    static String toIsoDate(String yyyymmdd) {
        if (yyyymmdd == null || yyyymmdd.length() != 8) {
            return LocalDate.now().toString();
        }
        return yyyymmdd.substring(0, 4) + "-" + yyyymmdd.substring(4, 6) + "-" + yyyymmdd.substring(6, 8);
    }

    static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    static String trimNumeric(String value) {
        String trimmed = trimToNull(value);
        if (trimmed == null) {
            return null;
        }
        if (trimmed.endsWith(".0")) {
            return trimmed.substring(0, trimmed.length() - 2);
        }
        return trimmed;
    }

    static Date parseDate(String input, Date fallback) {
        if (input == null || input.isBlank()) {
            return fallback;
        }
        Date parsed = ModelUtils.getDateAsObject(input);
        return parsed != null ? parsed : fallback;
    }

    static Date parseStrictIsoDate(String input) {
        if (input == null) {
            return null;
        }
        try {
            LocalDate date = LocalDate.parse(input.trim());
            return Date.from(date.atStartOfDay(ZoneId.systemDefault()).toInstant());
        } catch (DateTimeParseException ex) {
            return null;
        }
    }

    static String formatDate(Date date) {
        if (date == null) {
            return null;
        }
        return ModelUtils.getDateAsString(date);
    }

    static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    static boolean isSendableUsageCode(String code) {
        return trimToNull(code) != null;
    }

    static boolean isSendableInjectionAdminCode(String code) {
        String normalized = trimToNull(code);
        return normalized != null && normalized.matches("^\\d{6}$");
    }

    static boolean isSupportedOperation(String operation) {
        return "create".equals(operation) || "update".equals(operation) || "delete".equals(operation);
    }

    static boolean isValidEntity(String entity) {
        String normalized = canonicalizeEntity(entity);
        if (normalized == null) {
            return false;
        }
        return ORDER_BUNDLE_ENTITIES.contains(normalized);
    }

    static boolean isPhysiologyOrder(String entity) {
        return IInfoModel.ENTITY_PHYSIOLOGY_ORDER.equals(canonicalizeEntity(entity));
    }

    static boolean isCompatibleClassCode(String entity, String classCode) {
        String normalizedEntity = canonicalizeEntity(entity);
        String normalizedClassCode = trimToNull(classCode);
        if (normalizedEntity == null || normalizedClassCode == null) {
            return true;
        }
        if (IInfoModel.ENTITY_OTHER_ORDER.equals(normalizedEntity)) {
            return isValidOtherOrderClassCode(normalizedClassCode);
        }
        if (!OrcaSendabilityPolicy.isSendableEntity(normalizedEntity)) {
            return true;
        }
        if (OrcaMedicalClassCatalog.isBlockedClassCode(normalizedEntity, normalizedClassCode)) {
            return false;
        }
        return OrcaMedicalClassCatalog.isAllowedClassCode(normalizedEntity, normalizedClassCode);
    }

    static boolean isValidOtherOrderCode(String code) {
        String normalized = trimToNull(code);
        return normalized != null && normalized.matches("^(?:8\\d{8}|18\\d{7})$");
    }

    static boolean isValidOtherOrderClassCode(String classCode) {
        String normalized = trimToNull(classCode);
        return normalized != null && normalized.matches("^\\d{3}$")
                && Integer.parseInt(normalized) >= 800
                && Integer.parseInt(normalized) <= 890;
    }

    static boolean supportsBodyPartField(String entity) {
        String normalizedEntity = canonicalizeEntity(entity);
        return normalizedEntity != null && OrcaSendabilityPolicy.supportsBodyPartField(normalizedEntity);
    }

    static boolean supportsBodyPartField(String entity, String classCode) {
        String normalizedEntity = canonicalizeEntity(entity);
        return normalizedEntity != null && OrcaSendabilityPolicy.supportsBodyPartField(normalizedEntity, classCode);
    }

    static String normalizeRowRole(String rowRole) {
        return OrcaOrderBundleRowRoleSupport.normalizeRowRole(rowRole);
    }

    static boolean isBodyPartCode(String code) {
        return OrcaOrderBundleRowRoleSupport.isBodyPartCode(code);
    }

    static boolean isCommentCode(String code) {
        return OrcaOrderBundleRowRoleSupport.isCommentCode(code);
    }

    static boolean isNineDigitCode(String code) {
        return OrcaOrderBundleRowRoleSupport.isNineDigitCode(code);
    }

    static boolean isSendableCodeForRowRole(String rowRole, String code) {
        return OrcaOrderBundleRowRoleSupport.isSendableCodeForRowRole(null, rowRole, code);
    }

    static boolean isValidCodeForRowRole(String entity, String rowRole, String code) {
        return OrcaOrderBundleRowRoleSupport.isCodeCompatibleWithRole(entity, rowRole, code);
    }

    static String resolveRowRole(String entity, String rowRole, String code) {
        return OrcaOrderBundleRowRoleSupport.resolveRowRole(entity, rowRole, code);
    }

    static boolean requiresSendableMainRow(String canonicalEntity) {
        return OrcaSendabilityPolicy.requiresSendableMainRow(canonicalEntity);
    }

    static boolean requiresSendableMainRow(String canonicalEntity, String classCode) {
        return OrcaSendabilityPolicy.requiresSendableMainRow(canonicalEntity, classCode);
    }

    static String resolveCanonicalClassName(String entity, String classCode, String className) {
        String normalizedEntity = canonicalizeEntity(entity);
        String exactClassName = OrcaMedicalClassCatalog.resolveExactClassName(normalizedEntity, classCode);
        if (exactClassName != null) {
            return exactClassName;
        }
        return trimToNull(className);
    }

    private static String canonicalizeEntity(String entity) {
        if (entity == null || entity.isBlank()) {
            return null;
        }
        String normalized = entity.trim();
        if ("laboTest".equals(normalized) || IInfoModel.ENTITY_LABO_TEST.equals(normalized)) {
            return "testOrder";
        }
        if (IInfoModel.ENTITY_GENERAL_ORDER.equals(normalized) || "generalOrder".equals(normalized)
                || IInfoModel.ENTITY_TREATMENT.equals(normalized)) {
            return "treatmentOrder";
        }
        if ("instructionChargeOrder".equals(normalized)) {
            return IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER;
        }
        return normalized;
    }

}
