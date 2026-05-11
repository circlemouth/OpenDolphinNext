package open.dolphin.rest.orca;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.inject.Inject;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.rest.dto.orca.PrescriptionAuthorityMutationRequest;
import open.dolphin.rest.dto.orca.PrescriptionAuthorityMutationResponse;
import open.dolphin.rest.dto.orca.PrescriptionOrder;
import open.dolphin.security.audit.AuthoritativeAuditRepository;
import open.dolphin.session.PatientServiceBean;

@Path("/prescriptions")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class PrescriptionAuthorityResource extends AbstractOrcaRestResource {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper().findAndRegisterModules();
    private static final String AUDIT_CREATE = "PRESCRIPTION_ORDER_CREATE";
    private static final String AUDIT_FINALIZE = "PRESCRIPTION_ORDER_FINALIZE";
    private static final String AUDIT_CHANGE = "PRESCRIPTION_ORDER_CHANGE";
    private static final String AUDIT_STOP = "PRESCRIPTION_ORDER_STOP";
    private static final String AUDIT_CANCEL = "PRESCRIPTION_ORDER_CANCEL";
    private static final String AUDIT_REISSUE = "PRESCRIPTION_ORDER_REISSUE";

    @Inject
    PatientServiceBean patientServiceBean;

    @Inject
    PrescriptionAuthorityRepository prescriptionAuthorityRepository;

    @Inject
    AuthoritativeAuditRepository authoritativeAuditRepository;

    @POST
    @Transactional
    public PrescriptionAuthorityMutationResponse createDraft(
            @Context HttpServletRequest request,
            PrescriptionAuthorityMutationRequest payload) {
        String runId = resolveRunId(request);
        String actor = requireRemoteUser(request);
        String facilityId = requireFacilityId(request);
        requireAuditWritePathAvailable(request);
        if (payload == null || payload.getOrder() == null) {
            failValidation(request, AUDIT_CREATE, facilityId, null, runId, "order", "order is required");
        }
        String patientId = trimToNull(firstNonBlank(payload.getPatientId(), payload.getOrder().getPatientId()));
        if (patientId == null) {
            failValidation(request, AUDIT_CREATE, facilityId, null, runId, "patientId", "patientId is required");
        }
        ensurePatientExists(request, AUDIT_CREATE, facilityId, patientId, runId);
        PrescriptionOrder order = copyOrder(payload.getOrder());
        order.setPatientId(patientId);
        order.setEncounterId(trimToNull(firstNonBlank(payload.getEncounterId(), order.getEncounterId())));
        validateOrderHasItems(request, AUDIT_CREATE, facilityId, patientId, runId, order);
        PrescriptionAuthorityRepository.PrescriptionMutationResult result =
                prescriptionAuthorityRepository.createDraft(
                        facilityId,
                        patientId,
                        order.getEncounterId(),
                        trimToNull(payload.getChartRevisionId()),
                        order,
                        actor,
                        Instant.now());
        recordSuccess(request, AUDIT_CREATE, facilityId, patientId, runId, result, null);
        return response(runId, result);
    }

    @POST
    @Path("/{prescriptionId}/finalize")
    @Transactional
    public PrescriptionAuthorityMutationResponse finalizeDraft(
            @Context HttpServletRequest request,
            @PathParam("prescriptionId") long prescriptionId,
            PrescriptionAuthorityMutationRequest payload) {
        String runId = resolveRunId(request);
        String actor = requireRemoteUser(request);
        requireFacilityId(request);
        requireAuditWritePathAvailable(request);
        PrescriptionAuthorityRepository.PrescriptionMutationResult result;
        try {
            result = prescriptionAuthorityRepository.finalizeDraft(prescriptionId, actor, Instant.now());
        } catch (IllegalStateException ex) {
            throw restError(request, statusForStateError(ex),
                    ex.getMessage(),
                    "Prescription order cannot be finalized in its current state");
        }
        recordSuccess(request, AUDIT_FINALIZE, null, result.patientId(), runId, result, null);
        return response(runId, result);
    }

    @POST
    @Path("/{prescriptionId}/change")
    @Transactional
    public PrescriptionAuthorityMutationResponse change(
            @Context HttpServletRequest request,
            @PathParam("prescriptionId") long prescriptionId,
            PrescriptionAuthorityMutationRequest payload) {
        return transition(request, prescriptionId, payload, "CHANGED", "CHANGE", AUDIT_CHANGE, true);
    }

    @POST
    @Path("/{prescriptionId}/stop")
    @Transactional
    public PrescriptionAuthorityMutationResponse stop(
            @Context HttpServletRequest request,
            @PathParam("prescriptionId") long prescriptionId,
            PrescriptionAuthorityMutationRequest payload) {
        return transition(request, prescriptionId, payload, "STOPPED", "STOP", AUDIT_STOP, false);
    }

    @POST
    @Path("/{prescriptionId}/cancel")
    @Transactional
    public PrescriptionAuthorityMutationResponse cancel(
            @Context HttpServletRequest request,
            @PathParam("prescriptionId") long prescriptionId,
            PrescriptionAuthorityMutationRequest payload) {
        return transition(request, prescriptionId, payload, "CANCELLED", "CANCEL", AUDIT_CANCEL, false);
    }

    @POST
    @Path("/{prescriptionId}/reissue")
    @Transactional
    public PrescriptionAuthorityMutationResponse reissue(
            @Context HttpServletRequest request,
            @PathParam("prescriptionId") long prescriptionId,
            PrescriptionAuthorityMutationRequest payload) {
        return transition(request, prescriptionId, payload, "REISSUED", "REISSUE", AUDIT_REISSUE, true);
    }

    private PrescriptionAuthorityMutationResponse transition(HttpServletRequest request,
            long prescriptionId,
            PrescriptionAuthorityMutationRequest payload,
            String status,
            String eventType,
            String auditAction,
            boolean requiresOrder) {
        String runId = resolveRunId(request);
        String actor = requireRemoteUser(request);
        String facilityId = requireFacilityId(request);
        requireAuditWritePathAvailable(request);
        if (payload == null || trimToNull(payload.getReasonText()) == null) {
            failValidation(request, auditAction, facilityId, null, runId, "reasonText", "reasonText is required");
        }
        PrescriptionOrder order = payload.getOrder() != null ? copyOrder(payload.getOrder()) : null;
        if (requiresOrder) {
            if (order == null) {
                failValidation(request, auditAction, facilityId, null, runId, "order", "order is required");
            }
            validateOrderHasItems(request, auditAction, facilityId, trimToNull(order.getPatientId()), runId, order);
        }
        PrescriptionAuthorityRepository.PrescriptionMutationResult result;
        try {
            result = prescriptionAuthorityRepository.transition(
                    prescriptionId,
                    status,
                    eventType,
                    trimToNull(payload.getReasonCode()),
                    trimToNull(payload.getReasonText()),
                    order,
                    actor,
                    Instant.now(),
                    null);
        } catch (IllegalStateException ex) {
            throw restError(request, statusForStateError(ex),
                    ex.getMessage(),
                    "Prescription order cannot transition in its current state");
        }
        recordSuccess(request, auditAction, facilityId, result.patientId(), runId, result, trimToNull(payload.getReasonText()));
        return response(runId, result);
    }

    private void requireAuditWritePathAvailable(HttpServletRequest request) {
        if (authoritativeAuditRepository != null && authoritativeAuditRepository.isWritePathAvailable()) {
            return;
        }
        throw restError(request, Response.Status.SERVICE_UNAVAILABLE,
                "audit_log_write_unavailable",
                "Audit log write path is unavailable");
    }

    private Response.Status statusForStateError(IllegalStateException ex) {
        if (ex != null && "prescription_order_not_found".equals(ex.getMessage())) {
            return Response.Status.NOT_FOUND;
        }
        return Response.Status.CONFLICT;
    }

    private void ensurePatientExists(HttpServletRequest request,
            String action,
            String facilityId,
            String patientId,
            String runId) {
        PatientModel patient = patientServiceBean.getPatientById(facilityId, patientId);
        if (patient != null) {
            return;
        }
        Map<String, Object> details = details(facilityId, patientId, runId, null);
        markFailureDetails(details, Response.Status.NOT_FOUND.getStatusCode(), "patient_not_found", "Patient not found");
        recordAudit(request, action, details, AuditEventEnvelope.Outcome.FAILURE);
        throw restError(request, Response.Status.NOT_FOUND, "patient_not_found", "Patient not found", details, null);
    }

    private void validateOrderHasItems(HttpServletRequest request,
            String action,
            String facilityId,
            String patientId,
            String runId,
            PrescriptionOrder order) {
        boolean hasDrug = order != null
                && order.getRps() != null
                && order.getRps().stream()
                        .filter(rp -> rp != null && rp.getDrugs() != null)
                        .flatMap(rp -> rp.getDrugs().stream())
                        .anyMatch(drug -> drug != null && trimToNull(drug.getName()) != null);
        if (!hasDrug) {
            failValidation(request, action, facilityId, patientId, runId, "order.rps", "at least one prescription item is required");
        }
    }

    private void failValidation(HttpServletRequest request,
            String action,
            String facilityId,
            String patientId,
            String runId,
            String field,
            String message) {
        Map<String, Object> details = details(facilityId, patientId, runId, null);
        details.put("field", field);
        markFailureDetails(details, Response.Status.BAD_REQUEST.getStatusCode(), "invalid_request", message);
        recordAudit(request, action, details, AuditEventEnvelope.Outcome.FAILURE);
        throw validationError(request, field, message);
    }

    private void recordSuccess(HttpServletRequest request,
            String action,
            String facilityId,
            String patientId,
            String runId,
            PrescriptionAuthorityRepository.PrescriptionMutationResult result,
            String reasonText) {
        Map<String, Object> details = details(facilityId, patientId, runId, result);
        if (reasonText != null) {
            details.put("reasonProvided", Boolean.TRUE);
        }
        markSuccessDetails(details);
        recordAudit(request, action, details, AuditEventEnvelope.Outcome.SUCCESS);
    }

    private Map<String, Object> details(String facilityId,
            String patientId,
            String runId,
            PrescriptionAuthorityRepository.PrescriptionMutationResult result) {
        Map<String, Object> details = new HashMap<>();
        details.put("facilityId", facilityId);
        details.put("patientId", patientId);
        details.put("runId", runId);
        if (result != null) {
            details.put("prescriptionId", result.orderId());
            details.put("revisionId", result.revisionId());
            details.put("status", result.status());
            details.put("encounterId", result.encounterId());
        }
        return details;
    }

    private PrescriptionAuthorityMutationResponse response(
            String runId,
            PrescriptionAuthorityRepository.PrescriptionMutationResult result) {
        PrescriptionAuthorityMutationResponse response = new PrescriptionAuthorityMutationResponse();
        response.setApiResult("00");
        response.setApiResultMessage("処理終了");
        response.setRunId(runId);
        response.setPrescriptionId(result.orderId());
        response.setRevisionId(result.revisionId());
        response.setStatus(result.status());
        response.setContentHash(result.contentHash());
        response.setPatientId(result.patientId());
        response.setEncounterId(result.encounterId());
        return response;
    }

    private PrescriptionOrder copyOrder(PrescriptionOrder source) {
        return OBJECT_MAPPER.convertValue(source, PrescriptionOrder.class);
    }

    private String firstNonBlank(String first, String second) {
        String normalized = trimToNull(first);
        return normalized != null ? normalized : trimToNull(second);
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
