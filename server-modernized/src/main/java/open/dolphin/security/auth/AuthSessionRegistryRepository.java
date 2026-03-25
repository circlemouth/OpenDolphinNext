package open.dolphin.security.auth;

import jakarta.annotation.Resource;
import jakarta.enterprise.context.ApplicationScoped;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import javax.sql.DataSource;

@ApplicationScoped
public class AuthSessionRegistryRepository {

    private static final String SQL_UPSERT_AUTHENTICATED_SESSION = """
            insert into opendolphin.auth_session_registry (
                session_id,
                user_pk,
                actor_id,
                facility_id,
                client_uuid,
                factor_level,
                issued_at,
                last_seen_at,
                revoked_at,
                revocation_reason,
                credential_epoch_at_issue,
                session_epoch_at_issue,
                step_up_scope,
                step_up_verified_at,
                step_up_expires_at,
                updated_at
            ) values (?, ?, ?, ?, ?, ?, ?, ?, null, null, ?, ?, null, null, null, ?)
            on conflict (session_id) do update set
                user_pk = excluded.user_pk,
                actor_id = excluded.actor_id,
                facility_id = excluded.facility_id,
                client_uuid = excluded.client_uuid,
                factor_level = excluded.factor_level,
                issued_at = excluded.issued_at,
                last_seen_at = excluded.last_seen_at,
                revoked_at = null,
                revocation_reason = null,
                credential_epoch_at_issue = excluded.credential_epoch_at_issue,
                session_epoch_at_issue = excluded.session_epoch_at_issue,
                step_up_scope = null,
                step_up_verified_at = null,
                step_up_expires_at = null,
                updated_at = excluded.updated_at
            """;
    private static final String SQL_SELECT_BY_SESSION_ID = """
            select session_id,
                   user_pk,
                   actor_id,
                   facility_id,
                   client_uuid,
                   factor_level,
                   issued_at,
                   last_seen_at,
                   revoked_at,
                   revocation_reason,
                   credential_epoch_at_issue,
                   session_epoch_at_issue,
                   step_up_scope,
                   step_up_verified_at,
                   step_up_expires_at,
                   updated_at
              from opendolphin.auth_session_registry
             where session_id = ?
            """;
    private static final String SQL_TOUCH_LAST_SEEN = """
            update opendolphin.auth_session_registry
               set last_seen_at = ?,
                   updated_at = ?
             where session_id = ?
            """;
    private static final String SQL_SAVE_STEP_UP = """
            update opendolphin.auth_session_registry
               set factor_level = ?,
                   step_up_scope = ?,
                   step_up_verified_at = ?,
                   step_up_expires_at = ?,
                   updated_at = ?
             where session_id = ?
            """;
    private static final String SQL_REVOKE_SESSION = """
            update opendolphin.auth_session_registry
               set revoked_at = ?,
                   revocation_reason = ?,
                   updated_at = ?
             where session_id = ?
            """;
    private static final String SQL_REVOKE_ALL_ACTIVE = """
            update opendolphin.auth_session_registry
               set revoked_at = ?,
                   revocation_reason = ?,
                   updated_at = ?
             where user_pk = ?
               and revoked_at is null
            """;
    private static final String SQL_PURGE_REVOKED = """
            delete from opendolphin.auth_session_registry
             where revoked_at is not null
               and revoked_at < ?
            """;

    @Resource(lookup = "java:jboss/datasources/PostgresDS")
    private DataSource dataSource;

    public void upsertAuthenticatedSession(String sessionId,
            long userPk,
            String actorId,
            String facilityId,
            String clientUuid,
            String factorLevel,
            Instant issuedAt,
            Instant lastSeenAt,
            long credentialEpochAtIssue,
            long sessionEpochAtIssue) {
        String normalizedSessionId = requireText(sessionId, "sessionId");
        long normalizedUserPk = requirePositiveUserPk(userPk);
        String normalizedActorId = requireText(actorId, "actorId");
        String normalizedFactorLevel = normalizeFactorLevel(factorLevel);
        Instant effectiveIssuedAt = issuedAt != null ? issuedAt : Instant.now();
        Instant effectiveLastSeenAt = lastSeenAt != null ? lastSeenAt : effectiveIssuedAt;
        try (Connection connection = connection();
             PreparedStatement statement = connection.prepareStatement(SQL_UPSERT_AUTHENTICATED_SESSION)) {
            statement.setString(1, normalizedSessionId);
            statement.setLong(2, normalizedUserPk);
            statement.setString(3, normalizedActorId);
            statement.setString(4, trimToNull(facilityId));
            statement.setString(5, trimToNull(clientUuid));
            statement.setString(6, normalizedFactorLevel);
            statement.setTimestamp(7, Timestamp.from(effectiveIssuedAt));
            statement.setTimestamp(8, Timestamp.from(effectiveLastSeenAt));
            statement.setLong(9, credentialEpochAtIssue);
            statement.setLong(10, sessionEpochAtIssue);
            statement.setTimestamp(11, Timestamp.from(effectiveLastSeenAt));
            statement.executeUpdate();
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to upsert authenticated session", ex);
        }
    }

    public Optional<SessionRow> findBySessionId(String sessionId) {
        String normalizedSessionId = requireText(sessionId, "sessionId");
        try (Connection connection = connection();
             PreparedStatement statement = connection.prepareStatement(SQL_SELECT_BY_SESSION_ID)) {
            statement.setString(1, normalizedSessionId);
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    return Optional.empty();
                }
                return Optional.of(mapSessionRow(resultSet));
            }
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to load auth session registry row", ex);
        }
    }

    public void touchLastSeen(String sessionId, Instant seenAt) {
        Instant effectiveSeenAt = seenAt != null ? seenAt : Instant.now();
        executeUpdate(SQL_TOUCH_LAST_SEEN, statement -> {
            statement.setTimestamp(1, Timestamp.from(effectiveSeenAt));
            statement.setTimestamp(2, Timestamp.from(effectiveSeenAt));
            statement.setString(3, requireText(sessionId, "sessionId"));
        }, "Failed to touch auth session last_seen_at");
    }

    public void saveStepUp(String sessionId, String scope, Instant verifiedAt, Instant expiresAt) {
        Instant effectiveVerifiedAt = verifiedAt != null ? verifiedAt : Instant.now();
        executeUpdate(SQL_SAVE_STEP_UP, statement -> {
            statement.setString(1, "step-up");
            statement.setString(2, requireText(scope, "scope"));
            statement.setTimestamp(3, Timestamp.from(effectiveVerifiedAt));
            statement.setTimestamp(4, expiresAt == null ? null : Timestamp.from(expiresAt));
            statement.setTimestamp(5, Timestamp.from(effectiveVerifiedAt));
            statement.setString(6, requireText(sessionId, "sessionId"));
        }, "Failed to save session step-up");
    }

    public void revokeSession(String sessionId, String reason, Instant revokedAt) {
        Instant effectiveRevokedAt = revokedAt != null ? revokedAt : Instant.now();
        executeUpdate(SQL_REVOKE_SESSION, statement -> {
            statement.setTimestamp(1, Timestamp.from(effectiveRevokedAt));
            statement.setString(2, requireText(reason, "reason"));
            statement.setTimestamp(3, Timestamp.from(effectiveRevokedAt));
            statement.setString(4, requireText(sessionId, "sessionId"));
        }, "Failed to revoke auth session");
    }

    public int revokeAllActiveSessions(long userPk, String reason, Instant revokedAt) {
        Instant effectiveRevokedAt = revokedAt != null ? revokedAt : Instant.now();
        try (Connection connection = connection();
             PreparedStatement statement = connection.prepareStatement(SQL_REVOKE_ALL_ACTIVE)) {
            statement.setTimestamp(1, Timestamp.from(effectiveRevokedAt));
            statement.setString(2, requireText(reason, "reason"));
            statement.setTimestamp(3, Timestamp.from(effectiveRevokedAt));
            statement.setLong(4, requirePositiveUserPk(userPk));
            return statement.executeUpdate();
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to revoke active auth sessions", ex);
        }
    }

    public void purgeRevokedOlderThan(Instant cutoff) {
        Instant effectiveCutoff = cutoff != null ? cutoff : Instant.now();
        executeUpdate(SQL_PURGE_REVOKED, statement -> statement.setTimestamp(1, Timestamp.from(effectiveCutoff)),
                "Failed to purge revoked auth sessions");
    }

    public List<SessionRow> findAllByUserPk(long userPk) {
        String sql = """
                select session_id,
                       user_pk,
                       actor_id,
                       facility_id,
                       client_uuid,
                       factor_level,
                       issued_at,
                       last_seen_at,
                       revoked_at,
                       revocation_reason,
                       credential_epoch_at_issue,
                       session_epoch_at_issue,
                       step_up_scope,
                       step_up_verified_at,
                       step_up_expires_at,
                       updated_at
                  from opendolphin.auth_session_registry
                 where user_pk = ?
                 order by session_id
                """;
        List<SessionRow> rows = new ArrayList<>();
        try (Connection connection = connection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setLong(1, requirePositiveUserPk(userPk));
            try (ResultSet resultSet = statement.executeQuery()) {
                while (resultSet.next()) {
                    rows.add(mapSessionRow(resultSet));
                }
            }
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to load auth sessions by user", ex);
        }
        return rows;
    }

    private void executeUpdate(String sql, SqlBinder binder, String message) {
        try (Connection connection = connection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            binder.bind(statement);
            statement.executeUpdate();
        } catch (SQLException ex) {
            throw new IllegalStateException(message, ex);
        }
    }

    private SessionRow mapSessionRow(ResultSet resultSet) throws SQLException {
        return new SessionRow(
                resultSet.getString("session_id"),
                resultSet.getLong("user_pk"),
                resultSet.getString("actor_id"),
                resultSet.getString("facility_id"),
                resultSet.getString("client_uuid"),
                resultSet.getString("factor_level"),
                asInstant(resultSet.getTimestamp("issued_at")),
                asInstant(resultSet.getTimestamp("last_seen_at")),
                asInstant(resultSet.getTimestamp("revoked_at")),
                resultSet.getString("revocation_reason"),
                resultSet.getLong("credential_epoch_at_issue"),
                resultSet.getLong("session_epoch_at_issue"),
                resultSet.getString("step_up_scope"),
                asInstant(resultSet.getTimestamp("step_up_verified_at")),
                asInstant(resultSet.getTimestamp("step_up_expires_at")),
                asInstant(resultSet.getTimestamp("updated_at")));
    }

    private Connection connection() throws SQLException {
        if (dataSource == null) {
            throw new IllegalStateException("PostgresDS is not available for AuthSessionRegistryRepository");
        }
        return dataSource.getConnection();
    }

    private static long requirePositiveUserPk(long userPk) {
        if (userPk <= 0L) {
            throw new IllegalArgumentException("userPk must be positive");
        }
        return userPk;
    }

    private static String requireText(String value, String label) {
        String normalized = trimToNull(value);
        if (normalized == null) {
            throw new IllegalArgumentException(label + " is required");
        }
        return normalized;
    }

    private static String normalizeFactorLevel(String factorLevel) {
        String normalized = requireText(factorLevel, "factorLevel");
        return normalized.toLowerCase(Locale.ROOT);
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static Instant asInstant(Timestamp timestamp) {
        return timestamp == null ? null : timestamp.toInstant();
    }

    @FunctionalInterface
    private interface SqlBinder {
        void bind(PreparedStatement statement) throws SQLException;
    }

    public record SessionRow(
            String sessionId,
            long userPk,
            String actorId,
            String facilityId,
            String clientUuid,
            String factorLevel,
            Instant issuedAt,
            Instant lastSeenAt,
            Instant revokedAt,
            String revocationReason,
            long credentialEpochAtIssue,
            long sessionEpochAtIssue,
            String stepUpScope,
            Instant stepUpVerifiedAt,
            Instant stepUpExpiresAt,
            Instant updatedAt) {
    }
}
