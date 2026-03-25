package open.dolphin.security.auth;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.infomodel.UserModel;
import open.dolphin.rest.AbstractResource;
import open.dolphin.rest.AuthSessionSupport;
import open.dolphin.rest.TotpVerificationSupport;
import open.dolphin.rest.dto.CurrentUserResponse;
import open.dolphin.rest.support.CurrentUserResponseMapper;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.SessionAuditDispatcher;
import open.dolphin.session.UserServiceBean;

@ApplicationScoped
public class StepUpSessionService {

    static final Duration STEP_UP_TTL = Duration.ofSeconds(300);
    static final String REQUIRED_METHOD = "totp";
    static final String REQUIRED_SCOPE = "admin:mutation";
    public static final String DEPRECATED_OTP_FIELD = "totpCode";

    @Inject
    private AuthSessionRegistryService authSessionRegistryService;

    @Inject
    private SessionAuditDispatcher sessionAuditDispatcher;

    @Inject
    private UserServiceBean userServiceBean;

    @Inject
    private TotpVerificationSupport totpVerificationSupport;

    @PersistenceContext
    private EntityManager entityManager;

    public StepUpResult stepUp(HttpServletRequest request, Map<String, Object> payload) {
        String scope = readText(payload, "scope");
        String method = readText(payload, "method");
        String code = readText(payload, "code");

        if (payload != null && payload.containsKey(DEPRECATED_OTP_FIELD)) {
            return fail(request, Response.Status.BAD_REQUEST, "invalid_request",
                    "廃止された認証フィールドは受け付けません。", null, null);
        }
        if (code == null || method == null || scope == null
                || !REQUIRED_METHOD.equals(method)
                || !REQUIRED_SCOPE.equals(scope)) {
            return fail(request, Response.Status.BAD_REQUEST, "invalid_request",
                    "step-up の method/code/scope が不正です。", null, scope);
        }

        HttpSession session = request != null ? request.getSession(false) : null;
        String actorId = AuthSessionSupport.resolveActorId(session);
        if (session == null || actorId == null) {
            return fail(request, Response.Status.UNAUTHORIZED, "unauthorized",
                    "Authentication required.", null, scope);
        }

        AuthSessionRegistryService.SessionValidationResult validation =
                authSessionRegistryService != null ? authSessionRegistryService.validateCurrentSession(session)
                        : AuthSessionRegistryService.SessionValidationResult.noSession();
        if (!validation.valid()) {
            AuthSessionSupport.clearSession(session);
            invalidateSilently(session);
            return fail(request, Response.Status.UNAUTHORIZED, "session_revoked",
                    "セッションは無効化されました。再ログインしてください。", null, scope);
        }

        UserModel actorUser = loadActorUser(actorId);
        if (actorUser == null) {
            return fail(request, Response.Status.UNAUTHORIZED, "unauthorized",
                    "Authentication required.", null, scope);
        }
        String facilityId = deriveActorFacilityId(actorId, actorUser);
        if (!hasVerifiedTotpCredential(actorUser)) {
            return fail(request, Response.Status.PRECONDITION_FAILED, "factor2_missing",
                    "Authenticator（TOTP）が未登録です。", facilityId, scope);
        }

        TotpVerificationSupport.VerificationResult verification =
                totpVerificationSupport != null
                        ? totpVerificationSupport.verifyCurrentCode(actorUser.getId(), code)
                        : TotpVerificationSupport.VerificationResult.invalid();
        if (verification.status() == TotpVerificationSupport.VerificationStatus.MISSING_CREDENTIAL) {
            return fail(request, Response.Status.PRECONDITION_FAILED, "factor2_missing",
                    "Authenticator（TOTP）が未登録です。", facilityId, scope);
        }
        if (!verification.succeeded()) {
            return fail(request, Response.Status.UNAUTHORIZED, "factor2_invalid",
                    "認証コードが正しくありません。", facilityId, scope);
        }

        Instant verifiedAt = Instant.now();
        Instant expiresAt = verifiedAt.plus(STEP_UP_TTL);
        if (authSessionRegistryService != null) {
            authSessionRegistryService.registerStepUp(session, scope, verifiedAt, expiresAt);
        }
        AuthSessionSupport.populateStepUpSession(session, scope, verifiedAt, expiresAt);

        StepUpResult result = new StepUpResult(scope, verifiedAt, expiresAt, STEP_UP_TTL.getSeconds());
        recordAudit(request, "SESSION_STEP_UP_OK", facilityId, scope, Response.Status.OK.getStatusCode(), null,
                "success", null, result);
        return result;
    }

    private UserModel loadActorUser(String actorId) {
        if (userServiceBean == null || actorId == null || actorId.isBlank()) {
            return null;
        }
        try {
            return userServiceBean.getUser(actorId);
        } catch (RuntimeException ex) {
            return null;
        }
    }

    private boolean hasVerifiedTotpCredential(UserModel user) {
        if (user == null || entityManager == null || user.getId() <= 0) {
            return false;
        }
        String factor2Auth = user.getFactor2Auth();
        if (factor2Auth == null || !"totp".equalsIgnoreCase(factor2Auth.trim())) {
            return false;
        }
        try {
            var query = entityManager.createQuery(
                    "from Factor2Credential f where f.userPK=:userPK and f.credentialType=:type and f.verified=true order by f.updatedAt desc");
            query.setParameter("userPK", user.getId());
            query.setParameter("type", "totp");
            query.setMaxResults(1);
            List<?> results = query.getResultList();
            return results != null && !results.isEmpty();
        } catch (RuntimeException ex) {
            return false;
        }
    }

    private String deriveActorFacilityId(String actorId, UserModel actorUser) {
        if (actorUser != null && actorUser.getFacilityModel() != null
                && actorUser.getFacilityModel().getFacilityId() != null
                && !actorUser.getFacilityModel().getFacilityId().isBlank()) {
            return actorUser.getFacilityModel().getFacilityId().trim();
        }
        return AbstractResource.getRemoteFacility(actorId);
    }

    private String readText(Map<String, Object> payload, String key) {
        if (payload == null) {
            return null;
        }
        Object value = payload.get(key);
        if (!(value instanceof String text)) {
            return null;
        }
        String trimmed = text.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private StepUpResult fail(HttpServletRequest request,
            Response.Status status,
            String errorCode,
            String message,
            String facilityId,
            String scope) {
        recordAudit(request, "SESSION_STEP_UP_FAIL", facilityId, scope, status.getStatusCode(), errorCode,
                "failed", message, null);
        throw new WebApplicationException(buildErrorResponse(status, errorCode, message, scope));
    }

    private Response buildErrorResponse(Response.Status status, String errorCode, String message, String scope) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", errorCode);
        body.put("code", errorCode);
        body.put("message", message);
        body.put("status", status.getStatusCode());
        if (scope != null) {
            body.put("scope", scope);
        }
        return Response.status(status)
                .type(MediaType.APPLICATION_JSON_TYPE)
                .entity(body)
                .header("Cache-Control", "private, no-store, max-age=0, must-revalidate")
                .header("Pragma", "no-cache")
                .header("Expires", "0")
                .build();
    }

    private void invalidateSilently(HttpSession session) {
        if (session == null) {
            return;
        }
        try {
            session.invalidate();
        } catch (IllegalStateException ignored) {
            // already invalidated
        }
    }

    private void recordAudit(HttpServletRequest request,
            String action,
            String facilityId,
            String scope,
            int httpStatus,
            String errorCode,
            String status,
            String errorMessage,
            StepUpResult result) {
        if (sessionAuditDispatcher == null) {
            return;
        }
        AuditEventPayload payload = new AuditEventPayload();
        payload.setAction(action);
        payload.setResource("/api/session/step-up");
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
        if (facilityId != null) {
            details.put("facilityId", facilityId);
        }
        if (scope != null) {
            details.put("scope", scope);
        }
        if (errorCode != null) {
            details.put("errorCode", errorCode);
        }
        details.put("httpStatus", httpStatus);
        details.put("status", status);
        if (result != null) {
            details.put("verifiedAt", result.verifiedAt().toString());
            details.put("expiresAt", result.expiresAt().toString());
            details.put("ttlSeconds", result.ttlSeconds());
        }
        if (requestId != null && !requestId.isBlank()) {
            details.put("requestId", requestId.trim());
        }
        if (traceId != null && !traceId.isBlank()) {
            details.put("traceId", traceId.trim());
        }
        payload.setDetails(details);
        sessionAuditDispatcher.record(payload,
                httpStatus >= 400 ? AuditEventEnvelope.Outcome.FAILURE : AuditEventEnvelope.Outcome.SUCCESS,
                errorCode,
                errorMessage);
    }

    public record StepUpResult(
            String scope,
            Instant verifiedAt,
            Instant expiresAt,
            long ttlSeconds) {
    }
}
