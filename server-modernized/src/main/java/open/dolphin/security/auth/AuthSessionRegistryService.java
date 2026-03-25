package open.dolphin.security.auth;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.servlet.http.HttpSession;
import java.time.Instant;
import java.util.Optional;
import open.dolphin.infomodel.UserModel;
import open.dolphin.rest.AuthSessionSupport;

@ApplicationScoped
public class AuthSessionRegistryService {

    @Inject
    private AuthSessionRegistryRepository authSessionRegistryRepository;

    @Inject
    private UserSecurityStateRepository userSecurityStateRepository;

    public void registerAuthenticatedSession(HttpSession session,
            UserModel user,
            String actorId,
            String facilityId,
            String clientUuid,
            String factorLevel) {
        requireSession(session);
        requireUser(user);

        Instant now = Instant.now();
        userSecurityStateRepository.ensureRow(user.getId());
        long credentialEpoch = userSecurityStateRepository.currentCredentialEpoch(user.getId());
        long sessionEpoch = userSecurityStateRepository.currentSessionEpoch(user.getId());
        authSessionRegistryRepository.upsertAuthenticatedSession(
                session.getId(),
                user.getId(),
                actorId,
                facilityId,
                clientUuid,
                factorLevel != null && !factorLevel.isBlank() ? factorLevel : "password",
                now,
                now,
                credentialEpoch,
                sessionEpoch);
    }

    public void registerStepUp(HttpSession session, String scope, Instant verifiedAt, Instant expiresAt) {
        requireSession(session);
        authSessionRegistryRepository.saveStepUp(session.getId(), scope, verifiedAt, expiresAt);
    }

    public SessionValidationResult validateCurrentSession(HttpSession session) {
        String actorId = AuthSessionSupport.resolveActorId(session);
        if (session == null || actorId == null) {
            return SessionValidationResult.noSession();
        }
        Optional<AuthSessionRegistryRepository.SessionRow> row = authSessionRegistryRepository.findBySessionId(session.getId());
        if (row.isEmpty()) {
            return SessionValidationResult.revoked();
        }
        AuthSessionRegistryRepository.SessionRow sessionRow = row.orElseThrow();
        if (sessionRow.revokedAt() != null) {
            return SessionValidationResult.revoked();
        }
        long currentSessionEpoch = userSecurityStateRepository.currentSessionEpoch(sessionRow.userPk());
        if (sessionRow.sessionEpochAtIssue() < currentSessionEpoch) {
            return SessionValidationResult.revoked();
        }
        authSessionRegistryRepository.touchLastSeen(session.getId(), Instant.now());
        return SessionValidationResult.valid(sessionRow);
    }

    public boolean revokeCurrentSession(HttpSession session, String reason) {
        if (session == null || session.getId() == null || session.getId().isBlank()) {
            return false;
        }
        Optional<AuthSessionRegistryRepository.SessionRow> row = authSessionRegistryRepository.findBySessionId(session.getId());
        if (row.isEmpty()) {
            return false;
        }
        authSessionRegistryRepository.revokeSession(session.getId(), reason != null ? reason : "logout", Instant.now());
        return true;
    }

    private static void requireSession(HttpSession session) {
        if (session == null || session.getId() == null || session.getId().isBlank()) {
            throw new IllegalArgumentException("session is required");
        }
    }

    private static void requireUser(UserModel user) {
        if (user == null || user.getId() <= 0) {
            throw new IllegalArgumentException("user is required");
        }
    }

    public record SessionValidationResult(
            boolean valid,
            AuthSessionRegistryRepository.SessionRow sessionRow) {
        public static SessionValidationResult valid(AuthSessionRegistryRepository.SessionRow sessionRow) {
            return new SessionValidationResult(true, sessionRow);
        }

        public static SessionValidationResult revoked() {
            return new SessionValidationResult(false, null);
        }

        public static SessionValidationResult noSession() {
            return new SessionValidationResult(false, null);
        }
    }
}
