package open.dolphin.rest.orca;

import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import open.dolphin.infomodel.IInfoModel;

final class OrcaMedicalClassCatalog {

    static final String RADIOLOGY_LABEL = "画像診断";
    private static final String LEGACY_RADIOLOGY_LABEL = "\u653e\u5c04\u7dda";
    static final String BASE_CHARGE_LABEL = "基本診療料";
    static final String INSTRUCTION_CHARGE_LABEL = "医学管理等";

    private static final Pattern AUXILIARY_MATERIAL_CODE_PATTERN = Pattern.compile("^7\\d{8}$");

    private static final Set<String> MED_CLASS_CODES = Set.of("211", "212", "221", "222", "231", "232");
    private static final Set<String> INJECTION_CLASS_CODES = Set.of("310", "311", "312", "320", "321", "330", "331", "334", "340", "350");
    private static final Set<String> TREATMENT_CLASS_CODES = Set.of("400", "401", "402", "403", "409");
    private static final Set<String> SURGERY_CLASS_CODES = Set.of("500", "501", "502", "510");
    private static final Set<String> TEST_CLASS_CODES = Set.of("600", "601", "602", "603", "610");
    private static final Set<String> REJECTED_TEST_CLASS_CODES = Set.of("640", "643");
    private static final Set<String> RADIOLOGY_CLASS_CODES = Set.of("700", "701", "702", "703", "704", "731", "732");
    private static final Set<String> BASE_CHARGE_CLASS_CODES = Set.of("110", "114", "120", "124");
    private static final Set<String> INSTRUCTION_CHARGE_CLASS_CODES = Set.of("130", "132", "133", "140", "141", "142", "143", "148", "149");

    private static final Map<String, String> ENTITY_ALIASES = buildEntityAliases();

    private static final Map<String, EntityContract> ENTITY_CONTRACTS = Map.ofEntries(
            Map.entry(IInfoModel.ENTITY_MED_ORDER, new EntityContract("処方", new ClassMeta("212", "処方"), MED_CLASS_CODES, Set.of(), true, false, false)),
            Map.entry(IInfoModel.ENTITY_INJECTION_ORDER, new EntityContract("注射", new ClassMeta("310", "注射"), INJECTION_CLASS_CODES, Set.of(), true, false, false)),
            Map.entry(IInfoModel.ENTITY_TREATMENT, new EntityContract("処置", new ClassMeta("400", "処置"), TREATMENT_CLASS_CODES, Set.of(), true, false, false)),
            Map.entry(IInfoModel.ENTITY_SURGERY_ORDER, new EntityContract("手術", new ClassMeta("500", "手術"), SURGERY_CLASS_CODES, Set.of(), true, false, false)),
            Map.entry(IInfoModel.ENTITY_OTHER_ORDER, new EntityContract("その他", null, Set.of(), Set.of(), false, true, false)),
            Map.entry("testOrder", new EntityContract("検査", new ClassMeta("600", "検査"), TEST_CLASS_CODES, Set.of(), true, false, false)),
            Map.entry(IInfoModel.ENTITY_PHYSIOLOGY_ORDER, new EntityContract("生理検査", new ClassMeta("600", "検査"), Set.of("600"), Set.of(), false, false, true)),
            Map.entry(IInfoModel.ENTITY_BACTERIA_ORDER, new EntityContract("細菌検査", new ClassMeta("600", "検査"), Set.of("600"), Set.of(), false, true, false)),
            Map.entry(IInfoModel.ENTITY_RADIOLOGY_ORDER, new EntityContract(RADIOLOGY_LABEL, new ClassMeta("700", RADIOLOGY_LABEL), RADIOLOGY_CLASS_CODES, Set.of("700"), true, false, false)),
            Map.entry(IInfoModel.ENTITY_BASE_CHARGE_ORDER, new EntityContract("基本料", new ClassMeta("110", BASE_CHARGE_LABEL), BASE_CHARGE_CLASS_CODES, Set.of(), true, false, false)),
            Map.entry(IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER, new EntityContract("指導料", new ClassMeta("130", INSTRUCTION_CHARGE_LABEL), INSTRUCTION_CHARGE_CLASS_CODES, Set.of(), true, false, false)));

    private OrcaMedicalClassCatalog() {
    }

    static String normalizeEntity(String entity) {
        String normalized = trimToNull(entity);
        if (normalized == null) {
            return null;
        }
        return ENTITY_ALIASES.get(normalized);
    }

    static boolean isValidEntity(String entity) {
        return normalizeEntity(entity) != null;
    }

    static boolean isSendableEntity(String entity) {
        EntityContract contract = resolveContract(entity);
        return contract != null && contract.sendable();
    }

    static boolean isLocalOnlyEntity(String entity) {
        EntityContract contract = resolveContract(entity);
        return contract != null && contract.localOnly();
    }

    static boolean isImportOnlyEntity(String entity) {
        EntityContract contract = resolveContract(entity);
        return contract != null && contract.importOnly();
    }

    static boolean isCompatibleClassCode(String entity, String classCode) {
        EntityContract contract = resolveContract(entity);
        String normalizedClassCode = trimToNull(classCode);
        if (contract == null) {
            return false;
        }
        if (normalizedClassCode == null) {
            return true;
        }
        return !contract.allowedClassCodes().isEmpty() && contract.allowedClassCodes().contains(normalizedClassCode);
    }

    static boolean isAllowedClassCode(String entity, String classCode) {
        String normalizedClassCode = trimToNull(classCode);
        return normalizedClassCode != null && isCompatibleClassCode(entity, normalizedClassCode);
    }

    static boolean isExactTestOrderClassCode(String classCode) {
        String normalized = trimToNull(classCode);
        return normalized != null && TEST_CLASS_CODES.contains(normalized);
    }

    static boolean isRejectedTestOrderClassCode(String classCode) {
        String normalized = trimToNull(classCode);
        return normalized != null && REJECTED_TEST_CLASS_CODES.contains(normalized);
    }

    static boolean isMedOrderUsageBlocked(String entity) {
        return IInfoModel.ENTITY_MED_ORDER.equals(normalizeEntity(entity));
    }

    static boolean supportsBodyPartField(String entity) {
        ClassMeta defaultClassMeta = resolveDefaultClassMeta(entity);
        return defaultClassMeta != null && supportsBodyPartField(entity, defaultClassMeta.classCode());
    }

    static boolean supportsBodyPartField(String entity, String classCode) {
        EntityContract contract = resolveContract(entity);
        String normalizedClassCode = trimToNull(classCode);
        if (contract == null || normalizedClassCode == null) {
            return false;
        }
        return contract.bodyPartAllowedClassCodes().contains(normalizedClassCode);
    }

    static boolean requiresSendableMainRow(String entity) {
        String normalizedEntity = normalizeEntity(entity);
        return normalizedEntity != null && !IInfoModel.ENTITY_MED_ORDER.equals(normalizedEntity);
    }

    static boolean requiresSendableMainRow(String entity, String classCode) {
        if (!isCompatibleClassCode(entity, classCode)) {
            return false;
        }
        if (IInfoModel.ENTITY_SURGERY_ORDER.equals(normalizeEntity(entity)) && isSurgeryStandaloneClassCode(classCode)) {
            return false;
        }
        return requiresSendableMainRow(entity);
    }

    static String resolveEntityLabel(String entity) {
        EntityContract contract = resolveContract(entity);
        return contract != null ? contract.label() : null;
    }

    static ClassMeta resolveDefaultClassMeta(String entity) {
        EntityContract contract = resolveContract(entity);
        return contract != null ? contract.defaultClassMeta() : null;
    }

    static boolean isBaseChargeClassCode(String classCode) {
        String normalized = trimToNull(classCode);
        return normalized != null && BASE_CHARGE_CLASS_CODES.contains(normalized);
    }

    static boolean isInstructionChargeClassCode(String classCode) {
        String normalized = trimToNull(classCode);
        return normalized != null && INSTRUCTION_CHARGE_CLASS_CODES.contains(normalized);
    }

    static String resolveChargeEntityFromClassCode(String classCode) {
        if (isBaseChargeClassCode(classCode)) {
            return IInfoModel.ENTITY_BASE_CHARGE_ORDER;
        }
        if (isInstructionChargeClassCode(classCode)) {
            return IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER;
        }
        return null;
    }

    static String resolveChargeClassName(String classCode) {
        if (isBaseChargeClassCode(classCode)) {
            return BASE_CHARGE_LABEL;
        }
        if (isInstructionChargeClassCode(classCode)) {
            return INSTRUCTION_CHARGE_LABEL;
        }
        return null;
    }

    static String normalizeRadiologyLabel(String className) {
        String normalized = trimToNull(className);
        if (normalized == null) {
            return null;
        }
        return LEGACY_RADIOLOGY_LABEL.equals(normalized) ? RADIOLOGY_LABEL : normalized;
    }

    static String resolveExactClassName(String entity, String classCode) {
        String normalizedClassCode = trimToNull(classCode);
        if (normalizedClassCode == null) {
            return null;
        }
        String chargeClassName = resolveChargeClassName(normalizedClassCode);
        if (chargeClassName != null) {
            return chargeClassName;
        }
        String normalizedEntity = normalizeEntity(entity);
        if (normalizedEntity != null && isCompatibleClassCode(normalizedEntity, normalizedClassCode)) {
            ClassMeta defaultClassMeta = resolveDefaultClassMeta(normalizedEntity);
            return defaultClassMeta != null ? defaultClassMeta.className() : null;
        }
        OrcaOrderInputSetSupport.ClassMetadata metadata = resolveInputSetClassMetadata(normalizedClassCode);
        return metadata != null ? metadata.className() : null;
    }

    static OrcaOrderInputSetSupport.ClassMetadata resolveInputSetClassMetadata(String receiptCode) {
        String normalizedReceiptCode = trimToNull(receiptCode);
        if (normalizedReceiptCode == null) {
            return null;
        }
        if (MED_CLASS_CODES.contains(normalizedReceiptCode)) {
            return new OrcaOrderInputSetSupport.ClassMetadata(IInfoModel.ENTITY_MED_ORDER, "処方");
        }
        if (INJECTION_CLASS_CODES.contains(normalizedReceiptCode)) {
            return new OrcaOrderInputSetSupport.ClassMetadata(IInfoModel.ENTITY_INJECTION_ORDER, "注射");
        }
        if (TREATMENT_CLASS_CODES.contains(normalizedReceiptCode)) {
            return new OrcaOrderInputSetSupport.ClassMetadata(IInfoModel.ENTITY_TREATMENT, "処置");
        }
        if (SURGERY_CLASS_CODES.contains(normalizedReceiptCode)) {
            return new OrcaOrderInputSetSupport.ClassMetadata(IInfoModel.ENTITY_SURGERY_ORDER, "手術");
        }
        if (TEST_CLASS_CODES.contains(normalizedReceiptCode)) {
            return new OrcaOrderInputSetSupport.ClassMetadata("testOrder", "検査");
        }
        if (RADIOLOGY_CLASS_CODES.contains(normalizedReceiptCode)) {
            return new OrcaOrderInputSetSupport.ClassMetadata(IInfoModel.ENTITY_RADIOLOGY_ORDER, RADIOLOGY_LABEL);
        }
        return null;
    }

    static boolean isAuxiliaryMaterialCode(String code) {
        String normalized = trimToNull(code);
        return normalized != null && AUXILIARY_MATERIAL_CODE_PATTERN.matcher(normalized).matches();
    }

    static boolean isSurgeryStandaloneClassCode(String classCode) {
        String normalized = trimToNull(classCode);
        return "501".equals(normalized) || "502".equals(normalized);
    }

    static boolean isRadiologyClassCode(String classCode) {
        String normalized = trimToNull(classCode);
        return normalized != null && RADIOLOGY_CLASS_CODES.contains(normalized);
    }

    static boolean isTestClassCode(String classCode) {
        String normalized = trimToNull(classCode);
        return normalized != null && TEST_CLASS_CODES.contains(normalized);
    }

    static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static EntityContract resolveContract(String entity) {
        String normalizedEntity = normalizeEntity(entity);
        return normalizedEntity != null ? ENTITY_CONTRACTS.get(normalizedEntity) : null;
    }

    private static Map<String, String> buildEntityAliases() {
        java.util.LinkedHashMap<String, String> aliases = new java.util.LinkedHashMap<>();
        aliases.put("prescriptionOrder", IInfoModel.ENTITY_MED_ORDER);
        aliases.put(IInfoModel.ENTITY_MED_ORDER, IInfoModel.ENTITY_MED_ORDER);
        aliases.put(IInfoModel.ENTITY_INJECTION_ORDER, IInfoModel.ENTITY_INJECTION_ORDER);
        aliases.put(IInfoModel.ENTITY_TREATMENT, IInfoModel.ENTITY_TREATMENT);
        aliases.put(IInfoModel.ENTITY_GENERAL_ORDER, IInfoModel.ENTITY_TREATMENT);
        aliases.put(IInfoModel.ENTITY_SURGERY_ORDER, IInfoModel.ENTITY_SURGERY_ORDER);
        aliases.put(IInfoModel.ENTITY_OTHER_ORDER, IInfoModel.ENTITY_OTHER_ORDER);
        aliases.put("laboTest", "testOrder");
        aliases.put(IInfoModel.ENTITY_LABO_TEST, "testOrder");
        aliases.put(IInfoModel.ENTITY_PHYSIOLOGY_ORDER, IInfoModel.ENTITY_PHYSIOLOGY_ORDER);
        aliases.put(IInfoModel.ENTITY_BACTERIA_ORDER, IInfoModel.ENTITY_BACTERIA_ORDER);
        aliases.put(IInfoModel.ENTITY_RADIOLOGY_ORDER, IInfoModel.ENTITY_RADIOLOGY_ORDER);
        aliases.put(IInfoModel.ENTITY_BASE_CHARGE_ORDER, IInfoModel.ENTITY_BASE_CHARGE_ORDER);
        aliases.put(IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER, IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER);
        aliases.put("instructionChargeOrder", IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER);
        return java.util.Collections.unmodifiableMap(aliases);
    }

    record ClassMeta(String classCode, String className) {
    }

    private record EntityContract(
            String label,
            ClassMeta defaultClassMeta,
            Set<String> allowedClassCodes,
            Set<String> bodyPartAllowedClassCodes,
            boolean sendable,
            boolean localOnly,
            boolean importOnly) {
    }
}
