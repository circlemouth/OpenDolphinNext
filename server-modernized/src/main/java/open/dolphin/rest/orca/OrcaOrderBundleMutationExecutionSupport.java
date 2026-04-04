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
import open.dolphin.rest.dto.orca.OrderBundleMutationRequest;

final class OrcaOrderBundleMutationExecutionSupport {

    private static final Pattern COMMENT_CODE_PATTERN = Pattern.compile("^(008[1-6]|8[1-6]|098|099|98|99)");

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
        boolean hasBodyPart = hasBodyPartItem(op.getBodyPart());
        for (OrderBundleMutationRequest.BundleItem item : items != null ? items : List.<OrderBundleMutationRequest.BundleItem>of()) {
            if (!hasValuedItem(item)) {
                continue;
            }
            String code = OrcaOrderBundleRequestSupport.trimToNull(item.getCode());
                if (code != null) {
                    hasCodedRow = true;
                    if (OrcaOrderBundleRecommendationSupport.isBodyPartCode(code)) {
                        hasBodyPart = true;
                    } else if (!isCommentCode(code)) {
                        if (IInfoModel.ENTITY_OTHER_ORDER.equals(canonicalEntity)
                                && !OrcaOrderBundleRequestSupport.isValidOtherOrderCode(code)) {
                            throw validationFailure.invalid("items", "otherOrder items must use etensu category 8 sendable codes");
                        }
                        hasSendableMainRow = true;
                    }
                } else {
                    hasUncodedRow = true;
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

    private static boolean hasBodyPartItem(OrderBundleMutationRequest.BundleItem item) {
        if (!hasValuedItem(item)) {
            return false;
        }
        String code = OrcaOrderBundleRequestSupport.trimToNull(item.getCode());
        return code != null && OrcaOrderBundleRecommendationSupport.isBodyPartCode(code);
    }

    private static boolean isCommentCode(String code) {
        return COMMENT_CODE_PATTERN.matcher(code).find();
    }

    private static boolean hasValuedItem(OrderBundleMutationRequest.BundleItem item) {
        return item != null
                && (OrcaOrderBundleRequestSupport.hasText(item.getName())
                        || OrcaOrderBundleRequestSupport.hasText(item.getCode())
                        || OrcaOrderBundleRequestSupport.hasText(item.getQuantity())
                        || OrcaOrderBundleRequestSupport.hasText(item.getUnit())
                        || OrcaOrderBundleRequestSupport.hasText(item.getMemo()));
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
