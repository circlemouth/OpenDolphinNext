package open.dolphin.rest.orca;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.UserModel;
import open.dolphin.rest.dto.orca.BacteriaOrderMetadata;
import open.dolphin.rest.dto.orca.OrderBundleMutationRequest;

final class OrcaOrderBundleMutationExecutionSupport {

    private static final Pattern BACTERIA_NUMERIC_COMMENT_VALUE_PATTERN = Pattern.compile("^[+-]?\\d+(?:\\.\\d+)?$");

    private OrcaOrderBundleMutationExecutionSupport() {
    }

    static MutationResult execute(
            OrderBundleMutationRequest payload,
            KarteBean karte,
            UserModel user,
            Map<String, Object> orderBundleContext,
            DateValidator dateValidator,
            DocumentFetcher documentFetcher,
            Persistence persistence,
            FailureBuilder failureBuilder,
            ValidationFailure validationFailure) {
        List<Long> created = new ArrayList<>();
        List<Long> updated = new ArrayList<>();
        List<Long> deleted = new ArrayList<>();

        for (OrderBundleMutationRequest.BundleOperation op : payload.getOperations()) {
            if (op == null || op.getOperation() == null || op.getOperation().isBlank()) {
                throw validationFailure.invalid("operation", "operation is required");
            }
            String operation = op.getOperation().toLowerCase(Locale.ROOT);
            if (!OrcaOrderBundleRequestSupport.isSupportedOperation(operation)) {
                throw validationFailure.invalid("operation", "operation is invalid");
            }
            if (op.getEntity() != null && !op.getEntity().isBlank()
                    && !OrcaOrderBundleRequestSupport.isValidEntity(op.getEntity())) {
                throw validationFailure.invalid("entity", "entity is invalid");
            }
            validateOperationStructure(op, validationFailure);
            Date performDate = null;
            if ("create".equals(operation) || "update".equals(operation)) {
                performDate = dateValidator.require(operation, "startDate", op.getStartDate(), true);
                dateValidator.require(operation, "endDate", op.getEndDate(), false);
            }
            orderBundleContext.put("operation", operation);
            if (op.getDocumentId() != null) {
                orderBundleContext.put("documentId", op.getDocumentId());
            } else {
                orderBundleContext.remove("documentId");
            }
            switch (operation) {
                case "create" -> createDocument(karte, user, op, performDate, persistence, failureBuilder, created);
                case "update" -> updateDocument(user, op, performDate, documentFetcher, persistence, failureBuilder, validationFailure, updated);
                case "delete" -> deleteDocument(op, persistence, failureBuilder, validationFailure, deleted);
                default -> {
                }
            }
        }
        return new MutationResult(created, updated, deleted);
    }

    private static void validateOperationStructure(
            OrderBundleMutationRequest.BundleOperation op,
            ValidationFailure validationFailure) {
        String canonicalEntity = OrcaOrderBundleRequestSupport.normalizeEntityStorage(op.getEntity());
        if (canonicalEntity == null) {
            canonicalEntity = IInfoModel.ENTITY_TREATMENT;
        }
        if (!OrcaOrderBundleRequestSupport.isCompatibleClassCode(canonicalEntity, op.getClassCode())) {
            throw validationFailure.invalid("classCode", "classCode is incompatible with entity");
        }
        String explicitSubtype = OrcaOrderBundleRequestSupport.trimToNull(op.getSubtype());
        String resolvedSubtype = OrcaOrderBundle600SubtypeSupport.resolveSubtype(
                canonicalEntity, explicitSubtype, null);
        if (OrcaOrderBundle600SubtypeSupport.requiresSubtype(canonicalEntity)
                && !OrcaOrderBundleRequestSupport.hasText(resolvedSubtype)) {
            throw validationFailure.invalid("subtype", "subtype is required for bacteriaOrder");
        }
        if (explicitSubtype != null
                && !OrcaOrderBundle600SubtypeSupport.isValidSubtype(canonicalEntity, explicitSubtype)) {
            throw validationFailure.invalid("subtype", "subtype is incompatible with entity");
        }
        validateBacteriaMetadata(canonicalEntity, op.getBacteria(), validationFailure);
        if (IInfoModel.ENTITY_INJECTION_ORDER.equals(canonicalEntity)) {
            validateInjectionContract(op, validationFailure);
        }
        boolean hasExplicitBodyPart = validateExplicitBodyPart(canonicalEntity, op.getBodyPart(), validationFailure);
        List<OrderBundleMutationRequest.BundleItem> items = collectItems(op);
        boolean hasCodedRow = false;
        boolean hasUncodedRow = false;
        boolean hasSendableMainRow = false;
        boolean hasBodyPart = hasExplicitBodyPart;
        for (OrderBundleMutationRequest.BundleItem item : items != null ? items : List.<OrderBundleMutationRequest.BundleItem>of()) {
            if (!hasValuedItem(item)) {
                continue;
            }
            if (!OrcaOrderBundleRequestSupport.hasText(item.getName())) {
                throw validationFailure.invalid("items", "items contain blank name rows");
            }
            String code = OrcaOrderBundleRequestSupport.trimToNull(item.getCode());
            OrcaOrderBundleItemMemoSupport.ParsedItem parsedMemo = OrcaOrderBundleItemMemoSupport.parse(item.getMemo());
            String requestedRowRole = OrcaOrderBundleRequestSupport.normalizeRowRole(
                    OrcaOrderBundleRequestSupport.hasText(item.getRowRole()) ? item.getRowRole() : parsedMemo.rowRole());
            if (requestedRowRole != null && code != null
                    && !OrcaOrderBundleRequestSupport.isValidCodeForRowRole(canonicalEntity, requestedRowRole, code)) {
                if (OrcaOrderBundleRequestSupport.ROW_ROLE_BODY_PART.equals(requestedRowRole)
                        && !OrcaOrderBundleRequestSupport.supportsBodyPartField(canonicalEntity)) {
                    throw validationFailure.invalid("bodyPart", "bodyPart is incompatible with entity");
                }
                throw validationFailure.invalid("items", invalidCodeMessage(canonicalEntity, requestedRowRole));
            }
            String rowRole = OrcaOrderBundleRequestSupport.resolveRowRole(canonicalEntity, requestedRowRole, code);
            if (code != null) {
                hasCodedRow = true;
                if (OrcaOrderBundleRequestSupport.ROW_ROLE_BODY_PART.equals(rowRole)
                        && !OrcaOrderBundleRequestSupport.supportsBodyPartField(canonicalEntity)) {
                    throw validationFailure.invalid("bodyPart", "bodyPart is incompatible with entity");
                }
                if (!OrcaOrderBundleRequestSupport.isValidCodeForRowRole(canonicalEntity, rowRole, code)) {
                    throw validationFailure.invalid("items", invalidCodeMessage(canonicalEntity, rowRole));
                }
                if (OrcaOrderBundleRequestSupport.ROW_ROLE_BODY_PART.equals(rowRole)) {
                    hasBodyPart = true;
                } else if (OrcaOrderBundleRequestSupport.ROW_ROLE_MAIN.equals(rowRole)) {
                    String itemCategory = resolveEffectiveItemCategory(item, parsedMemo);
                    if (OrcaChargeClassSupport.isChargeEntity(canonicalEntity)
                            && !OrcaChargeClassSupport.isChargeItemCategoryCompatible(canonicalEntity, itemCategory)) {
                        throw validationFailure.invalid("items", "charge items must use a compatible masterCategory");
                    }
                    hasSendableMainRow = true;
                }
            } else {
                hasUncodedRow = true;
                if (OrcaOrderBundleRequestSupport.ROW_ROLE_BODY_PART.equals(rowRole)
                        && !OrcaOrderBundleRequestSupport.supportsBodyPartField(canonicalEntity)) {
                    throw validationFailure.invalid("bodyPart", "bodyPart is incompatible with entity");
                }
                if (OrcaOrderBundleRequestSupport.ROW_ROLE_MATERIAL.equals(rowRole)
                        && !IInfoModel.ENTITY_INJECTION_ORDER.equals(canonicalEntity)) {
                    throw validationFailure.invalid("items", "auxiliary rows require sendable 9-digit code");
                }
                if (OrcaOrderBundleRequestSupport.ROW_ROLE_BODY_PART.equals(rowRole)) {
                    throw validationFailure.invalid("bodyPart", "bodyPart must use 002 code");
                }
            }
        }
        if (hasCodedRow && hasUncodedRow) {
            throw validationFailure.invalid("items", "items contain mixed coded and uncoded rows");
        }
        if (hasUncodedRow) {
            throw validationFailure.invalid("items", "items contain uncoded rows");
        }
        if (hasBodyPart && !OrcaOrderBundleRequestSupport.supportsBodyPartField(canonicalEntity)) {
            throw validationFailure.invalid("bodyPart", "bodyPart is incompatible with entity");
        }
        if (IInfoModel.ENTITY_RADIOLOGY_ORDER.equals(canonicalEntity) && !hasBodyPart) {
            throw validationFailure.invalid("bodyPart", "bodyPart is required for radiologyOrder");
        }
        if (requiresSendableMainRow(canonicalEntity) && !hasSendableMainRow) {
            throw validationFailure.invalid("items", "items do not contain a sendable main row");
        }
    }

    private static void validateInjectionContract(
            OrderBundleMutationRequest.BundleOperation op,
            ValidationFailure validationFailure) {
        if (!OrcaOrderBundleRequestSupport.hasText(op.getAdmin())) {
            return;
        }
        String adminCode = OrcaOrderBundleRequestSupport.trimToNull(op.getAdminCode());
        if (adminCode == null) {
            throw validationFailure.invalid("adminCode", "adminCode is required when admin is provided");
        }
        if (!OrcaOrderBundleRequestSupport.isSendableInjectionAdminCode(adminCode)) {
            throw validationFailure.invalid("adminCode", "adminCode must be a sendable numeric code for injectionOrder");
        }
    }

    private static boolean validateExplicitBodyPart(
            String canonicalEntity,
            OrderBundleMutationRequest.BundleItem bodyPart,
            ValidationFailure validationFailure) {
        if (!hasValuedItem(bodyPart)) {
            return false;
        }
        if (!OrcaOrderBundleRequestSupport.supportsBodyPartField(canonicalEntity)) {
            throw validationFailure.invalid("bodyPart", "bodyPart is incompatible with entity");
        }
        String name = OrcaOrderBundleRequestSupport.trimToNull(bodyPart.getName());
        if (name == null) {
            throw validationFailure.invalid("bodyPart", "bodyPart name is required");
        }
        String code = OrcaOrderBundleRequestSupport.trimToNull(bodyPart.getCode());
        if (code == null) {
            throw validationFailure.invalid("bodyPart", "bodyPart code is required");
        }
        if (!OrcaOrderBundleRecommendationSupport.isBodyPartCode(code)) {
            throw validationFailure.invalid("bodyPart", "bodyPart must use code family 002");
        }
        return true;
    }

    private static boolean requiresSendableMainRow(String canonicalEntity) {
        return canonicalEntity != null
                && !IInfoModel.ENTITY_MED_ORDER.equals(canonicalEntity);
    }

    private static boolean hasValuedItem(OrderBundleMutationRequest.BundleItem item) {
        return item != null
                && (OrcaOrderBundleRequestSupport.hasText(item.getName())
                        || OrcaOrderBundleRequestSupport.hasText(item.getCode())
                        || OrcaOrderBundleRequestSupport.hasText(item.getQuantity())
                        || OrcaOrderBundleRequestSupport.hasText(item.getUnit())
                        || OrcaOrderBundleRequestSupport.hasText(item.getMemo())
                        || OrcaOrderBundleRequestSupport.hasText(item.getGenericFlg())
                        || OrcaOrderBundleRequestSupport.hasText(item.getUserComment())
                        || OrcaOrderBundleRequestSupport.hasText(item.getRowRole())
                        || OrcaOrderBundleRequestSupport.hasText(item.getRowSubtype())
                        || OrcaOrderBundleRequestSupport.hasText(item.getCategory())
                        || OrcaOrderBundleRequestSupport.hasText(item.getMasterCategory())
                        || OrcaOrderBundleRequestSupport.hasText(item.getItemNumber())
                        || OrcaOrderBundleRequestSupport.hasText(item.getItemNumberBranch())
                        || OrcaOrderBundleRequestSupport.hasText(item.getSelectionCommentItemNumber())
                        || OrcaOrderBundleRequestSupport.hasText(item.getSelectionCommentItemNumberBranch()));
    }

    private static List<OrderBundleMutationRequest.BundleItem> collectItems(OrderBundleMutationRequest.BundleOperation op) {
        List<OrderBundleMutationRequest.BundleItem> collected = new ArrayList<>();
        appendItems(collected, op != null ? op.getItems() : null);
        appendItems(collected, op != null ? op.getMaterialItems() : null);
        appendItems(collected, op != null ? op.getCommentItems() : null);
        return collected;
    }

    private static void appendItems(
            List<OrderBundleMutationRequest.BundleItem> target,
            List<OrderBundleMutationRequest.BundleItem> items) {
        if (items == null || items.isEmpty()) {
            return;
        }
        target.addAll(items);
    }

    private static String resolveEffectiveItemCategory(
            OrderBundleMutationRequest.BundleItem item,
            OrcaOrderBundleItemMemoSupport.ParsedItem parsedMemo) {
        if (item == null) {
            return null;
        }
        if (OrcaOrderBundleRequestSupport.hasText(item.getMasterCategory())) {
            return OrcaOrderBundleItemMemoSupport.normalizeMasterCategory(item.getMasterCategory());
        }
        return parsedMemo != null ? parsedMemo.masterCategory() : null;
    }

    private static void validateBacteriaMetadata(
            String canonicalEntity,
            BacteriaOrderMetadata bacteria,
            ValidationFailure validationFailure) {
        if (bacteria == null) {
            return;
        }
        if (!IInfoModel.ENTITY_BACTERIA_ORDER.equals(canonicalEntity)) {
            throw validationFailure.invalid("bacteria", "bacteria metadata is incompatible with entity");
        }
        validateCarrierComment("bacteria.specimen", bacteria.getSpecimen(), validationFailure);
        if (bacteria.getCarrierComments() != null) {
            for (int i = 0; i < bacteria.getCarrierComments().size(); i += 1) {
                validateCarrierComment("bacteria.carrierComments[" + i + "]", bacteria.getCarrierComments().get(i), validationFailure);
            }
        }
    }

    private static void validateCarrierComment(
            String field,
            BacteriaOrderMetadata.CarrierComment comment,
            ValidationFailure validationFailure) {
        if (comment == null) {
            return;
        }
        String code = OrcaOrderBundleRequestSupport.trimToNull(comment.getCode());
        String name = OrcaOrderBundleRequestSupport.trimToNull(comment.getName());
        String inputValue = OrcaOrderBundleRequestSupport.trimToNull(comment.getInputValue());
        if (code == null && name == null && inputValue == null) {
            return;
        }
        if (code == null || !OrcaOrderBundleRecommendationSupport.isCommentCode(code)) {
            throw validationFailure.invalid(field, "bacteria carrier comment code is invalid");
        }
        if (code.matches("^842\\d{6}$")) {
            if (inputValue == null || !BACTERIA_NUMERIC_COMMENT_VALUE_PATTERN.matcher(inputValue).matches()) {
                throw validationFailure.invalid(field, "842 comment requires numeric inputValue");
            }
            return;
        }
        if (code.matches("^830\\d{6}$") && inputValue == null) {
            throw validationFailure.invalid(field, "830 comment requires inputValue");
        }
    }

    private static String invalidCodeMessage(String canonicalEntity, String rowRole) {
        String normalizedRole = OrcaOrderBundleRequestSupport.normalizeRowRole(rowRole);
        if (IInfoModel.ENTITY_OTHER_ORDER.equals(canonicalEntity)) {
            return "otherOrder items must use etensu category 8 sendable codes";
        }
        if (OrcaOrderBundleRequestSupport.ROW_ROLE_BODY_PART.equals(normalizedRole)) {
            return "bodyPart must use 002 code";
        }
        if (OrcaOrderBundleRequestSupport.ROW_ROLE_COMMENT.equals(normalizedRole)) {
            return "comment rows must use comment code";
        }
        if (OrcaOrderBundleRequestSupport.ROW_ROLE_MATERIAL.equals(normalizedRole)) {
            return "auxiliary rows require sendable 9-digit code";
        }
        if (IInfoModel.ENTITY_TREATMENT.equals(canonicalEntity)
                || IInfoModel.ENTITY_GENERAL_ORDER.equals(canonicalEntity)
                || IInfoModel.ENTITY_RADIOLOGY_ORDER.equals(canonicalEntity)
                || "testOrder".equals(canonicalEntity)
                || IInfoModel.ENTITY_PHYSIOLOGY_ORDER.equals(canonicalEntity)
                || IInfoModel.ENTITY_BACTERIA_ORDER.equals(canonicalEntity)) {
            return "main rows require sendable 9-digit code";
        }
        return "rowRole is incompatible with code";
    }

    private static void createDocument(
            KarteBean karte,
            UserModel user,
            OrderBundleMutationRequest.BundleOperation op,
            Date performDate,
            Persistence persistence,
            FailureBuilder failureBuilder,
            List<Long> created) {
        try {
            DocumentModel document = OrcaOrderBundleMutationSupport.buildDocument(karte, user, op, performDate);
            long id = persistence.addDocument(document);
            persistence.flush();
            created.add(id);
        } catch (RuntimeException ex) {
            throw failureBuilder.build(null, "create", ex);
        }
    }

    private static void updateDocument(
            UserModel user,
            OrderBundleMutationRequest.BundleOperation op,
            Date performDate,
            DocumentFetcher documentFetcher,
            Persistence persistence,
            FailureBuilder failureBuilder,
            ValidationFailure validationFailure,
            List<Long> updated) {
        Long documentId = op.getDocumentId();
        if (documentId == null || documentId <= 0) {
            throw validationFailure.invalid("documentId", "documentId is required");
        }
        DocumentModel document = documentFetcher.fetch(documentId);
        if (document == null) {
            return;
        }
        try {
            OrcaOrderBundleMutationSupport.updateDocumentWithBundle(document, user, op, performDate);
            persistence.updateDocument(document);
            persistence.flush();
            updated.add(documentId);
        } catch (RuntimeException ex) {
            throw failureBuilder.build(documentId, "update", ex);
        }
    }

    private static void deleteDocument(
            OrderBundleMutationRequest.BundleOperation op,
            Persistence persistence,
            FailureBuilder failureBuilder,
            ValidationFailure validationFailure,
            List<Long> deleted) {
        Long documentId = op.getDocumentId();
        if (documentId == null || documentId <= 0) {
            throw validationFailure.invalid("documentId", "documentId is required");
        }
        try {
            persistence.deleteDocument(documentId);
            persistence.flush();
            deleted.add(documentId);
        } catch (RuntimeException ex) {
            throw failureBuilder.build(documentId, "delete", ex);
        }
    }

    record MutationResult(List<Long> created, List<Long> updated, List<Long> deleted) {
    }

    @FunctionalInterface
    interface DateValidator {
        Date require(String operation, String field, String input, boolean required);
    }

    @FunctionalInterface
    interface DocumentFetcher {
        DocumentModel fetch(long documentId);
    }

    interface Persistence {
        long addDocument(DocumentModel document);
        void updateDocument(DocumentModel document);
        void deleteDocument(long documentId);
        void flush();
    }

    @FunctionalInterface
    interface FailureBuilder {
        RuntimeException build(Long documentId, String operation, RuntimeException ex);
    }

    @FunctionalInterface
    interface ValidationFailure {
        RuntimeException invalid(String field, String message);
    }
}
