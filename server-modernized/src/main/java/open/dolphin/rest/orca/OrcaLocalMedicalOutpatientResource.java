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
import open.dolphin.orca.service.OutpatientProjectionService;
import open.dolphin.rest.dto.outpatient.MedicalOutpatientResponse;
import open.dolphin.rest.dto.outpatient.OutpatientFlagResponse;

/**
 * ローカル集約した外来情報を返す API。ORCA の medicalmodv2 送信 API ではない。
 */
@Path("/orca/local-medical")
public class OrcaLocalMedicalOutpatientResource extends AbstractOrcaRestResource {

    private static final String DATA_SOURCE = "server";
    private static final String AUDIT_ACTION = "ORCA_LOCAL_MEDICAL_OUTPATIENT_GET";
    private static final String DEFAULT_RESOURCE = "/api/orca/local-medical/outpatient";

    @Inject
    private OutpatientProjectionService outpatientProjectionService;

    @POST
    @Path("/outpatient")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public MedicalOutpatientResponse postOutpatientMedical(@Context HttpServletRequest request, Map<String, Object> payload) {
        requireRemoteUser(request);
        String facilityId = requireFacilityId(request);

        String runId = resolveRunId(request);
        String traceId = resolveTraceId(request);
        String requestId = resolveRequestId(request, traceId);
        List<MedicalOutpatientResponse.MedicalOutpatientEntry> outpatientEntries =
                outpatientProjectionService != null ? outpatientProjectionService.loadEntries(facilityId, payload) : List.of();

        MedicalOutpatientResponse response = new MedicalOutpatientResponse();
        response.setRunId(runId);
        response.setTraceId(traceId);
        response.setRequestId(requestId);
        response.setDataSource(DATA_SOURCE);
        response.setDataSourceTransition(DATA_SOURCE);
        response.setCacheHit(false);
        response.setMissingMaster(false);
        response.setFallbackUsed(false);
        response.setFetchedAt(Instant.now().toString());
        response.setOutpatientList(outpatientEntries);
        response.setRecordsReturned(outpatientEntries.size());
        response.setOutcome(outpatientEntries.isEmpty() ? "MISSING" : "SUCCESS");

        String resourcePath = resolveResourcePath(request);
        Map<String, Object> details = buildAuditDetails(facilityId, outpatientEntries, response, resourcePath);
        OutpatientFlagResponse.AuditEvent auditEvent = new OutpatientFlagResponse.AuditEvent();
        auditEvent.setAction(AUDIT_ACTION);
        auditEvent.setResource(resourcePath);
        auditEvent.setOutcome(response.getOutcome());
        auditEvent.setDetails(details);
        auditEvent.setTraceId(traceId);
        auditEvent.setRequestId(requestId);
        response.setAuditEvent(auditEvent);

        Map<String, Object> auditPayload = new LinkedHashMap<>(details);
        auditPayload.put("recordsReturned", response.getRecordsReturned());
        recordAudit(request, AUDIT_ACTION, auditPayload, AuditEventEnvelope.Outcome.SUCCESS);

        return response;
    }

    private Map<String, Object> buildAuditDetails(String facilityId,
            List<MedicalOutpatientResponse.MedicalOutpatientEntry> entries,
            MedicalOutpatientResponse response,
            String resourcePath) {
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("facilityId", facilityId);
        details.put("runId", response.getRunId());
        details.put("dataSource", response.getDataSource());
        details.put("dataSourceTransition", response.getDataSourceTransition());
        details.put("cacheHit", response.isCacheHit());
        details.put("missingMaster", response.isMissingMaster());
        details.put("fallbackUsed", response.isFallbackUsed());
        details.put("fetchedAt", response.getFetchedAt());
        details.put("recordsReturned", response.getRecordsReturned());
        details.put("outcome", response.getOutcome());
        details.put("resource", resourcePath);
        details.put("telemetryFunnelStage", "charts_orchestration");
        if (entries != null && !entries.isEmpty()) {
            details.put("patientsReturned", entries.size());
        }
        return details;
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

    private String resolveResourcePath(HttpServletRequest request) {
        if (request == null) {
            return DEFAULT_RESOURCE;
        }
        String requestUri = request.getRequestURI();
        if (requestUri == null || requestUri.isBlank()) {
            return DEFAULT_RESOURCE;
        }
        return requestUri;
    }
}
