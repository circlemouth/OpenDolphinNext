package open.dolphin.orca.push;

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
public class OrcaPushCursorStore {

    private static final String SQL_SELECT = """
            SELECT last_fetched_event_time, last_fetched_event_uuid, last_applied_event_time,
                   last_applied_event_uuid, last_recovery_run_id, updated_at
              FROM opendolphin.d_orca_push_cursor
             WHERE facility_id = ? AND stream_kind = ?
            """;

    private static final String SQL_UPSERT = """
            INSERT INTO opendolphin.d_orca_push_cursor (
                facility_id, stream_kind, last_fetched_event_time, last_fetched_event_uuid,
                last_applied_event_time, last_applied_event_uuid, last_recovery_run_id, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT (facility_id, stream_kind) DO UPDATE SET
                last_fetched_event_time = EXCLUDED.last_fetched_event_time,
                last_fetched_event_uuid = EXCLUDED.last_fetched_event_uuid,
                last_applied_event_time = EXCLUDED.last_applied_event_time,
                last_applied_event_uuid = EXCLUDED.last_applied_event_uuid,
                last_recovery_run_id = EXCLUDED.last_recovery_run_id,
                updated_at = CURRENT_TIMESTAMP
            """;

    @Resource(lookup = "java:jboss/datasources/PostgresDS")
    DataSource dataSource;

    public CursorRow load(String facilityId, String streamKind) {
        if (isBlank(facilityId) || isBlank(streamKind) || dataSource == null) {
            return null;
        }
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_SELECT)) {
            statement.setString(1, facilityId.trim());
            statement.setString(2, streamKind.trim());
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    return null;
                }
                return new CursorRow(
                        facilityId.trim(),
                        streamKind.trim(),
                        toInstant(resultSet.getTimestamp(1)),
                        resultSet.getString(2),
                        toInstant(resultSet.getTimestamp(3)),
                        resultSet.getString(4),
                        resultSet.getString(5),
                        toInstant(resultSet.getTimestamp(6)));
            }
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to load ORCA push cursor", ex);
        }
    }

    public void save(String facilityId, String streamKind, Instant lastFetchedEventTime, String lastFetchedEventUuid,
            Instant lastAppliedEventTime, String lastAppliedEventUuid, String lastRecoveryRunId) {
        requireText(facilityId, "facilityId");
        requireText(streamKind, "streamKind");
        try (Connection connection = requireDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_UPSERT)) {
            statement.setString(1, facilityId.trim());
            statement.setString(2, streamKind.trim());
            statement.setObject(3, lastFetchedEventTime != null ? Timestamp.from(lastFetchedEventTime) : null);
            statement.setString(4, normalize(lastFetchedEventUuid));
            statement.setObject(5, lastAppliedEventTime != null ? Timestamp.from(lastAppliedEventTime) : null);
            statement.setString(6, normalize(lastAppliedEventUuid));
            statement.setString(7, normalize(lastRecoveryRunId));
            statement.executeUpdate();
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to save ORCA push cursor", ex);
        }
    }

    private DataSource requireDataSource() {
        if (dataSource == null) {
            throw new IllegalStateException("PostgresDS is not available for ORCA push cursor store");
        }
        return dataSource;
    }

    private static Instant toInstant(Timestamp value) {
        return value != null ? value.toInstant() : null;
    }

    private static String requireText(String value, String label) {
        String normalized = normalize(value);
        if (normalized == null) {
            throw new IllegalArgumentException(label + " is required");
        }
        return normalized;
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    public record CursorRow(
            String facilityId,
            String streamKind,
            Instant lastFetchedEventTime,
            String lastFetchedEventUuid,
            Instant lastAppliedEventTime,
            String lastAppliedEventUuid,
            String lastRecoveryRunId,
            Instant updatedAt
    ) {
    }
}
