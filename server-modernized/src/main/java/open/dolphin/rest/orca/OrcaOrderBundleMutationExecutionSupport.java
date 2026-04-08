package open.dolphin.rest.orca;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.UserModel;
import open.dolphin.rest.dto.orca.BacteriaOrderMetadata;
import open.dolphin.rest.dto.orca.OrderBundleMutationRequest;

final class OrcaOrderBundleMutationExecutionSupport {

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
        if (!OrcaMedicalClassCatalog.isSupportedEntity(canonicalEntity)) {
            throw validationFailure.invalid("entity", "entity is invalid");
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
        String normalizedClassCode = OrcaOrderBundleRequestSupport.trimToNull(op.getClassCode());
        boolean hasExplicitBodyPart = validateExplicitBodyPart(canonicalEntity, normalizedClassCode, op.getBodyPart(), validationFailure);
        List<OrderBundleMutationRequest.BundleItem> items = collectItems(op);
        boolean hasCodedRow = false;
        boolean hasUncodedRow = false;
        boolean hasSendableMainRow = false;
        boolean hasBodyPart = hasExplicitBodyPart;
        String chargeMainCategory = null;
        for (OrderBundleMutationRequest.BundleItem item : items != null ? items : List.<OrderBundleMutationRequest.BundleItem>of()) {
            if (!hasValuedItem(item)) {
                continue;
            }
            if (!OrcaOrderBundleRequestSupport.hasText(item.getName())) {
                throw validationFailure.invalid("items", "items contain blank name rows");
            }
            String code = OrcaOrderBundleRequestSupport.trimToNull(item.getCode());
            if (OrcaCommentCarrierRules.hasUnknownStructuredFamily(code)) {
                throw validationFailure.invalid("items", "structured comment family is unsupported");
            }
            OrcaOrderBundleItemMemoSupport.ParsedItem parsedMemo = OrcaOrderBundleItemMemoSupport.parse(item.getMemo());
            if (hasUnsupportedSelectionCommentParameter(item, parsedMemo)) {
                throw validationFailure.invalid(
                        "items",
                        "selection comment itemNumber / branch is unsupported for order bundle items");
            }
            String requestedRowRole = OrcaOrderBundleRequestSupport.normalizeRowRole(
                    OrcaOrderBundleRequestSupport.hasText(item.getRowRole()) ? item.getRowRole() : parsedMemo.rowRole());
            String rowRole = OrcaOrderBundleRequestSupport.resolveRowRole(canonicalEntity, requestedRowRole, code);
            if (code != null) {
                hasCodedRow = true;
                if (OrcaOrderBundleRequestSupport.ROW_ROLE_BODY_PART.equals(rowRole)
                        && !OrcaOrderBundleRequestSupport.supportsBodyPartField(canonicalEntity, normalizedClassCode)) {
                    throw validationFailure.invalid("bodyPart", "bodyPart is incompatible with entity");
                }
                if (!OrcaOrderBundleRequestSupport.isValidCodeForRowRole(canonicalEntity, rowRole, code)) {
                    throw validationFailure.invalid("items", invalidCodeMessage(canonicalEntity, rowRole));
                }
                if (OrcaOrderBundleRequestSupport.ROW_ROLE_BODY_PART.equals(rowRole)) {
                    hasBodyPart = true;
                } else if (OrcaOrderBundleRequestSupport.ROW_ROLE_MAIN.equals(rowRole)) {
                    String itemCategory = resolveEffectiveItemCategory(item, parsedMemo);
                    if ((IInfoModel.ENTITY_BASE_CHARGE_ORDER.equals(canonicalEntity)
                            || IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER.equals(canonicalEntity))
                            && itemCategory != null
                            && !OrcaMedicalClassCatalog.isAllowedClassCode(canonicalEntity, itemCategory)) {
                        throw validationFailure.invalid("items", "charge items must use a compatible masterCategory");
                    }
                    if ((IInfoModel.ENTITY_BASE_CHARGE_ORDER.equals(canonicalEntity)
                            || IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER.equals(canonicalEntity))
                            && itemCategory != null) {
                        if (normalizedClassCode != null && !normalizedClassCode.equals(itemCategory)) {
                            throw validationFailure.invalid("items", "charge bundle classCode and main row masterCategory must match");
                        }
                        if (chargeMainCategory == null) {
                            chargeMainCategory = itemCategory;
                        } else if (!chargeMainCategory.equals(itemCategory)) {
                            throw validationFailure.invalid("items", "charge bundle main rows must share one exact masterCategory");
                        }
                    }
                    hasSendableMainRow = true;
                }
            } else {
                hasUncodedRow = true;
                if (OrcaOrderBundleRequestSupport.ROW_ROLE_BODY_PART.equals(rowRole)
                        && !OrcaOrderBundleRequestSupport.supportsBodyPartField(canonicalEntity, normalizedClassCode)) {
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
        if (hasBodyPart && !OrcaOrderBundleRequestSupport.supportsBodyPartField(canonicalEntity, normalizedClassCode)) {
            throw validationFailure.invalid("bodyPart", "bodyPart is incompatible with entity");
        }
        if (requiresSendableMainRow(canonicalEntity, normalizedClassCode) && !hasSendableMainRow) {
            throw validationFailure.invalid("items", "items do not contain a sendable main row");
        }
    }

    private static boolean validateExplicitBodyPart(
            String canonicalEntity,
            String classCode,
            OrderBundleMutationRequest.BundleItem bodyPart,
            ValidationFailure validationFailure) {
        if (!hasValuedItem(bodyPart)) {
            return false;
        }
        if (!OrcaOrderBundleRequestSupport.supportsBodyPartField(canonicalEntity, classCode)) {
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

    private static boolean requiresSendableMainRow(String canonicalEntity, String classCode) {
        return OrcaSendabilityPolicy.requiresSendableMainRow(canonicalEntity, classCode);
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

    private static boolean hasUnsupportedSelectionCommentParameter(
            OrderBundleMutationRequest.BundleItem item,
            OrcaOrderBundleItemMemoSupport.ParsedItem parsedMemo) {
        if (item == null) {
            return false;
        }
        return OrcaOrderBundleRequestSupport.hasText(item.getSelectionCommentItemNumber())
                || OrcaOrderBundleRequestSupport.hasText(item.getSelectionCommentItemNumberBranch())
                || OrcaOrderBundleRequestSupport.hasText(item.getItemNumber())
                || OrcaOrderBundleRequestSupport.hasText(item.getItemNumberBranch())
                || (parsedMemo != null
                        && (OrcaOrderBundleRequestSupport.hasText(parsedMemo.itemNumber())
                                || OrcaOrderBundleRequestSupport.hasText(parsedMemo.itemNumberBranch())));
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
        if (code == null || !OrcaCommentCarrierRules.isKnownCommentCode(code)
                || !OrcaCommentCarrierRules.isBacteriaStructuredFamilyAllowed(code)) {
            throw validationFailure.invalid(field, "bacteria carrier comment code is invalid");
        }
        if (!OrcaCommentCarrierRules.hasSupportedValue(code, inputValue)) {
            throw validationFailure.invalid(field, "bacteria carrier comment requires a supported inputValue");
        }
    }

    private static String invalidCodeMessage(String canonicalEntity, String rowRole) {
        String normalizedRole = OrcaOrderBundleRequestSupport.normalizeRowRole(rowRole);
        if (IInfoModel.ENTITY_OTHER_ORDER.equals(canonicalEntity)) {
            return "otherOrder items are local-only";
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
        if (OrcaSendabilityPolicy.isSendableEntity(canonicalEntity)) {
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
