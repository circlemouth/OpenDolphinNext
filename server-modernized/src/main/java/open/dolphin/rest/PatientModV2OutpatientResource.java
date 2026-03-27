package open.dolphin.rest;

import jakarta.inject.Inject;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.orca.service.OrcaLiveGateway;
import open.dolphin.orca.sync.OrcaPatientSyncService;
import open.dolphin.orca.transport.OrcaTransport;
import open.dolphin.rest.orca.AbstractOrcaRestResource;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.SessionAuditDispatcher;
import open.dolphin.session.PatientServiceBean;

/**
 * Web client endpoint for /api/orca/patientmodv2/outpatient.
 *
 * <p>Updates are reflected to ORCA (patientmodv2 class=02) and then re-imported (ORCA -> local)
 * so the local patient table stays consistent with ORCA.</p>
 */
@Path("/orca/patientmodv2/outpatient")
public final class PatientModV2OutpatientResource extends AbstractResource {

    private static final String DATA_SOURCE_SERVER = "server";
    private static final String AUDIT_ACTION = "ORCA_PATIENT_MUTATION";

    @Inject
    private PatientServiceBean patientServiceBean;

    @Inject
    private SessionAuditDispatcher sessionAuditDispatcher;

    @Inject
    private OrcaTransport orcaTransport;

    @Inject
    private OrcaLiveGateway orcaWrapperService;

    @Inject
    private OrcaPatientSyncService orcaPatientSyncService;

    void setPatientServiceBean(PatientServiceBean patientServiceBean) {
        this.patientServiceBean = patientServiceBean;
    }

    void setOrcaTransport(OrcaTransport orcaTransport) {
        this.orcaTransport = orcaTransport;
    }

    void setOrcaLiveGateway(OrcaLiveGateway orcaWrapperService) {
        this.orcaWrapperService = orcaWrapperService;
    }

    void setOrcaPatientSyncService(OrcaPatientSyncService orcaPatientSyncService) {
        this.orcaPatientSyncService = orcaPatientSyncService;
    }

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response mutatePatient(@Context HttpServletRequest request, Map<String, Object> payload) {
        return handleMutation(request, payload, DATA_SOURCE_SERVER, false);
    }

    private Response handleMutation(HttpServletRequest request,
            Map<String, Object> payload,
            String dataSource,
            boolean fallbackUsed) {
        String runId = AbstractOrcaRestResource.resolveRunIdValue(request);
        String traceId = resolveTraceId(request);
        String requestId = resolveRequestId(request, traceId);
        String facilityId = requireFacilityId(request);
        if (facilityId == null || facilityId.isBlank()) {
            throw restError(request, Response.Status.UNAUTHORIZED, "facility_missing", "Facility is required");
        }

        String operation = PatientModV2OutpatientSupport.getNonBlankText(payload, "operation");
        if (operation == null) {
            throw restError(request, Response.Status.BAD_REQUEST, "invalid_request", "operation is required");
        }

        PatientModV2OutpatientSupport.PatientPatch patch = PatientModV2OutpatientSupport.toPatientPatch(payload);
        if (patch.patientId == null || patch.patientId.isBlank()) {
            throw restError(request, Response.Status.BAD_REQUEST, "invalid_request", "patientId is required");
        }

        Map<String, Object> response = createBaseResponse(runId, traceId, requestId, dataSource, fallbackUsed, facilityId);
        Map<String, Object> details = createAuditDetails(request, operation, patch, runId, dataSource, fallbackUsed, facilityId,
                response.get("fetchedAt"));

        boolean success = false;
        Response.Status status = Response.Status.OK;
        String apiResult = "00";
        String apiResultMessage = "OK";
        PatientModel syncedPatient = null;

        try {
            MutationOutcome outcome = executeOperation(request, operation, facilityId, patch, runId, response, details);
            success = outcome.success();
            status = outcome.status();
            apiResult = outcome.apiResult();
            apiResultMessage = outcome.apiResultMessage();
            syncedPatient = outcome.patient();
        } catch (RuntimeException ex) {
            details.put("errorMessage", ex.getMessage());
            dispatchAuditEvent(request, details, AUDIT_ACTION, AuditEventEnvelope.Outcome.FAILURE);
            throw ex;
        }

        response.put("apiResult", apiResult);
        response.put("apiResultMessage", apiResultMessage);
        response.put("operation", operation);
        response.put("status", status.getStatusCode());
        response.put("patientDbId", syncedPatient != null ? syncedPatient.getId() : null);
        response.put("patient", syncedPatient != null
                ? PatientModV2OutpatientSupport.toPatientRecord(syncedPatient)
                : patch.toResponse());
        response.put("auditEvent", createAuditEvent(details, traceId, requestId, success));

        dispatchAuditEvent(request, details, AUDIT_ACTION,
                success ? AuditEventEnvelope.Outcome.SUCCESS : AuditEventEnvelope.Outcome.FAILURE);

        Response.ResponseBuilder builder = Response.status(status).entity(response);
        applyObservabilityHeaders(builder, runId, traceId, requestId, dataSource, fallbackUsed);
        return builder.build();
    }

    private MutationOutcome executeOperation(HttpServletRequest request,
            String operation,
            String facilityId,
            PatientModV2OutpatientSupport.PatientPatch patch,
            String runId,
            Map<String, Object> response,
            Map<String, Object> details) {
        switch (operation.toLowerCase(Locale.ROOT)) {
            case "create" -> {
                return handleCreate(request, facilityId, patch, runId, response, details);
            }
            case "update" -> {
                return handleUpdate(facilityId, patch, runId, details);
            }
            case "delete" -> {
                return new MutationOutcome(
                        false,
                        Response.Status.FORBIDDEN,
                        "79",
                        "患者削除は電子カルテ側から実行できません（ORCA側で操作してください）",
                        null);
            }
            default -> throw restError(request, Response.Status.BAD_REQUEST, "invalid_request",
                    "Unsupported operation: " + operation);
        }
    }

    private MutationOutcome handleCreate(HttpServletRequest request,
            String facilityId,
            PatientModV2OutpatientSupport.PatientPatch patch,
            String runId,
            Map<String, Object> response,
            Map<String, Object> details) {
        if (patientServiceBean == null) {
            throw new IllegalStateException("PatientServiceBean is not available");
        }
        PatientModel existing = patientServiceBean.getPatientById(facilityId, patch.patientId);
        if (existing != null) {
            if (!PatientModV2OutpatientSupport.matchesLocalPatient(existing, patch)) {
                details.put("idempotent", Boolean.FALSE);
                details.put("idempotentReason", "existing_patient_conflict");
                details.put("localPatientDbId", existing.getId());
                details.put("localPatientSnapshot", PatientModV2OutpatientSupport.toPatientRecord(existing));
                throw restError(request, Response.Status.CONFLICT, "patient_exists",
                        "患者が既に存在します。患者IDと内容を確認してください。");
            }
            response.put("idempotent", Boolean.TRUE);
            response.put("idempotentReason", "existing_patient");
            details.put("idempotent", Boolean.TRUE);
            details.put("idempotentReason", "existing_patient");
            return new MutationOutcome(true, Response.Status.OK, "00", "既存患者のためスキップしました", existing);
        }

        PatientModel imported = orcaCoordinator().importFromOrcaAndFetchLocal(facilityId, patch.patientId, runId, details);
        return new MutationOutcome(true, Response.Status.OK, "00", "ORCAから取り込みました", imported);
    }

    private MutationOutcome handleUpdate(String facilityId,
            PatientModV2OutpatientSupport.PatientPatch patch,
            String runId,
            Map<String, Object> details) {
        PatientModV2OutpatientSupport.OrcaMutationResult result =
                orcaCoordinator().updateOrcaAndSyncLocal(facilityId, patch, runId, details);
        return new MutationOutcome(true, Response.Status.OK, result.apiResult, result.apiResultMessage, result.patient);
    }

    private PatientModV2OutpatientOrcaCoordinator orcaCoordinator() {
        return new PatientModV2OutpatientOrcaCoordinator(
                patientServiceBean,
                orcaTransport,
                orcaWrapperService,
                orcaPatientSyncService);
    }

    private Map<String, Object> createBaseResponse(String runId,
            String traceId,
            String requestId,
            String dataSource,
            boolean fallbackUsed,
            String facilityId) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("runId", runId);
        response.put("traceId", traceId);
        response.put("requestId", requestId);
        response.put("dataSource", dataSource);
        response.put("dataSourceTransition", dataSource);
        response.put("cacheHit", Boolean.FALSE);
        response.put("missingMaster", Boolean.FALSE);
        response.put("fallbackUsed", fallbackUsed);
        response.put("fetchedAt", Instant.now().toString());
        response.put("facilityId", facilityId);
        return response;
    }

    private Map<String, Object> createAuditDetails(HttpServletRequest request,
            String operation,
            PatientModV2OutpatientSupport.PatientPatch patch,
            String runId,
            String dataSource,
            boolean fallbackUsed,
            String facilityId,
            Object fetchedAt) {
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("resource", request != null ? request.getRequestURI() : "/api/orca/patientmodv2/outpatient");
        details.put("operation", operation);
        details.put("patientId", patch.patientId);
        details.put("runId", runId);
        details.put("dataSource", dataSource);
        details.put("dataSourceTransition", dataSource);
        details.put("cacheHit", Boolean.FALSE);
        details.put("missingMaster", Boolean.FALSE);
        details.put("fallbackUsed", fallbackUsed);
        details.put("fetchedAt", fetchedAt);
        details.put("facilityId", facilityId);
        if (patch.changedKeys != null && !patch.changedKeys.isEmpty()) {
            details.put("changedKeys", List.copyOf(patch.changedKeys));
        }
        return details;
    }

    private Map<String, Object> createAuditEvent(Map<String, Object> details, String traceId, String requestId, boolean success) {
        Map<String, Object> auditEvent = new LinkedHashMap<>();
        auditEvent.put("action", AUDIT_ACTION);
        auditEvent.put("resource", details.get("resource"));
        auditEvent.put("outcome", success ? "SUCCESS" : "FAILURE");
        auditEvent.put("details", details);
        auditEvent.put("traceId", traceId);
        auditEvent.put("requestId", requestId);
        return auditEvent;
    }

    private String resolveRequestId(HttpServletRequest request, String traceId) {
        if (request != null) {
            String header = request.getHeader("X-Request-Id");
            if (header != null && !header.isBlank()) {
                return header.trim();
            }
        }
        return traceId;
    }

    private String requireFacilityId(HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        String remoteUser = request.getRemoteUser();
        String facilityId = getRemoteFacility(remoteUser);
        if (facilityId != null && !facilityId.isBlank()) {
            return facilityId;
        }
        String header = request.getHeader("X-Facility-Id");
        if (header != null && !header.isBlank()) {
            return header.trim();
        }
        return null;
    }

    private void dispatchAuditEvent(HttpServletRequest request,
            Map<String, Object> details,
            String action,
            AuditEventEnvelope.Outcome outcome) {
        if (sessionAuditDispatcher == null) {
            return;
        }
        AuditEventPayload payload = new AuditEventPayload();
        payload.setAction(action);
        payload.setResource(request != null ? request.getRequestURI() : "/api/orca/patientmodv2/outpatient");
        payload.setDetails(details);
        payload.setTraceId(resolveTraceId(request));
        payload.setRequestId(request != null ? request.getHeader("X-Request-Id") : null);
        if (request != null) {
            payload.setActorId(request.getRemoteUser());
            payload.setIpAddress(request.getRemoteAddr());
            payload.setUserAgent(request.getHeader("User-Agent"));
        }
        sessionAuditDispatcher.record(payload, outcome, null, null);
    }

    private void applyObservabilityHeaders(Response.ResponseBuilder builder,
            String runId,
            String traceId,
            String requestId,
            String dataSourceTransition,
            boolean fallbackUsed) {
        if (builder == null) {
            return;
        }
        if (runId != null && !runId.isBlank()) {
            builder.header("x-run-id", runId);
        }
        if (traceId != null && !traceId.isBlank()) {
            builder.header("x-trace-id", traceId);
        }
        if (requestId != null && !requestId.isBlank()) {
            builder.header("x-request-id", requestId);
        }
        if (dataSourceTransition != null && !dataSourceTransition.isBlank()) {
            builder.header("x-data-source-transition", dataSourceTransition);
            builder.header("x-datasource-transition", dataSourceTransition);
        }
        builder.header("x-cache-hit", "false");
        builder.header("x-missing-master", "false");
        builder.header("x-fallback-used", String.valueOf(fallbackUsed));
    }

    private record MutationOutcome(
            boolean success,
            Response.Status status,
            String apiResult,
            String apiResultMessage,
            PatientModel patient) {
    }
}
