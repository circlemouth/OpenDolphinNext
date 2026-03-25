package open.dolphin.security.auth;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.rest.AbstractResource;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.SessionAuditDispatcher;

@ApplicationScoped
public class SessionRevocationService {

    public static final String REASON_PASSWORD_RESET = "password_reset";
    public static final String REASON_PRIVILEGE_DOWNGRADE = "privilege_downgrade";
    public static final String REASON_FACTOR2_CREDENTIAL_REVOKE = "factor2_credential_revoke";
    public static final String REASON_LOGOUT = "logout";

    @Inject
    private UserSecurityStateRepository userSecurityStateRepository;

    @Inject
    private AuthSessionRegistryRepository authSessionRegistryRepository;

    @Inject
    private SessionAuditDispatcher sessionAuditDispatcher;

    public void incrementSessionEpoch(long userPk, Instant updatedAt) {
        userSecurityStateRepository.incrementSessionEpoch(userPk, updatedAt);
    }

    public void markPasswordChanged(long userPk, Instant changedAt) {
        userSecurityStateRepository.markPasswordChanged(userPk, changedAt);
    }

    public int revokeAllForUser(long userPk, String facilityId, String reason, HttpServletRequest request) {
        String normalizedReason = normalizeReason(reason);
        Instant now = Instant.now();
        int revokedCount = authSessionRegistryRepository.revokeAllActiveSessions(userPk, normalizedReason, now);
        recordAudit(userPk, facilityId, normalizedReason, revokedCount, request);
        return revokedCount;
    }

    public int revokeAllForFactor2Credential(long userPk, String facilityId, HttpServletRequest request) {
        return revokeAllForUser(userPk, facilityId, REASON_FACTOR2_CREDENTIAL_REVOKE, request);
    }

    private void recordAudit(long userPk, String facilityId, String reason, int revokedCount, HttpServletRequest request) {
        if (sessionAuditDispatcher == null) {
            return;
        }
        String traceId = AbstractResource.resolveTraceIdValue(request);
        String requestId = request != null ? request.getHeader("X-Request-Id") : null;
        if (requestId == null || requestId.isBlank()) {
            requestId = traceId;
        }

        AuditEventPayload payload = new AuditEventPayload();
        payload.setAction("SESSION_REVOKED");
        payload.setResource(request != null ? request.getRequestURI() : "/api/admin/access");
        payload.setActorId(request != null ? request.getRemoteUser() : null);
        payload.setIpAddress(request != null ? request.getRemoteAddr() : null);
        payload.setUserAgent(request != null ? request.getHeader("User-Agent") : null);
        if (traceId != null && !traceId.isBlank()) {
            payload.setTraceId(traceId.trim());
        }
        if (requestId != null && !requestId.isBlank()) {
            payload.setRequestId(requestId.trim());
        }
        Map<String, Object> details = new LinkedHashMap<>();
        if (facilityId != null && !facilityId.isBlank()) {
            details.put("facilityId", facilityId.trim());
        }
        details.put("targetUserPk", userPk);
        details.put("reason", reason);
        details.put("revokedCount", revokedCount);
        if (requestId != null && !requestId.isBlank()) {
            details.put("requestId", requestId.trim());
        }
        if (traceId != null && !traceId.isBlank()) {
            details.put("traceId", traceId.trim());
        }
        payload.setDetails(details);
        sessionAuditDispatcher.record(payload, AuditEventEnvelope.Outcome.SUCCESS, null, null);
    }

    private static String normalizeReason(String reason) {
        if (REASON_PASSWORD_RESET.equals(reason)
                || REASON_PRIVILEGE_DOWNGRADE.equals(reason)
                || REASON_FACTOR2_CREDENTIAL_REVOKE.equals(reason)
                || REASON_LOGOUT.equals(reason)) {
            return reason;
        }
        throw new IllegalArgumentException("Unsupported revocation reason: " + reason);
    }
}
