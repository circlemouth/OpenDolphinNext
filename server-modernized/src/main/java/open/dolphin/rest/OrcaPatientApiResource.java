package open.dolphin.rest;

import jakarta.inject.Inject;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.orca.OrcaGatewayException;
import open.dolphin.orca.transport.OrcaEndpoint;
import open.dolphin.orca.transport.OrcaTransport;
import open.dolphin.orca.transport.OrcaTransportRequest;
import open.dolphin.orca.transport.OrcaTransportResult;
import open.dolphin.rest.orca.AbstractOrcaRestResource;
import open.dolphin.security.audit.AuditDetailSanitizer;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.SessionAuditDispatcher;

/**
 * ORCA patient get bridge (patientgetv2 JSON contract only).
 */
@Path("/orca/official")
public class OrcaPatientApiResource extends AbstractResource {

    static final String RUN_ID_FALLBACK = "fallback"; // deprecated sentinel; dynamic runId now used
    private static final String AUDIT_ACTION = "ORCA_OFFICIAL_GET_PATIENT";

    @Inject
    OrcaTransport orcaTransport;

    @Inject
    SessionAuditDispatcher sessionAuditDispatcher;

    @GET
    @Path("/patientgetv2")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getPatient(@Context HttpServletRequest request,
            @QueryParam("id") String patientId,
            @QueryParam("class") String classCode,
            @QueryParam("format") String format) {
        return respondPatientGet(request, patientId, classCode, format, "/api/orca/official/patientgetv2");
    }

    private Response respondPatientGet(HttpServletRequest request, String patientId, String classCode, String format,
            String resourcePath) {
        String runId = AbstractOrcaRestResource.resolveRunIdValue(request);
        Map<String, Object> details = buildAuditDetails(request, resourcePath, runId);
        try {
            if (orcaTransport == null) {
                throw new OrcaGatewayException("ORCA transport is not available");
            }
            if (patientId == null || patientId.isBlank()) {
                throw new BadRequestException("id is required");
            }
            String query = "id=" + encode(patientId);
            if (classCode != null && !classCode.isBlank()) {
                query = query + "&class=" + encode(classCode);
                details.put("class", classCode);
            }

            String resolvedFormat = (format == null || format.isBlank()) ? "json" : format;
            if (!"json".equalsIgnoreCase(resolvedFormat)) {
                throw new BadRequestException("format must be json");
            }
            query = query + "&format=json";
            details.put("format", "json");

            details.put("patientId", patientId);
            String facilityId = getRemoteFacility(request != null ? request.getRemoteUser() : null);
            OrcaTransportResult result = orcaTransport.invoke(
                    facilityId,
                    OrcaEndpoint.PATIENT_GET,
                    OrcaTransportRequest.get(query));
            markSuccess(details);
            recordAudit(request, resourcePath, AUDIT_ACTION, details, AuditEventEnvelope.Outcome.SUCCESS, null, null);
            return OrcaApiProxySupport.buildProxyResponse(result, runId);
        } catch (RuntimeException ex) {
            String errorCode = "orca.patientget.error";
            String errorMessage = ex.getMessage();
            int status = (ex instanceof BadRequestException)
                    ? Response.Status.BAD_REQUEST.getStatusCode()
                    : Response.Status.BAD_GATEWAY.getStatusCode();
            markFailure(details, status, errorCode, errorMessage);
            recordAudit(request, resourcePath, AUDIT_ACTION, details, AuditEventEnvelope.Outcome.FAILURE,
                    errorCode, errorMessage);
            throw ex;
        }
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private Map<String, Object> buildAuditDetails(HttpServletRequest request, String resourcePath, String runId) {
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("runId", runId);
        details.put("resource", resourcePath);
        String scope = AbstractOrcaRestResource.resolveAuditScope(resourcePath);
        if (scope != null && !scope.isBlank()) {
            details.put("scope", scope);
        }
        String remoteUser = request != null ? request.getRemoteUser() : null;
        String facilityId = getRemoteFacility(remoteUser);
        if (facilityId != null && !facilityId.isBlank()) {
            details.put("facilityId", facilityId);
        }
        String traceId = resolveTraceId(request);
        if (traceId != null && !traceId.isBlank()) {
            details.put("traceId", traceId);
        }
        String requestId = request != null ? request.getHeader("X-Request-Id") : null;
        if (requestId != null && !requestId.isBlank()) {
            details.put("requestId", requestId);
        } else if (traceId != null && !traceId.isBlank()) {
            details.put("requestId", traceId);
        }
        return details;
    }

    private void markSuccess(Map<String, Object> details) {
        if (details != null) {
            details.put("status", "success");
        }
    }

    private void markFailure(Map<String, Object> details, int httpStatus, String errorCode, String errorMessage) {
        if (details == null) {
            return;
        }
        details.put("status", "failed");
        details.put("httpStatus", httpStatus);
        if (errorCode != null && !errorCode.isBlank()) {
            details.put("errorCode", errorCode);
        }
        if (errorMessage != null && !errorMessage.isBlank()) {
            details.put("errorMessage", errorMessage);
        }
    }

    private void recordAudit(HttpServletRequest request, String resourcePath, String action, Map<String, Object> details,
            AuditEventEnvelope.Outcome outcome, String errorCode, String errorMessage) {
        if (sessionAuditDispatcher == null) {
            return;
        }
        AuditEventPayload payload = new AuditEventPayload();
        payload.setAction(action);
        payload.setResource(resourcePath);
        payload.setActorId(request != null ? request.getRemoteUser() : null);
        payload.setIpAddress(resolveClientIp(request));
        payload.setUserAgent(request != null ? request.getHeader("User-Agent") : null);
        String traceId = resolveTraceId(request);
        if (traceId != null && !traceId.isBlank()) {
            payload.setTraceId(traceId);
        }
        String requestId = request != null ? request.getHeader("X-Request-Id") : null;
        if (requestId != null && !requestId.isBlank()) {
            payload.setRequestId(requestId);
        } else if (traceId != null && !traceId.isBlank()) {
            payload.setRequestId(traceId);
        }
        payload.setPatientId(AuditDetailSanitizer.resolvePatientId(null, details));
        payload.setDetails(details);
        sessionAuditDispatcher.record(payload, outcome, errorCode, errorMessage);
    }
}
