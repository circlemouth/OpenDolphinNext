package open.dolphin.rest.orca;

import jakarta.inject.Inject;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.orca.service.OrcaLiveGateway;
import open.dolphin.orca.service.OutpatientProjectionService;
import open.dolphin.rest.dto.outpatient.MedicalOutpatientResponse;
import open.dolphin.rest.dto.outpatient.OutpatientFlagResponse;

@Path("/orca/medical")
public class OrcaMedicalOutpatientResource extends AbstractOrcaRestResource {

    @Inject
    private OrcaLiveGateway liveGateway;

    @Inject
    private OutpatientProjectionService outpatientProjectionService;

    private static final String AUDIT_ACTION = "ORCA_MEDICAL_OUTPATIENT_GET";
    private static final String DEFAULT_RESOURCE = "/api/orca/medical/outpatient";

    @POST
    @Path("/outpatient")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public MedicalOutpatientResponse postOutpatientMedical(
            @Context HttpServletRequest request,
            Map<String, Object> payload) {
        requireRemoteUser(request);
        String facilityId = requireFacilityId(request);
        List<MedicalOutpatientResponse.MedicalOutpatientEntry> outpatientEntries =
                outpatientProjectionService != null ? outpatientProjectionService.loadEntries(facilityId, payload) : List.of();
        String traceId = resolveTraceId(request);
        String requestId = request != null ? request.getHeader("X-Request-Id") : null;
        if (requestId == null || requestId.isBlank()) {
            requestId = traceId;
        }

        MedicalOutpatientResponse response = new MedicalOutpatientResponse();
        response.setRunId(resolveRunId(request));
        response.setTraceId(traceId);
        response.setRequestId(requestId);
        response.setDataSource("server");
        response.setDataSourceTransition("server");
        response.setCacheHit(false);
        response.setMissingMaster(false);
        response.setFallbackUsed(false);
        response.setFetchedAt(Instant.now().toString());
        response.setOutpatientList(outpatientEntries);
        response.setRecordsReturned(outpatientEntries.size());
        response.setOutcome(outpatientEntries.isEmpty() ? "MISSING" : "SUCCESS");

        String resourcePath = request != null && request.getRequestURI() != null && !request.getRequestURI().isBlank()
                ? request.getRequestURI()
                : DEFAULT_RESOURCE;
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("facilityId", facilityId);
        details.put("runId", response.getRunId());
        details.put("traceId", traceId);
        details.put("requestId", requestId);
        details.put("dataSource", response.getDataSource());
        details.put("dataSourceTransition", response.getDataSourceTransition());
        details.put("recordsReturned", response.getRecordsReturned());
        details.put("outcome", response.getOutcome());
        details.put("resource", resourcePath);
        if (liveGateway != null) {
            details.put("liveGatewayType", liveGateway.getClass().getSimpleName());
        }

        OutpatientFlagResponse.AuditEvent auditEvent = new OutpatientFlagResponse.AuditEvent();
        auditEvent.setAction(AUDIT_ACTION);
        auditEvent.setResource(resourcePath);
        auditEvent.setOutcome(response.getOutcome());
        auditEvent.setDetails(details);
        auditEvent.setTraceId(traceId);
        auditEvent.setRequestId(requestId);
        response.setAuditEvent(auditEvent);
        recordAudit(request, AUDIT_ACTION, details, AuditEventEnvelope.Outcome.SUCCESS);
        return response;
    }
}
