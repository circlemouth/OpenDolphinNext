package open.dolphin.security.audit;

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
import javax.sql.DataSource;

@ApplicationScoped
public class AuditOutboxRepository {

    public static final String DESTINATION_JMS_DOLPHIN = "jms:dolphin";

    private static final String SQL_ENQUEUE = """
            insert into opendolphin.audit_export_outbox (
                event_id,
                destination,
                delivery_state,
                last_attempt_at,
                attempt_count,
                last_error
            ) values (?, ?, 'pending', null, 0, null)
            on conflict (event_id, destination) do nothing
            """;
    private static final String SQL_CLAIM_PENDING = """
            select event_id, destination, delivery_state, last_attempt_at, attempt_count, last_error
              from opendolphin.audit_export_outbox
             where destination = ?
               and delivery_state in ('pending', 'failed')
             order by coalesce(last_attempt_at, to_timestamp(0)), event_id
             limit ?
             for update skip locked
            """;
    private static final String SQL_MARK_CLAIMED = """
            update opendolphin.audit_export_outbox
               set delivery_state = 'claimed',
                   last_attempt_at = ?,
                   attempt_count = attempt_count + 1
             where event_id = ?
               and destination = ?
               and delivery_state in ('pending', 'failed')
            """;
    private static final String SQL_MARK_DELIVERED = """
            update opendolphin.audit_export_outbox
               set delivery_state = 'sent',
                   last_attempt_at = ?,
                   last_error = null
             where event_id = ?
               and destination = ?
            """;
    private static final String SQL_MARK_FAILED = """
            update opendolphin.audit_export_outbox
               set delivery_state = 'failed',
                   last_attempt_at = ?,
                   last_error = ?
             where event_id = ?
               and destination = ?
            """;

    @Resource(lookup = "java:jboss/datasources/PostgresDS")
    private DataSource dataSource;

    public void enqueue(long eventId, String destination) {
        try (Connection connection = connection()) {
            enqueue(connection, eventId, destination);
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to enqueue audit outbox row", ex);
        }
    }

    public void enqueue(Connection connection, long eventId, String destination) {
        try (PreparedStatement statement = connection.prepareStatement(SQL_ENQUEUE)) {
            statement.setLong(1, requirePositiveEventId(eventId));
            statement.setString(2, requireText(destination, "destination"));
            statement.executeUpdate();
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to enqueue audit outbox row", ex);
        }
    }

    public List<OutboxRow> claimPending(String destination, int limit, Instant now) {
        int normalizedLimit = Math.max(1, limit);
        Instant effectiveClaimedAt = now != null ? now : Instant.now();
        List<OutboxRow> rows = new ArrayList<>();
        try (Connection connection = connection()) {
            connection.setAutoCommit(false);
            try (PreparedStatement statement = connection.prepareStatement(SQL_CLAIM_PENDING)) {
                statement.setString(1, requireText(destination, "destination"));
                statement.setInt(2, normalizedLimit);
                try (ResultSet resultSet = statement.executeQuery()) {
                    while (resultSet.next()) {
                        long eventId = resultSet.getLong("event_id");
                        String claimedDestination = resultSet.getString("destination");
                        int attemptCount = resultSet.getInt("attempt_count");
                        rows.add(new OutboxRow(
                                eventId,
                                claimedDestination,
                                "claimed",
                                effectiveClaimedAt,
                                attemptCount + 1,
                                resultSet.getString("last_error")));
                        markClaimed(connection, eventId, claimedDestination, effectiveClaimedAt);
                    }
                }
                connection.commit();
            } catch (SQLException ex) {
                try {
                    connection.rollback();
                } catch (SQLException rollbackEx) {
                    ex.addSuppressed(rollbackEx);
                }
                throw ex;
            }
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to claim audit outbox rows", ex);
        }
        return rows;
    }

    public void markDelivered(long eventId, String destination, Instant deliveredAt) {
        Instant effectiveDeliveredAt = deliveredAt != null ? deliveredAt : Instant.now();
        executeUpdate(SQL_MARK_DELIVERED, statement -> {
            statement.setTimestamp(1, Timestamp.from(effectiveDeliveredAt));
            statement.setLong(2, requirePositiveEventId(eventId));
            statement.setString(3, requireText(destination, "destination"));
        }, "Failed to mark audit outbox row as delivered");
    }

    public void markFailed(long eventId, String destination, Instant failedAt, String error) {
        Instant effectiveFailedAt = failedAt != null ? failedAt : Instant.now();
        executeUpdate(SQL_MARK_FAILED, statement -> {
            statement.setTimestamp(1, Timestamp.from(effectiveFailedAt));
            statement.setString(2, trimToNull(error));
            statement.setLong(3, requirePositiveEventId(eventId));
            statement.setString(4, requireText(destination, "destination"));
        }, "Failed to mark audit outbox row as failed");
    }

    private void markClaimed(Connection connection, long eventId, String destination, Instant claimedAt) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(SQL_MARK_CLAIMED)) {
            statement.setTimestamp(1, Timestamp.from(claimedAt));
            statement.setLong(2, requirePositiveEventId(eventId));
            statement.setString(3, requireText(destination, "destination"));
            statement.executeUpdate();
        }
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

    private Connection connection() throws SQLException {
        if (dataSource == null) {
            throw new IllegalStateException("PostgresDS is not available for AuditOutboxRepository");
        }
        return dataSource.getConnection();
    }

    private static long requirePositiveEventId(long eventId) {
        if (eventId <= 0L) {
            throw new IllegalArgumentException("eventId must be positive");
        }
        return eventId;
    }

    private static String requireText(String value, String label) {
        String normalized = trimToNull(value);
        if (normalized == null) {
            throw new IllegalArgumentException(label + " is required");
        }
        return normalized;
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

    public record OutboxRow(
            long eventId,
            String destination,
            String deliveryState,
            Instant lastAttemptAt,
            int attemptCount,
            String lastError) {
    }
}
