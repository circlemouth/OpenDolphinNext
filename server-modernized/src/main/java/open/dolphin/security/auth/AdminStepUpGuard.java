package open.dolphin.security.auth;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.rest.AbstractResource;
import open.dolphin.rest.AuthSessionSupport;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.SessionAuditDispatcher;

@ApplicationScoped
public class AdminStepUpGuard {

    private static final String REQUIRED_SCOPE = "admin:mutation";

    @Inject
    private SessionAuditDispatcher sessionAuditDispatcher;

    public void require(HttpServletRequest request, String scope) {
        HttpSession session = request != null ? request.getSession(false) : null;
        AuthSessionSupport.StepUpSession proof = AuthSessionSupport.loadStepUpSession(session);
        Instant now = Instant.now();
        if (proof == null
                || proof.expiresAt() == null
                || !now.isBefore(proof.expiresAt())
                || scope == null
                || scope.isBlank()
                || !REQUIRED_SCOPE.equals(scope)
                || !REQUIRED_SCOPE.equals(proof.scope())) {
            recordBlockedAudit(request, scope);
            throw new WebApplicationException(buildResponse());
        }
    }

    private void recordBlockedAudit(HttpServletRequest request, String scope) {
        if (sessionAuditDispatcher == null) {
            return;
        }
        AuditEventPayload payload = new AuditEventPayload();
        payload.setAction("ADMIN_STEP_UP_BLOCKED");
        payload.setResource(request != null ? request.getRequestURI() : "/api/admin");
        payload.setActorId(AuthSessionSupport.resolveActorId(request));
        payload.setIpAddress(request != null ? request.getRemoteAddr() : null);
        payload.setUserAgent(request != null ? request.getHeader("User-Agent") : null);
        String traceId = AbstractResource.resolveTraceIdValue(request);
        if (traceId != null && !traceId.isBlank()) {
            payload.setTraceId(traceId);
        }
        String requestId = request != null ? request.getHeader("X-Request-Id") : null;
        if (requestId == null || requestId.isBlank()) {
            requestId = traceId;
        }
        if (requestId != null && !requestId.isBlank()) {
            payload.setRequestId(requestId.trim());
        }
        Map<String, Object> details = new LinkedHashMap<>();
        String facilityId = actorFacilityId(request);
        if (facilityId != null) {
            details.put("facilityId", facilityId);
        }
        if (scope != null) {
            details.put("scope", scope);
        }
        details.put("requiredScope", REQUIRED_SCOPE);
        details.put("errorCode", "step_up_required");
        details.put("httpStatus", Response.Status.PRECONDITION_FAILED.getStatusCode());
        if (requestId != null && !requestId.isBlank()) {
            details.put("requestId", requestId.trim());
        }
        if (traceId != null && !traceId.isBlank()) {
            details.put("traceId", traceId.trim());
        }
        payload.setDetails(details);
        sessionAuditDispatcher.record(payload, AuditEventEnvelope.Outcome.BLOCKED, "step_up_required",
                "管理操作には追加認証が必要です。");
    }

    private Response buildResponse() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", "step_up_required");
        body.put("code", "step_up_required");
        body.put("message", "管理操作には追加認証が必要です。");
        body.put("requiredScope", REQUIRED_SCOPE);
        body.put("status", Response.Status.PRECONDITION_FAILED.getStatusCode());
        return Response.status(Response.Status.PRECONDITION_FAILED)
                .type(MediaType.APPLICATION_JSON_TYPE)
                .entity(body)
                .header("Cache-Control", "private, no-store, max-age=0, must-revalidate")
                .header("Pragma", "no-cache")
                .header("Expires", "0")
                .build();
    }

    private String actorFacilityId(HttpServletRequest request) {
        String remoteUser = request != null ? request.getRemoteUser() : null;
        return remoteUser != null ? AbstractResource.getRemoteFacility(remoteUser) : null;
    }
}
