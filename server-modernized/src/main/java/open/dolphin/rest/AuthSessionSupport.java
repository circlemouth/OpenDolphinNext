package open.dolphin.rest;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.ws.rs.core.Response;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import open.dolphin.rest.dto.CurrentUserResponse;

public final class AuthSessionSupport {

    public static final String AUTH_ACTOR_ID = AuthSessionSupport.class.getName() + ".AUTH_ACTOR_ID";
    public static final String AUTH_FACILITY_ID = AuthSessionSupport.class.getName() + ".AUTH_FACILITY_ID";
    public static final String AUTH_LOGIN_ID = AuthSessionSupport.class.getName() + ".AUTH_LOGIN_ID";
    public static final String AUTH_CLIENT_UUID = AuthSessionSupport.class.getName() + ".AUTH_CLIENT_UUID";
    public static final String AUTH_AUTHENTICATED_AT = AuthSessionSupport.class.getName() + ".AUTH_AUTHENTICATED_AT";
    public static final String AUTH_STEP_UP_SCOPE = AuthSessionSupport.class.getName() + ".AUTH_STEP_UP_SCOPE";
    public static final String AUTH_STEP_UP_VERIFIED_AT = AuthSessionSupport.class.getName() + ".AUTH_STEP_UP_VERIFIED_AT";
    public static final String AUTH_STEP_UP_EXPIRES_AT = AuthSessionSupport.class.getName() + ".AUTH_STEP_UP_EXPIRES_AT";
    static final String PENDING_FACTOR2_ACTOR_ID = AuthSessionSupport.class.getName() + ".PENDING_FACTOR2_ACTOR_ID";
    static final String PENDING_FACTOR2_FACILITY_ID = AuthSessionSupport.class.getName() + ".PENDING_FACTOR2_FACILITY_ID";
    static final String PENDING_FACTOR2_LOGIN_ID = AuthSessionSupport.class.getName() + ".PENDING_FACTOR2_LOGIN_ID";
    static final String PENDING_FACTOR2_CLIENT_UUID = AuthSessionSupport.class.getName() + ".PENDING_FACTOR2_CLIENT_UUID";
    static final String PENDING_FACTOR2_CREATED_AT = AuthSessionSupport.class.getName() + ".PENDING_FACTOR2_CREATED_AT";
    static final String PENDING_FACTOR2_ATTEMPT_COUNT = AuthSessionSupport.class.getName() + ".PENDING_FACTOR2_ATTEMPT_COUNT";
    static final java.time.Duration PENDING_SECOND_FACTOR_TTL = java.time.Duration.ofMinutes(5);
    static final int PENDING_SECOND_FACTOR_MAX_ATTEMPTS = 5;

    private AuthSessionSupport() {
    }

    static HttpSession rotateSession(HttpServletRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("request is required");
        }
        try {
            request.changeSessionId();
            return request.getSession(true);
        } catch (IllegalStateException ex) {
            HttpSession current = request.getSession(false);
            Map<String, Object> snapshot = snapshotAttributes(current);
            if (current != null) {
                try {
                    current.invalidate();
                } catch (IllegalStateException ignored) {
                    // already invalidated
                }
            }
            HttpSession next = request.getSession(true);
            snapshot.forEach(next::setAttribute);
            return next;
        }
    }

    public static void populateAuthenticatedSession(HttpSession session,
            String actorId,
            String facilityId,
            String loginId,
            String clientUuid) {
        if (session == null) {
            throw new IllegalArgumentException("session is required");
        }
        clearPendingSecondFactorSession(session);
        session.setAttribute(AUTH_ACTOR_ID, actorId);
        session.setAttribute(AUTH_FACILITY_ID, facilityId);
        session.setAttribute(AUTH_LOGIN_ID, loginId);
        if (clientUuid != null && !clientUuid.isBlank()) {
            session.setAttribute(AUTH_CLIENT_UUID, clientUuid.trim());
        } else {
            session.removeAttribute(AUTH_CLIENT_UUID);
        }
        session.setAttribute(AUTH_AUTHENTICATED_AT, Instant.now().toString());
        clearStepUpSession(session);
    }

    public static void populateStepUpSession(HttpSession session,
            String scope,
            Instant verifiedAt,
            Instant expiresAt) {
        if (session == null) {
            throw new IllegalArgumentException("session is required");
        }
        if (scope == null || scope.isBlank()) {
            throw new IllegalArgumentException("scope is required");
        }
        if (verifiedAt == null) {
            throw new IllegalArgumentException("verifiedAt is required");
        }
        if (expiresAt == null) {
            throw new IllegalArgumentException("expiresAt is required");
        }
        session.setAttribute(AUTH_STEP_UP_SCOPE, scope.trim());
        session.setAttribute(AUTH_STEP_UP_VERIFIED_AT, verifiedAt.toString());
        session.setAttribute(AUTH_STEP_UP_EXPIRES_AT, expiresAt.toString());
    }

    static void populatePendingSecondFactorSession(HttpSession session,
            String actorId,
            String facilityId,
            String loginId,
            String clientUuid) {
        populatePendingSecondFactorSession(session, new PendingSecondFactorSession(
                actorId,
                facilityId,
                loginId,
                normalizeOptional(clientUuid),
                Instant.now(),
                0));
    }

    static void populatePendingSecondFactorSession(HttpSession session, PendingSecondFactorSession pending) {
        if (session == null) {
            throw new IllegalArgumentException("session is required");
        }
        if (pending == null) {
            throw new IllegalArgumentException("pending is required");
        }
        clearAuthenticatedSession(session);
        session.setAttribute(PENDING_FACTOR2_ACTOR_ID, pending.actorId());
        session.setAttribute(PENDING_FACTOR2_FACILITY_ID, pending.facilityId());
        session.setAttribute(PENDING_FACTOR2_LOGIN_ID, pending.loginId());
        if (pending.clientUuid() != null) {
            session.setAttribute(PENDING_FACTOR2_CLIENT_UUID, pending.clientUuid());
        } else {
            session.removeAttribute(PENDING_FACTOR2_CLIENT_UUID);
        }
        session.setAttribute(PENDING_FACTOR2_CREATED_AT, pending.createdAt().toString());
        session.setAttribute(PENDING_FACTOR2_ATTEMPT_COUNT, Math.max(0, pending.attemptCount()));
    }

    public static void clearAuthenticatedSession(HttpSession session) {
        if (session == null) {
            return;
        }
        session.removeAttribute(AUTH_ACTOR_ID);
        session.removeAttribute(AUTH_FACILITY_ID);
        session.removeAttribute(AUTH_LOGIN_ID);
        session.removeAttribute(AUTH_CLIENT_UUID);
        session.removeAttribute(AUTH_AUTHENTICATED_AT);
        clearStepUpSession(session);
    }

    static void clearPendingSecondFactorSession(HttpSession session) {
        if (session == null) {
            return;
        }
        session.removeAttribute(PENDING_FACTOR2_ACTOR_ID);
        session.removeAttribute(PENDING_FACTOR2_FACILITY_ID);
        session.removeAttribute(PENDING_FACTOR2_LOGIN_ID);
        session.removeAttribute(PENDING_FACTOR2_CLIENT_UUID);
        session.removeAttribute(PENDING_FACTOR2_CREATED_AT);
        session.removeAttribute(PENDING_FACTOR2_ATTEMPT_COUNT);
    }

    public static void clearSession(HttpSession session) {
        clearAuthenticatedSession(session);
        clearPendingSecondFactorSession(session);
    }

    public static String resolveActorId(HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        HttpSession session = request.getSession(false);
        return resolveActorId(session);
    }

    public static String resolveActorId(HttpSession session) {
        if (session == null) {
            return null;
        }
        Object actor = session.getAttribute(AUTH_ACTOR_ID);
        return actor instanceof String text && !text.isBlank() ? text.trim() : null;
    }

    public static String resolveClientUuid(HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        HttpSession session = request.getSession(false);
        if (session == null) {
            return null;
        }
        Object clientUuid = session.getAttribute(AUTH_CLIENT_UUID);
        return clientUuid instanceof String text && !text.isBlank() ? text.trim() : null;
    }

    static PendingSecondFactorSession loadPendingSecondFactor(HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        return loadPendingSecondFactor(request.getSession(false));
    }

    static PendingSecondFactorSession loadPendingSecondFactor(HttpSession session) {
        if (session == null) {
            return null;
        }
        String actorId = normalizeStringAttribute(session.getAttribute(PENDING_FACTOR2_ACTOR_ID));
        String facilityId = normalizeStringAttribute(session.getAttribute(PENDING_FACTOR2_FACILITY_ID));
        String loginId = normalizeStringAttribute(session.getAttribute(PENDING_FACTOR2_LOGIN_ID));
        Instant createdAt = parseInstantAttribute(session.getAttribute(PENDING_FACTOR2_CREATED_AT));
        if (actorId == null || facilityId == null || loginId == null || createdAt == null) {
            return null;
        }
        String clientUuid = normalizeStringAttribute(session.getAttribute(PENDING_FACTOR2_CLIENT_UUID));
        int attemptCount = parseIntAttribute(session.getAttribute(PENDING_FACTOR2_ATTEMPT_COUNT));
        return new PendingSecondFactorSession(actorId, facilityId, loginId, clientUuid, createdAt, attemptCount);
    }

    static PendingSecondFactorSession incrementPendingSecondFactorAttempt(HttpSession session) {
        PendingSecondFactorSession pending = loadPendingSecondFactor(session);
        if (pending == null) {
            return null;
        }
        PendingSecondFactorSession updated = new PendingSecondFactorSession(
                pending.actorId(),
                pending.facilityId(),
                pending.loginId(),
                pending.clientUuid(),
                pending.createdAt(),
                pending.attemptCount() + 1);
        populatePendingSecondFactorSession(session, updated);
        return updated;
    }

    static SessionUserResponse toSessionUserResponse(CurrentUserResponse safeUser,
            String clientUuid,
            String runId) {
        if (safeUser == null) {
            return null;
        }
        String facilityId = safeUser.facility() != null ? safeUser.facility().facilityId() : null;
        String displayName = firstNonBlank(safeUser.commonName(), safeUser.givenName(), safeUser.sirName());
        java.util.List<String> roles = safeUser.roles() == null
                ? java.util.List.of()
                : safeUser.roles().stream()
                .map(role -> role != null ? role.role() : null)
                .filter(value -> value != null && !value.isBlank())
                .toList();
        return new SessionUserResponse(
                facilityId,
                safeUser.userId(),
                safeUser.id(),
                displayName,
                safeUser.commonName(),
                roles,
                clientUuid,
                runId
        );
    }

    static Response.ResponseBuilder noStore(Response.ResponseBuilder builder) {
        return builder
                .header("Cache-Control", "private, no-store, max-age=0, must-revalidate")
                .header("Pragma", "no-cache")
                .header("Expires", "0");
    }

    static void applyNoStore(HttpServletResponse response) {
        if (response == null) {
            return;
        }
        response.setHeader("Cache-Control", "private, no-store, max-age=0, must-revalidate");
        response.setHeader("Pragma", "no-cache");
        response.setHeader("Expires", "0");
    }

    public static StepUpSession loadStepUpSession(HttpSession session) {
        if (session == null) {
            return null;
        }
        String scope = normalizeStringAttribute(session.getAttribute(AUTH_STEP_UP_SCOPE));
        Instant verifiedAt = parseInstantAttribute(session.getAttribute(AUTH_STEP_UP_VERIFIED_AT));
        Instant expiresAt = parseInstantAttribute(session.getAttribute(AUTH_STEP_UP_EXPIRES_AT));
        if (scope == null || verifiedAt == null || expiresAt == null) {
            return null;
        }
        long ttlSeconds = Math.max(0L, java.time.Duration.between(verifiedAt, expiresAt).toSeconds());
        return new StepUpSession(scope, verifiedAt, expiresAt, ttlSeconds);
    }

    public static void clearStepUpSession(HttpSession session) {
        if (session == null) {
            return;
        }
        session.removeAttribute(AUTH_STEP_UP_SCOPE);
        session.removeAttribute(AUTH_STEP_UP_VERIFIED_AT);
        session.removeAttribute(AUTH_STEP_UP_EXPIRES_AT);
    }

    private static Map<String, Object> snapshotAttributes(HttpSession session) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        if (session == null) {
            return snapshot;
        }
        java.util.Enumeration<String> names = session.getAttributeNames();
        while (names != null && names.hasMoreElements()) {
            String name = names.nextElement();
            snapshot.put(name, session.getAttribute(name));
        }
        return snapshot;
    }

    private static String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return null;
    }

    private static String normalizeOptional(String value) {
        return value != null && !value.isBlank() ? value.trim() : null;
    }

    private static String normalizeStringAttribute(Object value) {
        return value instanceof String text && !text.isBlank() ? text.trim() : null;
    }

    private static Instant parseInstantAttribute(Object value) {
        if (!(value instanceof String text) || text.isBlank()) {
            return null;
        }
        try {
            return Instant.parse(text.trim());
        } catch (RuntimeException ex) {
            return null;
        }
    }

    private static int parseIntAttribute(Object value) {
        if (value instanceof Number number) {
            return Math.max(0, number.intValue());
        }
        if (value instanceof String text && !text.isBlank()) {
            try {
                return Math.max(0, Integer.parseInt(text.trim()));
            } catch (NumberFormatException ex) {
                return 0;
            }
        }
        return 0;
    }

    record SessionUserResponse(
            String facilityId,
            String userId,
            long userPk,
            String displayName,
            String commonName,
            java.util.List<String> roles,
            String clientUuid,
            String runId) {
    }

    record PendingSecondFactorSession(
            String actorId,
            String facilityId,
            String loginId,
            String clientUuid,
            Instant createdAt,
            int attemptCount) {
    }

    public record StepUpSession(
            String scope,
            Instant verifiedAt,
            Instant expiresAt,
            long ttlSeconds) {
    }
}
