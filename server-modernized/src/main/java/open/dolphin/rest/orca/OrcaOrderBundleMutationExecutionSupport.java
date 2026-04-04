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
        List<OrderBundleMutationRequest.BundleItem> items = op.getItems();
        boolean hasCodedRow = false;
        boolean hasUncodedRow = false;
        boolean hasSendableMainRow = false;
        boolean hasBodyPart = false;
        OrderBundleMutationRequest.BundleItem explicitBodyPart = op.getBodyPart();
        if (hasValuedItem(explicitBodyPart)) {
            if (!OrcaOrderBundleRequestSupport.supportsBodyPartField(canonicalEntity)) {
                throw validationFailure.invalid("bodyPart", "bodyPart is incompatible with entity");
            }
            String explicitBodyPartName = OrcaOrderBundleRequestSupport.trimToNull(explicitBodyPart.getName());
            String explicitBodyPartCode = OrcaOrderBundleRequestSupport.trimToNull(explicitBodyPart.getCode());
            if (explicitBodyPartName == null) {
                throw validationFailure.invalid("bodyPart", "bodyPart name is required");
            }
            if (!OrcaOrderBundleRequestSupport.isValidCodeForRowRole(canonicalEntity, OrcaOrderBundleRequestSupport.ROW_ROLE_BODY_PART, explicitBodyPartCode)) {
                throw validationFailure.invalid("bodyPart", "bodyPart must use 002 code");
            }
            hasBodyPart = true;
        }
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
                    hasSendableMainRow = true;
                }
            } else {
                hasUncodedRow = true;
                if (OrcaOrderBundleRequestSupport.ROW_ROLE_BODY_PART.equals(rowRole)
                        && !OrcaOrderBundleRequestSupport.supportsBodyPartField(canonicalEntity)) {
                    throw validationFailure.invalid("bodyPart", "bodyPart is incompatible with entity");
                }
                if (OrcaOrderBundleRequestSupport.ROW_ROLE_MATERIAL.equals(rowRole)) {
                    throw validationFailure.invalid("items", "material rows require sendable 9-digit code");
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

    private static boolean requiresSendableMainRow(String canonicalEntity) {
        return canonicalEntity != null
                && !IInfoModel.ENTITY_MED_ORDER.equals(canonicalEntity)
                && !IInfoModel.ENTITY_INJECTION_ORDER.equals(canonicalEntity);
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
                        || OrcaOrderBundleRequestSupport.hasText(item.getRowRole()));
    }

    private static String invalidCodeMessage(String canonicalEntity, String rowRole) {
        String normalizedRole = OrcaOrderBundleRequestSupport.normalizeRowRole(rowRole);
        if (IInfoModel.ENTITY_OTHER_ORDER.equals(canonicalEntity)) {
            return "otherOrder items must use code family 8";
        }
        if (OrcaOrderBundleRequestSupport.ROW_ROLE_BODY_PART.equals(normalizedRole)) {
            return "bodyPart must use 002 code";
        }
        if (OrcaOrderBundleRequestSupport.ROW_ROLE_COMMENT.equals(normalizedRole)) {
            return "comment rows must use comment code";
        }
        if (OrcaOrderBundleRequestSupport.ROW_ROLE_MATERIAL.equals(normalizedRole)) {
            return "material rows require sendable 9-digit code";
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
