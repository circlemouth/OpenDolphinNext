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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.orca.service.OrcaLiveGateway;
import open.dolphin.orca.sync.OrcaPatientSyncService;
import open.dolphin.orca.transport.OrcaTransport;
import open.dolphin.rest.dto.orca.OfficialPatientCreateRequest;
import open.dolphin.rest.dto.orca.OfficialPatientMutationResponse;
import open.dolphin.rest.dto.orca.OfficialPatientUpdateRequest;
import open.dolphin.rest.dto.outpatient.OutpatientFlagResponse;
import open.dolphin.rest.orca.AbstractOrcaRestResource;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.SessionAuditDispatcher;
import open.dolphin.session.PatientServiceBean;

/**
 * Web client endpoint for official ORCA patient create/update.
 *
 * <p>Create/update are reflected to ORCA (patientmodv2 class=01/class=02) and then re-imported (ORCA -> local)
 * so the local patient table stays consistent with ORCA.</p>
 */
@Path("/orca/patientmodv2/outpatient")
public final class PatientModV2OutpatientResource extends AbstractResource {

    private static final String DATA_SOURCE_SERVER = "server";
    private static final String ROUTE_NAMESPACE = "official";
    private static final String CREATE_RESOURCE_PATH = "/api/orca/patientmodv2/outpatient/create";
    private static final String UPDATE_RESOURCE_PATH = "/api/orca/patientmodv2/outpatient/update";
    private static final String CREATE_AUDIT_ACTION = "OFFICIAL_PATIENT_CREATE";
    private static final String UPDATE_AUDIT_ACTION = "OFFICIAL_PATIENT_UPDATE";

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
    @Path("/create")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response createPatient(@Context HttpServletRequest request, OfficialPatientCreateRequest body) {
        return handleCreate(request, body);
    }

    @POST
    @Path("/update")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response updatePatient(@Context HttpServletRequest request, OfficialPatientUpdateRequest body) {
        return handleUpdate(request, body);
    }

    Response mutatePatient(HttpServletRequest request, Map<String, Object> payload) {
        throw new UnsupportedOperationException("legacy multiplexed patient mutation route is removed");
    }

    private Response handleCreate(HttpServletRequest request, OfficialPatientCreateRequest body) {
        String runId = AbstractOrcaRestResource.resolveRunIdValue(request);
        String traceId = resolveTraceId(request);
        String requestId = resolveRequestId(request, traceId);
        String facilityId = requireFacilityId(request);
        if (facilityId == null || facilityId.isBlank()) {
            throw restError(request, Response.Status.UNAUTHORIZED, "facility_missing", "Facility is required");
        }
        PatientModV2OutpatientSupport.PatientPatch patch = PatientModV2OutpatientSupport.toCreatePatch(body);
        OfficialPatientMutationResponse response = createBaseResponse(runId, traceId, requestId);
        Map<String, Object> details = createAuditDetails(request, "create", patch, runId, facilityId, response.getFetchedAt());
        PatientModV2OutpatientSupport.applyAuditMeta(details, body != null ? body.getAuditMeta() : null);

        try {
            PatientModV2OutpatientSupport.OrcaMutationResult result =
                    orcaCoordinator().createOrcaAndSyncLocal(facilityId, patch, runId, details);
            populateSuccessResponse(response, result, details, traceId, requestId, CREATE_AUDIT_ACTION);
            dispatchAuditEvent(request, details, CREATE_AUDIT_ACTION, AuditEventEnvelope.Outcome.SUCCESS);
            Response.ResponseBuilder builder = Response.status(Response.Status.OK).entity(response);
            applyObservabilityHeaders(builder, runId, traceId, requestId, DATA_SOURCE_SERVER, false);
            return builder.build();
        } catch (RuntimeException ex) {
            details.put("errorMessage", ex.getMessage());
            dispatchAuditEvent(request, details, CREATE_AUDIT_ACTION, AuditEventEnvelope.Outcome.FAILURE);
            throw ex;
        }
    }

    private Response handleUpdate(HttpServletRequest request, OfficialPatientUpdateRequest body) {
        String runId = AbstractOrcaRestResource.resolveRunIdValue(request);
        String traceId = resolveTraceId(request);
        String requestId = resolveRequestId(request, traceId);
        String facilityId = requireFacilityId(request);
        if (facilityId == null || facilityId.isBlank()) {
            throw restError(request, Response.Status.UNAUTHORIZED, "facility_missing", "Facility is required");
        }
        PatientModV2OutpatientSupport.PatientPatch patch = PatientModV2OutpatientSupport.toUpdatePatch(body);
        if (patch.patientId == null || patch.patientId.isBlank() || "*".equals(patch.patientId)) {
            throw restError(request, Response.Status.BAD_REQUEST, "invalid_request", "patientId is required");
        }

        OfficialPatientMutationResponse response = createBaseResponse(runId, traceId, requestId);
        Map<String, Object> details = createAuditDetails(request, "update", patch, runId, facilityId, response.getFetchedAt());
        PatientModV2OutpatientSupport.applyAuditMeta(details, body != null ? body.getAuditMeta() : null);

        try {
            PatientModV2OutpatientSupport.OrcaMutationResult result =
                    orcaCoordinator().updateOrcaAndSyncLocal(facilityId, patch, runId, details);
            populateSuccessResponse(response, result, details, traceId, requestId, UPDATE_AUDIT_ACTION);
            dispatchAuditEvent(request, details, UPDATE_AUDIT_ACTION, AuditEventEnvelope.Outcome.SUCCESS);
            Response.ResponseBuilder builder = Response.status(Response.Status.OK).entity(response);
            applyObservabilityHeaders(builder, runId, traceId, requestId, DATA_SOURCE_SERVER, false);
            return builder.build();
        } catch (RuntimeException ex) {
            details.put("errorMessage", ex.getMessage());
            dispatchAuditEvent(request, details, UPDATE_AUDIT_ACTION, AuditEventEnvelope.Outcome.FAILURE);
            throw ex;
        }
    }

    private PatientModV2OutpatientOrcaCoordinator orcaCoordinator() {
        return new PatientModV2OutpatientOrcaCoordinator(
                patientServiceBean,
                orcaTransport,
                orcaWrapperService,
                orcaPatientSyncService);
    }

    private OfficialPatientMutationResponse createBaseResponse(String runId, String traceId, String requestId) {
        OfficialPatientMutationResponse response = new OfficialPatientMutationResponse();
        response.setRunId(runId);
        response.setTraceId(traceId);
        response.setRequestId(requestId);
        response.setRouteNamespace(ROUTE_NAMESPACE);
        response.setDataSource(DATA_SOURCE_SERVER);
        response.setDataSourceTransition(DATA_SOURCE_SERVER);
        response.setCacheHit(false);
        response.setMissingMaster(false);
        response.setFallbackUsed(false);
        response.setFetchedAt(java.time.Instant.now().toString());
        return response;
    }

    private Map<String, Object> createAuditDetails(HttpServletRequest request,
            String operation,
            PatientModV2OutpatientSupport.PatientPatch patch,
            String runId,
            String facilityId,
            String fetchedAt) {
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("resource", request != null ? request.getRequestURI()
                : ("create".equals(operation) ? CREATE_RESOURCE_PATH : UPDATE_RESOURCE_PATH));
        details.put("operation", operation);
        details.put("patientId", patch.patientId);
        details.put("runId", runId);
        details.put("routeNamespace", ROUTE_NAMESPACE);
        details.put("dataSource", DATA_SOURCE_SERVER);
        details.put("dataSourceTransition", DATA_SOURCE_SERVER);
        details.put("cacheHit", Boolean.FALSE);
        details.put("missingMaster", Boolean.FALSE);
        details.put("fallbackUsed", Boolean.FALSE);
        details.put("fetchedAt", fetchedAt);
        details.put("facilityId", facilityId);
        if (patch.changedKeys != null && !patch.changedKeys.isEmpty()) {
            details.put("changedKeys", List.copyOf(patch.changedKeys));
        }
        return details;
    }

    private void populateSuccessResponse(OfficialPatientMutationResponse response,
            PatientModV2OutpatientSupport.OrcaMutationResult result,
            Map<String, Object> details,
            String traceId,
            String requestId,
            String action) {
        response.setApiResult(result.apiResult != null ? result.apiResult : "00");
        response.setApiResultMessage(result.apiResultMessage != null ? result.apiResultMessage : "OK");
        response.setPatientDbId(result.patient != null ? result.patient.getId() : null);
        response.setPatientId(result.patient != null ? result.patient.getPatientId() : details.get("patientId").toString());
        response.setPatient(result.patient != null ? PatientModV2OutpatientSupport.toPatientRecord(result.patient) : null);
        response.setIdempotent(result.idempotent);
        response.setIdempotentReason(result.idempotentReason);
        response.setAuditEvent(createAuditEvent(action, details, traceId, requestId));
    }

    private OutpatientFlagResponse.AuditEvent createAuditEvent(String action,
            Map<String, Object> details,
            String traceId,
            String requestId) {
        OutpatientFlagResponse.AuditEvent auditEvent = new OutpatientFlagResponse.AuditEvent();
        auditEvent.setAction(action);
        auditEvent.setResource(String.valueOf(details.get("resource")));
        auditEvent.setOutcome("SUCCESS");
        auditEvent.setDetails(details);
        auditEvent.setTraceId(traceId);
        auditEvent.setRequestId(requestId);
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

}
