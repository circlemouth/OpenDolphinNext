package open.dolphin.security.auth;

import jakarta.annotation.Resource;
import jakarta.enterprise.context.ApplicationScoped;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import javax.sql.DataSource;

@ApplicationScoped
public class UserSecurityStateRepository {

    private static final String SQL_ENSURE_ROW = """
            insert into opendolphin.user_security_state (user_pk)
            values (?)
            on conflict (user_pk) do nothing
            """;
    private static final String SQL_SELECT_EPOCHS = """
            select credential_epoch, session_epoch
              from opendolphin.user_security_state
             where user_pk = ?
            """;
    private static final String SQL_INCREMENT_SESSION_EPOCH = """
            update opendolphin.user_security_state
               set session_epoch = session_epoch + 1,
                   updated_at = ?
             where user_pk = ?
            """;
    private static final String SQL_INCREMENT_CREDENTIAL_EPOCH = """
            update opendolphin.user_security_state
               set credential_epoch = credential_epoch + 1,
                   updated_at = ?
             where user_pk = ?
            """;
    private static final String SQL_MARK_PASSWORD_CHANGED = """
            update opendolphin.user_security_state
               set password_changed_at = ?,
                   updated_at = ?
             where user_pk = ?
            """;

    @Resource(lookup = "java:jboss/datasources/PostgresDS")
    private DataSource dataSource;

    public void ensureRow(long userPk) {
        requirePositiveUserPk(userPk);
        try (Connection connection = connection();
             PreparedStatement statement = connection.prepareStatement(SQL_ENSURE_ROW)) {
            statement.setLong(1, userPk);
            statement.executeUpdate();
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to ensure user_security_state row", ex);
        }
    }

    public long currentSessionEpoch(long userPk) {
        return loadEpochs(userPk).sessionEpoch();
    }

    public long currentCredentialEpoch(long userPk) {
        return loadEpochs(userPk).credentialEpoch();
    }

    public void incrementSessionEpoch(long userPk, Instant updatedAt) {
        ensureRow(userPk);
        Instant effectiveUpdatedAt = updatedAt != null ? updatedAt : Instant.now();
        try (Connection connection = connection();
             PreparedStatement statement = connection.prepareStatement(SQL_INCREMENT_SESSION_EPOCH)) {
            statement.setTimestamp(1, Timestamp.from(effectiveUpdatedAt));
            statement.setLong(2, userPk);
            statement.executeUpdate();
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to increment session epoch", ex);
        }
    }

    public void incrementCredentialEpoch(long userPk, Instant updatedAt) {
        ensureRow(userPk);
        Instant effectiveUpdatedAt = updatedAt != null ? updatedAt : Instant.now();
        try (Connection connection = connection();
             PreparedStatement statement = connection.prepareStatement(SQL_INCREMENT_CREDENTIAL_EPOCH)) {
            statement.setTimestamp(1, Timestamp.from(effectiveUpdatedAt));
            statement.setLong(2, userPk);
            statement.executeUpdate();
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to increment credential epoch", ex);
        }
    }

    public void markPasswordChanged(long userPk, Instant changedAt) {
        ensureRow(userPk);
        Instant effectiveChangedAt = changedAt != null ? changedAt : Instant.now();
        try (Connection connection = connection();
             PreparedStatement statement = connection.prepareStatement(SQL_MARK_PASSWORD_CHANGED)) {
            statement.setTimestamp(1, Timestamp.from(effectiveChangedAt));
            statement.setTimestamp(2, Timestamp.from(effectiveChangedAt));
            statement.setLong(3, userPk);
            statement.executeUpdate();
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to mark password change", ex);
        }
    }

    private Epochs loadEpochs(long userPk) {
        ensureRow(userPk);
        try (Connection connection = connection();
             PreparedStatement statement = connection.prepareStatement(SQL_SELECT_EPOCHS)) {
            statement.setLong(1, userPk);
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    return new Epochs(0L, 0L);
                }
                return new Epochs(resultSet.getLong(1), resultSet.getLong(2));
            }
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to load user security state", ex);
        }
    }

    private Connection connection() throws SQLException {
        if (dataSource == null) {
            throw new IllegalStateException("PostgresDS is not available for UserSecurityStateRepository");
        }
        return dataSource.getConnection();
    }

    private static void requirePositiveUserPk(long userPk) {
        if (userPk <= 0L) {
            throw new IllegalArgumentException("userPk must be positive");
        }
    }

    private record Epochs(long credentialEpoch, long sessionEpoch) {
    }
}
