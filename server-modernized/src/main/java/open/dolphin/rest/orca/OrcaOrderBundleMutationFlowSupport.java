package open.dolphin.rest.orca;

import jakarta.servlet.http.HttpServletRequest;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.UserModel;
import open.dolphin.rest.dto.orca.OrderBundleMutationRequest;
import open.dolphin.rest.dto.orca.OrderBundleMutationResponse;
import open.dolphin.session.KarteServiceBean;
import open.dolphin.session.PatientServiceBean;
import open.dolphin.session.UserServiceBean;
import org.slf4j.Logger;

final class OrcaOrderBundleMutationFlowSupport {

    private OrcaOrderBundleMutationFlowSupport() {
    }

    static MutationFlowResult execute(
            AbstractOrcaRestResource resource,
            Logger logger,
            HttpServletRequest request,
            OrderBundleMutationRequest payload,
            String remoteUser,
            PatientServiceBean patientServiceBean,
            KarteServiceBean karteServiceBean,
            UserServiceBean userServiceBean,
            String facilityId,
            String runId) {
        MutationContext context = validateRequest(
                resource,
                request,
                payload,
                patientServiceBean,
                karteServiceBean,
                facilityId,
                runId);
        UserModel user = userServiceBean.getUser(remoteUser);
        OrcaOrderBundleMutationExecutionSupport.MutationResult mutationResult =
                OrcaOrderBundleMutationExecutionSupport.execute(
                        payload,
                        context.karte(),
                        user,
                        context.orderBundleContext(),
                        (operation, field, input, required) -> OrcaOrderBundleMutationAuditSupport.requireMutationDate(
                                resource,
                                request, facilityId, payload.getPatientId(), runId, operation, field, input, required),
                        documentId -> OrcaOrderBundleQuerySupport.fetchDocument(karteServiceBean, documentId),
                        new OrcaOrderBundleMutationExecutionSupport.Persistence() {
                            @Override
                            public long addDocument(open.dolphin.infomodel.DocumentModel document) {
                                return karteServiceBean.addDocument(document);
                            }

                            @Override
                            public void updateDocument(open.dolphin.infomodel.DocumentModel document) {
                                karteServiceBean.updateDocument(document);
                            }

                            @Override
                            public void deleteDocument(long documentId) {
                                karteServiceBean.deleteDocument(documentId);
                            }

                            @Override
                            public void flush() {
                                karteServiceBean.flush();
                            }
                        },
                        (documentId, operation, ex) -> OrcaOrderBundleMutationAuditSupport.buildOrderBundleFailure(
                                resource,
                                logger,
                                request, runId, facilityId, payload.getPatientId(), context.karteId(), documentId, operation, ex),
                        (field, message) -> OrcaOrderBundleMutationAuditSupport.validationFailure(
                                resource,
                                request, facilityId, payload.getPatientId(), runId, field, message));
        List<Long> created = mutationResult.created();
        List<Long> updated = mutationResult.updated();
        List<Long> deleted = mutationResult.deleted();
        return new MutationFlowResult(
                buildResponse(runId, created, updated, deleted),
                buildAudit(facilityId, payload.getPatientId(), runId, created, updated, deleted));
    }

    private static MutationContext validateRequest(
            AbstractOrcaRestResource resource,
            HttpServletRequest request,
            OrderBundleMutationRequest payload,
            PatientServiceBean patientServiceBean,
            KarteServiceBean karteServiceBean,
            String facilityId,
            String runId) {
        if (payload == null || payload.getPatientId() == null || payload.getPatientId().isBlank()) {
            throw validationFailure(resource, request, facilityId, null, runId, "patientId", "patientId is required");
        }
        Map<String, Object> orderBundleContext = new HashMap<>();
        orderBundleContext.put("facilityId", facilityId);
        orderBundleContext.put("runId", runId);
        if (patientServiceBean.getPatientById(facilityId, payload.getPatientId()) == null) {
            throw notFoundFailure(resource, request, facilityId, payload.getPatientId(), runId, "patient_not_found", "Patient not found");
        }
        orderBundleContext.put("patientId", payload.getPatientId());
        request.setAttribute(OrcaOrderBundleResource.ORDER_BUNDLE_CONTEXT_KEY, orderBundleContext);
        KarteBean karte = karteServiceBean.getKarte(facilityId, payload.getPatientId(), null);
        if (karte == null) {
            throw notFoundFailure(resource, request, facilityId, payload.getPatientId(), runId, "karte_not_found", "Karte not found");
        }
        orderBundleContext.put("karteId", karte.getId());
        if (payload.getOperations() == null || payload.getOperations().isEmpty()) {
            throw validationFailure(resource, request, facilityId, payload.getPatientId(), runId, "operations", "operations is required");
        }
        return new MutationContext(karte, karte.getId(), orderBundleContext);
    }

    private static OrderBundleMutationResponse buildResponse(
            String runId,
            List<Long> created,
            List<Long> updated,
            List<Long> deleted) {
        OrderBundleMutationResponse response = new OrderBundleMutationResponse();
        response.setApiResult("00");
        response.setApiResultMessage("処理終了");
        response.setRunId(runId);
        response.setCreatedDocumentIds(created);
        response.setUpdatedDocumentIds(updated);
        response.setDeletedDocumentIds(deleted);
        return response;
    }

    private static Map<String, Object> buildAudit(
            String facilityId,
            String patientId,
            String runId,
            List<Long> created,
            List<Long> updated,
            List<Long> deleted) {
        Map<String, Object> audit = new HashMap<>();
        audit.put("facilityId", facilityId);
        audit.put("patientId", patientId);
        audit.put("runId", runId);
        audit.put("created", created.size());
        audit.put("updated", updated.size());
        audit.put("deleted", deleted.size());
        return audit;
    }

    private static RuntimeException validationFailure(
            AbstractOrcaRestResource resource,
            HttpServletRequest request,
            String facilityId,
            String patientId,
            String runId,
            String field,
            String message) {
        return OrcaOrderBundleMutationAuditSupport.validationFailure(
                resource,
                request,
                facilityId,
                patientId,
                runId,
                field,
                message);
    }

    private static RuntimeException notFoundFailure(
            AbstractOrcaRestResource resource,
            HttpServletRequest request,
            String facilityId,
            String patientId,
            String runId,
            String errorCode,
            String message) {
        Map<String, Object> audit = new HashMap<>();
        audit.put("facilityId", facilityId);
        audit.put("patientId", patientId);
        audit.put("runId", runId);
        resource.markFailureDetails(audit, 404, errorCode, message);
        resource.recordAudit(request, "ORCA_ORDER_BUNDLE_MUTATION", audit, open.dolphin.audit.AuditEventEnvelope.Outcome.FAILURE);
        return resource.restError(request, jakarta.ws.rs.core.Response.Status.NOT_FOUND, errorCode, message);
    }

    record MutationFlowResult(
            OrderBundleMutationResponse response,
            Map<String, Object> audit) {
    }

    private record MutationContext(
            KarteBean karte,
            Long karteId,
            Map<String, Object> orderBundleContext) {
    }
}
