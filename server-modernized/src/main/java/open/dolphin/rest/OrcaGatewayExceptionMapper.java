package open.dolphin.rest;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import java.util.LinkedHashMap;
import java.util.Map;
import open.dolphin.orca.OrcaGatewayException;

@Provider
public class OrcaGatewayExceptionMapper implements ExceptionMapper<OrcaGatewayException> {

    @Context
    private HttpServletRequest request;

    @Override
    public Response toResponse(OrcaGatewayException exception) {
        int status = resolveStatus(exception);
        Response.Status resolvedStatus = Response.Status.fromStatusCode(status);
        if (resolvedStatus == null) {
            resolvedStatus = Response.Status.BAD_GATEWAY;
        }
        String message = exception != null
                ? sanitizeMessage(exception.getMessage())
                : "Orca gateway error";
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("source", "orca_gateway");
        return AbstractResource.restError(
                request,
                resolvedStatus,
                "orca_gateway_error",
                message,
                details,
                exception).getResponse();
    }

    private int resolveStatus(OrcaGatewayException exception) {
        if (exception == null) {
            return Response.Status.BAD_GATEWAY.getStatusCode();
        }
        String message = exception.getMessage();
        if (message != null) {
            String normalized = message.trim().toLowerCase();
            if (isUpstreamAuthFailure(normalized)) {
                return Response.Status.SERVICE_UNAVAILABLE.getStatusCode();
            }
            if (normalized.contains("settings") || normalized.contains("not available")
                    || normalized.contains("incomplete")) {
                return Response.Status.SERVICE_UNAVAILABLE.getStatusCode();
            }
        }
        return Response.Status.BAD_GATEWAY.getStatusCode();
    }

    private String sanitizeMessage(String message) {
        String sanitized = AbstractResource.sanitizeOrcaTransportMessage(message);
        if (sanitized != null && isUpstreamAuthFailure(sanitized.trim().toLowerCase())) {
            return "ORCA upstream authentication failed";
        }
        return sanitized;
    }

    private boolean isUpstreamAuthFailure(String normalizedMessage) {
        if (normalizedMessage == null || normalizedMessage.isBlank()) {
            return false;
        }
        return normalizedMessage.contains("orca http response status 401")
                || normalizedMessage.contains("orca http response status 403")
                || normalizedMessage.contains("[http_status]") && normalizedMessage.contains(" status 401")
                || normalizedMessage.contains("[http_status]") && normalizedMessage.contains(" status 403");
    }
}
