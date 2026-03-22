package open.dolphin.rest.orca;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import open.dolphin.infomodel.DocumentModel;
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
