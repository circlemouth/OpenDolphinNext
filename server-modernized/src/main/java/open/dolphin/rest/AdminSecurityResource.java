package open.dolphin.rest;

import jakarta.inject.Inject;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.mbean.UserCache;
import open.dolphin.rest.orca.AbstractOrcaRestResource;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.SessionAuditDispatcher;

/**
 * 管理者向けセキュリティ操作エンドポイント。
 * ヘッダ認証の資格情報キャッシュの可視化とクリアを行う。
 */
@Path("/admin/security")
public class AdminSecurityResource extends AbstractResource {

    @Inject
    private UserCache userCache;

    @Inject
    private SessionAuditDispatcher sessionAuditDispatcher;

    @Inject
    private open.dolphin.session.UserServiceBean userServiceBean;

    @GET
    @Path("/header-credentials/cache")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getCache(@Context HttpServletRequest request) {
        requireAdmin(request, userServiceBean);
        Map<String, String> snapshot = userCache.snapshot();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("ttlMinutes", userCache.ttlMinutes());
        body.put("cachedUsers", snapshot.size());
        body.put("users", snapshot.keySet().stream().map(this::mask).toList());
        String runId = AbstractOrcaRestResource.resolveRunIdValue(request);
        Response.ResponseBuilder builder = Response.ok(body)
                .header("x-run-id", runId)
                .header("x-header-credential-cache-ttl", userCache.ttlMinutes());
        return builder.build();
    }

    @DELETE
    @Path("/header-credentials/cache")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response clearCache(@Context HttpServletRequest request, @QueryParam("userName") String userName) {
        requireAdmin(request, userServiceBean);
        String normalized = normalize(userName);
        boolean clearedAll = normalized == null;
        int clearedCount = 0;
        if (clearedAll) {
            clearedCount = userCache.snapshot().size();
            userCache.clearAll();
        } else if (userCache.evict(normalized)) {
            clearedCount = 1;
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("clearedAll", clearedAll);
        body.put("clearedCount", clearedCount);
        body.put("ttlMinutes", userCache.ttlMinutes());
        body.put("cachedUsers", userCache.snapshot().size());
        String runId = AbstractOrcaRestResource.resolveRunIdValue(request);
        Response.ResponseBuilder builder = Response.ok(body)
                .header("x-run-id", runId)
                .header("x-header-credential-cache-ttl", userCache.ttlMinutes());

        recordAudit(request, clearedAll ? "HEADER_CREDENTIAL_CACHE_CLEAR" : "HEADER_CREDENTIAL_CACHE_EVICT",
                normalized, clearedCount, runId);
        return builder.build();
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String mask(String userName) {
        if (userName == null || userName.length() < 3) {
            return "***";
        }
        return userName.charAt(0) + "***" + userName.charAt(userName.length() - 1);
    }

    private void recordAudit(HttpServletRequest request,
                             String action,
                             String targetUser,
                             int clearedCount,
                             String runId) {
        if (sessionAuditDispatcher == null) {
            return;
        }
        AuditEventPayload payload = new AuditEventPayload();
        payload.setAction(action);
        payload.setResource("/api/admin/security/header-credentials/cache");
        payload.setActorId(request != null ? request.getRemoteUser() : null);
        payload.setIpAddress(request != null ? request.getRemoteAddr() : null);
        payload.setUserAgent(request != null ? request.getHeader("User-Agent") : null);
        payload.setTraceId(resolveTraceId(request));
        payload.setRequestId(runId != null ? runId : resolveTraceId(request));

        Map<String, Object> details = new LinkedHashMap<>();
        details.put("clearedCount", clearedCount);
        details.put("clearedAll", targetUser == null);
        if (targetUser != null) {
            details.put("targetUser", mask(targetUser));
        }
        details.put("ttlMinutes", userCache.ttlMinutes());
        payload.setDetails(details);

        sessionAuditDispatcher.record(payload,
                AuditEventEnvelope.Outcome.SUCCESS,
                null,
                null);
    }
}
