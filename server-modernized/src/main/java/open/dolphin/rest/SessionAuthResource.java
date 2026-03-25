package open.dolphin.rest;

import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.infomodel.UserModel;
import open.dolphin.rest.dto.CurrentUserResponse;
import open.dolphin.rest.support.CurrentUserResponseMapper;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.SessionAuditDispatcher;
import open.dolphin.security.auth.AuthSessionRegistryService;
import open.dolphin.security.auth.StepUpSessionService;
import open.dolphin.session.UserServiceBean;

@Path("/session")
public class SessionAuthResource extends AbstractResource {

    @Inject
    private UserServiceBean userServiceBean;

    @Inject
    private TotpVerificationSupport totpVerificationSupport;

    @Inject
    private AuthSessionRegistryService authSessionRegistryService;

    @Inject
    private StepUpSessionService stepUpSessionService;

    @Inject
    private SessionAuditDispatcher sessionAuditDispatcher;

    @PersistenceContext
    private EntityManager entityManager;

    private static final String FACTOR2_REQUIRED_CODE = "factor2_required";
    private static final String FACTOR2_INVALID_CODE = "factor2_invalid";
    private static final String FACTOR2_SESSION_MISSING_CODE = "factor2_session_missing";
    private static final String FACTOR2_SESSION_EXPIRED_CODE = "factor2_session_expired";
    private static final String FACTOR2_REQUIRED_MESSAGE = "二要素認証コードを入力してください。";
    private static final String FACTOR2_INVALID_MESSAGE = "認証コードが正しくありません。";
    private static final String FACTOR2_SESSION_MESSAGE = "二要素認証をやり直してください。";

    @POST
    @Path("/login")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response login(@Context HttpServletRequest request, LoginRequest body) {
        if (body == null) {
            recordLifecycleAudit(request, "LOGIN_PASSWORD_FAIL", null, null,
                    Response.Status.BAD_REQUEST.getStatusCode(), "invalid_request",
                    "ログイン情報が必要です。", AuditEventEnvelope.Outcome.FAILURE, Map.of("status", "failed"));
            throw restError(request, Response.Status.BAD_REQUEST, "invalid_request", "ログイン情報が必要です。");
        }
        String facilityId = trimToNull(body.facilityId());
        String loginId = trimToNull(body.userId());
        String password = body.password();
        String clientUuid = trimToNull(body.clientUuid());
        if (facilityId == null || loginId == null || password == null || password.isBlank()) {
            recordLifecycleAudit(request, "LOGIN_PASSWORD_FAIL", facilityId, null,
                    Response.Status.BAD_REQUEST.getStatusCode(), "invalid_request",
                    "施設ID、ユーザーID、パスワードを指定してください。", AuditEventEnvelope.Outcome.FAILURE,
                    Map.of("status", "failed"));
            throw restError(request, Response.Status.BAD_REQUEST, "invalid_request", "施設ID、ユーザーID、パスワードを指定してください。");
        }
        String actorId = facilityId + ":" + loginId;
        UserServiceBean.AuthenticationResult result =
                userServiceBean.authenticateWithPolicy(actorId, password, resolveClientIp(request));
        if (result.ipThrottled()) {
            recordLifecycleAudit(request, "LOGIN_PASSWORD_BLOCKED", facilityId, null,
                    Response.Status.TOO_MANY_REQUESTS.getStatusCode(), "too_many_requests",
                    "ログイン試行が多すぎます。時間をおいて再試行してください。",
                    AuditEventEnvelope.Outcome.BLOCKED,
                    Map.of("status", "blocked", "retryAfterSeconds", result.retryAfterSeconds()));
            Response.ResponseBuilder response = Response.status(429)
                    .entity(buildLoginError("too_many_requests", "ログイン試行が多すぎます。時間をおいて再試行してください。"));
            response.header("Retry-After", Long.toString(Math.max(1L, result.retryAfterSeconds())));
            return AuthSessionSupport.noStore(response).build();
        }
        if (!result.authenticated()) {
            if (result.secondFactorRequired()) {
                UserModel actorUser = loadActorUser(actorId);
                if (!hasVerifiedTotpCredential(actorUser)) {
                    recordLifecycleAudit(request, "LOGIN_PASSWORD_FAIL", facilityId, null,
                            Response.Status.UNAUTHORIZED.getStatusCode(), "unauthorized",
                            "認証に失敗しました。", AuditEventEnvelope.Outcome.FAILURE,
                            Map.of("status", "failed", "factor2Required", true));
                    throw restError(request, Response.Status.UNAUTHORIZED, "unauthorized", "認証に失敗しました。");
                }
                HttpSession session = AuthSessionSupport.rotateSession(request);
                AuthSessionSupport.clearSession(session);
                AuthSessionSupport.populatePendingSecondFactorSession(session, actorId, facilityId, loginId, clientUuid);
                recordLifecycleAudit(request, "LOGIN_FACTOR2_REQUIRED", facilityId, null,
                        Response.Status.UNAUTHORIZED.getStatusCode(), "factor2_required",
                        "二要素認証コードを入力してください。", AuditEventEnvelope.Outcome.BLOCKED,
                        Map.of("status", "blocked", "factor2Required", true, "factor2Type", "totp"));
                return buildFactor2RequiredResponse();
            }
            recordLifecycleAudit(request, "LOGIN_PASSWORD_FAIL", facilityId, null,
                    Response.Status.UNAUTHORIZED.getStatusCode(), "unauthorized",
                    "認証に失敗しました。", AuditEventEnvelope.Outcome.FAILURE,
                    Map.of("status", "failed"));
            throw restError(request, Response.Status.UNAUTHORIZED, "unauthorized", "認証に失敗しました。");
        }

        UserModel actorUser = loadActorUser(actorId);
        CurrentUserResponse safeUser = CurrentUserResponseMapper.from(actorUser);
        if (safeUser == null) {
            recordLifecycleAudit(request, "LOGIN_PASSWORD_FAIL", facilityId, null,
                    Response.Status.UNAUTHORIZED.getStatusCode(), "unauthorized",
                    "認証ユーザーを取得できませんでした。", AuditEventEnvelope.Outcome.FAILURE,
                    Map.of("status", "failed"));
            throw restError(request, Response.Status.UNAUTHORIZED, "unauthorized", "認証ユーザーを取得できませんでした。");
        }

        HttpSession session = AuthSessionSupport.rotateSession(request);
        AuthSessionSupport.clearSession(session);
        AuthSessionSupport.populateAuthenticatedSession(session, actorId, facilityId, loginId, clientUuid);
        registerAuthenticatedSession(request, session, actorUser, actorId, facilityId, loginId, clientUuid, "password");
        recordLifecycleAudit(request, "LOGIN_PASSWORD_OK", facilityId, null,
                Response.Status.OK.getStatusCode(), null, "success", AuditEventEnvelope.Outcome.SUCCESS,
                Map.of("factor2Required", false));

        String runId = normalizeRunIdValue(request);
        AuthSessionSupport.SessionUserResponse payload =
                AuthSessionSupport.toSessionUserResponse(safeUser, clientUuid, runId);
        return AuthSessionSupport.noStore(Response.ok(payload)).build();
    }

    @POST
    @Path("/login/factor2")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response loginFactor2(@Context HttpServletRequest request, LoginFactor2Request body) {
        String code = trimToNull(body != null ? body.code() : null);
        if (code == null) {
            recordLifecycleAudit(request, "LOGIN_FACTOR2_FAIL", null, null,
                    Response.Status.BAD_REQUEST.getStatusCode(), "invalid_request",
                    "認証コードを指定してください。", AuditEventEnvelope.Outcome.FAILURE,
                    Map.of("status", "failed"));
            throw restError(request, Response.Status.BAD_REQUEST, "invalid_request", "認証コードを指定してください。");
        }

        HttpSession currentSession = request != null ? request.getSession(false) : null;
        AuthSessionSupport.PendingSecondFactorSession pending = AuthSessionSupport.loadPendingSecondFactor(currentSession);
        if (pending == null) {
            recordLifecycleAudit(request, "LOGIN_FACTOR2_EXPIRED", null, null,
                    Response.Status.UNAUTHORIZED.getStatusCode(), "factor2_session_missing",
                    "二要素認証をやり直してください。", AuditEventEnvelope.Outcome.BLOCKED,
                    Map.of("status", "blocked"));
            return buildFactor2SessionError(FACTOR2_SESSION_MISSING_CODE);
        }
        if (isExpired(pending) || pending.attemptCount() >= AuthSessionSupport.PENDING_SECOND_FACTOR_MAX_ATTEMPTS) {
            AuthSessionSupport.clearSession(currentSession);
            recordLifecycleAudit(request, "LOGIN_FACTOR2_EXPIRED", pending.facilityId(), null,
                    Response.Status.UNAUTHORIZED.getStatusCode(), FACTOR2_SESSION_EXPIRED_CODE,
                    "二要素認証をやり直してください。", AuditEventEnvelope.Outcome.BLOCKED,
                    Map.of("status", "blocked"));
            return buildFactor2SessionError(FACTOR2_SESSION_EXPIRED_CODE);
        }

        if (!code.matches("\\d{6}")) {
            recordLifecycleAudit(request, "LOGIN_FACTOR2_FAIL", pending.facilityId(), null,
                    Response.Status.UNAUTHORIZED.getStatusCode(), FACTOR2_INVALID_CODE,
                    FACTOR2_INVALID_MESSAGE, AuditEventEnvelope.Outcome.FAILURE,
                    Map.of("status", "failed"));
            return onInvalidSecondFactorCode(currentSession);
        }

        UserServiceBean userService = userServiceBean;
        if (userService == null) {
            AuthSessionSupport.clearSession(currentSession);
            recordLifecycleAudit(request, "LOGIN_FACTOR2_EXPIRED", pending.facilityId(), null,
                    Response.Status.UNAUTHORIZED.getStatusCode(), FACTOR2_SESSION_EXPIRED_CODE,
                    "二要素認証をやり直してください。", AuditEventEnvelope.Outcome.BLOCKED,
                    Map.of("status", "blocked"));
            return buildFactor2SessionError(FACTOR2_SESSION_EXPIRED_CODE);
        }

        UserModel actorUser;
        try {
            actorUser = userService.getUser(pending.actorId());
        } catch (RuntimeException ex) {
            AuthSessionSupport.clearSession(currentSession);
            recordLifecycleAudit(request, "LOGIN_FACTOR2_EXPIRED", pending.facilityId(), null,
                    Response.Status.UNAUTHORIZED.getStatusCode(), FACTOR2_SESSION_EXPIRED_CODE,
                    "二要素認証をやり直してください。", AuditEventEnvelope.Outcome.BLOCKED,
                    Map.of("status", "blocked"));
            return buildFactor2SessionError(FACTOR2_SESSION_EXPIRED_CODE);
        }

        if (!hasVerifiedTotpCredential(actorUser)) {
            AuthSessionSupport.clearSession(currentSession);
            recordLifecycleAudit(request, "LOGIN_FACTOR2_EXPIRED", pending.facilityId(), null,
                    Response.Status.UNAUTHORIZED.getStatusCode(), FACTOR2_SESSION_EXPIRED_CODE,
                    "二要素認証をやり直してください。", AuditEventEnvelope.Outcome.BLOCKED,
                    Map.of("status", "blocked"));
            return buildFactor2SessionError(FACTOR2_SESSION_EXPIRED_CODE);
        }

        TotpVerificationSupport.VerificationResult verification =
                totpVerificationSupport.verifyCurrentCode(actorUser.getId(), code);
        if (!verification.succeeded()) {
            recordLifecycleAudit(request, "LOGIN_FACTOR2_FAIL", pending.facilityId(), null,
                    Response.Status.UNAUTHORIZED.getStatusCode(), FACTOR2_INVALID_CODE,
                    FACTOR2_INVALID_MESSAGE, AuditEventEnvelope.Outcome.FAILURE,
                    Map.of("status", "failed"));
            return onInvalidSecondFactorCode(currentSession);
        }

        CurrentUserResponse safeUser = CurrentUserResponseMapper.from(actorUser);
        if (safeUser == null) {
            AuthSessionSupport.clearSession(currentSession);
            recordLifecycleAudit(request, "LOGIN_FACTOR2_EXPIRED", pending.facilityId(), null,
                    Response.Status.UNAUTHORIZED.getStatusCode(), FACTOR2_SESSION_EXPIRED_CODE,
                    "二要素認証をやり直してください。", AuditEventEnvelope.Outcome.BLOCKED,
                    Map.of("status", "blocked"));
            throw restError(request, Response.Status.UNAUTHORIZED, "unauthorized", "認証ユーザーを取得できませんでした。");
        }

        HttpSession authenticatedSession = AuthSessionSupport.rotateSession(request);
        AuthSessionSupport.clearSession(authenticatedSession);
        AuthSessionSupport.populateAuthenticatedSession(
                authenticatedSession,
                pending.actorId(),
                pending.facilityId(),
                pending.loginId(),
                pending.clientUuid());
        registerAuthenticatedSession(request, authenticatedSession, actorUser, pending.actorId(), pending.facilityId(),
                pending.loginId(), pending.clientUuid(), "factor2");
        recordLifecycleAudit(request, "LOGIN_FACTOR2_OK", pending.facilityId(), null,
                Response.Status.OK.getStatusCode(), null, "success", AuditEventEnvelope.Outcome.SUCCESS,
                Map.of("factor2Type", "totp"));

        String runId = normalizeRunIdValue(request);
        AuthSessionSupport.SessionUserResponse payload =
                AuthSessionSupport.toSessionUserResponse(safeUser, pending.clientUuid(), runId);
        return AuthSessionSupport.noStore(Response.ok(payload)).build();
    }

    @POST
    @Path("/step-up")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response stepUp(@Context HttpServletRequest request, Map<String, Object> body) {
        StepUpSessionService.StepUpResult result = stepUpSessionService.stepUp(request, body);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("scope", result.scope());
        response.put("verifiedAt", result.verifiedAt().toString());
        response.put("expiresAt", result.expiresAt().toString());
        response.put("ttlSeconds", result.ttlSeconds());
        return AuthSessionSupport.noStore(Response.ok(response)).build();
    }

    @GET
    @Path("/me")
    @Produces(MediaType.APPLICATION_JSON)
    public Response me(@Context HttpServletRequest request) {
        enforceActiveSession(request);
        String actorId = AuthSessionSupport.resolveActorId(request);
        if (actorId == null) {
            throw restError(request, Response.Status.UNAUTHORIZED, "unauthorized", "Authentication required.");
        }
        CurrentUserResponse safeUser = loadSafeUser(actorId);
        if (safeUser == null) {
            throw restError(request, Response.Status.UNAUTHORIZED, "unauthorized", "Authentication required.");
        }
        String runId = normalizeRunIdValue(request);
        String clientUuid = AuthSessionSupport.resolveClientUuid(request);
        AuthSessionSupport.SessionUserResponse payload =
                AuthSessionSupport.toSessionUserResponse(safeUser, clientUuid, runId);
        return AuthSessionSupport.noStore(Response.ok(payload)).build();
    }

    private void enforceActiveSession(HttpServletRequest request) {
        if (authSessionRegistryService == null || request == null) {
            return;
        }
        HttpSession session = request.getSession(false);
        String actorId = AuthSessionSupport.resolveActorId(session);
        if (session == null || actorId == null) {
            return;
        }
        AuthSessionRegistryService.SessionValidationResult validation =
                authSessionRegistryService.validateCurrentSession(session);
        if (validation.valid()) {
            return;
        }
        AuthSessionSupport.clearSession(session);
        invalidateSession(session);
        throw restError(request, Response.Status.UNAUTHORIZED, "session_revoked",
                "セッションは無効化されました。再ログインしてください。");
    }

    private CurrentUserResponse loadSafeUser(String actorId) {
        try {
            return CurrentUserResponseMapper.from(userServiceBean.getUser(actorId));
        } catch (RuntimeException ex) {
            return null;
        }
    }

    private UserModel loadActorUser(String actorId) {
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
        String factor2Auth = trimToNull(user.getFactor2Auth());
        if (!"totp".equalsIgnoreCase(factor2Auth)) {
            return false;
        }
        try {
            Query query = entityManager.createQuery(
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

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String normalizeRunIdValue(HttpServletRequest request) {
        Object explicit = request != null ? request.getAttribute(LogFilter.RUN_ID_ATTRIBUTE) : null;
        if (explicit instanceof String text && !text.isBlank()) {
            return text.trim();
        }
        String headerRunId = request != null ? request.getHeader("X-Run-Id") : null;
        if (headerRunId != null && !headerRunId.isBlank()) {
            return headerRunId.trim();
        }
        return resolveTraceIdValue(request);
    }

    private static Map<String, Object> buildLoginError(String code, String message) {
        return buildLoginError(code, message, 429, "too_many_requests");
    }

    private static Map<String, Object> buildLoginError(String code, String message, int status, String errorCategory) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", code);
        body.put("code", code);
        body.put("errorCode", code);
        body.put("message", message);
        body.put("status", status);
        body.put("errorCategory", errorCategory);
        return body;
    }

    private Response buildFactor2RequiredResponse() {
        Map<String, Object> body = buildLoginError(
                FACTOR2_REQUIRED_CODE,
                FACTOR2_REQUIRED_MESSAGE,
                Response.Status.UNAUTHORIZED.getStatusCode(),
                FACTOR2_REQUIRED_CODE);
        body.put("factor2Required", true);
        body.put("factor2Type", "totp");
        return AuthSessionSupport.noStore(Response.status(Response.Status.UNAUTHORIZED).entity(body)).build();
    }

    private void registerAuthenticatedSession(HttpServletRequest request,
            HttpSession session,
            UserModel user,
            String actorId,
            String facilityId,
            String loginId,
            String clientUuid,
            String factorLevel) {
        if (authSessionRegistryService == null) {
            throw restError(request, Response.Status.SERVICE_UNAVAILABLE, "session_registry_unavailable",
                    "セッション登録サービスが利用できません。");
        }
        try {
            authSessionRegistryService.registerAuthenticatedSession(session, user, actorId, facilityId, clientUuid, factorLevel);
        } catch (RuntimeException ex) {
            AuthSessionSupport.clearSession(session);
            invalidateSession(session);
            throw restError(request, Response.Status.SERVICE_UNAVAILABLE, "session_registry_unavailable",
                    "セッション登録に失敗しました。");
        }
    }

    private void invalidateSession(HttpSession session) {
        if (session == null) {
            return;
        }
        try {
            session.invalidate();
        } catch (IllegalStateException ignored) {
            // already invalidated
        }
    }

    private void recordLifecycleAudit(HttpServletRequest request,
            String action,
            String facilityId,
            String scope,
            int httpStatus,
            String errorCode,
            String message,
            AuditEventEnvelope.Outcome outcome,
            Map<String, Object> extraDetails) {
        if (sessionAuditDispatcher == null) {
            return;
        }
        AuditEventPayload payload = new AuditEventPayload();
        payload.setAction(action);
        payload.setResource(request != null ? request.getRequestURI() : "/api/session");
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
        details.put("httpStatus", httpStatus);
        if (errorCode != null) {
            details.put("errorCode", errorCode);
        }
        if (message != null) {
            details.put("message", message);
        }
        if (extraDetails != null && !extraDetails.isEmpty()) {
            details.putAll(extraDetails);
        }
        if (requestId != null && !requestId.isBlank()) {
            details.put("requestId", requestId.trim());
        }
        if (traceId != null && !traceId.isBlank()) {
            details.put("traceId", traceId.trim());
        }
        payload.setDetails(details);
        sessionAuditDispatcher.record(payload, outcome, errorCode, message);
    }

    private Response buildFactor2SessionError(String code) {
        Map<String, Object> body = buildLoginError(
                code,
                FACTOR2_SESSION_MESSAGE,
                Response.Status.UNAUTHORIZED.getStatusCode(),
                code);
        return AuthSessionSupport.noStore(Response.status(Response.Status.UNAUTHORIZED).entity(body)).build();
    }

    private Response buildFactor2InvalidResponse() {
        Map<String, Object> body = buildLoginError(
                FACTOR2_INVALID_CODE,
                FACTOR2_INVALID_MESSAGE,
                Response.Status.UNAUTHORIZED.getStatusCode(),
                FACTOR2_INVALID_CODE);
        return AuthSessionSupport.noStore(Response.status(Response.Status.UNAUTHORIZED).entity(body)).build();
    }

    private Response onInvalidSecondFactorCode(HttpSession session) {
        AuthSessionSupport.PendingSecondFactorSession updated = AuthSessionSupport.incrementPendingSecondFactorAttempt(session);
        if (updated == null || updated.attemptCount() >= AuthSessionSupport.PENDING_SECOND_FACTOR_MAX_ATTEMPTS) {
            AuthSessionSupport.clearSession(session);
            return buildFactor2SessionError(FACTOR2_SESSION_EXPIRED_CODE);
        }
        return buildFactor2InvalidResponse();
    }

    private static boolean isExpired(AuthSessionSupport.PendingSecondFactorSession pending) {
        Instant expiresAt = pending.createdAt().plus(AuthSessionSupport.PENDING_SECOND_FACTOR_TTL);
        return !Instant.now().isBefore(expiresAt);
    }

    public record LoginRequest(String facilityId, String userId, String password, String clientUuid) {
    }

    public record LoginFactor2Request(String code) {
    }
}
