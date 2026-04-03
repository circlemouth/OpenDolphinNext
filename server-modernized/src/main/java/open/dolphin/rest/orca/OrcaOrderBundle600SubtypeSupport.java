package open.dolphin.rest.orca;

import open.dolphin.infomodel.IInfoModel;

final class OrcaOrderBundle600SubtypeSupport {

    private static final String STAMP_TOKEN_PREFIX = "[orca-order-subtype:";
    private static final String STAMP_TOKEN_SUFFIX = "]";

    private OrcaOrderBundle600SubtypeSupport() {
    }

    static String normalizeSubtype(String subtype) {
        String normalized = OrcaOrderBundleRequestSupport.trimToNull(subtype);
        if (normalized == null) {
            return null;
        }
        return switch (normalized.toLowerCase()) {
            case "specimen", "physiology", "culture", "sensitivity" -> normalized.toLowerCase();
            default -> null;
        };
    }

    static boolean isClass600Entity(String entity) {
        String normalizedEntity = OrcaOrderBundleRequestSupport.normalizeEntityResponse(entity);
        return "testOrder".equals(normalizedEntity)
                || IInfoModel.ENTITY_PHYSIOLOGY_ORDER.equals(normalizedEntity)
                || IInfoModel.ENTITY_BACTERIA_ORDER.equals(normalizedEntity);
    }

    static String defaultSubtype(String entity) {
        String normalizedEntity = OrcaOrderBundleRequestSupport.normalizeEntityResponse(entity);
        if ("testOrder".equals(normalizedEntity)) {
            return "specimen";
        }
        if (IInfoModel.ENTITY_PHYSIOLOGY_ORDER.equals(normalizedEntity)) {
            return "physiology";
        }
        return null;
    }

    static boolean requiresSubtype(String entity) {
        return IInfoModel.ENTITY_BACTERIA_ORDER.equals(OrcaOrderBundleRequestSupport.normalizeEntityResponse(entity));
    }

    static boolean isValidSubtype(String entity, String subtype) {
        String normalizedEntity = OrcaOrderBundleRequestSupport.normalizeEntityResponse(entity);
        String normalizedSubtype = normalizeSubtype(subtype);
        if (!isClass600Entity(normalizedEntity)) {
            return normalizedSubtype == null;
        }
        return switch (normalizedEntity) {
            case "testOrder" -> normalizedSubtype == null || "specimen".equals(normalizedSubtype);
            case IInfoModel.ENTITY_PHYSIOLOGY_ORDER -> normalizedSubtype == null || "physiology".equals(normalizedSubtype);
            case IInfoModel.ENTITY_BACTERIA_ORDER -> "culture".equals(normalizedSubtype) || "sensitivity".equals(normalizedSubtype);
            default -> normalizedSubtype == null;
        };
    }

    static String resolveSubtype(String entity, String explicitSubtype, String stampMemo) {
        String normalizedSubtype = normalizeSubtype(explicitSubtype);
        if (normalizedSubtype == null) {
            normalizedSubtype = extractStoredSubtype(stampMemo);
        }
        if (normalizedSubtype == null) {
            normalizedSubtype = defaultSubtype(entity);
        }
        return isValidSubtype(entity, normalizedSubtype) ? normalizedSubtype : defaultSubtype(entity);
    }

    static String updateStampMemo(String existingStampMemo, String entity, String subtype) {
        String cleaned = removeStoredSubtypeToken(existingStampMemo);
        String normalizedSubtype = normalizeSubtype(subtype);
        if (!isValidSubtype(entity, normalizedSubtype)) {
            normalizedSubtype = null;
        }
        String defaultSubtype = defaultSubtype(entity);
        boolean shouldPersist = normalizedSubtype != null && !normalizedSubtype.equals(defaultSubtype);
        if (!shouldPersist) {
            return OrcaOrderBundleRequestSupport.trimToNull(cleaned);
        }
        String token = STAMP_TOKEN_PREFIX + normalizedSubtype + STAMP_TOKEN_SUFFIX;
        if (cleaned == null || cleaned.isBlank()) {
            return token;
        }
        return cleaned.trim() + " " + token;
    }

    static boolean matchesInputSetEntity(String requestedEntity, String bundleEntity, String classCode) {
        if (OrcaOrderBundleRequestSupport.entitiesMatch(requestedEntity, bundleEntity)) {
            return true;
        }
        String normalizedRequested = OrcaOrderBundleRequestSupport.normalizeEntityResponse(requestedEntity);
        String normalizedBundle = OrcaOrderBundleRequestSupport.normalizeEntityResponse(bundleEntity);
        String normalizedClassCode = OrcaOrderBundleRequestSupport.trimToNull(classCode);
        return normalizedClassCode != null
                && normalizedClassCode.startsWith("6")
                && ("testOrder".equals(normalizedBundle))
                && (IInfoModel.ENTITY_PHYSIOLOGY_ORDER.equals(normalizedRequested)
                        || IInfoModel.ENTITY_BACTERIA_ORDER.equals(normalizedRequested));
    }

    private static String extractStoredSubtype(String stampMemo) {
        String normalized = OrcaOrderBundleRequestSupport.trimToNull(stampMemo);
        if (normalized == null) {
            return null;
        }
        int start = normalized.indexOf(STAMP_TOKEN_PREFIX);
        if (start < 0) {
            return null;
        }
        int valueStart = start + STAMP_TOKEN_PREFIX.length();
        int end = normalized.indexOf(STAMP_TOKEN_SUFFIX, valueStart);
        if (end < 0) {
            return null;
        }
        return normalizeSubtype(normalized.substring(valueStart, end));
    }

    private static String removeStoredSubtypeToken(String stampMemo) {
        String normalized = OrcaOrderBundleRequestSupport.trimToNull(stampMemo);
        if (normalized == null) {
            return null;
        }
        int start = normalized.indexOf(STAMP_TOKEN_PREFIX);
        if (start < 0) {
            return normalized;
        }
        int end = normalized.indexOf(STAMP_TOKEN_SUFFIX, start + STAMP_TOKEN_PREFIX.length());
        if (end < 0) {
            return normalized.substring(0, start).trim();
        }
        String prefix = normalized.substring(0, start).trim();
        String suffix = normalized.substring(end + STAMP_TOKEN_SUFFIX.length()).trim();
        String joined = (prefix + " " + suffix).trim();
        return joined.isBlank() ? null : joined;
    }
}
