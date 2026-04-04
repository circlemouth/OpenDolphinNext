package open.dolphin.rest.orca;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import open.dolphin.infomodel.ClaimItem;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.rest.dto.orca.BacteriaOrderMetadata;

final class OrcaOrderBundle600SubtypeSupport {

    private static final String LEGACY_STAMP_TOKEN_PREFIX = "[orca-order-subtype:";
    private static final String META_TOKEN_PREFIX = "[orca-order-600-meta:";
    private static final String TOKEN_SUFFIX = "]";
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

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
            normalizedSubtype = extractStoredMeta(stampMemo).subtype;
        }
        if (normalizedSubtype == null) {
            normalizedSubtype = extractLegacySubtype(stampMemo);
        }
        if (normalizedSubtype == null) {
            normalizedSubtype = defaultSubtype(entity);
        }
        return isValidSubtype(entity, normalizedSubtype) ? normalizedSubtype : defaultSubtype(entity);
    }

    static BacteriaOrderMetadata resolveBacteria(
            String entity,
            BacteriaOrderMetadata explicitMetadata,
            String stampMemo,
            ClaimItem[] claimItems) {
        if (!IInfoModel.ENTITY_BACTERIA_ORDER.equals(OrcaOrderBundleRequestSupport.normalizeEntityResponse(entity))) {
            return null;
        }
        BacteriaOrderMetadata normalizedExplicit = normalizeBacteria(explicitMetadata);
        if (hasBacteriaMetadata(normalizedExplicit)) {
            return normalizedExplicit;
        }
        Stored600Meta stored = extractStoredMeta(stampMemo);
        if (hasBacteriaMetadata(stored.bacteria)) {
            return normalizeBacteria(stored.bacteria);
        }
        return deriveBacteriaFromClaimItems(claimItems);
    }

    static String updateStampMemo(String existingStampMemo, String entity, String subtype) {
        return updateStampMemo(existingStampMemo, entity, subtype, null);
    }

    static String updateStampMemo(String existingStampMemo, String entity, String subtype, BacteriaOrderMetadata bacteria) {
        String cleaned = removeStoredTokens(existingStampMemo);
        String normalizedSubtype = normalizeSubtype(subtype);
        if (!isValidSubtype(entity, normalizedSubtype)) {
            normalizedSubtype = null;
        }
        BacteriaOrderMetadata normalizedBacteria = normalizeBacteria(bacteria);
        Stored600Meta payload = new Stored600Meta();
        payload.subtype = normalizedSubtype != null && !normalizedSubtype.equals(defaultSubtype(entity)) ? normalizedSubtype : null;
        payload.bacteria = hasBacteriaMetadata(normalizedBacteria) ? normalizedBacteria : null;
        if (payload.subtype == null && payload.bacteria == null) {
            return OrcaOrderBundleRequestSupport.trimToNull(cleaned);
        }
        try {
            String token = META_TOKEN_PREFIX + OBJECT_MAPPER.writeValueAsString(payload) + TOKEN_SUFFIX;
            if (cleaned == null || cleaned.isBlank()) {
                return token;
            }
            return cleaned.trim() + " " + token;
        } catch (Exception ex) {
            return OrcaOrderBundleRequestSupport.trimToNull(cleaned);
        }
    }

    static boolean matchesInputSetEntity(String requestedEntity, String bundleEntity, String classCode) {
        String resolvedEntity = resolveInputSetEntity(requestedEntity, bundleEntity, classCode);
        return OrcaOrderBundleRequestSupport.entitiesMatch(requestedEntity, resolvedEntity);
    }

    static String resolveInputSetEntity(String requestedEntity, String bundleEntity, String classCode) {
        String normalizedRequested = OrcaOrderBundleRequestSupport.normalizeEntityResponse(requestedEntity);
        String normalizedBundle = OrcaOrderBundleRequestSupport.normalizeEntityResponse(bundleEntity);
        String normalizedClassCode = OrcaOrderBundleRequestSupport.trimToNull(classCode);
        if (normalizedRequested != null
                && normalizedClassCode != null
                && normalizedClassCode.startsWith("6")
                && "testOrder".equals(normalizedBundle)
                && (IInfoModel.ENTITY_PHYSIOLOGY_ORDER.equals(normalizedRequested)
                        || IInfoModel.ENTITY_BACTERIA_ORDER.equals(normalizedRequested))) {
            return normalizedRequested;
        }
        return normalizedBundle;
    }

    private static BacteriaOrderMetadata deriveBacteriaFromClaimItems(ClaimItem[] claimItems) {
        if (claimItems == null || claimItems.length == 0) {
            return null;
        }
        BacteriaOrderMetadata metadata = new BacteriaOrderMetadata();
        List<BacteriaOrderMetadata.CarrierComment> comments = new ArrayList<>();
        for (ClaimItem item : claimItems) {
            if (item == null || !OrcaOrderBundleRecommendationSupport.isCommentCode(item.getCode())) {
                continue;
            }
            BacteriaOrderMetadata.CarrierComment comment = new BacteriaOrderMetadata.CarrierComment();
            comment.setCode(OrcaOrderBundleRequestSupport.trimToNull(item.getCode()));
            comment.setName(OrcaOrderBundleRequestSupport.trimToNull(item.getName()));
            if (is842Comment(item.getCode())) {
                comment.setInputValue(OrcaOrderBundleRequestSupport.trimToNull(item.getNumber()));
            } else if (is830Comment(item.getCode())) {
                comment.setInputValue(OrcaOrderBundleRequestSupport.trimToNull(item.getName()));
            }
            if (comment.getCode() != null) {
                comments.add(comment);
            }
        }
        metadata.setCarrierComments(comments);
        return hasBacteriaMetadata(metadata) ? metadata : null;
    }

    private static boolean is842Comment(String code) {
        String normalized = OrcaOrderBundleRequestSupport.trimToNull(code);
        return normalized != null && normalized.matches("^842\\d{6}$");
    }

    private static boolean is830Comment(String code) {
        String normalized = OrcaOrderBundleRequestSupport.trimToNull(code);
        return normalized != null && normalized.matches("^830\\d{6}$");
    }

    private static BacteriaOrderMetadata normalizeBacteria(BacteriaOrderMetadata metadata) {
        if (metadata == null) {
            return null;
        }
        BacteriaOrderMetadata normalized = new BacteriaOrderMetadata();
        normalized.setSpecimen(normalizeCarrierComment(metadata.getSpecimen()));
        List<BacteriaOrderMetadata.CarrierComment> carrierComments = new ArrayList<>();
        if (metadata.getCarrierComments() != null) {
            for (BacteriaOrderMetadata.CarrierComment comment : metadata.getCarrierComments()) {
                BacteriaOrderMetadata.CarrierComment normalizedComment = normalizeCarrierComment(comment);
                if (normalizedComment != null) {
                    carrierComments.add(normalizedComment);
                }
            }
        }
        normalized.setCarrierComments(carrierComments);
        return hasBacteriaMetadata(normalized) ? normalized : null;
    }

    private static BacteriaOrderMetadata.CarrierComment normalizeCarrierComment(BacteriaOrderMetadata.CarrierComment comment) {
        if (comment == null) {
            return null;
        }
        BacteriaOrderMetadata.CarrierComment normalized = new BacteriaOrderMetadata.CarrierComment();
        normalized.setRole(OrcaOrderBundleRequestSupport.trimToNull(comment.getRole()));
        normalized.setCode(OrcaOrderBundleRequestSupport.trimToNull(comment.getCode()));
        normalized.setName(OrcaOrderBundleRequestSupport.trimToNull(comment.getName()));
        normalized.setInputValue(OrcaOrderBundleRequestSupport.trimToNull(comment.getInputValue()));
        normalized.setCategory(OrcaOrderBundleRequestSupport.trimToNull(comment.getCategory()));
        normalized.setItemNumber(OrcaOrderBundleRequestSupport.trimToNull(comment.getItemNumber()));
        normalized.setItemNumberBranch(OrcaOrderBundleRequestSupport.trimToNull(comment.getItemNumberBranch()));
        if (normalized.getCode() == null && normalized.getName() == null && normalized.getInputValue() == null) {
            return null;
        }
        return normalized;
    }

    private static boolean hasBacteriaMetadata(BacteriaOrderMetadata metadata) {
        return metadata != null
                && (metadata.getSpecimen() != null
                        || (metadata.getCarrierComments() != null && !metadata.getCarrierComments().isEmpty()));
    }

    private static Stored600Meta extractStoredMeta(String stampMemo) {
        String normalized = OrcaOrderBundleRequestSupport.trimToNull(stampMemo);
        if (normalized == null) {
            return new Stored600Meta();
        }
        int start = normalized.indexOf(META_TOKEN_PREFIX);
        if (start < 0) {
            return new Stored600Meta();
        }
        int valueStart = start + META_TOKEN_PREFIX.length();
        int end = normalized.indexOf(TOKEN_SUFFIX, valueStart);
        if (end < 0) {
            return new Stored600Meta();
        }
        try {
            Stored600Meta stored = OBJECT_MAPPER.readValue(normalized.substring(valueStart, end), Stored600Meta.class);
            stored.subtype = normalizeSubtype(stored.subtype);
            stored.bacteria = normalizeBacteria(stored.bacteria);
            return stored;
        } catch (Exception ex) {
            return new Stored600Meta();
        }
    }

    private static String extractLegacySubtype(String stampMemo) {
        String normalized = OrcaOrderBundleRequestSupport.trimToNull(stampMemo);
        if (normalized == null) {
            return null;
        }
        int start = normalized.indexOf(LEGACY_STAMP_TOKEN_PREFIX);
        if (start < 0) {
            return null;
        }
        int valueStart = start + LEGACY_STAMP_TOKEN_PREFIX.length();
        int end = normalized.indexOf(TOKEN_SUFFIX, valueStart);
        if (end < 0) {
            return null;
        }
        return normalizeSubtype(normalized.substring(valueStart, end));
    }

    private static String removeStoredTokens(String stampMemo) {
        String normalized = OrcaOrderBundleRequestSupport.trimToNull(stampMemo);
        if (normalized == null) {
            return null;
        }
        String cleaned = removeToken(normalized, META_TOKEN_PREFIX);
        cleaned = removeToken(cleaned, LEGACY_STAMP_TOKEN_PREFIX);
        return OrcaOrderBundleRequestSupport.trimToNull(cleaned);
    }

    private static String removeToken(String value, String prefix) {
        String normalized = OrcaOrderBundleRequestSupport.trimToNull(value);
        if (normalized == null) {
            return null;
        }
        int start = normalized.indexOf(prefix);
        if (start < 0) {
            return normalized;
        }
        int end = normalized.indexOf(TOKEN_SUFFIX, start + prefix.length());
        if (end < 0) {
            return normalized.substring(0, start).trim();
        }
        String before = normalized.substring(0, start).trim();
        String after = normalized.substring(end + TOKEN_SUFFIX.length()).trim();
        String joined = (before + " " + after).trim();
        return joined.isBlank() ? null : joined;
    }

    static final class Stored600Meta {
        public String subtype;
        public BacteriaOrderMetadata bacteria;
    }
}
