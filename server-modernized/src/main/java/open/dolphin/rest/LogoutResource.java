package open.dolphin.rest;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.NewCookie;
import jakarta.ws.rs.core.Response;
import java.util.LinkedHashMap;
import java.util.Map;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.SessionAuditDispatcher;
import open.dolphin.security.auth.AuthSessionRegistryService;
import open.dolphin.security.auth.SessionRevocationService;

/**
 * Idempotent logout endpoint for server-side session invalidation.
 */
@Path("/logout")
public class LogoutResource extends AbstractResource {

    private static final String CACHE_CONTROL_VALUE = "private, no-store, max-age=0, must-revalidate";

    @jakarta.inject.Inject
    private AuthSessionRegistryService authSessionRegistryService;

    @jakarta.inject.Inject
    private SessionAuditDispatcher sessionAuditDispatcher;

    @POST
    public Response logout(@Context HttpServletRequest request) {
        boolean registryRevoked = false;
        String actorId = AuthSessionSupport.resolveActorId(request);
        String facilityId = actorId != null ? AbstractResource.getRemoteFacility(actorId) : null;
        if (request != null) {
            HttpSession session = request.getSession(false);
            if (session != null) {
                try {
                    if (authSessionRegistryService != null) {
                        registryRevoked = authSessionRegistryService.revokeCurrentSession(session, SessionRevocationService.REASON_LOGOUT);
                    }
                    AuthSessionSupport.clearSession(session);
                    session.invalidate();
                } catch (IllegalStateException ignored) {
                    // already invalidated by concurrent logout
                }
            }
        }
        recordAudit(request, actorId, facilityId, registryRevoked);
        return Response.noContent()
                .header("Cache-Control", CACHE_CONTROL_VALUE)
                .header("Pragma", "no-cache")
                .header("Expires", "0")
                .header("Clear-Site-Data", "\"storage\"")
                .cookie(expiredSessionCookie(request))
                .build();
    }

    private void recordAudit(HttpServletRequest request, String actorId, String facilityId, boolean registryRevoked) {
        if (sessionAuditDispatcher == null) {
            return;
        }
        AuditEventPayload payload = new AuditEventPayload();
        payload.setAction("LOGOUT_OK");
        payload.setResource("/api/logout");
        payload.setActorId(actorId);
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
        if (facilityId != null) {
            details.put("facilityId", facilityId);
        }
        details.put("httpStatus", Response.Status.NO_CONTENT.getStatusCode());
        details.put("sessionInvalidated", Boolean.TRUE);
        details.put("registryRevoked", registryRevoked);
        details.put("revocationReason", SessionRevocationService.REASON_LOGOUT);
        if (requestId != null && !requestId.isBlank()) {
            details.put("requestId", requestId.trim());
        }
        if (traceId != null && !traceId.isBlank()) {
            details.put("traceId", traceId.trim());
        }
        payload.setDetails(details);
        sessionAuditDispatcher.record(payload, AuditEventEnvelope.Outcome.SUCCESS, null, null);
    }

    private static NewCookie expiredSessionCookie(HttpServletRequest request) {
        String path = "/";
        boolean secure = false;
        if (request != null) {
            secure = RequestSecuritySupport.isSecureRequest(request);
            String contextPath = request.getContextPath();
            if (contextPath != null && !contextPath.isBlank()) {
                path = contextPath;
            }
        }
        return new NewCookie.Builder("JSESSIONID")
                .value("")
                .path(path)
                .maxAge(0)
                .httpOnly(true)
                .secure(secure)
                .build();
    }
}
