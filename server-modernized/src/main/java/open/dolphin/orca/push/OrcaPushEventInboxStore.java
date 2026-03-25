package open.dolphin.orca.push;

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
public class OrcaPushEventInboxStore {

    private static final String SQL_UPSERT_RECEIVED = """
            INSERT INTO opendolphin.d_orca_push_event_inbox (
                facility_id, stream_kind, event_uuid, event_name, event_time, status, received_at, payload_json, last_recovery_run_id
            ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, cast(? as jsonb), ?)
            ON CONFLICT (facility_id, stream_kind, event_uuid) DO UPDATE SET
                event_name = EXCLUDED.event_name,
                event_time = EXCLUDED.event_time,
                status = EXCLUDED.status,
                payload_json = EXCLUDED.payload_json,
                last_recovery_run_id = EXCLUDED.last_recovery_run_id
            """;

    private static final String SQL_MARK_FETCHED = """
            UPDATE opendolphin.d_orca_push_event_inbox
               SET status = 'fetched',
                   fetched_at = ?,
                   last_recovery_run_id = COALESCE(?, last_recovery_run_id)
             WHERE facility_id = ? AND stream_kind = ? AND event_uuid = ?
            """;

    private static final String SQL_MARK_APPLIED = """
            UPDATE opendolphin.d_orca_push_event_inbox
               SET status = 'applied',
                   applied_at = ?,
                   last_recovery_run_id = COALESCE(?, last_recovery_run_id),
                   error_code = NULL,
                   error_message = NULL
             WHERE facility_id = ? AND stream_kind = ? AND event_uuid = ?
            """;

    private static final String SQL_MARK_FAILED = """
            UPDATE opendolphin.d_orca_push_event_inbox
               SET status = 'failed',
                   failed_at = ?,
                   error_code = ?,
                   error_message = ?,
                   last_recovery_run_id = COALESCE(?, last_recovery_run_id)
             WHERE facility_id = ? AND stream_kind = ? AND event_uuid = ?
            """;

    private static final String SQL_SELECT_APPLIED = """
            SELECT facility_id, stream_kind, event_uuid, event_name, event_time, status, received_at,
                   fetched_at, applied_at, failed_at, error_code, error_message, payload_json::text, last_recovery_run_id
              FROM opendolphin.d_orca_push_event_inbox
             WHERE facility_id = ? AND stream_kind = ? AND status = 'applied'
             ORDER BY received_at DESC
            """;

    private static final String SQL_SELECT_APPLIED_FLAG = """
            SELECT applied_at
              FROM opendolphin.d_orca_push_event_inbox
             WHERE facility_id = ? AND stream_kind = ? AND event_uuid = ?
            """;

    @Resource(lookup = "java:jboss/datasources/PostgresDS")
    DataSource dataSource;

    public void markReceived(String facilityId, String streamKind, String eventUuid, String eventName, Instant eventTime,
            String payloadJson, String lastRecoveryRunId) {
        requireText(facilityId, "facilityId");
        requireText(streamKind, "streamKind");
        requireText(eventUuid, "eventUuid");
        requireText(eventName, "eventName");
        String effectivePayloadJson = normalize(payloadJson);
        if (effectivePayloadJson == null) {
            effectivePayloadJson = "{}";
        }
        try (Connection connection = requireDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_UPSERT_RECEIVED)) {
            statement.setString(1, facilityId.trim());
            statement.setString(2, streamKind.trim());
            statement.setString(3, eventUuid.trim());
            statement.setString(4, eventName.trim());
            statement.setObject(5, eventTime != null ? Timestamp.from(eventTime) : null);
            statement.setString(6, "received");
            statement.setString(7, effectivePayloadJson);
            statement.setString(8, normalize(lastRecoveryRunId));
            statement.executeUpdate();
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to mark ORCA push event received", ex);
        }
    }

    public void markFetched(String facilityId, String streamKind, String eventUuid, Instant fetchedAt, String lastRecoveryRunId) {
        updateTimestampStatus(SQL_MARK_FETCHED, facilityId, streamKind, eventUuid, fetchedAt, lastRecoveryRunId, null, null);
    }

    public void markApplied(String facilityId, String streamKind, String eventUuid, Instant appliedAt, String lastRecoveryRunId) {
        updateTimestampStatus(SQL_MARK_APPLIED, facilityId, streamKind, eventUuid, appliedAt, lastRecoveryRunId, null, null);
    }

    public void markFailed(String facilityId, String streamKind, String eventUuid, Instant failedAt, String errorCode,
            String errorMessage, String lastRecoveryRunId) {
        updateTimestampStatus(SQL_MARK_FAILED, facilityId, streamKind, eventUuid, failedAt, lastRecoveryRunId, errorCode, errorMessage);
    }

    public List<EventInboxRow> findApplied(String facilityId, String streamKind) {
        if (isBlank(facilityId) || isBlank(streamKind) || dataSource == null) {
            return List.of();
        }
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_SELECT_APPLIED)) {
            statement.setString(1, facilityId.trim());
            statement.setString(2, streamKind.trim());
            try (ResultSet resultSet = statement.executeQuery()) {
                List<EventInboxRow> rows = new ArrayList<>();
                while (resultSet.next()) {
                    rows.add(new EventInboxRow(
                            resultSet.getString(1),
                            resultSet.getString(2),
                            resultSet.getString(3),
                            resultSet.getString(4),
                            toInstant(resultSet.getTimestamp(5)),
                            resultSet.getString(6),
                            toInstant(resultSet.getTimestamp(7)),
                            toInstant(resultSet.getTimestamp(8)),
                            toInstant(resultSet.getTimestamp(9)),
                            toInstant(resultSet.getTimestamp(10)),
                            resultSet.getString(11),
                            resultSet.getString(12),
                            resultSet.getString(13),
                            resultSet.getString(14)));
                }
                return List.copyOf(rows);
            }
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to load applied ORCA push events", ex);
        }
    }

    public boolean isApplied(String facilityId, String streamKind, String eventUuid) {
        if (isBlank(facilityId) || isBlank(streamKind) || isBlank(eventUuid) || dataSource == null) {
            return false;
        }
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_SELECT_APPLIED_FLAG)) {
            statement.setString(1, facilityId.trim());
            statement.setString(2, streamKind.trim());
            statement.setString(3, eventUuid.trim());
            try (ResultSet resultSet = statement.executeQuery()) {
                return resultSet.next() && resultSet.getTimestamp(1) != null;
            }
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to inspect ORCA push event inbox", ex);
        }
    }

    private void updateTimestampStatus(String sql, String facilityId, String streamKind, String eventUuid, Instant when,
            String lastRecoveryRunId, String errorCode, String errorMessage) {
        requireText(facilityId, "facilityId");
        requireText(streamKind, "streamKind");
        requireText(eventUuid, "eventUuid");
        Instant effectiveWhen = when != null ? when : Instant.now();
        try (Connection connection = requireDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setTimestamp(1, Timestamp.from(effectiveWhen));
            if (SQL_MARK_FAILED.equals(sql)) {
                statement.setString(2, normalize(errorCode));
                statement.setString(3, normalize(errorMessage));
                statement.setString(4, normalize(lastRecoveryRunId));
                statement.setString(5, facilityId.trim());
                statement.setString(6, streamKind.trim());
                statement.setString(7, eventUuid.trim());
            } else {
                statement.setString(2, normalize(lastRecoveryRunId));
                statement.setString(3, facilityId.trim());
                statement.setString(4, streamKind.trim());
                statement.setString(5, eventUuid.trim());
            }
            statement.executeUpdate();
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to update ORCA push event inbox", ex);
        }
    }

    private DataSource requireDataSource() {
        if (dataSource == null) {
            throw new IllegalStateException("PostgresDS is not available for ORCA push event inbox store");
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

    public record EventInboxRow(
            String facilityId,
            String streamKind,
            String eventUuid,
            String eventName,
            Instant eventTime,
            String status,
            Instant receivedAt,
            Instant fetchedAt,
            Instant appliedAt,
            Instant failedAt,
            String errorCode,
            String errorMessage,
            String payloadJson,
            String lastRecoveryRunId
    ) {
    }
}
