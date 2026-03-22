package open.dolphin.rest;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.core.Response;
import java.net.ConnectException;
import java.net.UnknownHostException;
import java.net.http.HttpTimeoutException;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.net.ssl.SSLException;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.orca.OrcaGatewayException;
import open.dolphin.orca.config.OrcaConnectionConfigStore;
import open.dolphin.orca.transport.OrcaConnectionPolicyException;
import open.dolphin.orca.transport.OrcaEndpoint;
import open.dolphin.orca.transport.OrcaTransportRequest;
import open.dolphin.orca.transport.OrcaTransportResult;
import open.dolphin.orca.transport.RestOrcaTransport;
import open.dolphin.rest.orca.AbstractOrcaRestResource;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.SessionAuditDispatcher;
import open.dolphin.session.UserServiceBean;

final class AdminOrcaConnectionTestSupport {

    private static final Pattern API_RESULT_PATTERN =
            Pattern.compile("<Api_Result\\b[^>]*>(.*?)</Api_Result>", Pattern.DOTALL);
    private static final Pattern API_MESSAGE_PATTERN =
            Pattern.compile("<Api_Result_Message\\b[^>]*>(.*?)</Api_Result_Message>", Pattern.DOTALL);
    private static final Pattern ORCA_HTTP_STATUS_PATTERN =
            Pattern.compile("response status\\s+(\\d+)");

    private final HttpServletRequest request;
    private final OrcaConnectionConfigStore orcaConnectionConfigStore;
    private final RestOrcaTransport restOrcaTransport;
    private final UserServiceBean userServiceBean;
    private final SessionAuditDispatcher sessionAuditDispatcher;

    AdminOrcaConnectionTestSupport(HttpServletRequest request,
            OrcaConnectionConfigStore orcaConnectionConfigStore,
            RestOrcaTransport restOrcaTransport,
            UserServiceBean userServiceBean,
            SessionAuditDispatcher sessionAuditDispatcher) {
        this.request = request;
        this.orcaConnectionConfigStore = orcaConnectionConfigStore;
        this.restOrcaTransport = restOrcaTransport;
        this.userServiceBean = userServiceBean;
        this.sessionAuditDispatcher = sessionAuditDispatcher;
    }

    Response testConnection() {
        String runId = AbstractOrcaRestResource.resolveRunIdValue(request);
        String actor = requireAdminActor(runId);
        String facilityId = resolveActorFacilityId(actor);
        String traceId = AbstractResource.resolveTraceIdValue(request);
        Map<String, Object> details = createAuditDetails(runId, actor, facilityId, traceId);
        Map<String, Object> body = createResponseBody(runId, facilityId, traceId);

        try {
            return buildSuccessResponse(runId, facilityId, body, details);
        } catch (OrcaConnectionPolicyException ex) {
            return buildPolicyFailureResponse(runId, body, details, ex);
        } catch (RuntimeException ex) {
            return buildRuntimeFailureResponse(runId, body, details, ex);
        }
    }

    private Map<String, Object> createAuditDetails(String runId, String actor, String facilityId, String traceId) {
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("operation", "test");
        details.put("resource", "/api/admin/orca/connection/test");
        details.put("runId", runId);
        details.put("actor", actor);
        details.put("facilityId", facilityId);
        if (traceId != null && !traceId.isBlank()) {
            details.put("traceId", traceId);
        }
        return details;
    }

    private Map<String, Object> createResponseBody(String runId, String facilityId, String traceId) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("runId", runId);
        body.put("facilityId", facilityId);
        if (traceId != null && !traceId.isBlank()) {
            body.put("traceId", traceId);
        }
        return body;
    }

    private Response buildSuccessResponse(
            String runId,
            String facilityId,
            Map<String, Object> body,
            Map<String, Object> details) {
        TestInvocationResult invocation = invokeTestConnection(facilityId);
        boolean ok = invocation.isOk();
        body.put("ok", ok);
        body.put("orcaHttpStatus", invocation.result() != null ? invocation.result().getStatus() : null);
        body.put("apiResult", invocation.apiResult());
        body.put("apiResultMessage", invocation.apiMessage());
        body.put("testedAt", Instant.now().toString());
        details.put("status", ok ? "success" : "failed");
        details.put("orcaHttpStatus", invocation.result() != null ? invocation.result().getStatus() : null);
        details.put("apiResult", invocation.apiResult());
        recordAudit("ADMIN_ORCA_CONNECTION_TEST", details,
                ok ? AuditEventEnvelope.Outcome.SUCCESS : AuditEventEnvelope.Outcome.FAILURE,
                ok ? null : "orca.connection.test.failed",
                ok ? null : invocation.apiMessage());
        return Response.ok(body).header("x-run-id", runId).build();
    }

    private TestInvocationResult invokeTestConnection(String facilityId) {
        if (restOrcaTransport == null) {
            throw new IllegalStateException("ORCA transport is not available");
        }
        if (orcaConnectionConfigStore != null) {
            orcaConnectionConfigStore.resolve(facilityId);
        }
        restOrcaTransport.reloadSettings(facilityId);
        String payload = buildSystemListRequestXml("04");
        OrcaTransportRequest transportRequest = OrcaTransportRequest.post(payload).withQuery("class=04");
        OrcaTransportResult result =
                restOrcaTransport.invokeDetailed(OrcaEndpoint.SYSTEM_MANAGEMENT_LIST, transportRequest);
        String responseXml = result != null ? result.getBody() : null;
        String apiResult = extractFirst(API_RESULT_PATTERN, responseXml);
        String apiMessage = extractFirst(API_MESSAGE_PATTERN, responseXml);
        return new TestInvocationResult(result, apiResult, apiMessage);
    }

    private Response buildPolicyFailureResponse(
            String runId,
            Map<String, Object> body,
            Map<String, Object> details,
            OrcaConnectionPolicyException ex) {
        body.put("ok", false);
        body.put("errorCategory", ex.getErrorCategory());
        body.put("error", ex.getMessage());
        body.put("testedAt", Instant.now().toString());
        details.put("status", "failed");
        details.put("errorCategory", ex.getErrorCategory());
        details.put("error", ex.getMessage());
        recordAudit("ADMIN_ORCA_CONNECTION_TEST", details,
                AuditEventEnvelope.Outcome.FAILURE,
                "orca.connection.test.policy_violation",
                ex.getMessage());
        return Response.status(Response.Status.BAD_REQUEST).entity(body).header("x-run-id", runId).build();
    }

    private Response buildRuntimeFailureResponse(
            String runId,
            Map<String, Object> body,
            Map<String, Object> details,
            RuntimeException ex) {
        Failure failure = classifyFailure(ex);
        body.put("ok", false);
        body.put("errorCategory", failure.category());
        body.put("error", failure.message());
        if (failure.orcaHttpStatus() != null) {
            body.put("orcaHttpStatus", failure.orcaHttpStatus());
        }
        body.put("testedAt", Instant.now().toString());
        details.put("status", "failed");
        details.put("errorCategory", failure.category());
        details.put("error", failure.message());
        if (failure.orcaHttpStatus() != null) {
            details.put("orcaHttpStatus", failure.orcaHttpStatus());
        }
        recordAudit("ADMIN_ORCA_CONNECTION_TEST", details,
                AuditEventEnvelope.Outcome.FAILURE,
                "orca.connection.test.error",
                failure.message());
        return Response.ok(body).header("x-run-id", runId).build();
    }

    private String requireAdminActor(String runId) {
        String actor = request != null ? request.getRemoteUser() : null;
        if (actor == null || actor.isBlank()) {
            throw AbstractResource.restError(request, Response.Status.UNAUTHORIZED, "unauthorized", "Authentication required");
        }
        if (userServiceBean == null || !userServiceBean.isAdmin(actor)) {
            throw AbstractResource.restError(request, Response.Status.FORBIDDEN, "forbidden", "管理者権限が必要です。");
        }
        return actor;
    }

    private String resolveActorFacilityId(String actor) {
        if (actor == null || actor.isBlank()) {
            return null;
        }
        int idx = actor.indexOf(IInfoModel.COMPOSITE_KEY_MAKER);
        if (idx <= 0) {
            return null;
        }
        String facility = actor.substring(0, idx).trim();
        return facility.isEmpty() ? null : facility;
    }

    private void recordAudit(String action,
            Map<String, Object> details,
            AuditEventEnvelope.Outcome outcome,
            String errorCode,
            String errorMessage) {
        if (sessionAuditDispatcher == null) {
            return;
        }
        AuditEventPayload payload = new AuditEventPayload();
        payload.setAction(action);
        payload.setResource(request != null ? request.getRequestURI() : "/api/admin/orca/connection");
        payload.setActorId(request != null ? request.getRemoteUser() : null);
        payload.setIpAddress(request != null ? request.getRemoteAddr() : null);
        payload.setUserAgent(request != null ? request.getHeader("User-Agent") : null);
        String traceId = AbstractResource.resolveTraceIdValue(request);
        if (traceId != null && !traceId.isBlank()) {
            payload.setTraceId(traceId);
        }
        String requestId = request != null ? request.getHeader("X-Request-Id") : null;
        if (requestId != null && !requestId.isBlank()) {
            payload.setRequestId(requestId.trim());
        } else if (traceId != null && !traceId.isBlank()) {
            payload.setRequestId(traceId);
        }
        payload.setDetails(details);
        sessionAuditDispatcher.record(payload, outcome, errorCode, errorMessage);
    }

    private static String buildSystemListRequestXml(String requestNumber) {
        String rn = requestNumber != null && !requestNumber.isBlank() ? requestNumber.trim() : "04";
        return String.join("\n",
                "<data>",
                "  <system01lstv2req type=\"record\">",
                "    <Request_Number type=\"string\">" + rn + "</Request_Number>",
                "  </system01lstv2req>",
                "</data>");
    }

    private static String extractFirst(Pattern pattern, String xml) {
        if (pattern == null || xml == null || xml.isBlank()) {
            return null;
        }
        Matcher matcher = pattern.matcher(xml);
        if (!matcher.find()) {
            return null;
        }
        String value = matcher.group(1);
        return value != null ? value.trim() : null;
    }

    private Failure classifyFailure(Throwable ex) {
        Throwable root = unwrap(ex);
        Integer orcaHttpStatus = extractOrcaHttpStatus(ex != null ? ex.getMessage() : null);

        if (orcaHttpStatus != null && (orcaHttpStatus == 401 || orcaHttpStatus == 403)) {
            return new Failure("auth_failed",
                    "認証に失敗しました。ユーザー名とパスワード(APIキー)を確認してください。",
                    orcaHttpStatus);
        }
        if (hasCause(root, HttpTimeoutException.class)) {
            return new Failure("timeout", "タイムアウトしました。接続先とネットワーク、証明書を確認してください。", orcaHttpStatus);
        }
        if (hasCause(root, UnknownHostException.class) || hasCause(root, ConnectException.class)) {
            return new Failure("unreachable", "接続先に到達できません。URL/ポート/ネットワークを確認してください。", orcaHttpStatus);
        }
        if (hasCause(root, SSLException.class) || containsSslHint(root)) {
            return new Failure("certificate_error", "証明書エラーの可能性があります。クライアント証明書/パスフレーズ/CA証明書を確認してください。", orcaHttpStatus);
        }
        if (root instanceof IllegalArgumentException) {
            return new Failure("config_incomplete", root.getMessage(), orcaHttpStatus);
        }
        if (root instanceof open.dolphin.orca.OrcaGatewayException) {
            return new Failure("http_error", root.getMessage(), orcaHttpStatus);
        }
        String message = root != null && root.getMessage() != null ? root.getMessage() : "不明なエラーです。";
        return new Failure("unknown", message, orcaHttpStatus);
    }

    private Throwable unwrap(Throwable ex) {
        if (ex == null) {
            return null;
        }
        Throwable current = ex;
        while (current.getCause() != null && (current instanceof open.dolphin.orca.OrcaGatewayException || current instanceof RuntimeException)) {
            if (current.getCause() == current) {
                break;
            }
            current = current.getCause();
        }
        return current;
    }

    private boolean hasCause(Throwable ex, Class<? extends Throwable> type) {
        if (ex == null || type == null) {
            return false;
        }
        Throwable cur = ex;
        int depth = 0;
        while (cur != null && depth < 10) {
            if (type.isInstance(cur)) {
                return true;
            }
            cur = cur.getCause();
            depth++;
        }
        return false;
    }

    private boolean containsSslHint(Throwable ex) {
        if (ex == null) {
            return false;
        }
        String msg = ex.getMessage();
        if (msg == null) {
            return false;
        }
        String normalized = msg.toLowerCase(Locale.ROOT);
        return normalized.contains("ssl") || normalized.contains("pkix") || normalized.contains("handshake");
    }

    private Integer extractOrcaHttpStatus(String message) {
        if (message == null || message.isBlank()) {
            return null;
        }
        Matcher matcher = ORCA_HTTP_STATUS_PATTERN.matcher(message);
        if (!matcher.find()) {
            return null;
        }
        try {
            return Integer.parseInt(matcher.group(1));
        } catch (Exception ex) {
            return null;
        }
    }

    private record Failure(String category, String message, Integer orcaHttpStatus) {}

    private record TestInvocationResult(OrcaTransportResult result, String apiResult, String apiMessage) {

        private boolean isOk() {
            return result != null
                    && result.getStatus() >= 200
                    && result.getStatus() < 300
                    && OrcaApiProxySupport.isApiResultSuccess(apiResult);
        }
    }
}
