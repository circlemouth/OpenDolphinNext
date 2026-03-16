package open.dolphin.rest;

import jakarta.inject.Inject;
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
import java.util.Map;
import open.dolphin.rest.dto.CurrentUserResponse;
import open.dolphin.rest.support.CurrentUserResponseMapper;
import open.dolphin.session.UserServiceBean;

@Path("/session")
public class SessionAuthResource extends AbstractResource {

    @Inject
    private UserServiceBean userServiceBean;

    @Inject
    private TotpVerificationSupport totpVerificationSupport;

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
            throw restError(request, Response.Status.BAD_REQUEST, "invalid_request", "ログイン情報が必要です。");
        }
        String facilityId = trimToNull(body.facilityId());
        String loginId = trimToNull(body.userId());
        String password = body.password();
        String clientUuid = trimToNull(body.clientUuid());
        if (facilityId == null || loginId == null || password == null || password.isBlank()) {
            throw restError(request, Response.Status.BAD_REQUEST, "invalid_request", "施設ID、ユーザーID、パスワードを指定してください。");
        }
        String actorId = facilityId + ":" + loginId;
        UserServiceBean.AuthenticationResult result =
                userServiceBean.authenticateWithPolicy(actorId, password, resolveClientIp(request));
        if (result.ipThrottled()) {
            Response.ResponseBuilder response = Response.status(429)
                    .entity(buildLoginError("too_many_requests", "ログイン試行が多すぎます。時間をおいて再試行してください。"));
            response.header("Retry-After", Long.toString(Math.max(1L, result.retryAfterSeconds())));
            return AuthSessionSupport.noStore(response).build();
        }
        if (!result.authenticated()) {
            if (result.secondFactorRequired()) {
                HttpSession session = AuthSessionSupport.rotateSession(request);
                AuthSessionSupport.clearSession(session);
                AuthSessionSupport.populatePendingSecondFactorSession(session, actorId, facilityId, loginId, clientUuid);
                return buildFactor2RequiredResponse();
            }
            throw restError(request, Response.Status.UNAUTHORIZED, "unauthorized", "認証に失敗しました。");
        }

        CurrentUserResponse safeUser = loadSafeUser(actorId);
        if (safeUser == null) {
            throw restError(request, Response.Status.UNAUTHORIZED, "unauthorized", "認証ユーザーを取得できませんでした。");
        }

        HttpSession session = AuthSessionSupport.rotateSession(request);
        AuthSessionSupport.clearSession(session);
        AuthSessionSupport.populateAuthenticatedSession(session, actorId, facilityId, loginId, clientUuid);

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
            throw restError(request, Response.Status.BAD_REQUEST, "invalid_request", "認証コードを指定してください。");
        }

        HttpSession currentSession = request != null ? request.getSession(false) : null;
        AuthSessionSupport.PendingSecondFactorSession pending = AuthSessionSupport.loadPendingSecondFactor(currentSession);
        if (pending == null) {
            return buildFactor2SessionError(FACTOR2_SESSION_MISSING_CODE);
        }
        if (isExpired(pending) || pending.attemptCount() >= AuthSessionSupport.PENDING_SECOND_FACTOR_MAX_ATTEMPTS) {
            AuthSessionSupport.clearSession(currentSession);
            return buildFactor2SessionError(FACTOR2_SESSION_EXPIRED_CODE);
        }

        if (!code.matches("\\d{6}")) {
            return onInvalidSecondFactorCode(currentSession);
        }

        UserServiceBean userService = userServiceBean;
        if (userService == null) {
            AuthSessionSupport.clearSession(currentSession);
            return buildFactor2SessionError(FACTOR2_SESSION_EXPIRED_CODE);
        }

        open.dolphin.infomodel.UserModel actorUser;
        try {
            actorUser = userService.getUser(pending.actorId());
        } catch (RuntimeException ex) {
            AuthSessionSupport.clearSession(currentSession);
            return buildFactor2SessionError(FACTOR2_SESSION_EXPIRED_CODE);
        }

        TotpVerificationSupport.VerificationResult verification =
                totpVerificationSupport.verifyCurrentCode(actorUser.getId(), code);
        if (!verification.succeeded()) {
            return onInvalidSecondFactorCode(currentSession);
        }

        CurrentUserResponse safeUser = loadSafeUser(pending.actorId());
        if (safeUser == null) {
            AuthSessionSupport.clearSession(currentSession);
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

        String runId = normalizeRunIdValue(request);
        AuthSessionSupport.SessionUserResponse payload =
                AuthSessionSupport.toSessionUserResponse(safeUser, pending.clientUuid(), runId);
        return AuthSessionSupport.noStore(Response.ok(payload)).build();
    }

    @GET
    @Path("/me")
    @Produces(MediaType.APPLICATION_JSON)
    public Response me(@Context HttpServletRequest request) {
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

    private CurrentUserResponse loadSafeUser(String actorId) {
        try {
            return CurrentUserResponseMapper.from(userServiceBean.getUser(actorId));
        } catch (RuntimeException ex) {
            return null;
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
