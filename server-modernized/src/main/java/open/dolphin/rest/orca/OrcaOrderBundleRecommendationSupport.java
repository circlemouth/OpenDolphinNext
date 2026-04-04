package open.dolphin.rest.orca;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import open.dolphin.infomodel.BundleDolphin;
import open.dolphin.infomodel.ClaimItem;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.rest.dto.orca.BacteriaOrderMetadata;
import open.dolphin.rest.dto.orca.OrderBundleFetchResponse;
import open.dolphin.rest.dto.orca.OrderBundleRecommendationResponse;

final class OrcaOrderBundleRecommendationSupport {

    private static final String MATERIAL_CODE_PREFIX = "7";
    private static final String BODY_PART_CODE_PREFIX = "002";
    private static final String COMMENT_CODE_REGEX = "^(008[1-6]|8[1-6]|098|099|98|99).*";
    static final String ROW_ROLE_MAIN = "main";
    static final String ROW_ROLE_MATERIAL = "material";
    static final String ROW_ROLE_COMMENT = "comment";
    static final String ROW_ROLE_BODY_PART = "bodyPart";

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
            entry.setCategory(parsedMemo.category());
            entry.setItemNumber(parsedMemo.itemNumber());
            entry.setItemNumberBranch(parsedMemo.itemNumberBranch());
            entry.setRowRole(resolveRowRole(entity, entry));
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

    static List<OrderBundleFetchResponse.OrderBundleItem> filterItemsByRowRole(
            List<OrderBundleFetchResponse.OrderBundleItem> items,
            String rowRole) {
        if (items == null || items.isEmpty()) {
            return List.of();
        }
        List<OrderBundleFetchResponse.OrderBundleItem> filtered = new ArrayList<>();
        for (OrderBundleFetchResponse.OrderBundleItem item : items) {
            if (item == null) {
                continue;
            }
            if (Objects.equals(rowRole, item.getRowRole())) {
                filtered.add(item);
            }
        }
        return filtered;
    }

    static boolean isBodyPartCode(String code) {
        return normalize(code).startsWith(BODY_PART_CODE_PREFIX);
    }

    static boolean isCommentCode(String code) {
        return normalize(code).matches(COMMENT_CODE_REGEX);
    }

    static String resolveRowRole(String entity, OrderBundleFetchResponse.OrderBundleItem item) {
        if (item == null) {
            return ROW_ROLE_MAIN;
        }
        String code = normalize(item.getCode());
        if (isBodyPartCode(code)) {
            return ROW_ROLE_BODY_PART;
        }
        if (shouldTreatAsMaterialItem(entity, code)) {
            return ROW_ROLE_MATERIAL;
        }
        if (isCommentCode(code)) {
            return ROW_ROLE_COMMENT;
        }
        return ROW_ROLE_MAIN;
    }

    private static boolean shouldTreatAsMaterialItem(String entity, String code) {
        String normalizedCode = normalize(code);
        if (!normalizedCode.startsWith(MATERIAL_CODE_PREFIX)) {
            return false;
        }
        String normalizedEntity = OrcaOrderBundleRequestSupport.normalizeEntityResponse(entity);
        // Radiology main rows also use 7xx codes, so prefix-only material detection would drop valid main rows.
        return !IInfoModel.ENTITY_RADIOLOGY_ORDER.equals(normalizedEntity);
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
        template.setClassCode(normalize(bundle.getClassCode()));
        template.setClassCodeSystem(normalize(bundle.getClassCodeSystem()));
        template.setClassName(normalize(bundle.getClassName()));
        template.setAdminMemo(normalize(bundle.getAdminMemo()));
        template.setMemo(normalize(bundle.getMemo()));
        template.setSubtype(OrcaOrderBundle600SubtypeSupport.resolveSubtype(entity, null, stampMemo));
        template.setBacteria(OrcaOrderBundle600SubtypeSupport.resolveBacteria(entity, null, stampMemo, bundle.getClaimItem()));
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
        appendBacteria(builder, template.getBacteria());
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
        builder.append("}");
    }

    private static void appendBacteria(StringBuilder builder, BacteriaOrderMetadata bacteria) {
        builder.append("|{");
        if (bacteria != null) {
            appendCarrierComment(builder, bacteria.getSpecimen());
            if (bacteria.getCarrierComments() != null) {
                for (BacteriaOrderMetadata.CarrierComment comment : bacteria.getCarrierComments()) {
                    appendCarrierComment(builder, comment);
                }
            }
        }
        builder.append("}");
    }

    private static void appendCarrierComment(StringBuilder builder, BacteriaOrderMetadata.CarrierComment comment) {
        builder.append("[");
        if (comment != null) {
            appendNormalized(builder, comment.getRole());
            appendNormalized(builder, comment.getCode());
            appendNormalized(builder, comment.getName());
            appendNormalized(builder, comment.getInputValue());
            appendNormalized(builder, comment.getCategory());
            appendNormalized(builder, comment.getItemNumber());
            appendNormalized(builder, comment.getItemNumberBranch());
        }
        builder.append("]");
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
