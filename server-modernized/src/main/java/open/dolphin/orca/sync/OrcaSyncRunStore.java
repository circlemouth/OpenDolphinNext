package open.dolphin.orca.sync;

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
public class OrcaSyncRunStore {

    private static final String SQL_INSERT = """
            INSERT INTO opendolphin.d_orca_sync_run (
                run_id, facility_id, stream_kind, trigger, requested_at, requested_count, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """;

    private static final String SQL_UPDATE_STATE = """
            UPDATE opendolphin.d_orca_sync_run
               SET requested_count = COALESCE(?, requested_count),
                   started_at = COALESCE(?, started_at),
                   finished_at = COALESCE(?, finished_at),
                   fetched_count = ?,
                   applied_count = ?,
                   failed_count = ?,
                   skipped_count = ?,
                   status = ?,
                   error_code = ?,
                   error_message = ?
             WHERE run_id = ?
            """;

    private static final String SQL_SELECT = """
            SELECT run_id, facility_id, stream_kind, trigger, requested_at, started_at, finished_at,
                   requested_count, fetched_count, applied_count, failed_count, skipped_count,
                   status, error_code, error_message
              FROM opendolphin.d_orca_sync_run
             WHERE run_id = ?
            """;

    private static final String SQL_SELECT_LATEST = """
            SELECT run_id, facility_id, stream_kind, trigger, requested_at, started_at, finished_at,
                   requested_count, fetched_count, applied_count, failed_count, skipped_count,
                   status, error_code, error_message
              FROM opendolphin.d_orca_sync_run
             WHERE facility_id = ? AND stream_kind = ?
             ORDER BY requested_at DESC
             LIMIT 1
            """;

    @Resource(lookup = "java:jboss/datasources/PostgresDS")
    DataSource dataSource;

    public void createRequested(String runId, String facilityId, String streamKind, String trigger, Instant requestedAt, int requestedCount) {
        requireText(runId, "runId");
        requireText(facilityId, "facilityId");
        requireText(streamKind, "streamKind");
        requireText(trigger, "trigger");
        Instant effectiveRequestedAt = requestedAt != null ? requestedAt : Instant.now();
        try (Connection connection = requireDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_INSERT)) {
            statement.setString(1, runId.trim());
            statement.setString(2, facilityId.trim());
            statement.setString(3, streamKind.trim());
            statement.setString(4, trigger.trim());
            statement.setTimestamp(5, Timestamp.from(effectiveRequestedAt));
            statement.setInt(6, Math.max(requestedCount, 0));
            statement.setString(7, "requested");
            statement.executeUpdate();
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to create ORCA sync run", ex);
        }
    }

    public void markFetching(String runId, Instant startedAt) {
        update(runId, null, startedAt, null, 0, 0, 0, 0, "fetching", null, null);
    }

    public void markFetching(String runId, int requestedCount, Instant startedAt) {
        update(runId, requestedCount, startedAt, null, 0, 0, 0, 0, "fetching", null, null);
    }

    public void markApplying(String runId, int fetchedCount) {
        update(runId, null, null, null, Math.max(fetchedCount, 0), 0, 0, 0, "applying", null, null);
    }

    public void markApplying(String runId, int requestedCount, int fetchedCount) {
        update(runId, requestedCount, null, null, Math.max(fetchedCount, 0), 0, 0, 0, "applying", null, null);
    }

    public void markCompleted(String runId, Instant finishedAt, int fetchedCount, int appliedCount, int skippedCount) {
        update(runId, null, null, finishedAt, Math.max(fetchedCount, 0), Math.max(appliedCount, 0), 0, Math.max(skippedCount, 0),
                "completed", null, null);
    }

    public void markCompleted(String runId, int requestedCount, Instant finishedAt, int fetchedCount, int appliedCount,
            int skippedCount) {
        update(runId, requestedCount, null, finishedAt, Math.max(fetchedCount, 0), Math.max(appliedCount, 0), 0,
                Math.max(skippedCount, 0), "completed", null, null);
    }

    public void markPartial(String runId, Instant finishedAt, int fetchedCount, int appliedCount, int failedCount, int skippedCount,
            String errorCode, String errorMessage) {
        update(runId, null, null, finishedAt, Math.max(fetchedCount, 0), Math.max(appliedCount, 0), Math.max(failedCount, 0),
                Math.max(skippedCount, 0), "partial", normalize(errorCode), normalize(errorMessage));
    }

    public void markPartial(String runId, int requestedCount, Instant finishedAt, int fetchedCount, int appliedCount,
            int failedCount, int skippedCount, String errorCode, String errorMessage) {
        update(runId, requestedCount, null, finishedAt, Math.max(fetchedCount, 0), Math.max(appliedCount, 0),
                Math.max(failedCount, 0), Math.max(skippedCount, 0), "partial", normalize(errorCode), normalize(errorMessage));
    }

    public void markFailed(String runId, Instant finishedAt, int fetchedCount, int failedCount, String errorCode, String errorMessage) {
        update(runId, null, null, finishedAt, Math.max(fetchedCount, 0), 0, Math.max(failedCount, 0), 0,
                "failed", normalize(errorCode), normalize(errorMessage));
    }

    public void markFailed(String runId, int requestedCount, Instant finishedAt, int fetchedCount, int failedCount,
            String errorCode, String errorMessage) {
        update(runId, requestedCount, null, finishedAt, Math.max(fetchedCount, 0), 0, Math.max(failedCount, 0), 0,
                "failed", normalize(errorCode), normalize(errorMessage));
    }

    public RunRow load(String runId) {
        if (isBlank(runId) || dataSource == null) {
            return null;
        }
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_SELECT)) {
            statement.setString(1, runId.trim());
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    return null;
                }
                return new RunRow(
                        resultSet.getString(1),
                        resultSet.getString(2),
                        resultSet.getString(3),
                        resultSet.getString(4),
                        resultSet.getTimestamp(5).toInstant(),
                        toInstant(resultSet.getTimestamp(6)),
                        toInstant(resultSet.getTimestamp(7)),
                        resultSet.getInt(8),
                        resultSet.getInt(9),
                        resultSet.getInt(10),
                        resultSet.getInt(11),
                        resultSet.getInt(12),
                        resultSet.getString(13),
                        resultSet.getString(14),
                        resultSet.getString(15));
            }
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to load ORCA sync run", ex);
        }
    }

    public RunRow findLatest(String facilityId, String streamKind) {
        if (isBlank(facilityId) || isBlank(streamKind) || dataSource == null) {
            return null;
        }
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_SELECT_LATEST)) {
            statement.setString(1, facilityId.trim());
            statement.setString(2, streamKind.trim());
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    return null;
                }
                return new RunRow(
                        resultSet.getString(1),
                        resultSet.getString(2),
                        resultSet.getString(3),
                        resultSet.getString(4),
                        resultSet.getTimestamp(5).toInstant(),
                        toInstant(resultSet.getTimestamp(6)),
                        toInstant(resultSet.getTimestamp(7)),
                        resultSet.getInt(8),
                        resultSet.getInt(9),
                        resultSet.getInt(10),
                        resultSet.getInt(11),
                        resultSet.getInt(12),
                        resultSet.getString(13),
                        resultSet.getString(14),
                        resultSet.getString(15));
            }
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to load latest ORCA sync run", ex);
        }
    }

    private void update(String runId, Integer requestedCount, Instant startedAt, Instant finishedAt, int fetchedCount,
            int appliedCount, int failedCount, int skippedCount, String status, String errorCode, String errorMessage) {
        requireText(runId, "runId");
        requireText(status, "status");
        try (Connection connection = requireDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_UPDATE_STATE)) {
            statement.setObject(1, requestedCount);
            statement.setObject(2, startedAt != null ? Timestamp.from(startedAt) : null);
            statement.setObject(3, finishedAt != null ? Timestamp.from(finishedAt) : null);
            statement.setInt(4, fetchedCount);
            statement.setInt(5, appliedCount);
            statement.setInt(6, failedCount);
            statement.setInt(7, skippedCount);
            statement.setString(8, status);
            statement.setString(9, errorCode);
            statement.setString(10, errorMessage);
            statement.setString(11, runId.trim());
            statement.executeUpdate();
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to update ORCA sync run", ex);
        }
    }

    private DataSource requireDataSource() {
        if (dataSource == null) {
            throw new IllegalStateException("PostgresDS is not available for ORCA sync run store");
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

    public record RunRow(
            String runId,
            String facilityId,
            String streamKind,
            String trigger,
            Instant requestedAt,
            Instant startedAt,
            Instant finishedAt,
            int requestedCount,
            int fetchedCount,
            int appliedCount,
            int failedCount,
            int skippedCount,
            String status,
            String errorCode,
            String errorMessage
    ) {
    }
}
