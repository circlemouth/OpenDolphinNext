package open.orca.rest;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.Response.Status;
import java.time.Instant;
import java.util.Map;
import open.dolphin.rest.dto.orca.OrcaMasterErrorResponse;
import open.dolphin.rest.orca.AbstractOrcaRestResource;
import open.dolphin.security.audit.SessionAuditDispatcher;

class OrcaMasterErrorResponseSupport {
    private final OrcaMasterAuditSupport auditSupport;

    OrcaMasterErrorResponseSupport(SessionAuditDispatcher sessionAuditDispatcher) {
        this.auditSupport = new OrcaMasterAuditSupport(sessionAuditDispatcher);
    }

    Response unauthorized(HttpServletRequest request) {
        OrcaMasterErrorResponse response = new OrcaMasterErrorResponse();
        response.setCode("ORCA_MASTER_UNAUTHORIZED");
        response.setError("ORCA_MASTER_UNAUTHORIZED");
        response.setErrorCode("ORCA_MASTER_UNAUTHORIZED");
        response.setMessage("Authenticated principal is required.");
        response.setStatus(Status.UNAUTHORIZED.getStatusCode());
        response.setRunId(resolveRunId(request));
        response.setTimestamp(Instant.now().toString());
        String traceId = resolveTraceId(request);
        if (traceId != null && !traceId.isBlank()) {
            response.setCorrelationId(traceId);
            response.setTraceId(traceId);
        }
        response.setPath(request != null ? request.getRequestURI() : "/orca/master");
        response.setErrorCategory("unauthorized");
        return Response.status(Status.UNAUTHORIZED).entity(response).build();
    }

    Response validationError(HttpServletRequest request, String code, String message) {
        return auditSupport.validationError(request, code, message);
    }

    Response badRequest(HttpServletRequest request, String code, String message) {
        return auditSupport.badRequest(request, code, message);
    }

    Response notFound(String code, String message, HttpServletRequest request) {
        return auditSupport.notFound(code, message, request);
    }

    Response serviceUnavailable(HttpServletRequest request, String code, String message) {
        return auditSupport.serviceUnavailable(request, code, message);
    }

    Response buildErrorResponse(Status status, String code, String message, HttpServletRequest request,
            Map<String, String> extraHeaders) {
        OrcaMasterErrorResponse response = new OrcaMasterErrorResponse();
        response.setCode(code);
        response.setError(code);
        response.setErrorCode(code);
        response.setMessage(message);
        response.setStatus(status != null ? status.getStatusCode() : null);
        response.setRunId(resolveRunId(request));
        response.setTimestamp(Instant.now().toString());
        String traceId = resolveTraceId(request);
        if (traceId != null && !traceId.isBlank()) {
            response.setCorrelationId(traceId);
            response.setTraceId(traceId);
        }
        response.setPath(request != null ? request.getRequestURI() : "/orca/master");
        if (status != null) {
            response.setErrorCategory(switch (status.getStatusCode()) {
                case 400, 422 -> "validation_error";
                case 401 -> "unauthorized";
                case 403 -> "forbidden";
                case 404 -> "not_found";
                default -> status.getStatusCode() >= 500 ? "server_error" : "client_error";
            });
        }
        Response.ResponseBuilder builder = Response.status(status).entity(response);
        applyExtraHeaders(builder, extraHeaders);
        return builder.build();
    }

    private void applyExtraHeaders(Response.ResponseBuilder builder, Map<String, String> extraHeaders) {
        if (builder == null || extraHeaders == null || extraHeaders.isEmpty()) {
            return;
        }
        for (Map.Entry<String, String> entry : extraHeaders.entrySet()) {
            if (entry.getKey() == null || entry.getKey().isBlank() || entry.getValue() == null) {
                continue;
            }
            builder.header(entry.getKey(), entry.getValue());
        }
    }

    private String resolveRunId(HttpServletRequest request) {
        return AbstractOrcaRestResource.resolveRunIdValue(request);
    }

    private String resolveTraceId(HttpServletRequest request) {
        return request == null ? null : AbstractOrcaRestResource.resolveTraceIdValue(request);
    }
}
