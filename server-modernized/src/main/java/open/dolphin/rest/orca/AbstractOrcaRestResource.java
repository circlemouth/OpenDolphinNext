package open.dolphin.rest.orca;

import jakarta.inject.Inject;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.rest.AbstractResource;
import open.dolphin.security.audit.AuditDetailSanitizer;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.SessionAuditDispatcher;

/**
 * Shared helpers for ORCA wrapper resources.
 */
public abstract class AbstractOrcaRestResource extends AbstractResource {

    protected static final DateTimeFormatter RUN_ID_FORMAT =
            DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'").withZone(ZoneOffset.UTC);
    private static final String FACILITY_HEADER = "X-Facility-Id";

    @Inject
    protected SessionAuditDispatcher sessionAuditDispatcher;

    protected String requireRemoteUser(HttpServletRequest request) {
        if (request == null || request.getRemoteUser() == null || request.getRemoteUser().isBlank()) {
            throw restError(request, Response.Status.UNAUTHORIZED, "remote_user_missing", "Authenticated user is required");
        }
        return request.getRemoteUser();
    }

    protected String requireFacilityId(HttpServletRequest request) {
        String remote = request != null ? request.getRemoteUser() : null;
        String facilityId = getRemoteFacility(remote);
        if (facilityId == null || facilityId.isBlank()) {
            throw restError(request, Response.Status.UNAUTHORIZED, "facility_missing",
                    "Remote user must belong to a facility");
        }
        return facilityId;
    }

    /**
     * Resolve runId: prefer X-Run-Id header, otherwise generate new UTC-based id.
     */
    protected String resolveRunId(HttpServletRequest request) {
        return resolveRunIdValue((Object) request);
    }

    public static String resolveRunIdValue(Object requestOrHeader) {
        if (requestOrHeader instanceof HttpServletRequest request) {
            String header = request.getHeader("X-Run-Id");
            if (header != null && !header.isBlank()) {
                return header.trim();
            }
        }
        if (requestOrHeader instanceof String headerValue) {
            return resolveRunIdValue(headerValue);
        }
        return resolveRunIdValue((String) null);
    }

    public static String resolveRunIdValue(String headerValue) {
        if (headerValue != null && !headerValue.isBlank()) {
            return headerValue.trim();
        }
        return RUN_ID_FORMAT.format(Instant.now());
    }

    protected void markFailureDetails(Map<String, Object> details, int httpStatus, String errorCode, String errorMessage) {
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

    protected void markSuccessDetails(Map<String, Object> details) {
        if (details == null) {
            return;
        }
        details.put("status", "success");
    }

    protected void recordAudit(HttpServletRequest request, String action, Map<String, Object> details,
            AuditEventEnvelope.Outcome outcome) {
        if (sessionAuditDispatcher == null) {
            return;
        }
        Map<String, Object> enriched = details != null ? new HashMap<>(details) : new HashMap<>();
        String resourcePath = extractDetailText(enriched, "resource");
        if (resourcePath == null || resourcePath.isBlank()) {
            resourcePath = request != null ? request.getRequestURI() : null;
        }
        String scope = extractDetailText(enriched, "scope");
        if ((scope == null || scope.isBlank()) && resourcePath != null && !resourcePath.isBlank()) {
            scope = resolveAuditScope(resourcePath);
            if (scope != null && !scope.isBlank()) {
                enriched.put("scope", scope);
            }
        }
        String facilityId = resolveAuditFacilityId(request);
        if (facilityId != null && !facilityId.isBlank()) {
            enriched.putIfAbsent("facilityId", facilityId);
        }
        AuditEventPayload payload = new AuditEventPayload();
        payload.setAction(action);
        payload.setResource(resourcePath != null && !resourcePath.isBlank() ? resourcePath : "/orca");
        payload.setActorId(request != null ? request.getRemoteUser() : null);
        payload.setIpAddress(resolveClientIp(request));
        payload.setUserAgent(request != null ? request.getHeader("User-Agent") : null);
        String traceId = resolveTraceId(request);
        String requestId = request != null ? request.getHeader("X-Request-Id") : null;
        if (requestId != null && !requestId.isBlank()) {
            requestId = requestId.trim();
        } else {
            requestId = extractDetailText(enriched, "requestId");
        }
        if ((traceId == null || traceId.isBlank())) {
            traceId = extractDetailText(enriched, "traceId");
        }
        if ((traceId == null || traceId.isBlank()) && requestId != null && !requestId.isBlank()) {
            traceId = requestId;
        }
        if (traceId != null && !traceId.isBlank()) {
            payload.setTraceId(traceId);
            enriched.putIfAbsent("traceId", traceId);
        }
        if (requestId != null && !requestId.isBlank()) {
            payload.setRequestId(requestId);
            enriched.putIfAbsent("requestId", requestId);
        } else if (traceId != null && !traceId.isBlank()) {
            payload.setRequestId(traceId);
            enriched.putIfAbsent("requestId", traceId);
        }
        payload.setPatientId(AuditDetailSanitizer.resolvePatientId(null, enriched));
        payload.setDetails(enriched);
        String errorCode = extractDetailText(enriched, "errorCode");
        String errorMessage = extractDetailText(enriched, "errorMessage");
        sessionAuditDispatcher.record(payload, outcome, errorCode, errorMessage);
    }

    public static String resolveAuditScope(String resourcePath) {
        if (resourcePath == null) {
            return null;
        }
        String normalized = resourcePath.trim();
        if (normalized.isEmpty()) {
            return null;
        }
        if (normalized.startsWith("/api/orca/official/")) {
            return "official";
        }
        if (normalized.startsWith("/api/orca/master/")) {
            return "master";
        }
        if (normalized.startsWith("/api/local/")) {
            return "local";
        }
        if (normalized.startsWith("/api/admin/internal/")) {
            return "admin-internal";
        }
        return null;
    }

    private String resolveAuditFacilityId(HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        String remoteUser = request.getRemoteUser();
        String facility = null;
        if (remoteUser != null && remoteUser.indexOf(IInfoModel.COMPOSITE_KEY_MAKER) >= 0) {
            facility = getRemoteFacility(remoteUser);
        }
        if (facility == null || facility.isBlank()) {
            String header = request.getHeader(FACILITY_HEADER);
            if (header != null && !header.trim().isEmpty()) {
                return header.trim();
            }
        }
        return facility;
    }

    private String extractDetailText(Map<String, Object> details, String key) {
        if (details == null || key == null) {
            return null;
        }
        Object value = details.get(key);
        if (value instanceof String text && !text.isBlank()) {
            return text;
        }
        return null;
    }

    protected WebApplicationException validationError(HttpServletRequest request, String field, String message) {
        Map<String, Object> details = new HashMap<>();
        details.put("field", field);
        details.put("validationError", Boolean.TRUE);
        return restError(request, Response.Status.BAD_REQUEST, "invalid_request", message, details, null);
    }
}
