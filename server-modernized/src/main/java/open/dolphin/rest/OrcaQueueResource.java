package open.dolphin.rest;

import jakarta.inject.Inject;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import open.dolphin.rest.admin.AdminConfigSnapshot;
import open.dolphin.rest.admin.AdminConfigStore;
import open.dolphin.rest.orca.AbstractOrcaRestResource;
import open.dolphin.session.UserServiceBean;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Path("/orca/queue")
public class OrcaQueueResource extends AbstractResource {

    private static final Logger LOGGER = LoggerFactory.getLogger(OrcaQueueResource.class);
    private static final String ALLOW_MOCK_ENV = "OPENDOLPHIN_ALLOW_MOCK_ORCA_QUEUE";

    @Inject
    private AdminConfigStore adminConfigStore;

    @Inject
    private OrcaQueueStore queueStore;

    @Inject
    private UserServiceBean userServiceBean;

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Response getQueue(@Context HttpServletRequest request,
            @QueryParam("patientId") String patientId,
            @QueryParam("retry") String retry) {
        requireAdmin(request, userServiceBean);
        return buildQueueResponse(request, patientId, retry, false);
    }

    @DELETE
    @Produces(MediaType.APPLICATION_JSON)
    public Response deleteQueue(@Context HttpServletRequest request,
            @QueryParam("patientId") String patientId) {
        requireAdmin(request, userServiceBean);
        return buildQueueResponse(request, patientId, null, true);
    }

    private Response buildQueueResponse(HttpServletRequest request, String patientId, String retry, boolean deleteRequested) {
        AdminConfigSnapshot snapshot = adminConfigStore.getSnapshot();
        boolean allowMock = isTruthyEnv(ALLOW_MOCK_ENV);
        boolean useMock = allowMock && Boolean.TRUE.equals(snapshot.getUseMockOrcaQueue());
        boolean verify = Boolean.TRUE.equals(snapshot.getVerified());
        boolean retrySupported = useMock && queueStore != null;
        boolean discardSupported = useMock && queueStore != null;
        boolean retryRequested = isTrue(retry);

        OrcaQueueStore.RetryOutcome retryOutcome = null;
        boolean discardApplied = false;
        if (retrySupported || discardSupported) {
            if (deleteRequested && discardSupported) {
                discardApplied = queueStore.discard(patientId);
            }
            if (retryRequested && retrySupported) {
                retryOutcome = queueStore.retry(patientId);
            }
        }

        List<Map<String, Object>> queue = useMock ? mockQueue() : new ArrayList<>();
        if (patientId != null && !patientId.isBlank()) {
            queue.removeIf(entry -> !patientId.equals(entry.get("patientId")));
        }

        String runId = resolveRunId(request);
        String traceId = resolveTraceId(request);
        if (traceId == null || traceId.isBlank()) {
            traceId = runId;
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("runId", runId);
        body.put("traceId", traceId);
        body.put("fetchedAt", Instant.now().toString());
        body.put("source", useMock ? "mock" : "live");
        body.put("verifyAdminDelivery", verify);
        body.put("retrySupported", retrySupported);
        body.put("discardSupported", discardSupported);
        body.put("adminOnly", true);
        body.put("queue", queue);
        if (patientId != null && !patientId.isBlank()) {
            body.put("patientId", patientId);
        }

        if (retryRequested) {
            String retryReason;
            if (patientId == null || patientId.isBlank()) {
                retryReason = "patientId_required";
            } else if (retrySupported) {
                retryReason = retryOutcome != null ? retryOutcome.reason() : "mock_noop";
            } else {
                retryReason = "not_implemented";
            }
            boolean retryApplied = retryOutcome != null && retryOutcome.applied();
            body.put("retryRequested", true);
            body.put("retryApplied", retryApplied);
            body.put("retryReason", retryReason);
            if (retryApplied) {
                LOGGER.info("Orca queue retry applied (patientId={}, source={}, reason={})",
                        patientId, useMock ? "mock" : "live", retryReason);
            } else {
                LOGGER.info("Orca queue retry requested but not applied (patientId={}, source={}, reason={})",
                        patientId, useMock ? "mock" : "live", retryReason);
            }
        } else {
            body.put("retryRequested", false);
        }
        if (deleteRequested) {
            body.put("discardApplied", discardApplied);
        }

        Response.Status status = Response.Status.OK;
        if (retryRequested) {
            if (patientId == null || patientId.isBlank()) {
                return buildErrorResponse(request, Response.Status.BAD_REQUEST, "patientId_required",
                        "patientId が必要です。", body, runId, traceId, useMock, verify);
            } else if (!retrySupported) {
                return buildErrorResponse(request, Response.Status.NOT_IMPLEMENTED, "not_implemented",
                        "この環境では ORCA 再送は未実装です。", body, runId, traceId, useMock, verify);
            }
        }

        Response.ResponseBuilder builder = Response.status(status).entity(body);
        builder.header("x-run-id", runId);
        builder.header("x-trace-id", traceId);
        builder.header("x-orca-queue-mode", useMock ? "mock" : "live");
        builder.header("x-admin-delivery-verification", verify ? "enabled" : "disabled");
        return builder.build();
    }

    @SuppressWarnings("unchecked")
    private Response buildErrorResponse(HttpServletRequest request, Response.Status status, String errorCode, String message,
            Map<String, Object> queueBody, String runId, String traceId, boolean useMock, boolean verify) {
        WebApplicationException exception = restError(request, status, errorCode, message, queueBody, null);
        Response errorResponse = exception.getResponse();
        Map<String, Object> errorBody = errorResponse.getEntity() instanceof Map<?, ?>
                ? new LinkedHashMap<>((Map<String, Object>) errorResponse.getEntity())
                : new LinkedHashMap<>();
        Response.ResponseBuilder builder = Response.status(status).type(MediaType.APPLICATION_JSON_TYPE).entity(errorBody);
        builder.header("x-run-id", runId);
        builder.header("x-trace-id", traceId);
        builder.header("x-orca-queue-mode", useMock ? "mock" : "live");
        builder.header("x-admin-delivery-verification", verify ? "enabled" : "disabled");
        return builder.build();
    }

    private List<Map<String, Object>> mockQueue() {
        if (queueStore == null) {
            return new ArrayList<>();
        }
        List<Map<String, Object>> queue = new ArrayList<>();
        for (OrcaQueueStore.QueueEntry entry : queueStore.snapshot()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("patientId", entry.patientId());
            row.put("status", entry.status());
            row.put("retryable", entry.retryable());
            if (entry.lastDispatchAt() != null) {
                row.put("lastDispatchAt", entry.lastDispatchAt());
            }
            if (entry.error() != null) {
                row.put("error", entry.error());
            }
            queue.add(row);
        }
        return queue;
    }

    private String resolveRunId(HttpServletRequest request) {
        return AbstractOrcaRestResource.resolveRunIdValue(request);
    }

    private boolean isTrue(String value) {
        if (value == null) {
            return false;
        }
        String trimmed = value.trim();
        return "1".equals(trimmed) || "true".equalsIgnoreCase(trimmed);
    }

    private boolean isTruthyEnv(String key) {
        if (key == null || key.isBlank()) {
            return false;
        }
        String value = System.getProperty(key);
        if (value == null) {
            value = System.getenv(key);
        }
        if (value == null) {
            return false;
        }
        String trimmed = value.trim();
        return "1".equals(trimmed)
                || "true".equalsIgnoreCase(trimmed)
                || "yes".equalsIgnoreCase(trimmed)
                || "on".equalsIgnoreCase(trimmed);
    }
}
