package open.dolphin.rest.orca;

import java.util.Map;
import java.util.Set;
import open.dolphin.infomodel.IInfoModel;

final class OrcaMedicalClassCatalog {

    private static final Set<String> SENDABLE_ENTITIES = Set.of(
            IInfoModel.ENTITY_MED_ORDER,
            IInfoModel.ENTITY_INJECTION_ORDER,
            "treatmentOrder",
            IInfoModel.ENTITY_SURGERY_ORDER,
            "testOrder",
            IInfoModel.ENTITY_RADIOLOGY_ORDER,
            IInfoModel.ENTITY_BASE_CHARGE_ORDER,
            IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER);

    private static final Set<String> IMPORT_ONLY_ENTITIES = Set.of(IInfoModel.ENTITY_PHYSIOLOGY_ORDER);
    private static final Set<String> LOCAL_ONLY_ENTITIES = Set.of(
            IInfoModel.ENTITY_OTHER_ORDER,
            IInfoModel.ENTITY_BACTERIA_ORDER);

    private static final Map<String, Set<String>> ALLOWLIST_BY_ENTITY = Map.of(
            IInfoModel.ENTITY_MED_ORDER, Set.of(
                    "210", "211", "212", "213",
                    "220", "221", "222", "223",
                    "230", "231", "232", "233",
                    "290", "291", "292",
                    "293", "294", "295",
                    "296", "297", "298"),
            IInfoModel.ENTITY_INJECTION_ORDER, Set.of(
                    "310", "311", "312",
                    "320", "321",
                    "330", "331", "334",
                    "340",
                    "350"),
            "treatmentOrder", Set.of("400", "401", "402", "403", "409"),
            IInfoModel.ENTITY_SURGERY_ORDER, Set.of("500", "501", "502", "510"),
            "testOrder", Set.of("600", "601", "602", "603", "610"),
            IInfoModel.ENTITY_RADIOLOGY_ORDER, Set.of("700", "701", "702", "703", "704", "731", "732"),
            IInfoModel.ENTITY_BASE_CHARGE_ORDER, Set.of("110", "114", "120", "124"),
            IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER, Set.of("130", "132", "133", "140", "141", "142", "143", "148", "149"));

    private static final Map<String, Set<String>> BLOCKED_BY_ENTITY = Map.of(
            IInfoModel.ENTITY_INJECTION_ORDER, Set.of("332", "335", "352"),
            IInfoModel.ENTITY_SURGERY_ORDER, Set.of("520", "540", "541", "542"),
            "testOrder", Set.of("640", "643"),
            IInfoModel.ENTITY_RADIOLOGY_ORDER, Set.of("710", "711", "712", "713", "720", "721", "723", "724"),
            IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER, Set.of("131", "144", "145", "146", "147", "150"));

    private static final Map<String, Map<String, String>> CLASS_MODE_BY_ENTITY = Map.of(
            "treatmentOrder", Map.of(
                    "400", "procedure-capable",
                    "401", "drug-only",
                    "402", "material-only",
                    "403", "add-on-only",
                    "409", "procedure-capable"));

    private static final Map<String, String> EXACT_CLASS_NAMES = Map.ofEntries(
            Map.entry("110", "初診料"),
            Map.entry("114", "初診加算料"),
            Map.entry("120", "再診"),
            Map.entry("124", "再診加算料"),
            Map.entry("130", "管理料"),
            Map.entry("132", "管理材料"),
            Map.entry("133", "管理加算料"),
            Map.entry("140", "在宅料"),
            Map.entry("141", "在宅薬剤"),
            Map.entry("142", "在宅材料"),
            Map.entry("143", "在宅加算料"),
            Map.entry("148", "在宅薬剤（院外処方）"),
            Map.entry("149", "在宅材料（院外処方）"),
            Map.entry("400", "処置"),
            Map.entry("401", "処置薬剤"),
            Map.entry("402", "処置材料"),
            Map.entry("403", "処置加算料"),
            Map.entry("409", "処置"),
            Map.entry("500", "手術"),
            Map.entry("501", "手術薬剤"),
            Map.entry("502", "手術材料"),
            Map.entry("510", "輸血"),
            Map.entry("600", "検査"),
            Map.entry("601", "検査薬剤"),
            Map.entry("602", "検査材料"),
            Map.entry("603", "検査加算料"),
            Map.entry("610", "検査"),
            Map.entry("700", "画像診断"),
            Map.entry("701", "画像診断薬剤"),
            Map.entry("702", "画像診断材料"),
            Map.entry("703", "X線フィルム"),
            Map.entry("704", "画像診断加算料"),
            Map.entry("731", "造影剤・注入手技"),
            Map.entry("732", "造影剤・注入手技"));

    private OrcaMedicalClassCatalog() {
    }

    static String normalizeEntity(String entity) {
        if (entity == null || entity.isBlank()) {
            return null;
        }
        String normalized = entity.trim();
        if ("laboTest".equals(normalized) || IInfoModel.ENTITY_LABO_TEST.equals(normalized)) {
            return "testOrder";
        }
        if (IInfoModel.ENTITY_GENERAL_ORDER.equals(normalized)
                || "generalOrder".equals(normalized)
                || IInfoModel.ENTITY_TREATMENT.equals(normalized)) {
            return "treatmentOrder";
        }
        if ("instructionChargeOrder".equals(normalized)) {
            return IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER;
        }
        return normalized;
    }

    static boolean isSendableEntity(String entity) {
        return SENDABLE_ENTITIES.contains(normalizeEntity(entity));
    }

    static boolean isImportOnlyEntity(String entity) {
        return IMPORT_ONLY_ENTITIES.contains(normalizeEntity(entity));
    }

    static boolean isLocalOnlyEntity(String entity) {
        return LOCAL_ONLY_ENTITIES.contains(normalizeEntity(entity));
    }

    static boolean isSupportedEntity(String entity) {
        String normalized = normalizeEntity(entity);
        return normalized != null
                && (SENDABLE_ENTITIES.contains(normalized)
                        || IMPORT_ONLY_ENTITIES.contains(normalized)
                        || LOCAL_ONLY_ENTITIES.contains(normalized));
    }

    static boolean allowsClassCode(String entity, String classCode) {
        String normalizedEntity = normalizeEntity(entity);
        String normalizedClassCode = trimToNull(classCode);
        if (normalizedEntity == null || normalizedClassCode == null) {
            return true;
        }
        if (IInfoModel.ENTITY_OTHER_ORDER.equals(normalizedEntity)) {
            return false;
        }
        Set<String> allowlist = ALLOWLIST_BY_ENTITY.get(normalizedEntity);
        if (allowlist != null && allowlist.contains(normalizedClassCode)) {
            return true;
        }
        Set<String> blocked = BLOCKED_BY_ENTITY.get(normalizedEntity);
        if (blocked != null && blocked.contains(normalizedClassCode)) {
            return false;
        }
        return !isSendableEntity(normalizedEntity);
    }

    static boolean isBlockedClassCode(String entity, String classCode) {
        String normalizedEntity = normalizeEntity(entity);
        String normalizedClassCode = trimToNull(classCode);
        if (normalizedEntity == null || normalizedClassCode == null) {
            return false;
        }
        Set<String> blocked = BLOCKED_BY_ENTITY.get(normalizedEntity);
        return blocked != null && blocked.contains(normalizedClassCode);
    }

    static boolean isAllowedClassCode(String entity, String classCode) {
        String normalizedEntity = normalizeEntity(entity);
        String normalizedClassCode = trimToNull(classCode);
        if (normalizedEntity == null || normalizedClassCode == null) {
            return false;
        }
        Set<String> allowlist = ALLOWLIST_BY_ENTITY.get(normalizedEntity);
        return allowlist != null && allowlist.contains(normalizedClassCode);
    }

    static String resolveExactClassName(String entity, String classCode) {
        String normalizedClassCode = trimToNull(classCode);
        if (normalizedClassCode == null) {
            return null;
        }
        return EXACT_CLASS_NAMES.get(normalizedClassCode);
    }

    static String resolveEntityForClassCode(String classCode) {
        String normalizedClassCode = trimToNull(classCode);
        if (normalizedClassCode == null) {
            return null;
        }
        for (Map.Entry<String, Set<String>> entry : ALLOWLIST_BY_ENTITY.entrySet()) {
            if (entry.getValue().contains(normalizedClassCode)) {
                return entry.getKey();
            }
        }
        return null;
    }

    static String resolveEntityLabel(String entity) {
        String normalized = normalizeEntity(entity);
        if (normalized == null) {
            return null;
        }
        return switch (normalized) {
            case IInfoModel.ENTITY_MED_ORDER -> "RP";
            case IInfoModel.ENTITY_INJECTION_ORDER -> "注射";
            case "treatmentOrder" -> "処置";
            case IInfoModel.ENTITY_SURGERY_ORDER -> "手術";
            case "testOrder" -> "検査";
            case IInfoModel.ENTITY_RADIOLOGY_ORDER -> "画像診断";
            case IInfoModel.ENTITY_OTHER_ORDER -> "その他";
            default -> null;
        };
    }

    static boolean supportsBodyPartField(String entity) {
        return supportsBodyPartField(entity, null);
    }

    static boolean supportsBodyPartField(String entity, String classCode) {
        String normalized = normalizeEntity(entity);
        String normalizedClassCode = trimToNull(classCode);
        return IInfoModel.ENTITY_RADIOLOGY_ORDER.equals(normalized)
                && (normalizedClassCode == null || "700".equals(normalizedClassCode));
    }

    static boolean requiresSendableMainRow(String entity) {
        return requiresSendableMainRow(entity, null);
    }

    static boolean requiresSendableMainRow(String entity, String classCode) {
        String normalized = normalizeEntity(entity);
        if (!isSendableEntity(normalized)
                || IInfoModel.ENTITY_MED_ORDER.equals(normalized)
                || IInfoModel.ENTITY_OTHER_ORDER.equals(normalized)
                || IInfoModel.ENTITY_PHYSIOLOGY_ORDER.equals(normalized)
                || IInfoModel.ENTITY_BACTERIA_ORDER.equals(normalized)) {
            return false;
        }
        if ("treatmentOrder".equals(normalized)) {
            String normalizedClassCode = trimToNull(classCode);
            if (normalizedClassCode == null) {
                return true;
            }
            String classMode = CLASS_MODE_BY_ENTITY.getOrDefault(normalized, Map.of()).get(normalizedClassCode);
            return classMode == null || "procedure-capable".equals(classMode);
        }
        return true;
    }

    static boolean isMedOrderUsageBlocked(String entity) {
        return IInfoModel.ENTITY_MED_ORDER.equals(normalizeEntity(entity));
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
