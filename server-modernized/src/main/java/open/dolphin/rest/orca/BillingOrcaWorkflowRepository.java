package open.dolphin.rest.orca;

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
public class BillingOrcaWorkflowRepository {

    private static final String SQL_UPSERT_SNAPSHOT = """
            INSERT INTO opendolphin.d_billing_orca_snapshot (
                facility_id, encounter_key, patient_id, schedule_key, snapshot_version, state, snapshot_json, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, cast(? as jsonb), CURRENT_TIMESTAMP)
            ON CONFLICT (facility_id, encounter_key, snapshot_version) DO UPDATE SET
                patient_id = EXCLUDED.patient_id,
                schedule_key = EXCLUDED.schedule_key,
                state = EXCLUDED.state,
                snapshot_json = EXCLUDED.snapshot_json,
                updated_at = CURRENT_TIMESTAMP
            RETURNING snapshot_id, facility_id, encounter_key, patient_id, schedule_key, snapshot_version, state
            """;

    private static final String SQL_FIND_TRANSMISSION = """
            SELECT transmission_id, snapshot_id, facility_id, encounter_key, idempotency_key, state,
                   medical_uid, api_result, api_result_message, http_status, request_id, trace_id
              FROM opendolphin.d_billing_orca_transmission
             WHERE facility_id = ?
               AND encounter_key = ?
               AND idempotency_key = ?
            """;

    private static final String SQL_FIND_REVIEW_TRANSMISSIONS = """
            SELECT t.transmission_id, t.snapshot_id, t.facility_id, t.encounter_key, t.idempotency_key, t.state,
                   t.medical_uid, t.api_result, t.api_result_message, t.http_status, t.request_id, t.trace_id,
                   s.patient_id, s.schedule_key, t.started_at, t.completed_at, s.snapshot_json::text
              FROM opendolphin.d_billing_orca_transmission t
              JOIN opendolphin.d_billing_orca_snapshot s
                ON s.snapshot_id = t.snapshot_id
             WHERE t.facility_id = ?
               AND t.state IN ('ORCA_UNKNOWN', 'ORCA_FAILED', 'CORRECTION_REQUIRED')
             ORDER BY t.started_at DESC, t.transmission_id DESC
             LIMIT ?
            """;

    private static final String SQL_FIND_REVIEW_TRANSMISSION_BY_ID = """
            SELECT t.transmission_id, t.snapshot_id, t.facility_id, t.encounter_key, t.idempotency_key, t.state,
                   t.medical_uid, t.api_result, t.api_result_message, t.http_status, t.request_id, t.trace_id,
                   s.patient_id, s.schedule_key, t.started_at, t.completed_at, s.snapshot_json::text
              FROM opendolphin.d_billing_orca_transmission t
              JOIN opendolphin.d_billing_orca_snapshot s
                ON s.snapshot_id = t.snapshot_id
             WHERE t.facility_id = ?
               AND t.transmission_id = ?
               AND t.state IN ('ORCA_UNKNOWN', 'ORCA_FAILED', 'CORRECTION_REQUIRED')
            """;

    private static final String SQL_INSERT_TRANSMISSION = """
            INSERT INTO opendolphin.d_billing_orca_transmission (
                snapshot_id, facility_id, encounter_key, idempotency_key, state, request_id, trace_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            RETURNING transmission_id, snapshot_id, facility_id, encounter_key, idempotency_key, state,
                      medical_uid, api_result, api_result_message, http_status, request_id, trace_id
            """;

    private static final String SQL_COMPLETE_TRANSMISSION = """
            UPDATE opendolphin.d_billing_orca_transmission
               SET state = ?,
                   medical_state = ?,
                   medical_uid = ?,
                   api_result = ?,
                   api_result_message = ?,
                   http_status = ?,
                   completed_at = CURRENT_TIMESTAMP,
                   error_code = ?,
                   error_message = ?,
                   response_json = cast(? as jsonb)
             WHERE transmission_id = ?
            """;

    private static final String SQL_UPDATE_SNAPSHOT_STATE = """
            UPDATE opendolphin.d_billing_orca_snapshot
               SET state = ?,
                   updated_at = CURRENT_TIMESTAMP
             WHERE snapshot_id = ?
            """;

    @Resource(lookup = "java:jboss/datasources/PostgresDS")
    DataSource dataSource;

    public SnapshotRecord upsertSnapshot(String facilityId, String encounterKey, String patientId, String scheduleKey,
            long snapshotVersion, String state, String snapshotJson) {
        try (Connection connection = requireDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_UPSERT_SNAPSHOT)) {
            statement.setString(1, require(facilityId, "facilityId"));
            statement.setString(2, require(encounterKey, "encounterKey"));
            statement.setString(3, require(patientId, "patientId"));
            statement.setString(4, normalize(scheduleKey));
            statement.setLong(5, snapshotVersion);
            statement.setString(6, require(state, "state"));
            statement.setString(7, snapshotJson != null && !snapshotJson.isBlank() ? snapshotJson : "{}");
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    throw new IllegalStateException("Failed to upsert billing ORCA snapshot");
                }
                return mapSnapshot(resultSet);
            }
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to upsert billing ORCA snapshot", ex);
        }
    }

    public TransmissionRecord findTransmission(String facilityId, String encounterKey, String idempotencyKey) {
        if (normalize(facilityId) == null || normalize(encounterKey) == null || normalize(idempotencyKey) == null
                || dataSource == null) {
            return null;
        }
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_FIND_TRANSMISSION)) {
            statement.setString(1, facilityId.trim());
            statement.setString(2, encounterKey.trim());
            statement.setString(3, idempotencyKey.trim());
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    return null;
                }
                return mapTransmission(resultSet);
            }
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to load billing ORCA transmission", ex);
        }
    }

    public List<TransmissionReviewRecord> findReviewTransmissions(String facilityId, int limit) {
        if (normalize(facilityId) == null || dataSource == null) {
            return List.of();
        }
        int safeLimit = Math.max(1, Math.min(limit, 100));
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_FIND_REVIEW_TRANSMISSIONS)) {
            statement.setString(1, facilityId.trim());
            statement.setInt(2, safeLimit);
            try (ResultSet resultSet = statement.executeQuery()) {
                List<TransmissionReviewRecord> records = new ArrayList<>();
                while (resultSet.next()) {
                    records.add(mapTransmissionReview(resultSet));
                }
                return records;
            }
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to load billing ORCA review transmissions", ex);
        }
    }

    public TransmissionReviewRecord findReviewTransmission(String facilityId, long transmissionId) {
        if (normalize(facilityId) == null || transmissionId <= 0 || dataSource == null) {
            return null;
        }
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_FIND_REVIEW_TRANSMISSION_BY_ID)) {
            statement.setString(1, facilityId.trim());
            statement.setLong(2, transmissionId);
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    return null;
                }
                return mapTransmissionReview(resultSet);
            }
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to load billing ORCA review transmission", ex);
        }
    }

    public TransmissionRecord insertTransmission(long snapshotId, String facilityId, String encounterKey,
            String idempotencyKey, String state, String requestId, String traceId) {
        try (Connection connection = requireDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_INSERT_TRANSMISSION)) {
            statement.setLong(1, snapshotId);
            statement.setString(2, require(facilityId, "facilityId"));
            statement.setString(3, require(encounterKey, "encounterKey"));
            statement.setString(4, require(idempotencyKey, "idempotencyKey"));
            statement.setString(5, require(state, "state"));
            statement.setString(6, normalize(requestId));
            statement.setString(7, normalize(traceId));
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    throw new IllegalStateException("Failed to create billing ORCA transmission");
                }
                return mapTransmission(resultSet);
            }
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to create billing ORCA transmission", ex);
        }
    }

    public void completeTransmission(long transmissionId, String state, String medicalUid, String apiResult,
            String apiResultMessage, Integer httpStatus, String errorCode, String errorMessage, String responseJson) {
        try (Connection connection = requireDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_COMPLETE_TRANSMISSION)) {
            statement.setString(1, require(state, "state"));
            statement.setString(2, state);
            statement.setString(3, normalize(medicalUid));
            statement.setString(4, normalize(apiResult));
            statement.setString(5, truncate(normalize(apiResultMessage), 512));
            if (httpStatus != null) {
                statement.setInt(6, httpStatus);
            } else {
                statement.setObject(6, null);
            }
            statement.setString(7, normalize(errorCode));
            statement.setString(8, truncate(normalize(errorMessage), 512));
            statement.setString(9, responseJson != null && !responseJson.isBlank() ? responseJson : "{}");
            statement.setLong(10, transmissionId);
            statement.executeUpdate();
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to complete billing ORCA transmission", ex);
        }
    }

    public void updateSnapshotState(long snapshotId, String state) {
        try (Connection connection = requireDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_UPDATE_SNAPSHOT_STATE)) {
            statement.setString(1, require(state, "state"));
            statement.setLong(2, snapshotId);
            statement.executeUpdate();
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to update billing ORCA snapshot state", ex);
        }
    }

    private DataSource requireDataSource() {
        if (dataSource == null) {
            throw new IllegalStateException("PostgresDS is not available for billing ORCA workflow repository");
        }
        return dataSource;
    }

    private SnapshotRecord mapSnapshot(ResultSet resultSet) throws SQLException {
        return new SnapshotRecord(
                resultSet.getLong(1),
                resultSet.getString(2),
                resultSet.getString(3),
                resultSet.getString(4),
                resultSet.getString(5),
                resultSet.getLong(6),
                resultSet.getString(7));
    }

    private TransmissionRecord mapTransmission(ResultSet resultSet) throws SQLException {
        return new TransmissionRecord(
                resultSet.getLong(1),
                resultSet.getLong(2),
                resultSet.getString(3),
                resultSet.getString(4),
                resultSet.getString(5),
                resultSet.getString(6),
                resultSet.getString(7),
                resultSet.getString(8),
                resultSet.getString(9),
                (Integer) resultSet.getObject(10),
                resultSet.getString(11),
                resultSet.getString(12));
    }

    private TransmissionReviewRecord mapTransmissionReview(ResultSet resultSet) throws SQLException {
        Timestamp startedAt = resultSet.getTimestamp(15);
        Timestamp completedAt = resultSet.getTimestamp(16);
        return new TransmissionReviewRecord(
                resultSet.getLong(1),
                resultSet.getLong(2),
                resultSet.getString(3),
                resultSet.getString(4),
                resultSet.getString(5),
                resultSet.getString(6),
                resultSet.getString(7),
                resultSet.getString(8),
                resultSet.getString(9),
                (Integer) resultSet.getObject(10),
                resultSet.getString(11),
                resultSet.getString(12),
                resultSet.getString(13),
                resultSet.getString(14),
                startedAt != null ? startedAt.toInstant() : null,
                completedAt != null ? completedAt.toInstant() : null,
                resultSet.getString(17));
    }

    private static String require(String value, String label) {
        String normalized = normalize(value);
        if (normalized == null) {
            throw new IllegalArgumentException(label + " is required");
        }
        return normalized;
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String truncate(String value, int max) {
        if (value == null || value.length() <= max) {
            return value;
        }
        return value.substring(0, max);
    }

    public record SnapshotRecord(
            long snapshotId,
            String facilityId,
            String encounterKey,
            String patientId,
            String scheduleKey,
            long snapshotVersion,
            String state
    ) {
    }

    public record TransmissionRecord(
            long transmissionId,
            long snapshotId,
            String facilityId,
            String encounterKey,
            String idempotencyKey,
            String state,
            String medicalUid,
            String apiResult,
            String apiResultMessage,
            Integer httpStatus,
            String requestId,
            String traceId
    ) {
    }

    public record TransmissionReviewRecord(
            long transmissionId,
            long snapshotId,
            String facilityId,
            String encounterKey,
            String idempotencyKey,
            String state,
            String medicalUid,
            String apiResult,
            String apiResultMessage,
            Integer httpStatus,
            String requestId,
            String traceId,
            String patientId,
            String scheduleKey,
            Instant startedAt,
            Instant completedAt,
            String snapshotJson
    ) {
    }
}
