package open.dolphin.rest.orca;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import open.dolphin.infomodel.BundleDolphin;
import open.dolphin.infomodel.ClaimItem;
import open.dolphin.infomodel.ClaimConst;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.rest.dto.orca.OrderBundleFetchResponse;
import open.dolphin.rest.dto.orca.OrderBundleRecommendationResponse;

final class OrcaOrderBundleRecommendationSupport {

    private static final String MATERIAL_CODE_PREFIX = "7";
    static final String ROW_ROLE_MAIN = OrcaOrderBundleRequestSupport.ROW_ROLE_MAIN;
    static final String ROW_ROLE_MATERIAL = OrcaOrderBundleRequestSupport.ROW_ROLE_MATERIAL;
    static final String ROW_ROLE_COMMENT = OrcaOrderBundleRequestSupport.ROW_ROLE_COMMENT;
    static final String ROW_ROLE_BODY_PART = OrcaOrderBundleRequestSupport.ROW_ROLE_BODY_PART;
    static final String ROW_SUBTYPE_MATERIAL = "material";
    static final String ROW_SUBTYPE_CONTRAST_DRUG = "contrastDrug";

    private OrcaOrderBundleRecommendationSupport() {
    }

    static List<OrderBundleFetchResponse.OrderBundleItem> toItems(String entity, ClaimItem[] items) {
        if (items == null || items.length == 0) {
            return List.of();
        }
        List<OrderBundleFetchResponse.OrderBundleItem> list = new ArrayList<>();
        for (ClaimItem item : items) {
            if (item == null) {
                continue;
            }
            OrderBundleFetchResponse.OrderBundleItem entry = new OrderBundleFetchResponse.OrderBundleItem();
            OrcaOrderBundleItemMemoSupport.ParsedItem parsedMemo = OrcaOrderBundleItemMemoSupport.parse(item.getMemo());
            entry.setCode(item.getCode());
            entry.setName(item.getName());
            entry.setQuantity(item.getNumber());
            entry.setUnit(item.getUnit());
            entry.setMemo(parsedMemo.memoText());
            entry.setGenericFlg(parsedMemo.genericFlg());
            entry.setUserComment(parsedMemo.userComment());
            String rowRole = resolveRowRole(entity, entry.getCode(), parsedMemo.rowRole(), parsedMemo.rowSubtype());
            entry.setRowRole(rowRole);
            entry.setRowSubtype(resolveRowSubtype(entity, entry.getCode(), rowRole, parsedMemo.rowSubtype(), null));
            list.add(entry);
        }
        return list;
    }

    static List<OrderBundleFetchResponse.OrderBundleItem> removeBodyPartItems(
            List<OrderBundleFetchResponse.OrderBundleItem> items) {
        if (items == null || items.isEmpty()) {
            return List.of();
        }
        List<OrderBundleFetchResponse.OrderBundleItem> filtered = new ArrayList<>();
        for (OrderBundleFetchResponse.OrderBundleItem item : items) {
            if (item == null) {
                continue;
            }
            if (isBodyPartCode(item.getCode())) {
                continue;
            }
            filtered.add(item);
        }
        return filtered;
    }

    static OrderBundleFetchResponse.OrderBundleItem extractBodyPart(
            List<OrderBundleFetchResponse.OrderBundleItem> items) {
        if (items == null || items.isEmpty()) {
            return null;
        }
        for (OrderBundleFetchResponse.OrderBundleItem item : items) {
            if (item == null) {
                continue;
            }
            if (isBodyPartCode(item.getCode())) {
                return item;
            }
        }
        return null;
    }

    static boolean isBodyPartCode(String code) {
        return OrcaOrderBundleRequestSupport.isBodyPartCode(code);
    }

    static boolean isCommentCode(String code) {
        return OrcaOrderBundleRequestSupport.isCommentCode(code);
    }

    static String normalizeRowRole(Object value) {
        return value instanceof String stringValue
                ? OrcaOrderBundleRequestSupport.normalizeRowRole(stringValue)
                : null;
    }

    static String normalizeRowSubtype(Object value) {
        if (!(value instanceof String stringValue)) {
            return null;
        }
        String normalized = normalize(stringValue);
        if (ROW_SUBTYPE_MATERIAL.equals(normalized) || ROW_SUBTYPE_CONTRAST_DRUG.equals(normalized)) {
            return normalized;
        }
        if ("contrast".equals(normalized) || "drug".equals(normalized)) {
            return ROW_SUBTYPE_CONTRAST_DRUG;
        }
        return null;
    }

    static String resolveRowRole(String entity, OrderBundleFetchResponse.OrderBundleItem item) {
        if (item == null) {
            return ROW_ROLE_MAIN;
        }
        String resolved = resolveRowRole(entity, item.getCode(), item.getRowRole(), item.getRowSubtype());
        item.setRowRole(resolved);
        return resolved;
    }

    static String resolveRowRole(String entity, String code, String explicitRowRole, String explicitRowSubtype) {
        String normalizedExplicitRole = normalizeRowRole(explicitRowRole);
        String normalizedExplicitSubtype = normalizeRowSubtype(explicitRowSubtype);
        if (normalizedExplicitRole != null) {
            if (ROW_ROLE_MATERIAL.equals(normalizedExplicitRole)) {
                return ROW_ROLE_MATERIAL;
            }
            return normalizedExplicitRole;
        }
        if (normalizedExplicitSubtype != null) {
            return ROW_ROLE_MATERIAL;
        }
        String normalizedCode = normalize(code);
        if (isBodyPartCode(normalizedCode)) {
            return ROW_ROLE_BODY_PART;
        }
        if (isContrastDrugCode(entity, normalizedCode)) {
            return ROW_ROLE_MATERIAL;
        }
        if (shouldTreatAsMaterialItem(entity, normalizedCode)) {
            return ROW_ROLE_MATERIAL;
        }
        if (isCommentCode(normalizedCode)) {
            return ROW_ROLE_COMMENT;
        }
        return ROW_ROLE_MAIN;
    }

    static String resolveRowSubtype(String entity, String code, String rowRole, String explicitRowSubtype, String fallbackSubtype) {
        String normalizedRowRole = normalizeRowRole(rowRole);
        if (!ROW_ROLE_MATERIAL.equals(normalizedRowRole)) {
            return null;
        }
        String normalizedSubtype = normalizeRowSubtype(explicitRowSubtype);
        if (normalizedSubtype == null) {
            normalizedSubtype = normalizeRowSubtype(fallbackSubtype);
        }
        if (normalizedSubtype != null) {
            return normalizedSubtype;
        }
        String normalizedCode = normalize(code);
        if (isContrastDrugCode(entity, normalizedCode)) {
            return ROW_SUBTYPE_CONTRAST_DRUG;
        }
        return ROW_SUBTYPE_MATERIAL;
    }

    private static boolean isContrastDrugCode(String entity, String code) {
        return IInfoModel.ENTITY_RADIOLOGY_ORDER.equals(OrcaOrderBundleRequestSupport.normalizeEntityResponse(entity))
                && normalize(code).matches("^6\\d{8}$");
    }

    private static boolean shouldTreatAsMaterialItem(String entity, String code) {
        if (isBodyPartCode(code)) {
            return false;
        }
        String normalizedCode = normalize(code);
        if (!normalizedCode.startsWith(MATERIAL_CODE_PREFIX)) {
            return false;
        }
        String normalizedEntity = OrcaOrderBundleRequestSupport.normalizeEntityResponse(entity);
        return "treatmentOrder".equals(normalizedEntity)
                || IInfoModel.ENTITY_INJECTION_ORDER.equals(normalizedEntity);
    }

    static OrderBundleRecommendationResponse.OrderRecommendationTemplate toRecommendationTemplate(
            String bundleName,
            BundleDolphin bundle,
            String entity,
            String stampMemo) {
        List<OrderBundleFetchResponse.OrderBundleItem> normalItems = new ArrayList<>();
        List<OrderBundleFetchResponse.OrderBundleItem> materialItems = new ArrayList<>();
        List<OrderBundleFetchResponse.OrderBundleItem> commentItems = new ArrayList<>();
        OrderBundleFetchResponse.OrderBundleItem bodyPart = null;
        for (OrderBundleFetchResponse.OrderBundleItem item : toItems(entity, bundle.getClaimItem())) {
            if (item == null) {
                continue;
            }
            String rowRole = resolveRowRole(entity, item);
            if (ROW_ROLE_BODY_PART.equals(rowRole)) {
                if (bodyPart == null) {
                    item.setRowRole(ROW_ROLE_BODY_PART);
                    bodyPart = item;
                } else {
                    normalItems.add(item);
                }
                continue;
            }
            if (ROW_ROLE_MATERIAL.equals(rowRole)) {
                item.setRowRole(ROW_ROLE_MATERIAL);
                materialItems.add(item);
                continue;
            }
            if (ROW_ROLE_COMMENT.equals(rowRole)) {
                item.setRowRole(ROW_ROLE_COMMENT);
                commentItems.add(item);
                continue;
            }
            item.setRowRole(ROW_ROLE_MAIN);
            normalItems.add(item);
        }
        PrescriptionMeta prescriptionMeta = resolvePrescriptionMeta(bundle.getClassCode());

        OrderBundleRecommendationResponse.OrderRecommendationTemplate template =
                new OrderBundleRecommendationResponse.OrderRecommendationTemplate();
        template.setBundleName(bundleName);
        template.setAdmin(normalize(bundle.getAdmin()));
        template.setAdminCode(normalize(bundle.getAdminCode()));
        template.setAdminCodeSystem(normalize(bundle.getAdminCodeSystem()));
        template.setBundleNumber(hasText(bundle.getBundleNumber()) ? bundle.getBundleNumber().trim() : "1");
        String canonicalClassCode = OrcaChargeClassCanonicalSupport.canonicalClassCode(entity, bundle.getClassCode());
        template.setClassCode(normalize(canonicalClassCode));
        template.setClassCodeSystem(canonicalClassCode != null ? ClaimConst.CLASS_CODE_ID : normalize(bundle.getClassCodeSystem()));
        template.setClassName(OrcaOrderBundleRequestSupport.resolveCanonicalClassName(
                entity,
                canonicalClassCode,
                OrcaChargeClassCanonicalSupport.canonicalClassName(
                        entity,
                        canonicalClassCode,
                        bundle.getClassName())));
        template.setAdminMemo(normalize(bundle.getAdminMemo()));
        template.setMemo(normalize(bundle.getMemo()));
        template.setSubtype(OrcaOrderBundle600SubtypeSupport.resolveSubtype(entity, null, stampMemo));
        if (IInfoModel.ENTITY_MED_ORDER.equals(entity)) {
            template.setPrescriptionLocation(prescriptionMeta.location());
            template.setPrescriptionTiming(prescriptionMeta.timing());
        }
        template.setItems(removeBodyPartItems(normalItems));
        template.setMaterialItems(materialItems);
        template.setCommentItems(commentItems);
        template.setBodyPart(bodyPart);
        return template;
    }

    static String buildRecommendationKey(
            String entity,
            OrderBundleRecommendationResponse.OrderRecommendationTemplate template) {
        StringBuilder builder = new StringBuilder();
        appendNormalized(builder, OrcaOrderBundleRequestSupport.normalizeEntityResponse(entity));
        appendNormalized(builder, template.getBundleName());
        appendNormalized(builder, template.getAdmin());
        appendNormalized(builder, template.getBundleNumber());
        appendNormalized(builder, template.getAdminMemo());
        appendNormalized(builder, template.getMemo());
        appendNormalized(builder, template.getPrescriptionLocation());
        appendNormalized(builder, template.getPrescriptionTiming());
        appendItems(builder, template.getItems());
        appendItems(builder, template.getMaterialItems());
        appendItems(builder, template.getCommentItems());
        appendItem(builder, template.getBodyPart());
        String raw = builder.toString();
        return Integer.toHexString(Objects.hash(raw)) + ":" + Integer.toString(raw.length(), 36);
    }

    private static void appendItems(StringBuilder builder, List<OrderBundleFetchResponse.OrderBundleItem> items) {
        builder.append("|[");
        if (items != null) {
            for (OrderBundleFetchResponse.OrderBundleItem item : items) {
                appendItem(builder, item);
            }
        }
        builder.append("]");
    }

    private static void appendItem(StringBuilder builder, OrderBundleFetchResponse.OrderBundleItem item) {
        if (item == null) {
            builder.append("{}");
            return;
        }
        builder.append("{");
        appendNormalized(builder, item.getCode());
        appendNormalized(builder, item.getName());
        appendNormalized(builder, item.getQuantity());
        appendNormalized(builder, item.getUnit());
        appendNormalized(builder, item.getMemo());
        appendNormalized(builder, item.getGenericFlg());
        appendNormalized(builder, item.getUserComment());
        appendNormalized(builder, item.getRowRole());
        appendNormalized(builder, item.getRowSubtype());
        builder.append("}");
    }

    private static void appendNormalized(StringBuilder builder, String value) {
        builder.append(normalize(value)).append("|");
    }

    private static PrescriptionMeta resolvePrescriptionMeta(String classCode) {
        String normalized = normalize(classCode);
        if (normalized.isEmpty()) {
            return new PrescriptionMeta("out", "regular");
        }
        String location = normalized.endsWith("2") ? "out" : "in";
        String timing = "regular";
        if (normalized.startsWith("22")) {
            timing = "tonyo";
        } else if (normalized.startsWith("29")) {
            timing = "temporal";
        }
        return new PrescriptionMeta(location, timing);
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim();
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private record PrescriptionMeta(String location, String timing) {
    }
}
