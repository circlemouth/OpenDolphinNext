package open.dolphin.rest;

import jakarta.persistence.NoResultException;
import jakarta.persistence.PersistenceException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.transaction.RollbackException;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import java.io.IOException;
import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.TimeoutException;
import java.util.logging.Level;
import java.util.logging.Logger;
import open.dolphin.orca.OrcaGatewayException;
import open.dolphin.rest.orca.OrcaOrderBundleResource;
import open.dolphin.session.framework.SessionServiceException;

@Provider
public class RestExceptionMapper implements ExceptionMapper<Throwable> {

    private static final Logger LOGGER = Logger.getLogger(RestExceptionMapper.class.getName());

    @Context
    private HttpServletRequest request;

    @Context
    private HttpServletResponse response;

    @Override
    public Response toResponse(Throwable exception) {
        if (response != null && response.isCommitted()) {
            String uri = request != null ? request.getRequestURI() : "unknown";
            LOGGER.log(Level.WARNING, "Response already committed; skipping error body (uri={0})", uri);
            int status = response.getStatus() > 0
                    ? response.getStatus()
                    : Response.Status.INTERNAL_SERVER_ERROR.getStatusCode();
            return Response.status(status).build();
        }
        Response orderBundleFailure = maybeMapOrderBundleFailure(exception);
        if (orderBundleFailure != null) {
            return orderBundleFailure;
        }
        if (exception instanceof WebApplicationException webException) {
            Response response = webException.getResponse();
            if (response != null && response.hasEntity() && isJson(response.getMediaType())) {
                return response;
            }
            int status = response != null ? response.getStatus() : Response.Status.INTERNAL_SERVER_ERROR.getStatusCode();
            logIfNeeded(exception, status);
            String message = resolveWebExceptionMessage(webException, response);
            return buildErrorResponse(status, message, exception, response);
        }

        int status = resolveStatus(exception);
        logIfNeeded(exception, status);
        String message = exception != null ? exception.getMessage() : null;
        OrcaGatewayException orcaCause = findOrcaGatewayCause(exception);
        if (orcaCause != null && (message == null || message.startsWith("Session layer failure"))) {
            message = orcaCause.getMessage();
        }
        return buildErrorResponse(status, message, exception, null);
    }

    private Response maybeMapOrderBundleFailure(Throwable exception) {
        if (request == null) {
            return null;
        }
        String uri = request.getRequestURI();
        if (uri == null || !uri.contains("/api/orca/order/bundles")) {
            return null;
        }
        if (!hasCauseByClassName(exception, "org.hibernate.exception.DataException")
                && !hasCause(exception, PersistenceException.class)
                && !hasCause(exception, RollbackException.class)) {
            return null;
        }
        Map<String, Object> details = new HashMap<>();
        Object context = request.getAttribute(OrcaOrderBundleResource.ORDER_BUNDLE_CONTEXT_KEY);
        if (context instanceof Map<?, ?> ctx) {
            for (Map.Entry<?, ?> entry : ctx.entrySet()) {
                if (entry.getKey() instanceof String key) {
                    details.put(key, entry.getValue());
                }
            }
        }
        String runId = request.getHeader("X-Run-Id");
        if (runId != null && !runId.isBlank()) {
            details.putIfAbsent("runId", runId.trim());
        }
        String patientId = details.get("patientId") instanceof String value ? value : null;
        String operation = details.get("operation") instanceof String value ? value : null;
        Object documentId = details.get("documentId");
        Object karteId = details.get("karteId");
        LOGGER.log(Level.WARNING,
                "Order bundle mutation failed after transaction (patientId={0}, karteId={1}, documentId={2}, operation={3}, runId={4})",
                new Object[]{patientId, karteId, documentId, operation, details.get("runId")});
        return AbstractResource.restError(request,
                Response.Status.SERVICE_UNAVAILABLE,
                "order_bundle_unavailable",
                "Failed to mutate order bundle",
                details,
                exception).getResponse();
    }

    private Response buildErrorResponse(int status, String message, Throwable exception, Response baseResponse) {
        Response.Status statusEnum = resolveStatusEnum(status);
        String errorCode = resolveErrorCode(status, exception);
        String resolvedMessage = resolveMessage(status, message);
        Map<String, Object> details = buildDetails(status, resolvedMessage, exception, baseResponse);
        Response errorResponse = AbstractResource.restError(request, statusEnum, errorCode, resolvedMessage, details, exception).getResponse();
        if (baseResponse == null || baseResponse.getHeaders().isEmpty()) {
            return errorResponse;
        }
        return copyHeaders(baseResponse, errorResponse);
    }

    private Response copyHeaders(Response source, Response target) {
        Response.ResponseBuilder builder = Response.fromResponse(target);
        for (Map.Entry<String, java.util.List<Object>> entry : source.getHeaders().entrySet()) {
            String name = entry.getKey();
            if (name == null) {
                continue;
            }
            if ("Content-Type".equalsIgnoreCase(name)) {
                continue;
            }
            for (Object value : entry.getValue()) {
                builder.header(name, value);
            }
        }
        return builder.build();
    }

    private int resolveStatus(Throwable exception) {
        OrcaGatewayException orcaCause = findOrcaGatewayCause(exception);
        if (orcaCause != null) {
            return resolveOrcaGatewayStatus(orcaCause);
        }
        if (exception instanceof SessionServiceException && hasCause(exception, NoResultException.class)) {
            return Response.Status.NOT_FOUND.getStatusCode();
        }
        if (exception instanceof NoResultException) {
            return Response.Status.NOT_FOUND.getStatusCode();
        }
        if (exception instanceof SecurityException) {
            return Response.Status.FORBIDDEN.getStatusCode();
        }
        if (exception instanceof SocketTimeoutException || exception instanceof TimeoutException) {
            return Response.Status.GATEWAY_TIMEOUT.getStatusCode();
        }
        if (exception instanceof ConnectException || exception instanceof IOException) {
            return Response.Status.SERVICE_UNAVAILABLE.getStatusCode();
        }
        if (exception instanceof IllegalArgumentException) {
            return Response.Status.BAD_REQUEST.getStatusCode();
        }
        return Response.Status.INTERNAL_SERVER_ERROR.getStatusCode();
    }

    private boolean hasCause(Throwable exception, Class<? extends Throwable> target) {
        Throwable current = exception;
        while (current != null) {
            if (target.isInstance(current)) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }

    private boolean hasCauseByClassName(Throwable exception, String className) {
        Throwable current = exception;
        while (current != null) {
            if (current.getClass().getName().equals(className)) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }

    private Response.Status resolveStatusEnum(int status) {
        Response.Status resolved = Response.Status.fromStatusCode(status);
        return resolved != null ? resolved : Response.Status.INTERNAL_SERVER_ERROR;
    }

    private String resolveErrorCode(int status, Throwable exception) {
        OrcaGatewayException orcaCause = findOrcaGatewayCause(exception);
        if (orcaCause != null) {
            return "orca_gateway_error";
        }
        return switch (status) {
            case 400, 422 -> "invalid_request";
            case 401 -> "unauthorized";
            case 403 -> "forbidden";
            case 404 -> "not_found";
            case 405 -> "method_not_allowed";
            case 408 -> "request_timeout";
            case 409 -> "conflict";
            case 412 -> "precondition_failed";
            case 410 -> "gone";
            case 415 -> "unsupported_media_type";
            case 429 -> "too_many_requests";
            case 500 -> "internal_server_error";
            case 502 -> "bad_gateway";
            case 503 -> "service_unavailable";
            case 504 -> "gateway_timeout";
            default -> "http_" + status;
        };
    }

    private OrcaGatewayException findOrcaGatewayCause(Throwable exception) {
        if (exception == null) {
            return null;
        }
        if (exception instanceof OrcaGatewayException orca) {
            return orca;
        }
        Throwable current = exception.getCause();
        while (current != null) {
            if (current instanceof OrcaGatewayException orca) {
                return orca;
            }
            current = current.getCause();
        }
        return null;
    }

    private int resolveOrcaGatewayStatus(OrcaGatewayException exception) {
        if (exception == null) {
            return Response.Status.BAD_GATEWAY.getStatusCode();
        }
        String message = exception.getMessage();
        if (message != null) {
            String normalized = message.trim().toLowerCase(Locale.ROOT);
            if (normalized.contains("settings") || normalized.contains("not available")
                    || normalized.contains("incomplete")) {
                return Response.Status.SERVICE_UNAVAILABLE.getStatusCode();
            }
            if (normalized.contains("required") || normalized.contains("must be")
                    || normalized.contains("missing required fields")) {
                return Response.Status.BAD_REQUEST.getStatusCode();
            }
        }
        return Response.Status.BAD_GATEWAY.getStatusCode();
    }

    private String resolveMessage(int status, String message) {
        if (message != null && !message.isBlank()) {
            return message;
        }
        return switch (status) {
            case 400, 422 -> "Invalid request";
            case 401 -> "Unauthorized";
            case 403 -> "Forbidden";
            case 404 -> "Not found";
            case 405 -> "Method not allowed";
            case 408 -> "Request timeout";
            case 409 -> "Conflict";
            case 412 -> "Precondition failed";
            case 410 -> "Gone";
            case 415 -> "Unsupported media type";
            case 429 -> "Too many requests";
            case 502 -> "Upstream service failure";
            case 503 -> "Service unavailable";
            case 504 -> "Gateway timeout";
            default -> "Internal server error";
        };
    }

    private Map<String, Object> buildDetails(int status, String message, Throwable exception, Response baseResponse) {
        Map<String, Object> details = new HashMap<>();
        if (isRetryable(status)) {
            details.put("retryable", Boolean.TRUE);
        }
        if (status == 400 || status == 422) {
            details.put("validationError", Boolean.TRUE);
            String normalized = stripEndpointPrefix(message);
            String field = resolveField(normalized);
            if (field != null) {
                details.put("field", field);
            }
            Map<String, Object> validationDetails = buildValidationDetails(field, normalized);
            if (!validationDetails.isEmpty()) {
                details.put("details", validationDetails);
            }
        }
        if (status == 404 || status == 409 || status == 412) {
            String reason = resolveReason(message, baseResponse);
            if (reason != null && !reason.isBlank()) {
                details.put("reason", reason);
            }
        }
        return details.isEmpty() ? null : details;
    }

    private boolean isRetryable(int status) {
        return status == 408
                || status == 429
                || status == 500
                || status == 502
                || status == 503
                || status == 504;
    }

    private boolean isJson(MediaType mediaType) {
        if (mediaType == null) {
            return false;
        }
        String subtype = mediaType.getSubtype();
        if (subtype == null) {
            return false;
        }
        String normalized = subtype.toLowerCase(Locale.ROOT);
        return normalized.equals("json") || normalized.endsWith("+json");
    }

    private String resolveWebExceptionMessage(WebApplicationException webException, Response response) {
        String entityMessage = extractEntityMessage(response);
        if (entityMessage != null && !entityMessage.isBlank()) {
            return stripEndpointPrefix(entityMessage);
        }
        String message = webException.getMessage();
        if (message != null && !message.isBlank()) {
            return stripEndpointPrefix(message);
        }
        if (response != null && response.getStatusInfo() != null) {
            String reason = response.getStatusInfo().getReasonPhrase();
            if (reason != null && !reason.isBlank()) {
                return reason;
            }
        }
        return null;
    }

    private String extractEntityMessage(Response response) {
        if (response == null || !response.hasEntity()) {
            return null;
        }
        Object entity = response.getEntity();
        if (entity instanceof String text) {
            return text;
        }
        return null;
    }

    private String stripEndpointPrefix(String message) {
        if (message == null) {
            return null;
        }
        String trimmed = message.trim();
        int index = trimmed.indexOf(" : ");
        if (index > 0) {
            String prefix = trimmed.substring(0, index);
            if (prefix.startsWith("GET ")
                    || prefix.startsWith("POST ")
                    || prefix.startsWith("PUT ")
                    || prefix.startsWith("DELETE ")
                    || prefix.startsWith("PATCH ")) {
                return trimmed.substring(index + 3).trim();
            }
        }
        return trimmed;
    }

    private String resolveField(String message) {
        if (message == null || message.isBlank()) {
            return null;
        }
        String trimmed = message.trim();
        String lower = trimmed.toLowerCase(Locale.ROOT);
        int index = lower.indexOf(" is required");
        if (index > 0) {
            return trimmed.substring(0, index).trim();
        }
        index = lower.indexOf(" must be ");
        if (index > 0) {
            return trimmed.substring(0, index).trim();
        }
        index = trimmed.indexOf(" は必須");
        if (index > 0) {
            return trimmed.substring(0, index).trim();
        }
        index = trimmed.indexOf(" パラメータは必須");
        if (index > 0) {
            return trimmed.substring(0, index).trim();
        }
        index = trimmed.indexOf(" は数値");
        if (index > 0) {
            return trimmed.substring(0, index).trim();
        }
        if (lower.startsWith("missing ")) {
            String candidate = trimmed.substring("missing ".length()).trim();
            return candidate.isBlank() ? null : candidate;
        }
        return null;
    }

    private Map<String, Object> buildValidationDetails(String field, String message) {
        Map<String, Object> details = new HashMap<>();
        if (field != null && !field.isBlank()) {
            details.put("field", field);
        }
        if (message != null && !message.isBlank()) {
            details.put("message", message);
        }
        return details;
    }

    private String resolveReason(String message, Response response) {
        String entityMessage = extractEntityMessage(response);
        if (entityMessage != null && !entityMessage.isBlank()) {
            return stripEndpointPrefix(entityMessage);
        }
        if (message != null && !message.isBlank()) {
            return stripEndpointPrefix(message);
        }
        if (response != null && response.getStatusInfo() != null) {
            String reason = response.getStatusInfo().getReasonPhrase();
            if (reason != null && !reason.isBlank()) {
                return reason;
            }
        }
        return null;
    }

    private void logIfNeeded(Throwable exception, int status) {
        if (exception == null) {
            return;
        }
        if (status >= 500) {
            LOGGER.log(Level.SEVERE, "REST exception mapped to HTTP " + status, exception);
            return;
        }
        if (LOGGER.isLoggable(Level.FINE)) {
            LOGGER.log(Level.FINE, "REST exception mapped to HTTP " + status, exception);
        }
    }
}
